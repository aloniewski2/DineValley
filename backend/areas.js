// Anywhere-search: turn a ZIP code into a place list.
//
// The home region is baked into data/places.json at deploy time and answers
// instantly. For anywhere else the server queries Overpass once, normalises the
// result through the same pipeline, and keeps it — in memory and on disk — so
// the second visitor to a given area pays nothing and OpenStreetMap isn't asked
// the same question twice.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { fetchElements, normalise } from "./osm.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = join(HERE, "data", "cache");
const TTL_MS = 7 * 24 * 60 * 60 * 1000;      // OSM moves slowly; a week is fine
// An empty answer is far more likely to be an Overpass hiccup than a genuinely
// foodless 20km circle, so it expires quickly and gets retried.
const EMPTY_TTL_MS = 30 * 60 * 1000;
const MAX_MEMORY_AREAS = 40;
const DEFAULT_RADIUS = 20000;

let zips = null;
const memory = new Map();                     // key -> { center, places, at }
const inflight = new Map();                   // key -> Promise, so bursts share one query

/** A place from any area we've fetched this session, for the details route. */
export function findCached(id) {
  for (const entry of memory.values()) {
    const hit = entry.places.find((p) => p.id === id);
    if (hit) return hit;
  }
  return null;
}

export async function loadZips() {
  if (zips) return zips;
  zips = JSON.parse(await readFile(join(HERE, "data", "zips.json"), "utf8"));
  return zips;
}

/** "18015" -> {lat,lng}; null if it isn't a real US ZIP. */
export function centerForZip(zip) {
  const key = String(zip || "").trim();
  if (!/^\d{5}$/.test(key) || !zips) return null;
  const hit = zips[key];
  return hit ? { lat: hit[0], lng: hit[1], zip: key } : null;
}

// Areas are cached on a coarse grid: two searches a few hundred metres apart
// are the same query as far as Overpass is concerned.
const keyFor = (lat, lng, radius) =>
  `${lat.toFixed(2)}_${lng.toFixed(2)}_${Math.round(radius / 1000)}`;

const distanceKm = (a, b) => {
  const R = 6371, toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

async function readDisk(key) {
  try {
    const raw = JSON.parse(await readFile(join(CACHE_DIR, `${key}.json`), "utf8"));
    const ttl = raw.places?.length ? TTL_MS : EMPTY_TTL_MS;
    if (Date.now() - new Date(raw.at).getTime() > ttl) return null;
    return raw;
  } catch {
    return null;
  }
}

async function writeDisk(key, payload) {
  try {
    await mkdir(CACHE_DIR, { recursive: true });
    await writeFile(join(CACHE_DIR, `${key}.json`), JSON.stringify(payload), "utf8");
  } catch (err) {
    console.warn("area cache write failed:", err.message);   // non-fatal
  }
}

function remember(key, payload) {
  memory.set(key, payload);
  if (memory.size > MAX_MEMORY_AREAS) memory.delete(memory.keys().next().value);
}

/**
 * Places around a point. `baked` is the deploy-time dataset; when the request
 * lands inside it we use it rather than querying anything.
 */
export async function areaFor({ lat, lng, radius = DEFAULT_RADIUS }, baked) {
  const center = { lat, lng };

  if (baked?.places?.length) {
    const home = baked.center;
    // Inside the baked footprint (minus a margin so edge searches still get a
    // full ring of results) the local dataset is strictly better: instant.
    if (distanceKm(home, center) * 1000 < Math.max(0, (baked.radiusMeters ?? DEFAULT_RADIUS) - radius / 2)) {
      return { center: home, places: baked.places, source: "local" };
    }
  }

  const key = keyFor(lat, lng, radius);
  const ttlFor = (entry) => (entry.places.length ? TTL_MS : EMPTY_TTL_MS);
  const fresh = (entry) => Date.now() - new Date(entry.at).getTime() < ttlFor(entry);

  const hot = memory.get(key);
  if (hot && fresh(hot)) return { center, places: hot.places, source: "cache" };
  if (inflight.has(key)) return inflight.get(key);

  const job = (async () => {
    const onDisk = await readDisk(key);
    if (onDisk) {
      remember(key, onDisk);
      return { center, places: onDisk.places, source: "cache" };
    }
    let places;
    try {
      places = normalise(await fetchElements(lat, lng, radius));
    } catch (err) {
      // Don't poison the cache with a failure — let the caller say so.
      const e = new Error(`OpenStreetMap didn't answer for this area (${err.message})`);
      e.code = "AREA_UNAVAILABLE";
      throw e;
    }
    const payload = { center, places, at: new Date().toISOString() };
    remember(key, payload);
    await writeDisk(key, payload);
    return { center, places, source: "overpass" };
  })();

  inflight.set(key, job);
  try {
    return await job;
  } finally {
    inflight.delete(key);
  }
}

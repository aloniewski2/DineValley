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
// A 20km circle over Manhattan is ~18,000 places. Holding them all costs more
// memory than a small host has, and the request that fetched them took the
// whole process down. The UI only ever pages 20 at a time, so keep the closest
// slice to the search centre and discard the rest.
const MAX_PLACES_PER_AREA = 1500;
const DEFAULT_RADIUS = 20000;
// How far inside the baked footprint a search has to be to be answered from it.
// Results are paged 20 at a time nearest-first, so a few km of cover around the
// search point is plenty; this only rules out searches sitting on the edge.
const EDGE_MARGIN = 3000;

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
/** Keep the nearest MAX_PLACES_PER_AREA results; dense cities blow past it. */
function trimToRadius(places, lat, lng) {
  if (places.length <= MAX_PLACES_PER_AREA) return places;
  const d2 = (p) => (p.lat - lat) ** 2 + (p.lng - lng) ** 2;
  return places.sort((a, b) => d2(a) - d2(b)).slice(0, MAX_PLACES_PER_AREA);
}

export async function areaFor({ lat, lng, radius = DEFAULT_RADIUS }, baked) {
  const center = { lat, lng };

  if (baked?.places?.length) {
    const home = baked.center;
    // Inside the baked footprint the local dataset is strictly better: it is
    // instant, and it cannot be rate-limited. Only the outer ring is excluded,
    // where a search would be missing the half of its neighbourhood that falls
    // outside the bake.
    //
    // The old margin was radius/2 -- half the *search* radius, not the bake's.
    // With both at 20km that admitted only the inner 10km, which put Bethlehem
    // (10.4-10.7km out) on the live path: the app's own home city queried
    // Overpass for restaurants that were already sitting in memory.
    const bakedRadius = baked.radiusMeters ?? DEFAULT_RADIUS;
    if (distanceKm(home, center) * 1000 <= Math.max(0, bakedRadius - EDGE_MARGIN)) {
      // Centre on what was actually searched, not on home. searchPlaces filters
      // by distance from this point, so returning `home` here made every ZIP in
      // the valley return the same Allentown-centred list -- the ZIP the visitor
      // typed changed nothing.
      return { center, places: baked.places, source: "local" };
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
      // One request, capped at the source. Asking twice — tight radius then
      // wide — reads better but gets the second query rate-limited by every
      // Overpass mirror, which broke rural searches entirely.
      places = trimToRadius(normalise(await fetchElements(lat, lng, radius)), lat, lng);
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

/**
 * Store an area that somebody else fetched from Overpass.
 *
 * Overpass rate-limits by IP, and a free host's egress address is shared with
 * everyone else on it, so the server can be refused for an area a visitor's own
 * browser is served happily. When that happens the browser fetches the area and
 * hands the raw elements here: they go through the same normalise/trim/cache
 * path as a server-side fetch, so a place fetched this way is shaped exactly
 * like any other -- and the next visitor to that area is served from cache
 * without anyone querying anything.
 */
export function storeArea({ lat, lng, radius = DEFAULT_RADIUS }, elements) {
  const center = { lat, lng };
  const places = trimToRadius(normalise(elements), lat, lng);
  const key = keyFor(lat, lng, radius);
  const payload = { center, places, at: new Date().toISOString() };
  remember(key, payload);
  void writeDisk(key, payload);
  return { center, places, source: "browser" };
}

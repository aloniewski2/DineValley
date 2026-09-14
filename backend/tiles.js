// Places for anywhere in the country, from pre-baked tiles.
//
// scripts/build-tiles.mjs turns OpenStreetMap extracts into half-degree tiles
// of normalised places and they are published as static files. A search fetches
// the few tiles its radius touches, keeps them in memory, and filters by
// distance. Nothing is queried live, so there is no mirror to hang and no
// rate limit to hit — the two things that made searching outside the home
// region unreliable.

import { distanceMeters } from "./places.js";

export const TILE_DEG = 0.5;

/** Grid key for a coordinate: tiles are half a degree on a side. */
export const tileKey = (lat, lng) =>
  `${Math.floor(lat / TILE_DEG)}_${Math.floor(lng / TILE_DEG)}`;

// Where the tiles live. Overridable so a fork can host its own build.
const TILE_BASE = (process.env.PLACES_TILE_BASE ||
  "https://aloniewski2.github.io/dinevalley-data").replace(/\/$/, "");

// A tile of downtown Manhattan is a few MB; forty of them is more than a small
// host should hold. Least recently used goes first.
const MAX_TILES_IN_MEMORY = 24;
const FETCH_TIMEOUT_MS = 8000;

/* The builder drops null fields, empty lists and the derivable OSM link to
 * keep tiles small; a place is only handed onward in the full shape the rest
 * of the server -- and the frontend -- expect. */
const LISTS = ["types", "cuisine", "dietary"];
const NULLABLE = ["priceLevel", "phone", "website", "openingHours", "brand", "wheelchair"];
function hydrate(p) {
  for (const k of LISTS) p[k] ??= [];
  for (const k of NULLABLE) p[k] ??= null;
  p.address ??= "";
  p.osmUrl ??= `https://www.openstreetmap.org/${p.id}`;
  return p;
}

const memory = new Map();                     // key -> place[] | null (null = known empty)
const inflight = new Map();                   // key -> Promise

/* A missing tile means "no restaurants here" -- but only if the tile set is
 * actually there. Without this check a tile host that is down, or a build
 * that has not been published yet, would look exactly like an empty country,
 * and the caller would serve confident empty lists instead of falling back.
 * The index is small and fetched once; a failure is retried next time. */
let ready = null;
function tileSetReady() {
  ready ??= (async () => {
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(`${TILE_BASE}/index.json`, { signal: abort.signal });
      if (!res.ok) throw new Error(`tile index: HTTP ${res.status}`);
      const index = await res.json();
      if (!index.tiles) throw new Error("tile index is empty");
      return index;
    } catch (err) {
      ready = null;
      throw err;
    } finally {
      clearTimeout(timer);
    }
  })();
  return ready;
}

function remember(key, places) {
  memory.delete(key);                         // re-insert so it becomes most recent
  memory.set(key, places);
  if (memory.size > MAX_TILES_IN_MEMORY) memory.delete(memory.keys().next().value);
}

async function fetchTile(key) {
  if (memory.has(key)) {
    const hit = memory.get(key);
    remember(key, hit);
    return hit;
  }
  if (inflight.has(key)) return inflight.get(key);

  const job = (async () => {
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(`${TILE_BASE}/tiles/${key}.json`, { signal: abort.signal });
      // Most of the grid is ocean, forest or farmland with no file at all:
      // a 404 is the normal answer for an empty tile, not a failure.
      if (res.status === 404) { remember(key, null); return null; }
      if (!res.ok) throw new Error(`tile ${key}: HTTP ${res.status}`);
      const { places } = await res.json();
      const hydrated = places.map(hydrate);
      remember(key, hydrated);
      return hydrated;
    } finally {
      clearTimeout(timer);
      inflight.delete(key);
    }
  })();
  inflight.set(key, job);
  return job;
}

/** Keys of every tile a circle of `radius` metres around a point can touch. */
export function tilesCovering(lat, lng, radius) {
  const dLat = radius / 111320;
  const dLng = radius / (111320 * Math.max(Math.cos((lat * Math.PI) / 180), 0.01));
  const keys = [];
  for (let r = Math.floor((lat - dLat) / TILE_DEG); r <= Math.floor((lat + dLat) / TILE_DEG); r++) {
    for (let c = Math.floor((lng - dLng) / TILE_DEG); c <= Math.floor((lng + dLng) / TILE_DEG); c++) {
      keys.push(`${r}_${c}`);
    }
  }
  return keys;
}

/**
 * Every baked place within `radius` of a point, nearest first. Throws if a
 * tile could not be fetched, so the caller can fall back rather than serve a
 * confidently empty list.
 */
export async function placesAround({ lat, lng, radius }) {
  await tileSetReady();
  const center = { lat, lng };
  const tiles = await Promise.all(tilesCovering(lat, lng, radius).map(fetchTile));
  const out = [];
  for (const places of tiles) {
    if (!places) continue;
    for (const p of places) if (distanceMeters(center, p) <= radius) out.push(p);
  }
  return out.sort((a, b) => distanceMeters(center, a) - distanceMeters(center, b));
}

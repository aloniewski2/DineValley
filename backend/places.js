// Local places index — the free replacement for Google Places.
//
// Data comes from OpenStreetMap via scripts/build-places.mjs and is served
// straight out of memory: no API key, no quota, no per-request cost, and no
// network round trip. The response shapes below are byte-for-byte what the
// Google-backed endpoints used to return, so the frontend is unchanged.

import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import OpeningHours from "opening_hours";

const HERE = dirname(fileURLToPath(import.meta.url));
const PAGE_SIZE = 20;                     // Google's Nearby Search page size

let dataset = { places: [], center: { lat: 40.6084, lng: -75.4902 }, attribution: "", generatedAt: null };

export async function loadPlaces() {
  const raw = await readFile(join(HERE, "data", "places.json"), "utf8");
  dataset = JSON.parse(raw);
  for (const p of dataset.places) p._search = searchText(p);
  return dataset;
}

export const meta = () => ({
  count: dataset.places.length,
  generatedAt: dataset.generatedAt,
  attribution: dataset.attribution,
  center: dataset.center,
});

const searchText = (p) =>
  [p.name, p.brand, p.address, ...p.types, ...p.cuisine, ...p.dietary]
    .filter(Boolean).join(" ").toLowerCase();

function distanceMeters(a, b) {
  const R = 6371000, toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/* --- opening hours -------------------------------------------------------
   OSM stores hours as a spec string ("Mo-Th,Su 11:30-23:00; Fr-Sa ..."),
   which the opening_hours library turns into real intervals. That gives us
   both `openNow` filtering and the weekday list the details page renders. */
const NOMINATIM_STUB = { address: { country_code: "us", state: "Pennsylvania" }, lat: 40.6, lon: -75.5 };
const ohCache = new Map();

function parseHours(spec) {
  if (!spec) return null;
  if (ohCache.has(spec)) return ohCache.get(spec);
  let parsed = null;
  try {
    parsed = new OpeningHours(spec, NOMINATIM_STUB);
  } catch {
    parsed = null;                        // malformed spec — treat as unknown
  }
  ohCache.set(spec, parsed);
  return parsed;
}

export function isOpenNow(place, now = new Date()) {
  const oh = parseHours(place.openingHours);
  if (!oh) return null;                   // unknown, not "closed"
  try { return oh.getState(now); } catch { return null; }
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const hhmm = (d) => `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;

export function weekdayText(place) {
  const oh = parseHours(place.openingHours);
  if (!oh) return place.openingHours ? [place.openingHours] : [];

  const out = [];
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  for (let i = 0; i < 7; i++) {
    const from = new Date(start.getTime() + i * 86400000);
    const to = new Date(from.getTime() + 86400000);
    let intervals = [];
    try {
      intervals = oh.getOpenIntervals(from, to);
    } catch { /* fall through to Closed */ }

    const label = DAYS[from.getDay()];
    const spans = intervals
      .map(([a, b]) => hhmm(a) + " – " + hhmm(b >= to ? new Date(b - 1) : b))
      .join(", ");
    out.push(intervals.length ? `${label}: ${spans}` : `${label}: Closed`);
  }
  return out;
}

/* --- the endpoints' data ------------------------------------------------- */

// Google gave every place a photo; OSM gives none. Rather than ship broken
// <img> tags (the old source.unsplash.com fallback now 503s), each place gets
// a generated SVG card keyed to its cuisine — deterministic, instant, free.
export const photoUrl = (baseUrl, place) =>
  `${baseUrl}/place-photo/${encodeURIComponent(place.id)}`;

export function searchPlaces({ keyword, minPrice, maxPrice, openNow, radius, pageToken } = {}) {
  const center = dataset.center;
  const maxRadius = Number.isFinite(Number(radius)) ? Number(radius) : 20000;
  const terms = String(keyword || "").toLowerCase().split(/\s+/).filter(Boolean);
  const min = Number.isFinite(Number(minPrice)) ? Number(minPrice) : null;
  const max = Number.isFinite(Number(maxPrice)) ? Number(maxPrice) : null;
  const wantOpen = openNow === true || openNow === "true";

  let matches = dataset.places.filter((p) => {
    if (distanceMeters(center, p) > maxRadius) return false;
    if (terms.length && !terms.every((t) => p._search.includes(t))) return false;
    if (min !== null || max !== null) {
      if (p.priceLevel === null) return false;          // unknown price, like Google
      if (min !== null && p.priceLevel < min) return false;
      if (max !== null && p.priceLevel > max) return false;
    }
    if (wantOpen && isOpenNow(p) !== true) return false;
    return true;
  });

  // Google ordered by "prominence"; the closest analogue we can compute is how
  // completely a place is described — a fully tagged restaurant is a better
  // result than a bare name on a map.
  const completeness = (p) =>
    (p.address ? 2 : 0) + (p.cuisine.length ? 2 : 0) + (p.openingHours ? 2 : 0) +
    (p.website ? 1 : 0) + (p.phone ? 1 : 0) + (p.dietary.length ? 1 : 0);

  matches.sort((a, b) => completeness(b) - completeness(a) || a.name.localeCompare(b.name));

  const offset = Number.parseInt(pageToken, 10) || 0;
  const page = matches.slice(offset, offset + PAGE_SIZE);
  const next = offset + PAGE_SIZE < matches.length ? String(offset + PAGE_SIZE) : null;

  return { matches: page, total: matches.length, nextPageToken: next };
}

export const toCard = (place, baseUrl) => ({
  id: place.id,
  name: place.name,
  imageUrl: photoUrl(baseUrl, place),
  rating: 0,                       // OSM has no ratings — the UI hides zeroes
  reviewCount: 0,
  address: place.address,
  priceLevel: place.priceLevel,
  businessStatus: "OPERATIONAL",
  types: place.types,
  dietary: place.dietary,
  openNow: isOpenNow(place),
});

export function findPlace(id) {
  return dataset.places.find((p) => p.id === id) || null;
}

export const toDetails = (place, baseUrl) => ({
  id: place.id,
  name: place.name,
  rating: null,
  address: place.address,
  phone: place.phone ?? undefined,
  website: place.website ?? undefined,
  openingHours: weekdayText(place),
  reviews: [],
  imageUrl: photoUrl(baseUrl, place),
  photoUrls: [photoUrl(baseUrl, place)],
  googleMapsUrl: `https://www.openstreetmap.org/?mlat=${place.lat}&mlon=${place.lng}#map=18/${place.lat}/${place.lng}`,
  mapImageUrl: `${baseUrl}/map-image?lat=${place.lat}&lng=${place.lng}`,
  coordinates: { lat: place.lat, lng: place.lng },
  types: place.types,
  dietary: place.dietary,
  openNow: isOpenNow(place),
  reviewSummary: { total: 0, average: null },
  attribution: dataset.attribution,
});

/* --- generated artwork ---------------------------------------------------- */
const PALETTE = [
  ["#ff7a5c", "#ffd166"], ["#4a7fd6", "#89c2ff"], ["#3fa15a", "#b7e4a0"],
  ["#c05fd6", "#ffc4f0"], ["#e0913a", "#ffe0a3"], ["#2b9fa8", "#a5e8ec"],
];

export function placeholderSvg(place) {
  const seed = [...place.id].reduce((a, c) => a + c.codePointAt(0), 0);
  const [from, to] = PALETTE[seed % PALETTE.length];
  const label = (place.cuisine[0] || place.types[0] || "food").replaceAll("_", " ");
  const initial = place.name.trim()[0]?.toUpperCase() || "?";
  const esc = (s) => String(s).replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]));

  return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300" role="img" aria-label="${esc(place.name)}">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/>
  </linearGradient></defs>
  <rect width="400" height="300" fill="url(#g)"/>
  <circle cx="200" cy="128" r="58" fill="rgba(255,255,255,.22)"/>
  <text x="200" y="150" font-family="Georgia,serif" font-size="64" font-weight="bold"
        fill="#fff" text-anchor="middle">${esc(initial)}</text>
  <text x="200" y="228" font-family="system-ui,sans-serif" font-size="17" letter-spacing="2"
        fill="rgba(255,255,255,.92)" text-anchor="middle">${esc(label.toUpperCase())}</text>
</svg>`;
}

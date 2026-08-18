#!/usr/bin/env node
// Builds backend/data/places.json from OpenStreetMap via the Overpass API.
//
//   npm run data:build              # default: 20km around Allentown, PA
//   npm run data:build -- 40.6 -75.4 25000
//
// Free, no API key, no quota. Re-run whenever you want fresher data — OSM in
// the Lehigh Valley is actively maintained, so this is worth doing monthly.

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const [latArg, lngArg, radiusArg] = process.argv.slice(2);

// Arguments are positional, so a stray flag like --help used to land in latArg,
// become NaN, and quietly produce an empty dataset that looked like a
// successful build. Refuse to run rather than write nonsense.
for (const [name, value] of [["latitude", latArg], ["longitude", lngArg], ["radius", radiusArg]]) {
  if (value !== undefined && !Number.isFinite(Number(value))) {
    console.error(`Bad ${name}: ${JSON.stringify(value)}\n` +
      `Usage: node scripts/build-places.mjs [lat] [lng] [radiusMeters]`);
    process.exit(1);
  }
}

const LAT = Number(latArg ?? 40.6084);
const LNG = Number(lngArg ?? -75.4902);
const RADIUS = Number(radiusArg ?? 20000);

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "data", "places.json");

// Overpass mirrors, tried in order — the main instance rate-limits under load.
const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.osm.ch/api/interpreter",
];

const AMENITIES = "restaurant|cafe|fast_food|bar|pub|ice_cream";
const QUERY = `
[out:json][timeout:120];
(
  node["amenity"~"^(${AMENITIES})$"](around:${RADIUS},${LAT},${LNG});
  way ["amenity"~"^(${AMENITIES})$"](around:${RADIUS},${LAT},${LNG});
);
out center tags;`;

async function overpass() {
  let lastError;
  for (const url of ENDPOINTS) {
    try {
      process.stdout.write(`  querying ${new URL(url).host}… `);
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded", "user-agent": "dinevalley/1.0" },
        body: new URLSearchParams({ data: QUERY }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      console.log(`${json.elements.length} elements`);
      return json.elements;
    } catch (err) {
      console.log(`failed (${err.message})`);
      lastError = err;
    }
  }
  throw lastError;
}

// Google returned an opaque `types` array; keep the same shape so the frontend
// filters keep working, built out of the OSM tags that carry real meaning.
function typesOf(tags) {
  const out = new Set();
  if (tags.amenity) out.add(tags.amenity);
  for (const c of (tags.cuisine || "").split(";")) if (c) out.add(c.trim());
  if (tags.takeaway === "yes") out.add("takeaway");
  if (tags.delivery === "yes") out.add("delivery");
  if (tags.outdoor_seating === "yes") out.add("outdoor_seating");
  if (tags.drive_through === "yes") out.add("drive_through");
  if (tags.reservation) out.add("reservations");
  return [...out];
}

const dietOf = (tags) =>
  Object.entries(tags)
    .filter(([k, v]) => k.startsWith("diet:") && (v === "yes" || v === "only"))
    .map(([k]) => k.slice(5));

function addressOf(tags) {
  const line = [tags["addr:housenumber"], tags["addr:street"]].filter(Boolean).join(" ");
  const city = [tags["addr:city"], tags["addr:state"]].filter(Boolean).join(", ");
  return [line, city].filter(Boolean).join(", ") || tags["addr:full"] || "";
}

// Chains have predictable price points; everything else is left null rather
// than invented, and the UI hides the field when it's null.
// Objects rather than [regex, level] tuples: in a mixed tuple array the level
// infers as RegExp|number, which makes priceOf() look polymorphic to analysers.
const CHAIN_PRICE = [
  { re: /mcdonald|burger king|wendy|taco bell|subway|dunkin|kfc|popeyes|arby|sonic|dairy queen|domino|little caesars/i, level: 1 },
  { re: /chipotle|panera|five guys|chick-fil-a|shake shack|starbucks|jersey mike|wawa|sheetz/i, level: 2 },
  { re: /applebee|olive garden|chili's|red robin|texas roadhouse|outback|cheesecake/i, level: 2 },
];

// Always returns a number; 0 means "no idea". The caller maps that back to
// null so data/places.json keeps its `priceLevel: number | null` shape.
function priceOf(tags) {
  const name = tags.name || "";
  for (const { re, level } of CHAIN_PRICE) if (re.test(name)) return level;
  if (tags.amenity === "fast_food") return 1;
  return 0;
}

const elements = await (async () => {
  console.log(`Fetching food & drink within ${RADIUS / 1000}km of ${LAT},${LNG}`);
  return overpass();
})();

const seen = new Set();
const places = [];

for (const el of elements) {
  const tags = el.tags || {};
  const name = (tags.name || "").trim();
  if (!name) continue;                                  // unnamed nodes are useless to a diner

  const lat = el.lat ?? el.center?.lat;
  const lng = el.lon ?? el.center?.lon;
  if (lat == null || lng == null) continue;

  // The same restaurant is sometimes mapped as both a node and a building way.
  const key = `${name.toLowerCase()}|${lat.toFixed(3)}|${lng.toFixed(3)}`;
  if (seen.has(key)) continue;
  seen.add(key);

  places.push({
    id: `${el.type}/${el.id}`,
    name,
    address: addressOf(tags),
    lat,
    lng,
    types: typesOf(tags),
    cuisine: (tags.cuisine || "").split(";").filter(Boolean),
    dietary: dietOf(tags),
    priceLevel: priceOf(tags) || null,
    phone: tags.phone || tags["contact:phone"] || null,
    website: tags.website || tags["contact:website"] || null,
    openingHours: tags.opening_hours || null,
    brand: tags.brand || null,
    wheelchair: tags.wheelchair || null,
    osmUrl: `https://www.openstreetmap.org/${el.type}/${el.id}`,
  });
}

places.sort((a, b) => a.name.localeCompare(b.name));

await mkdir(dirname(OUT), { recursive: true });
if (places.length === 0) {
  console.error(
    "Overpass returned no places. Refusing to overwrite data/places.json —\n" +
    "the previous dataset is still in place. Check the coordinates and retry."
  );
  process.exit(1);
}

await writeFile(
  OUT,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      center: { lat: LAT, lng: LNG },
      radiusMeters: RADIUS,
      attribution: "© OpenStreetMap contributors (ODbL)",
      count: places.length,
      places,
    },
    null,
    1
  ),
  "utf8"
);

const has = (f) => places.filter((place) => f(place)).length;
console.log(`\nWrote ${places.length} places to data/places.json`);
console.log(`  cuisine       ${has((p) => p.cuisine.length)}`);
console.log(`  address       ${has((p) => p.address)}`);
console.log(`  opening hours ${has((p) => p.openingHours)}`);
console.log(`  phone         ${has((p) => p.phone)}`);
console.log(`  website       ${has((p) => p.website)}`);

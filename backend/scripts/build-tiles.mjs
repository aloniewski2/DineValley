#!/usr/bin/env node
// Bake every restaurant in a set of OpenStreetMap extracts into geographic
// tiles, so the server never has to ask Overpass at request time.
//
//   node scripts/build-tiles.mjs <pbf-dir> <out-dir>
//
// Needs osmium-tool on PATH (brew install osmium-tool). For each *.osm.pbf in
// <pbf-dir> it keeps only the amenities the app knows about, exports them as
// GeoJSON, runs every feature through the same normaliser the live path uses,
// and writes <out-dir>/tiles/<row>_<col>.json on a half-degree grid plus an
// index.json describing the build. Nationwide the tiles are a few hundred MB
// in total, and a search touches at most a handful of them.
//
// Why bake rather than query: Overpass's public mirrors answer the same query
// in five seconds one minute and hang for ninety the next, rate-limit after a
// handful of requests, and the one free host this runs on shares its egress
// address with strangers. A visitor typing a ZIP outside the home region got a
// spinner and then an error more often than a list. Static tiles fetched from
// a CDN are sub-second, need no key, and cannot be rate-limited.

import { execFileSync } from "node:child_process";
import { createReadStream } from "node:fs";
import { mkdir, readdir, writeFile, stat } from "node:fs/promises";
import { createInterface } from "node:readline";
import { basename, join } from "node:path";
import { normalise } from "../osm.js";
import { TILE_DEG, tileKey } from "../tiles.js";

const [pbfDir, outDir] = process.argv.slice(2);
if (!pbfDir || !outDir) {
  console.error("Usage: node scripts/build-tiles.mjs <pbf-dir> <out-dir>");
  process.exit(1);
}

// Same set osm.js queries, spelled the way osmium's filter wants it.
const AMENITY_FILTER = "nwr/amenity=restaurant,cafe,fast_food,bar,pub,ice_cream";

/* osmium export emits one GeoJSON feature per object; with `id` and `type`
 * attributes on, each carries "@id" and "@type". A named restaurant mapped as
 * a building comes out as a polygon: take the centroid, which is what
 * Overpass's `out center` would have given the live path. */
function centroid(geometry) {
  if (geometry.type === "Point") return { lat: geometry.coordinates[1], lng: geometry.coordinates[0] };
  const ring =
    geometry.type === "Polygon" ? geometry.coordinates[0] :
    geometry.type === "MultiPolygon" ? geometry.coordinates[0][0] :
    geometry.type === "LineString" ? geometry.coordinates : null;
  if (!ring?.length) return null;
  let lat = 0, lng = 0;
  for (const [x, y] of ring) { lng += x; lat += y; }
  return { lat: lat / ring.length, lng: lng / ring.length };
}

/** A GeoJSON feature as the Overpass element normalise() expects. */
function toElement(feature) {
  const c = centroid(feature.geometry);
  if (!c) return null;
  const { "@id": id, "@type": type, ...tags } = feature.properties ?? {};
  const kind = type === "node" ? "node" : type === "way" ? "way" : "relation";
  return { type: kind, id, lat: c.lat, lon: c.lng, tags };
}

async function* featuresOf(geojsonseq) {
  const rl = createInterface({ input: createReadStream(geojsonseq), crlfDelay: Infinity });
  for await (const line of rl) {
    const s = line.replace(/^\x1e/, "").trim();      // RS-delimited per RFC 8142
    if (s) yield JSON.parse(s);
  }
}

const work = join(outDir, "work");
const tilesDir = join(outDir, "tiles");
await mkdir(work, { recursive: true });
await mkdir(tilesDir, { recursive: true });

// osmium needs a config file to emit ids; keep it next to the work files.
const exportConfig = join(work, "export.json");
await writeFile(exportConfig, JSON.stringify({
  attributes: { type: true, id: true },
  linear_tags: true,
  area_tags: true,
}));

const tiles = new Map();                        // key -> place[]
const seenIds = new Set();                      // objects can straddle two state extracts
let total = 0;

const files = (await readdir(pbfDir)).filter((f) => f.endsWith(".osm.pbf")).sort();
for (const file of files) {
  const src = join(pbfDir, file);
  const stem = basename(file, ".osm.pbf");
  const filtered = join(work, `${stem}.filtered.pbf`);
  const seq = join(work, `${stem}.geojsonseq`);
  const t0 = Date.now();

  // Skip work already done: a re-run after a failure picks up where it left off.
  if (!(await stat(seq).catch(() => null))) {
    execFileSync("osmium", ["tags-filter", "--overwrite", "-o", filtered, src, AMENITY_FILTER], { stdio: "inherit" });
    execFileSync("osmium", ["export", "--overwrite", "-f", "geojsonseq", "-c", exportConfig, "-o", seq, filtered], { stdio: "inherit" });
  }

  let n = 0;
  const elements = [];
  for await (const f of featuresOf(seq)) {
    const el = toElement(f);
    if (el) elements.push(el);
  }
  for (const p of normalise(elements)) {
    if (seenIds.has(p.id)) continue;
    seenIds.add(p.id);
    const key = tileKey(p.lat, p.lng);
    if (!tiles.has(key)) tiles.set(key, []);
    tiles.get(key).push(p);
    n++;
  }
  total += n;
  console.log(`${stem.padEnd(24)} ${String(n).padStart(7)} places  (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
}

/* Tiles are fetched over the network on every cold search, so they carry
 * only what cannot be derived: null fields and the osm.openstreetmap.org link
 * are put back by tiles.js on load. Roughly halves the bytes. */
const compact = (p) => {
  const out = {};
  for (const [k, v] of Object.entries(p)) {
    if (v === null || k === "osmUrl") continue;
    if (Array.isArray(v) && v.length === 0) continue;
    out[k] = v;
  }
  return out;
};

let bytes = 0;
for (const [key, places] of tiles) {
  places.sort((a, b) => a.name.localeCompare(b.name));
  const body = JSON.stringify({ key, count: places.length, places: places.map(compact) });
  bytes += body.length;
  await writeFile(join(tilesDir, `${key}.json`), body);
}

const index = {
  generatedAt: new Date().toISOString(),
  attribution: "© OpenStreetMap contributors (ODbL)",
  tileDegrees: TILE_DEG,
  tiles: tiles.size,
  places: total,
  sources: files,
};
await writeFile(join(outDir, "index.json"), JSON.stringify(index, null, 1));
console.log(`\n${total} places in ${tiles.size} tiles, ${(bytes / 1e6).toFixed(0)} MB → ${tilesDir}`);

#!/usr/bin/env node
// Builds data/zips.json — every US ZIP code with its centroid, so a search can
// start from a postcode without calling a geocoding service at request time.
//
//   node scripts/build-zips.mjs
//
// Source: US Census ZCTA Gazetteer (public domain). Coordinates are rounded to
// three decimals (~110 m), which is far finer than a postcode centroid means.

import { writeFile, mkdir } from "node:fs/promises";
import { inflateRawSync } from "node:zlib";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const URL_ = "https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2023_Gazetteer/2023_Gaz_zcta_national.zip";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "data", "zips.json");

// Minimal ZIP reader: this archive holds a single member, so the local file
// header is enough and we avoid pulling in a dependency just to unzip once.
function firstMember(buf) {
  if (buf.readUInt32LE(0) !== 0x04034b50) throw new Error("Not a ZIP archive");
  const method = buf.readUInt16LE(8);
  const compressedSize = buf.readUInt32LE(18);
  const nameLen = buf.readUInt16LE(26);
  const extraLen = buf.readUInt16LE(28);
  const start = 30 + nameLen + extraLen;
  const body = buf.subarray(start, start + compressedSize);
  return method === 0 ? body : inflateRawSync(body);
}

console.log("Downloading Census ZCTA gazetteer…");
const res = await fetch(URL_, { headers: { "user-agent": "dinevalley-build" } });
if (!res.ok) throw new Error(`${res.status} fetching gazetteer`);
const text = firstMember(Buffer.from(await res.arrayBuffer())).toString("utf8");

const lines = text.split(/\r?\n/).filter(Boolean);
const header = lines[0].split("\t").map((h) => h.trim());
const iZip = header.indexOf("GEOID");
const iLat = header.indexOf("INTPTLAT");
const iLng = header.indexOf("INTPTLONG");
if (iZip < 0 || iLat < 0 || iLng < 0) throw new Error(`Unexpected columns: ${header.join(",")}`);

const zips = {};
for (const line of lines.slice(1)) {
  const cols = line.split("\t");
  const zip = (cols[iZip] || "").trim();
  const lat = Number(cols[iLat]);
  const lng = Number(cols[iLng]);
  if (!/^\d{5}$/.test(zip) || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;
  zips[zip] = [Number(lat.toFixed(3)), Number(lng.toFixed(3))];
}

const count = Object.keys(zips).length;
if (count < 30000) throw new Error(`Only parsed ${count} ZIPs — refusing to write a partial file`);

await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, JSON.stringify(zips), "utf8");
console.log(`Wrote ${count} ZIP centroids to data/zips.json`);

// The browser-assisted area fetch.
//
// Overpass rate-limits by IP, and a free host's egress address is shared with
// every other tenant on it, so mirrors that answer a visitor's browser can
// refuse this server for the same query. When that happens the page fetches the
// area itself and posts the elements back. These tests pin the part that makes
// that safe: whatever a client sends goes through the same normaliser as a
// server-side fetch, and is then served like any other cached area — without
// touching the network.

import test from "node:test";
import assert from "node:assert/strict";

import { areaFor, storeArea } from "./areas.js";

const PORTLAND = { lat: 45.509, lng: -122.688, radius: 20000 };

const node = (id, name, over = {}) => ({
  type: "node",
  id,
  lat: PORTLAND.lat + (over.dLat ?? 0),
  lon: PORTLAND.lng + (over.dLng ?? 0),
  tags: { amenity: "restaurant", name, ...(over.tags ?? {}) },
});

test("an area the browser fetched is normalised and then served from cache", async () => {
  const here = { ...PORTLAND, lat: 45.6 };
  const stored = storeArea(here, [node(1, "Poblano Pepper"), node(2, "Sumo Sushi")]);
  assert.equal(stored.places.length, 2);
  assert.equal(stored.source, "browser");

  // No network: a live fetch here would need one, and the test would hang or
  // throw rather than return in microseconds.
  const served = await areaFor(here, null);
  assert.equal(served.source, "cache");
  assert.deepEqual(
    served.places.map((p) => p.name).sort(),
    ["Poblano Pepper", "Sumo Sushi"],
  );
});

test("it keeps the centre that was searched, not the baked one", async () => {
  const here = { ...PORTLAND, lat: 45.7 };
  const served = storeArea(here, [node(3, "Canary")]);
  assert.equal(served.center.lat, here.lat);
  assert.equal(served.center.lng, here.lng);
});

test("elements without a name or a position are dropped, not stored", () => {
  const here = { ...PORTLAND, lat: 45.8 };
  const stored = storeArea(here, [
    node(4, "Real Place"),
    { type: "node", id: 5, lat: 45.8, lon: -122.6, tags: { amenity: "restaurant" } }, // no name
    { type: "node", id: 6, tags: { amenity: "cafe", name: "Nowhere" } },              // no position
  ]);
  assert.deepEqual(stored.places.map((p) => p.name), ["Real Place"]);
});

test("a place fetched by the browser is shaped like any other place", () => {
  const here = { ...PORTLAND, lat: 45.9 };
  const [place] = storeArea(here, [
    node(7, "Tender Greens", { tags: { cuisine: "salad", "addr:city": "Portland" } }),
  ]).places;
  for (const field of ["id", "name", "lat", "lng", "types", "cuisine"]) {
    assert.ok(field in place, `missing ${field}`);
  }
});

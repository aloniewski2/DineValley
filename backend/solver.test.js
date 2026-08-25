// The rules the solver must not quietly break.
//
// The one that matters most: a sparse attribute may rank a place, but it may
// never exclude one. Nine places in the dataset carry a `dietary` tag, so a
// solver that filtered on it would answer "there is nowhere vegan in the
// Lehigh Valley" — confidently, and wrongly. Several tests below exist only to
// stop that regressing.

import test from "node:test";
import assert from "node:assert/strict";

import { decide, TRAVEL_SPEEDS, WEIGHTS } from "./solver.js";

const CENTER = { lat: 40.6, lng: -75.49 };

/* Roughly a kilometre north per 0.009 degrees of latitude — near enough for
   fixtures, and the real haversine still does the measuring. */
const at = (kmNorth, over = {}) => ({
  id: `n/${kmNorth}-${over.name ?? ""}`,
  name: over.name ?? `Place ${kmNorth}km`,
  lat: CENTER.lat + kmNorth * 0.009,
  lng: CENTER.lng,
  address: "1 Main St, Allentown, PA",
  types: ["restaurant"],
  cuisine: [],
  dietary: [],
  priceLevel: null,
  phone: null,
  website: null,
  openingHours: null,
  brand: null,
  ...over,
});

const run = (places, opts = {}) => decide({ places, center: CENTER, ...opts });

test("the travel budget is a real distance, not a radius guess", () => {
  const places = [at(1), at(5), at(50)];
  // 15 minutes of walking is 1.2 km, so only the first place is reachable.
  const walk = run(places, { mode: "walk", maxMinutes: 15 });
  assert.equal(walk.results.length, 1);
  assert.equal(walk.results[0].place.name, "Place 1km");

  // The same 15 minutes by car reaches 9 km.
  const drive = run(places, { mode: "drive", maxMinutes: 15 });
  assert.equal(drive.results.length, 2);
});

test("a requested dietary tag ranks a place but never excludes one", () => {
  const places = [at(5, { name: "Untagged" }), at(6, { name: "Vegan Spot", dietary: ["vegan"] })];
  const { results } = run(places, { dietary: ["vegan"], maxMinutes: 30 });

  // Both survive — this is the whole point.
  assert.equal(results.length, 2, "an untagged place must not be filtered out");
  // But the tagged one wins despite being further away.
  assert.equal(results[0].place.name, "Vegan Spot");
  const untagged = results.find((r) => r.place.name === "Untagged");
  assert.ok(
    untagged.reasons.some((r) => r.kind === "unknown" && r.label.includes("vegan")),
    "an untagged place must say the tag is unknown rather than staying silent"
  );
});

test("unknown hours keep a place; a known closure removes it", () => {
  const unknown = at(2, { name: "No Hours" });
  const closed = at(2, { name: "Closed", openingHours: "Mo-Su 03:00-04:00" });
  const open = at(2, { name: "Open", openingHours: "Mo-Su 00:00-24:00" });

  const { results } = run([unknown, closed, open], { openNow: true, maxMinutes: 30 });
  const names = results.map((r) => r.place.name);

  assert.ok(names.includes("No Hours"), "unknown is not the same as closed");
  assert.ok(names.includes("Open"));
  assert.ok(!names.includes("Closed"), "a known closure is real information and should filter");
});

test("unknown price keeps a place; a known overshoot removes it", () => {
  const unknown = at(2, { name: "No Price" });
  const cheap = at(2, { name: "Cheap", priceLevel: 1 });
  const pricey = at(2, { name: "Pricey", priceLevel: 3 });

  const names = run([unknown, cheap, pricey], { maxPrice: 1, maxMinutes: 30 })
    .results.map((r) => r.place.name);

  assert.ok(names.includes("No Price"));
  assert.ok(names.includes("Cheap"));
  assert.ok(!names.includes("Pricey"));
});

test("independent-only excludes branded chains", () => {
  const places = [at(2, { name: "Local" }), at(2, { name: "Chipotle", brand: "Chipotle" })];
  const names = run(places, { independentOnly: true, maxMinutes: 30 })
    .results.map((r) => r.place.name);
  assert.deepEqual(names, ["Local"]);
});

test("cuisine matches either the cuisine list or the type tags", () => {
  const viaCuisine = at(2, { name: "By Cuisine", cuisine: ["pizza"] });
  const viaType = at(2, { name: "By Type", types: ["restaurant", "pizza"] });
  const neither = at(2, { name: "Neither", cuisine: ["sushi"] });

  const names = run([viaCuisine, viaType, neither], { cuisines: ["pizza"], maxMinutes: 30 })
    .results.map((r) => r.place.name);

  assert.ok(names.includes("By Cuisine") && names.includes("By Type"));
  assert.ok(!names.includes("Neither"));
});

test("kinds group the tags a visitor would not think to distinguish", () => {
  const cafe = at(2, { name: "Cafe", types: ["cafe"] });
  const coffee = at(2, { name: "Coffee", types: ["coffee_shop"] });
  const bar = at(2, { name: "Bar", types: ["pub"] });

  const names = run([cafe, coffee, bar], { kinds: ["cafe"], maxMinutes: 30 })
    .results.map((r) => r.place.name);
  assert.deepEqual(names.sort(), ["Cafe", "Coffee"]);
});

test("every result explains itself, and the weights sum to one", () => {
  const total = Object.values(WEIGHTS).reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(total - 1) < 1e-9, `weights sum to ${total}, so the score is not a percentage`);

  const { results } = run([at(2, { name: "Somewhere", cuisine: ["pizza"], priceLevel: 1 })], {
    maxMinutes: 30,
  });
  const [top] = results;
  assert.ok(top.reasons.length > 0, "a score with no reasons is the thing we are avoiding");
  assert.ok(top.score >= 0 && top.score <= 100);
  for (const r of top.reasons) {
    assert.ok(["match", "bonus", "unknown", "miss"].includes(r.kind));
    assert.ok(typeof r.label === "string" && r.label.length > 0);
  }
});

test("a closer place beats a further one, all else equal", () => {
  const { results } = run([at(8, { name: "Far" }), at(1, { name: "Near" })], { maxMinutes: 30 });
  assert.equal(results[0].place.name, "Near");
});

test("a fully described place outranks a bare name at the same distance", () => {
  const bare = at(3, { name: "Bare", address: null });
  const full = at(3, {
    name: "Full",
    cuisine: ["italian"],
    openingHours: "Mo-Su 00:00-24:00",
    website: "https://example.com",
    phone: "555",
  });
  const { results } = run([bare, full], { maxMinutes: 30 });
  assert.equal(results[0].place.name, "Full");
});

test("walking is slower than driving, which is the only reason the mode exists", () => {
  assert.ok(TRAVEL_SPEEDS.walk < TRAVEL_SPEEDS.drive);
});

test("the limit caps results without hiding how many matched", () => {
  const places = Array.from({ length: 30 }, (_, i) => at(1 + i * 0.1, { name: `P${i}` }));
  const { results, considered } = run(places, { maxMinutes: 30, limit: 5 });
  assert.equal(results.length, 5);
  assert.equal(considered, 30, "the visitor should be able to be told what the 5 came out of");
});

test("a requested tag is a tier, not a nudge — untagged cannot outrank tagged", () => {
  // The first build returned McDonald's at rank two for a vegan search, on the
  // strength of being close and well described. Proximity must not be able to
  // buy its way above an actual match.
  const chain = at(0.5, {
    name: "McDonald's", brand: "McDonald's", priceLevel: 1,
    cuisine: ["burger"], openingHours: "Mo-Su 00:00-24:00",
    website: "https://mcdonalds.com", phone: "555",
  });
  const vegan = at(8, { name: "Vegan Far", dietary: ["vegan"] });

  const { results } = run([chain, vegan], { dietary: ["vegan"], maxMinutes: 30 });
  assert.equal(results[0].place.name, "Vegan Far", "a tagged match must outrank an untagged one");
  assert.equal(results.length, 2, "the untagged remainder still follows, labelled");
});

test("one entry per chain, so a shortlist is not three of the same brand", () => {
  const places = [
    at(1, { name: "Chipotle", brand: "Chipotle" }),
    at(2, { name: "Chipotle", brand: "Chipotle" }),
    at(3, { name: "Chipotle", brand: "Chipotle" }),
    at(4, { name: "Local Spot" }),
  ];
  const { results } = run(places, { maxMinutes: 30 });
  const names = results.map((r) => r.place.name);
  assert.equal(names.filter((n) => n === "Chipotle").length, 1, "a chain gets one slot");
  assert.ok(names.includes("Local Spot"));
});

test("independents are never collapsed together", () => {
  // They share no brand, so two unrelated places must both survive.
  const places = [at(1, { name: "Ann's" }), at(2, { name: "Bob's" })];
  const { results } = run(places, { maxMinutes: 30 });
  assert.equal(results.length, 2);
});

test("the nearest branch is the one a chain keeps", () => {
  const places = [
    at(9, { name: "Chipotle", brand: "Chipotle" }),
    at(1, { name: "Chipotle", brand: "Chipotle" }),
  ];
  const { results } = run(places, { maxMinutes: 30 });
  assert.equal(results.length, 1);
  // Assert on the measured distance rather than the rounded minutes, which
  // depend on the travel speed and would make this a test of arithmetic.
  assert.ok(results[0].metres < 2000, "the surviving branch should be the closest one");
});

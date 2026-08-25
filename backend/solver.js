// The decision engine — narrow a thousand places to a handful, and say why.
//
// This is the part that is not a worse Google Maps. Maps is better than us at
// "restaurants near me" and always will be. What it cannot do is take four
// people's constraints at once and return the short list that satisfies them,
// which is the question anyone actually has at 6pm on a Tuesday.
//
// The honest shape of that is set by how complete the data is, so it is worth
// writing the coverage down. Out of 1,032 places in the baked dataset:
//
//   lat/lng, types      100%     safe to filter on
//   address              85%
//   cuisine              66%     safe to filter on
//   brand (=> chain)     28%     absence means independent, 72% of the file
//   priceLevel           29%     too sparse to exclude on
//   openingHours         25%     too sparse to exclude on
//   takeaway             23%
//   dietary               1%     nine vegan places in the whole valley
//   wheelchair            0%     three records, total
//
// So the rule this module is built on: **sparse attributes rank, they never
// exclude.** Filtering on `dietary` would return an empty page and call it an
// answer. Instead a requested-but-unknown attribute keeps the place in the
// list, costs it some score, and is reported as unknown on the card — the
// visitor can see that we do not know rather than being told there is nothing.
//
// The one exception is a *known* negative. If OSM says a place is closed right
// now, and the visitor asked for open places, that is real information and the
// place is dropped. Unknown is not the same as no, and neither is the same as
// yes.

import { distanceMeters, isOpenNow } from "./places.js";

// Metres per minute. Walking is the standard 4.8 km/h; driving is deliberately
// a town speed rather than a highway one, because a 15-minute drive that
// assumes 60 km/h will put a result three towns away.
export const TRAVEL_SPEEDS = { walk: 80, drive: 600 };

// What each signal is worth. They sum to 1 so the score reads as a percentage,
// and every one of them turns into a line the card can show — a score nobody
// can decompose is the thing this project already refuses to ship elsewhere.
export const WEIGHTS = {
  proximity: 0.40,   // the constraint people actually feel
  open: 0.25,
  price: 0.15,
  described: 0.20,   // a fully tagged place is a better recommendation than a bare name
};

const KIND_TAGS = {
  restaurant: ["restaurant"],
  fast_food: ["fast_food"],
  cafe: ["cafe", "coffee_shop"],
  bar: ["bar", "pub"],
  dessert: ["ice_cream", "donut", "bakery"],
};

const has = (place, tag) => (place.types || []).includes(tag);

const matchesKind = (place, kinds) =>
  !kinds?.length || kinds.some((k) => (KIND_TAGS[k] || [k]).some((t) => has(place, t)));

const matchesCuisine = (place, cuisines) =>
  !cuisines?.length ||
  cuisines.some((c) => (place.cuisine || []).includes(c) || has(place, c));

/* How completely a place is described. A recommendation you cannot act on --
   no address, no hours, no cuisine -- is worse than one you can, even if it is
   marginally closer. Normalised to 0..1 so it can carry a weight. */
const describedness = (place) => {
  const points =
    (place.address ? 2 : 0) +
    (place.cuisine?.length ? 2 : 0) +
    (place.openingHours ? 2 : 0) +
    (place.website ? 1 : 0) +
    (place.phone ? 1 : 0);
  return points / 8;
};

/**
 * Narrow the dataset to the places that satisfy every hard constraint, then
 * rank what survives and explain each result.
 *
 * Hard constraints (a place is dropped): travel budget, venue kind, cuisine,
 * independent-only, and a *known* conflict on open-now or price.
 * Soft signals (a place is ranked): proximity, open, price, describedness,
 * plus any requested dietary tag.
 */
export function decide({
  places,
  center,
  maxMinutes = 15,
  mode = "drive",
  kinds = [],
  cuisines = [],
  independentOnly = false,
  openNow = false,
  maxPrice = null,
  dietary = [],
  limit = 8,
  now = new Date(),
} = {}) {
  const speed = TRAVEL_SPEEDS[mode] ?? TRAVEL_SPEEDS.drive;
  const budgetMeters = maxMinutes * speed;

  const scored = [];

  for (const place of places) {
    const metres = distanceMeters(center, place);
    if (metres > budgetMeters) continue;
    if (!matchesKind(place, kinds)) continue;
    if (!matchesCuisine(place, cuisines)) continue;
    if (independentOnly && place.brand) continue;

    const open = isOpenNow(place, now);          // true | false | null(unknown)
    if (openNow && open === false) continue;     // a known negative is real information

    const priceKnown = place.priceLevel !== null && place.priceLevel !== undefined;
    if (maxPrice !== null && priceKnown && place.priceLevel > maxPrice) continue;

    const reasons = [];

    // -- proximity ---------------------------------------------------------
    const minutes = Math.max(1, Math.round(metres / speed));
    const proximity = 1 - metres / budgetMeters;
    reasons.push({
      kind: "match",
      label: `${minutes} min ${mode === "walk" ? "walk" : "drive"}`,
      weight: WEIGHTS.proximity,
    });

    // -- open now ----------------------------------------------------------
    let openScore;
    if (open === true) {
      openScore = 1;
      reasons.push({ kind: "match", label: "open now", weight: WEIGHTS.open });
    } else if (open === null) {
      // Half credit, and said out loud. Silently scoring it zero would bury
      // three quarters of the valley for having no hours on OSM.
      openScore = 0.5;
      reasons.push({ kind: "unknown", label: "hours unknown", weight: WEIGHTS.open });
    } else {
      openScore = 0;
      reasons.push({ kind: "miss", label: "closed now", weight: WEIGHTS.open });
    }

    // -- price -------------------------------------------------------------
    let priceScore;
    if (priceKnown) {
      priceScore = place.priceLevel <= 1 ? 1 : 0.6;
      reasons.push({
        kind: "match",
        label: "$".repeat(Math.max(1, place.priceLevel)),
        weight: WEIGHTS.price,
      });
    } else {
      priceScore = 0.5;
      if (maxPrice !== null) {
        reasons.push({ kind: "unknown", label: "price unknown", weight: WEIGHTS.price });
      }
    }

    // -- dietary: a bonus, never a filter ----------------------------------
    // Nine vegan records in the whole file. Excluding on this would return an
    // empty page; ranking on it surfaces those nine first and admits the rest
    // are simply untagged.
    let dietaryBonus = 0;
    let dietaryMatched = false;
    for (const want of dietary) {
      if ((place.dietary || []).includes(want)) {
        dietaryMatched = true;
        dietaryBonus += 0.15;
        reasons.push({ kind: "bonus", label: `${want.replace("_", " ")} options`, weight: 0.15 });
      } else {
        reasons.push({ kind: "unknown", label: `${want.replace("_", " ")} not listed`, weight: 0 });
      }
    }

    if (independentOnly || !place.brand) {
      reasons.push({
        kind: place.brand ? "miss" : "bonus",
        label: place.brand ? `${place.brand} chain` : "independent",
        weight: 0,
      });
    }

    const described = describedness(place);
    const base =
      WEIGHTS.proximity * proximity +
      WEIGHTS.open * openScore +
      WEIGHTS.price * priceScore +
      WEIGHTS.described * described;

    scored.push({
      place,
      metres,
      minutes,
      dietaryMatched,
      score: Math.round(100 * Math.min(1, base + dietaryBonus)),
      reasons,
    });
  }

  /* Ask for vegan and the first build of this returned McDonald's at rank two,
     on the strength of being close and well described. A 15% bonus cannot
     outweigh proximity, and "vegan not listed" sitting second is exactly the
     confidently-useless answer this rewrite exists to stop.

     So a requested tag is a tier, not a nudge. Everything that actually
     carries the tag sorts above everything that does not, and the untagged
     remainder still follows — labelled — because nine tagged places in the
     valley is not a long enough list to be someone's only answer. */
  const tier = (r) => (dietary.length && r.dietaryMatched ? 1 : 0);
  scored.sort((a, b) => tier(b) - tier(a) || b.score - a.score || a.metres - b.metres);

  /* One entry per chain. Three Chipotles in a four-item shortlist is three
     wasted slots — the visitor has already decided about Chipotle. Independent
     places have no brand and are never collapsed. */
  const seenBrand = new Set();
  const results = [];
  for (const r of scored) {
    const brand = r.place.brand;
    if (brand) {
      if (seenBrand.has(brand)) continue;
      seenBrand.add(brand);
    }
    results.push(r);
    if (results.length >= limit) break;
  }

  return { results, considered: scored.length, matchedTag: scored.filter((r) => r.dietaryMatched).length };
}

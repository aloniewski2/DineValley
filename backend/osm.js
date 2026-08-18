// Talking to OpenStreetMap: one Overpass query, one normaliser.
//
// Shared deliberately. The build script bakes a dataset for the home region at
// deploy time, and the server calls the same functions when a visitor searches
// somewhere it has no data for. One code path means a place fetched live is
// shaped exactly like a place that was baked in.

const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.osm.ch/api/interpreter",
];

const AMENITIES = "restaurant|cafe|fast_food|bar|pub|ice_cream";

export function overpassQuery(lat, lng, radius) {
  return `
[out:json][timeout:60];
(
  node["amenity"~"^(${AMENITIES})$"](around:${radius},${lat},${lng});
  way ["amenity"~"^(${AMENITIES})$"](around:${radius},${lat},${lng});
);
out center tags;`;
}

export async function fetchElements(lat, lng, radius, { log = () => {} } = {}) {
  let lastError;
  for (const url of ENDPOINTS) {
    try {
      log(`  querying ${new URL(url).host}… `);
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          "user-agent": "dinevalley/1.0 (portfolio project)",
        },
        body: new URLSearchParams({ data: overpassQuery(lat, lng, radius) }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();

      // Overpass reports overload in-band: HTTP 200 with a `remark` and no
      // elements. Taking that at face value looks exactly like "this area has
      // no restaurants", so treat it as a failure and try the next mirror.
      if (json.remark) throw new Error(`overpass remark: ${json.remark.slice(0, 80)}`);
      if (!json.elements?.length) throw new Error("no elements returned");

      log(`${json.elements.length} elements\n`);
      return json.elements;
    } catch (err) {
      log(`failed (${err.message})\n`);
      lastError = err;
    }
  }
  throw lastError ?? new Error("No Overpass endpoint responded");
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
// than invented, and the UI hides the field when it's null. Objects rather than
// [regex, level] tuples so the level infers as a number.
const CHAIN_PRICE = [
  { re: /mcdonald|burger king|wendy|taco bell|subway|dunkin|kfc|popeyes|arby|sonic|dairy queen|domino|little caesars/i, level: 1 },
  { re: /chipotle|panera|five guys|chick-fil-a|shake shack|starbucks|jersey mike|wawa|sheetz/i, level: 2 },
  { re: /applebee|olive garden|chili's|red robin|texas roadhouse|outback|cheesecake/i, level: 2 },
];

// Always returns a number; 0 means "no idea", which the caller maps to null.
function priceOf(tags) {
  const name = tags.name || "";
  for (const { re, level } of CHAIN_PRICE) if (re.test(name)) return level;
  if (tags.amenity === "fast_food") return 1;
  return 0;
}

export function normalise(elements) {
  const seen = new Set();
  const places = [];

  for (const el of elements) {
    const tags = el.tags || {};
    const name = (tags.name || "").trim();
    if (!name) continue;                                // unnamed nodes are useless to a diner

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
      wheelchair: tags.wheelchair || null,
    });
  }
  return places;
}

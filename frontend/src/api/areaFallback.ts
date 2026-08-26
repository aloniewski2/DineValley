/**
 * When the server can't reach OpenStreetMap, the browser goes instead.
 *
 * Overpass rate-limits by IP. A free host's egress address is shared with every
 * other tenant on it, so the mirrors that answer a visitor's laptop in a few
 * seconds can refuse our server for exactly the same query -- which is why a ZIP
 * outside the baked region worked in local development and failed in
 * production. The visitor's own address has no such history.
 *
 * So on AREA_UNAVAILABLE the page fetches the area itself and posts the raw
 * elements back, where they are normalised and cached like any other area. The
 * next person to search there is served from that cache without anyone querying
 * anything -- one visitor's request repairs the area for everyone.
 */

const API_BASE =
  typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE_URL
    ? import.meta.env.VITE_API_BASE_URL.replace(/\/$/, "")
    : "https://dinevalley-backend.onrender.com";

/** The centre the server failed on, handed back with its 503. */
export interface UnavailableArea {
  lat: number;
  lng: number;
  radius?: number;
}

/**
 * These coordinates arrive in a response body and then go into a request URL,
 * so they are held to what a coordinate can actually be before they travel any
 * further. A centre off the globe is not a centre.
 */
export function unavailableAreaOf(body: unknown): UnavailableArea | null {
  const b = body as { code?: string; area?: Partial<UnavailableArea> } | null;
  if (!b || b.code !== "AREA_UNAVAILABLE") return null;
  const { lat, lng, radius } = b.area ?? {};
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat as number) > 90 || Math.abs(lng as number) > 180) return null;
  const bounded =
    Number.isFinite(radius) && (radius as number) > 0
      ? Math.min(50000, Math.round(radius as number))
      : undefined;
  return { lat: lat as number, lng: lng as number, radius: bounded };
}

const ENDPOINT_TIMEOUT_MS = 25000;

async function askOverpass(endpoints: string[], query: string): Promise<unknown[]> {
  let lastError: unknown = null;
  for (const url of endpoints) {
    const abort = new AbortController();
    const timer = window.setTimeout(() => abort.abort(), ENDPOINT_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ data: query }),
        signal: abort.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      // Overpass reports overload in-band: 200 with a `remark` and no elements.
      // Taking that at face value looks exactly like "nowhere to eat here".
      if (json.remark) throw new Error(String(json.remark).slice(0, 80));
      if (!Array.isArray(json.elements) || json.elements.length === 0) {
        throw new Error("no elements returned");
      }
      return json.elements;
    } catch (err) {
      lastError = err;
    } finally {
      window.clearTimeout(timer);
    }
  }
  throw lastError ?? new Error("no Overpass endpoint responded");
}

/**
 * Fetch the area from the browser and hand it to the server. Resolves true
 * when the area is cached and the original request is worth retrying.
 */
export async function fillAreaFromBrowser(area: UnavailableArea): Promise<boolean> {
  const params = new URLSearchParams({ lat: String(area.lat), lng: String(area.lng) });
  if (area.radius !== undefined) params.append("radius", String(area.radius));

  const planRes = await fetch(`${API_BASE}/area-query?${params.toString()}`);
  if (!planRes.ok) return false;
  const { query, endpoints, elementCap } = await planRes.json();
  if (!query || !Array.isArray(endpoints) || endpoints.length === 0) return false;

  const elements = await askOverpass(endpoints, query);

  const storeRes = await fetch(`${API_BASE}/area`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      lat: area.lat,
      lng: area.lng,
      radius: area.radius,
      // The server enforces this too; trimming here keeps the upload small.
      elements: typeof elementCap === "number" ? elements.slice(0, elementCap) : elements,
    }),
  });
  return storeRes.ok;
}

// Cover images, pulled from each restaurant's own website.
//
// OpenStreetMap has no photos — 0% of the places in the home dataset carry an
// `image` tag — but 44% link a website, and most sites publish an og:image for
// exactly this purpose: it's the picture they want shown when someone shares
// them. We read that tag, cache the URL, and fall back to the generated SVG.
//
// Nothing is proxied or re-hosted; the browser is redirected to the site's own
// image, so this costs no bandwidth and stores no third-party content.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { lookup } from "node:dns/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const CACHE_FILE = join(HERE, "data", "cache", "images.json");

const HIT_TTL = 30 * 24 * 60 * 60 * 1000;   // sites rarely change their og:image
const MISS_TTL = 3 * 24 * 60 * 60 * 1000;   // but one that gains one deserves a retry
const MAX_HTML_BYTES = 256 * 1024;          // og:image lives in <head>; never read a whole page
const FETCH_TIMEOUT_MS = 6000;

const cache = new Map();                     // placeId -> { url, at }
const inflight = new Map();
let dirty = false;

export async function loadImageCache() {
  try {
    const raw = JSON.parse(await readFile(CACHE_FILE, "utf8"));
    for (const [id, entry] of Object.entries(raw)) cache.set(id, entry);
  } catch { /* first run */ }
  return cache.size;
}

async function flush() {
  if (!dirty) return;
  dirty = false;
  try {
    await mkdir(dirname(CACHE_FILE), { recursive: true });
    await writeFile(CACHE_FILE, JSON.stringify(Object.fromEntries(cache)), "utf8");
  } catch (err) {
    console.warn("image cache write failed:", err.message);
  }
}
setInterval(() => { flush().catch(() => {}); }, 30_000).unref?.();

// Hosts restart containers often; without this, everything resolved since the
// last tick is lost and has to be fetched again.
for (const signal of ["SIGINT", "SIGTERM", "beforeExit"]) {
  process.on(signal, () => { flush().catch(() => {}); });
}

const isPrivate = (ip) =>
  /^(10\.|127\.|0\.|169\.254\.|192\.168\.|::1|fe80:|fc|fd)/i.test(ip) ||
  /^172\.(1[6-9]|2\d|3[01])\./.test(ip);

/**
 * These URLs come from OSM, which anyone can edit, so treat every one as
 * hostile: no non-HTTP schemes, no odd ports, and no addresses that resolve
 * inside our own network.
 */
async function safeUrl(raw) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (url.port && url.port !== "80" && url.port !== "443") return null;
  if (/^(localhost|.*\.local|.*\.internal)$/i.test(url.hostname)) return null;
  try {
    const { address } = await lookup(url.hostname);
    if (isPrivate(address)) return null;
  } catch {
    return null;                              // unresolvable host
  }
  return url;
}

// Two tiers, tried in order. A photo is what we want; a logo is what most
// small restaurant sites actually publish, and their own branding still beats
// a generated placeholder. Measured on this dataset: og:image covers ~42% of
// sites with a website, an apple-touch-icon adds ~17% more.
const PHOTO_META = [
  /<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i,
  /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
  /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
];

// Only sizeable icons — a 16px favicon is useless on a card.
const LOGO_META = [
  /<link[^>]+rel=["']apple-touch-icon[^"']*["'][^>]+href=["']([^"']+)["']/i,
  /<link[^>]+href=["']([^"']+)["'][^>]+rel=["']apple-touch-icon[^"']*["']/i,
  /<link[^>]+rel=["'](?:shortcut )?icon["'][^>]+sizes=["'](?:180|192|256|512)x[^"']*["'][^>]+href=["']([^"']+)["']/i,
];

async function readHead(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; DineValleyBot/1.0; +https://dinevalley.netlify.app)",
        accept: "text/html,application/xhtml+xml",
      },
    });
    if (!res.ok || !/text\/html/i.test(res.headers.get("content-type") || "")) return null;

    // Read only the head of the document, then stop.
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let html = "";
    while (html.length < MAX_HTML_BYTES) {
      const { value, done } = await reader.read();
      if (done) break;
      html += decoder.decode(value, { stream: true });
      if (/<\/head>/i.test(html)) break;
    }
    reader.cancel().catch(() => {});
    return { html, finalUrl: res.url };
  } finally {
    clearTimeout(timer);
  }
}

async function resolve(place) {
  const site = await safeUrl(place.website);
  if (!site) return null;

  const page = await readHead(site).catch(() => null);
  if (!page) return null;

  for (const [kind, patterns] of [["photo", PHOTO_META], ["logo", LOGO_META]]) {
    for (const re of patterns) {
      const hit = page.html.match(re);
      if (!hit?.[1]) continue;
      // these are frequently relative paths
      const abs = await safeUrl(new URL(hit[1], page.finalUrl).href);
      if (abs) return { url: abs.href, kind };
    }
  }
  return null;
}

/**
 * The image URL for a place, or null. Resolution continues in the background
 * past `timeoutMs` so the next request gets the answer — a slow restaurant
 * website never makes our own response slow.
 */
export async function imageForPlace(place, { timeoutMs = 2500 } = {}) {
  if (!place?.website) return null;

  const hit = cache.get(place.id);
  if (hit && Date.now() - hit.at < (hit.url ? HIT_TTL : MISS_TTL)) {
    return hit.url ? { url: hit.url, kind: hit.kind || "photo" } : null;
  }

  let job = inflight.get(place.id);
  if (!job) {
    job = resolve(place)
      .catch(() => null)
      .then((found) => {
        cache.set(place.id, { url: found?.url ?? null, kind: found?.kind ?? null, at: Date.now() });
        dirty = true;
        inflight.delete(place.id);
        return found;
      });
    inflight.set(place.id, job);
  }

  return Promise.race([job, new Promise((r) => setTimeout(() => r(null), timeoutMs))]);
}

export const imageCacheStats = () => {
  let hits = 0;
  for (const e of cache.values()) if (e.url) hits++;
  return { known: cache.size, withImage: hits };
};

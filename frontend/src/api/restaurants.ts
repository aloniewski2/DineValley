import { Restaurant, RestaurantDetails, RestaurantReview } from "../../types";
import { FALLBACK_IMAGE } from "../lib/fallbackImage";
import { fillAreaFromBrowser, unavailableAreaOf } from "./areaFallback";
import { API_BASE } from "./apiBase";

/**
 * The server says AREA_UNAVAILABLE when OpenStreetMap refused *it* -- which on
 * a shared host IP happens for areas a visitor's own browser is served fine.
 * Fetch the area here, hand it over, and tell the caller to try again. A
 * failure to do so is not worth surfacing: the caller falls through to the
 * server's own message, which already says to retry.
 */
async function retryAfterFillingArea(response: Response): Promise<boolean> {
  if (response.status !== 503) return false;
  const area = unavailableAreaOf(await response.clone().json().catch(() => null));
  if (!area) return false;
  try {
    return await fillAreaFromBrowser(area);
  } catch {
    return false;
  }
}

export interface BackendFilters {
  keyword?: string;
  minPrice?: number;
  maxPrice?: number;
  openNow?: boolean;
  pageToken?: string;
  radiusMeters?: number;
  zip?: string;
}

export interface RestaurantsResponse {
  results: Restaurant[];
  nextPageToken: string | null;
}

/* Search values are validated on the way into a query string.
 *
 * URLSearchParams already encodes what it is given, so none of these could
 * break out of the query and reach another path. The point is narrower and
 * still worth having: a page token is echoed back from a previous response
 * rather than typed by anyone, and a ZIP arrives from a text box, so each is
 * held to the shape the server will accept anyway. Anything that isn't that
 * shape is dropped here rather than sent and refused. */
/* The endpoint is built rather than concatenated.
 *
 * A search keyword is whatever someone typed, and pasting it into a template
 * string makes user text part of the URL itself. Setting `search` on a URL
 * whose origin and path are already fixed keeps that text where it belongs --
 * it can shape the query and nothing else, whatever it contains. */
function endpointUrl(path: string, params: URLSearchParams): string {
  const url = new URL(`${API_BASE}${path}`);
  url.search = params.toString();
  return url.toString();
}

/* A search term is words: letters, numbers, spaces, and the punctuation that
 * turns up inside a restaurant's name ("Mario's", "Chickie's & Pete's",
 * "Grille 3501"). The backend matches lowercased substrings and has no use for
 * anything else.
 *
 * Two steps rather than one, and the second is the point. Tidying a value says
 * nothing about what it now contains; the term is checked against the whole
 * allowlist afterwards and only used if it passes, so nothing reaches the query
 * on the strength of a transformation alone. Tidying first means the check
 * passes for anything a person would actually type -- it is a guarantee, not a
 * hurdle. */
const SEARCH_TERM = /^[\p{L}\p{N} '&-]+$/u;

function searchTerm(value: string, max: number): string {
  const tidied = String(value)
    .replace(/[^\p{L}\p{N}\s'&-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
  return SEARCH_TERM.test(tidied) ? tidied : "";
}

const digitsOnly = (value: string, max: number): string =>
  String(value).replace(/\D/g, "").slice(0, max);

const finite = (value: unknown): number | null =>
  Number.isFinite(Number(value)) ? Number(value) : null;

/* Building the query is its own job. Folded into the fetch it made one
 * function responsible for validating seven fields and performing a request
 * with a retry, which is more than one thing. */
function restaurantParams(filters: BackendFilters): URLSearchParams {
  const params = new URLSearchParams();

  const keyword = filters.keyword ? searchTerm(filters.keyword, 120) : "";
  if (keyword) params.append("keyword", keyword);

  const minPrice = finite(filters.minPrice);
  if (minPrice !== null) params.append("minPrice", String(minPrice));

  const maxPrice = finite(filters.maxPrice);
  if (maxPrice !== null) params.append("maxPrice", String(maxPrice));

  if (filters.openNow) params.append("openNow", "true");

  // The server reads this with parseInt; anything else is not a page.
  const pageToken = filters.pageToken ? digitsOnly(filters.pageToken, 9) : "";
  if (pageToken) params.append("pageToken", pageToken);

  const radius = finite(filters.radiusMeters);
  if (radius !== null) params.append("radius", String(radius));

  // Sent whenever it has any digits at all, rather than only when it is five:
  // the server explains a short ZIP better than silence does ("0000 isn't a
  // five-digit ZIP code"), and dropping it here would search the default area
  // as though nothing had been typed.
  const zip = filters.zip ? digitsOnly(filters.zip, 5) : "";
  if (zip) params.append("zip", zip);

  return params;
}

export async function fetchRestaurants(filters: BackendFilters): Promise<RestaurantsResponse> {
  const params = restaurantParams(filters);

  const target = endpointUrl("/restaurants", params);
  let response = await fetch(target);
  if (!response.ok && (await retryAfterFillingArea(response))) {
    response = await fetch(target);
  }
  if (!response.ok) {
    // The server says something useful here -- which ZIP it has no centroid
    // for, or that OpenStreetMap is busy and this is worth retrying. Replacing
    // that with "Failed to fetch restaurants" told the visitor nothing and made
    // a temporary problem look permanent.
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || "Failed to fetch restaurants");
  }

  const data = await response.json();

  return {
    results: Array.isArray(data.results) ? data.results : [],
    nextPageToken: typeof data.nextPageToken === "string" ? data.nextPageToken : null,
  };
}

const mapReview = (review: any): RestaurantReview => ({
  authorName: review?.author_name ?? "Anonymous",
  rating: review?.rating ?? 0,
  text: review?.text ?? "",
  relativeTimeDescription: review?.relative_time_description ?? "",
  profilePhotoUrl: review?.profile_photo_url,
});

export async function fetchRestaurantDetails(id: string): Promise<RestaurantDetails> {
  // Place ids carry a slash ("way/346382086"), so an unencoded id splits into
  // an extra path segment and never matches /restaurant/:id -- every details
  // page 404'd. The server already encodes ids when it builds photo URLs.
  const response = await fetch(`${API_BASE}/restaurant/${encodeURIComponent(id)}`);
  if (!response.ok) throw new Error("Failed to fetch restaurant details");

  const data = await response.json();

  return {
    id: data.id ?? id,
    name: data.name ?? "Unknown Restaurant",
    rating: data.rating ?? null,
    address: data.address ?? "",
    phone: data.phone ?? undefined,
    website: data.website ?? undefined,
    openingHours: Array.isArray(data.openingHours) ? data.openingHours : [],
    imageUrl: data.imageUrl ?? FALLBACK_IMAGE,
    photoUrls: Array.isArray(data.photoUrls) ? data.photoUrls : undefined,
    reviews: Array.isArray(data.reviews) ? data.reviews.map(mapReview) : [],
    googleMapsUrl: data.googleMapsUrl ?? undefined,
    mapImageUrl: data.mapImageUrl ?? undefined,
    coordinates: data.coordinates ?? undefined,
    types: Array.isArray(data.types) ? data.types : undefined,
    reviewSummary: data.reviewSummary ?? undefined,
  };
}

export interface MenuVisionSection {
  name: string;
  items: { name: string; price?: string; notes?: string }[];
}

export interface MenuVisionResult {
  sections: MenuVisionSection[];
  raw?: string;
}


export interface DecideParams {
  zip?: string;
  lat?: number;
  lng?: number;
  minutes: number;
  mode: "walk" | "drive";
  kinds?: string[];
  cuisines?: string[];
  independent?: boolean;
  openNow?: boolean;
  maxPrice?: number | null;
  dietary?: string[];
  limit?: number;
}

export interface DecideResponse {
  results: Restaurant[];
  considered: number;
  matchedTag: number;
  budget: { minutes: number; mode: string; metres: number };
}

/** Ask the backend for a shortlist rather than a page of everything nearby. */
export async function decideRestaurants(params: DecideParams): Promise<DecideResponse> {
  const q = new URLSearchParams();
  if (params.zip) q.append("zip", params.zip);
  if (params.lat !== undefined && params.lng !== undefined) {
    q.append("lat", String(params.lat));
    q.append("lng", String(params.lng));
  }
  q.append("minutes", String(params.minutes));
  q.append("mode", params.mode);
  if (params.kinds?.length) q.append("kinds", params.kinds.join(","));
  if (params.cuisines?.length) q.append("cuisines", params.cuisines.join(","));
  if (params.dietary?.length) q.append("dietary", params.dietary.join(","));
  if (params.independent) q.append("independent", "true");
  if (params.openNow) q.append("openNow", "true");
  if (params.maxPrice !== null && params.maxPrice !== undefined) {
    q.append("maxPrice", String(params.maxPrice));
  }
  q.append("limit", String(params.limit ?? 8));

  const target = endpointUrl("/decide", q);
  let response = await fetch(target);
  if (!response.ok && (await retryAfterFillingArea(response))) {
    response = await fetch(target);
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || "Could not work out a shortlist");
  }
  const data = await response.json();
  return {
    results: Array.isArray(data.results) ? data.results : [],
    considered: data.considered ?? 0,
    matchedTag: data.matchedTag ?? 0,
    budget: data.budget ?? { minutes: params.minutes, mode: params.mode, metres: 0 },
  };
}

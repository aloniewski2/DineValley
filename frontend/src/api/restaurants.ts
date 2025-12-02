import { Restaurant, RestaurantDetails, RestaurantReview } from "../../types";

const API_BASE =
  typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE_URL
    ? import.meta.env.VITE_API_BASE_URL.replace(/\/$/, "")
    : "https://dinevalley-backend.onrender.com";
export interface BackendFilters {
  keyword?: string;
  minPrice?: number;
  maxPrice?: number;
  openNow?: boolean;
  pageToken?: string;
  radiusMeters?: number;
}

export interface RestaurantsResponse {
  results: Restaurant[];
  nextPageToken: string | null;
}

export async function fetchRestaurants(filters: BackendFilters): Promise<RestaurantsResponse> {
  const params = new URLSearchParams();

  if (filters.keyword) params.append("keyword", filters.keyword);
  if (filters.minPrice !== undefined) params.append("minPrice", filters.minPrice.toString());
  if (filters.maxPrice !== undefined) params.append("maxPrice", filters.maxPrice.toString());
  if (filters.openNow) params.append("openNow", "true");
  if (filters.pageToken) params.append("pageToken", filters.pageToken);
  if (filters.radiusMeters !== undefined) params.append("radius", filters.radiusMeters.toString());

  const response = await fetch(`${API_BASE}/restaurants?${params.toString()}`);
  if (!response.ok) throw new Error("Failed to fetch restaurants");

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
  const response = await fetch(`${API_BASE}/restaurant/${id}`);
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
    imageUrl: data.imageUrl ?? "https://source.unsplash.com/600x400/?restaurant",
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

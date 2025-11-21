export interface Restaurant {
  id: string;
  name: string;
  imageUrl: string;
  rating: number;
  reviewCount: number;
  address: string;
  priceLevel: number | null;
  businessStatus: string;
  types: string[];
  isFavorite?: boolean;
  dietary?: string[];
  hasVisited?: boolean;
  visitCount?: number;
  lastVisited?: string | null;
}

export interface RestaurantReview {
  authorName: string;
  rating: number;
  text: string;
  relativeTimeDescription: string;
  profilePhotoUrl?: string;
}

export interface RestaurantDetails {
  id: string;
  name: string;
  rating: number | null;
  address: string;
  phone?: string;
  website?: string;
  openingHours: string[];
  reviews: RestaurantReview[];
  imageUrl: string;
  photoUrls?: string[];
  googleMapsUrl?: string | null;
  mapImageUrl?: string | null;
  coordinates?: { lat: number; lng: number } | null;
  types?: string[];
  reviewSummary?: {
    total: number;
    average: number | null;
  };
}

export interface FilterOptions {
  cuisines: string[];
  priceRanges: string[];
  minRating: number;
  openNow: boolean;
  distanceMiles: number;
}

export interface VisitSnapshot {
  id: string;
  name: string;
  imageUrl: string;
  rating: number;
  reviewCount: number;
  address: string;
  priceLevel: number | null;
  types: string[];
}

export interface VisitRecord {
  id: string;
  restaurantId: string;
  timestamp: string;
  snapshot: VisitSnapshot;
}

export interface VisitStatsEntry {
  count: number;
  lastVisited: string;
  snapshot: VisitSnapshot;
}

export type VisitStatsMap = Record<string, VisitStatsEntry>;

export const DEFAULT_FILTERS: FilterOptions = {
  cuisines: [],
  priceRanges: [],
  minRating: 0,
  openNow: false,
  distanceMiles: 10,
};

export const createDefaultFilters = (): FilterOptions => ({
  ...DEFAULT_FILTERS,
  cuisines: [...DEFAULT_FILTERS.cuisines],
  priceRanges: [...DEFAULT_FILTERS.priceRanges],
});

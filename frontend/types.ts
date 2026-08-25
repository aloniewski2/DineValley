/** Why a place made the shortlist. `unknown` is a first-class outcome: OSM
 *  simply has no dietary tag for most places, and saying so is more useful
 *  than implying a "no". */
export interface MatchReason {
  kind: "match" | "bonus" | "unknown" | "miss";
  label: string;
  weight: number;
}

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
  openNow?: boolean | null;
  hasVisited?: boolean;
  visitCount?: number;
  lastVisited?: string | null;
  /* Present only on results from /decide. */
  minutes?: number;
  metres?: number;
  matchScore?: number;
  reasons?: MatchReason[];
  independent?: boolean;
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

export interface MenuSectionItem {
  name: string;
  price?: string;
  notes?: string;
}

export interface MenuSection {
  name: string;
  items: MenuSectionItem[];
}

export interface FilterOptions {
  /** US ZIP code to search around; empty means the app's home region. */
  zip: string;
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
  zip: "",
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

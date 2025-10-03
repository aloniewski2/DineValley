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
  dietary: string[];
  openNow: boolean;
  distanceMiles: number;
}

export const DEFAULT_FILTERS: FilterOptions = {
  cuisines: [],
  priceRanges: [],
  minRating: 0,
  dietary: [],
  openNow: false,
  distanceMiles: 10,
};

export const createDefaultFilters = (): FilterOptions => ({
  ...DEFAULT_FILTERS,
  cuisines: [...DEFAULT_FILTERS.cuisines],
  priceRanges: [...DEFAULT_FILTERS.priceRanges],
  dietary: [...DEFAULT_FILTERS.dietary],
});

// types.ts

export interface Restaurant {
  id: string;
  name: string;
  imageUrl: string;
  rating: number;
  reviewCount: number;
  address: string;
  priceLevel: number | null;   // from Google Places API
  businessStatus: string;      // e.g., "OPERATIONAL"
  types: string[];             // Google place types (e.g., ["restaurant", "food"])
  isFavorite?: boolean;        // optional, for client-side favorites
}

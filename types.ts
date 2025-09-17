export interface Restaurant {
  id: string;
  name: string;
  imageUrl: string;
  rating: number;
  reviewCount: number;
  address: string;
  cuisineTypes: string[];
  priceRange: string;
  isFavorite: boolean;
  closed?: boolean;
  dietary?: string[]; // <--- ADD THIS LINE
}

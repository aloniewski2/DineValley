// types.ts
export interface Restaurant {
    id: string;
    imageUrl: string;
    name: string;
    rating: number;
    reviewCount: number;
    address: string;
    cuisineTypes: string[]; // replaces cuisineType1 / cuisineType2
    priceRange: string;
    favoriteIconUrl?: string;
    favoriteIconClass?: string;
    showClosedBadge?: boolean;
    isFavorite?: boolean;
  }
  
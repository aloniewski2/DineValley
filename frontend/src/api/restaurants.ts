export interface BackendFilters {
    keyword?: string;
    minPrice?: number;
    maxPrice?: number;
    openNow?: boolean;
  }
  
  export async function fetchRestaurants(filters: BackendFilters) {
    const params = new URLSearchParams();
  
    if (filters.keyword) params.append("keyword", filters.keyword);
    if (filters.minPrice !== undefined) params.append("minPrice", filters.minPrice.toString());
    if (filters.maxPrice !== undefined) params.append("maxPrice", filters.maxPrice.toString());
    if (filters.openNow) params.append("opennow", "true");
  
    const response = await fetch(`http://localhost:5050/restaurants?${params.toString()}`);
    if (!response.ok) throw new Error("Failed to fetch restaurants");
  
    return response.json();
  }
  
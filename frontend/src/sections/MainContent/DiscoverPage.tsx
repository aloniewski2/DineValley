import React, { useState, useMemo, useEffect } from "react";
import { Restaurant } from "../../../types";
import { RestaurantCard } from "../../components/RestaurantCard";
import { SearchSection } from "../SearchSection/SearchSection";
import { TrendingSection } from "../TrendingSection/TrendingSection";
import { AllRestaurantsSection } from "../AllRestaurantsSection/AllRestaurantsSection";
import { FilterOptions } from "./components/FilterModel";
import { fetchRestaurants } from "../../api/restaurants";

type Props = {
  onSelectRestaurant: (id: string) => void;
  onToggleFavorite: (id: string) => void;
};

export const DiscoverPage = ({ onSelectRestaurant, onToggleFavorite }: Props) => {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<FilterOptions>({
    cuisines: [],
    priceRanges: [],
    minRating: 0,
    dietary: [],
  });
  const [loading, setLoading] = useState(false);

  // 🔹 Fetch from backend whenever filters change
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        // Map FilterOptions → backend params
        const keyword = search || filters.cuisines[0] || "restaurant";
        const minPrice = filters.priceRanges.includes("$") ? 0 : 
                         filters.priceRanges.includes("$$") ? 1 :
                         filters.priceRanges.includes("$$$") ? 2 :
                         filters.priceRanges.includes("$$$$") ? 3 : undefined;
        const maxPrice = minPrice !== undefined ? minPrice + 1 : undefined;

        const data = await fetchRestaurants({
          keyword,
          minPrice,
          maxPrice,
          openNow: false,
        });

        // Map Google Places API response → Restaurant type
        const mapped: Restaurant[] = data.map((r: any) => ({
          id: r.place_id,
          name: r.name,
          imageUrl: r.photos
            ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${r.photos[0].photo_reference}&key=${
                import.meta.env.VITE_GOOGLE_PLACES_API_KEY
              }`
            : "/fallback-image.jpg",
          rating: r.rating || 0,
          reviewCount: r.user_ratings_total || 0,
          address: r.vicinity || "",
          cuisineTypes: filters.cuisines.length > 0 ? filters.cuisines : ["General"],
          priceRange: ["$", "$$", "$$$", "$$$$"][r.price_level || 0] || "$",
          isFavorite: false,
          closed: r.business_status !== "OPERATIONAL",
          dietary: [], // Could extend later
        }));

        // Apply rating + dietary filter locally
        const final = mapped.filter(
          (r) =>
            r.rating >= filters.minRating &&
            (filters.dietary.length === 0 ||
              filters.dietary.every((d) => r.dietary?.includes(d)))
        );

        setRestaurants(final);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [filters, search]);

  const filteredRestaurants = useMemo(() => restaurants, [restaurants]);

  return (
    <div className="p-6 space-y-6">
      <SearchSection
        value={search}
        onChange={setSearch}
        filters={filters}
        setFilters={setFilters}
      />
      {loading && <p>Loading restaurants...</p>}
      {!loading && (
        <>
          <TrendingSection
            restaurants={filteredRestaurants.slice(0, 5)}
            onSelectRestaurant={onSelectRestaurant}
            onToggleFavorite={onToggleFavorite}
          />
          <AllRestaurantsSection
            restaurants={filteredRestaurants}
            onSelectRestaurant={onSelectRestaurant}
            onToggleFavorite={onToggleFavorite}
          />
        </>
      )}
    </div>
  );
};

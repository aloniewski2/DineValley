import React, { useState, useMemo } from "react";
import { Restaurant } from "../../../types";
import { RestaurantCard } from "../../components/RestaurantCard";
import { SearchSection } from "../SearchSection/SearchSection";
import { TrendingSection } from "../TrendingSection/TrendingSection";
import { AllRestaurantsSection } from "../AllRestaurantsSection/AllRestaurantsSection";
import { FilterOptions } from "./components/FilterModel"; // just types!

type Props = {
  restaurants: Restaurant[];
  onSelectRestaurant: (id: string) => void;
  onToggleFavorite: (id: string) => void;
};

export const DiscoverPage = ({
  restaurants,
  onSelectRestaurant,
  onToggleFavorite,
}: Props) => {
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<FilterOptions>({
    cuisines: [],
    priceRanges: [],
    minRating: 0,
    dietary: [],
  });

  const filteredRestaurants = useMemo(() => {
    return restaurants.filter((r) =>
      (!search ||
        r.name.toLowerCase().includes(search.toLowerCase()) ||
        r.cuisineTypes.some((c) =>
          c.toLowerCase().includes(search.toLowerCase())
        )) &&
      (filters.cuisines.length === 0 ||
        filters.cuisines.some((c) => r.cuisineTypes.includes(c))) &&
      (filters.priceRanges.length === 0 ||
        filters.priceRanges.includes(r.priceRange)) &&
      (filters.dietary.length === 0 ||
        !filters.dietary.some(
          (d) => !r.dietary || !(Array.isArray(r.dietary) ? r.dietary.includes(d) : false)
        )) &&
      r.rating >= filters.minRating
    );
  }, [restaurants, search, filters]);

  return (
    <div className="p-6 space-y-6">
      <SearchSection
        value={search}
        onChange={setSearch}
        filters={filters}
        setFilters={setFilters}
      />
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
    </div>
  );
};

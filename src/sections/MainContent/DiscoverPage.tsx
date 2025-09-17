import React from "react";
import { Restaurant } from "../../../types";
import RestaurantCard from "../../components/RestaurantCard";
import { SearchSection } from "../SearchSection/SearchSection";
import { TrendingSection } from "../TrendingSection/TrendingSection";
import { AllRestaurantsSection } from "../AllRestaurantsSection/AllRestaurantsSection";


type Props = {
  restaurants: Restaurant[];
  onSelectRestaurant: (id: string) => void;
  onToggleFavorite: (id: string) => void;
};

export const DiscoverPage = ({ restaurants, onSelectRestaurant, onToggleFavorite }: Props) => (
  <div className="p-6 space-y-6">
    <SearchSection />
    <TrendingSection
      restaurants={restaurants.slice(0, 5)}
      onSelectRestaurant={onSelectRestaurant}
      onToggleFavorite={onToggleFavorite}
    />
    <AllRestaurantsSection
      restaurants={restaurants}
      onSelectRestaurant={onSelectRestaurant}
      onToggleFavorite={onToggleFavorite}
      onClick={onSelectRestaurant}
    />
  </div>
);

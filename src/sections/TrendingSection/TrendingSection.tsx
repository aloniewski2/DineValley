import React from "react";
import { RestaurantCard } from "../../components/RestaurantCard";
import { Restaurant } from "../../../types";

interface TrendingSectionProps {
  restaurants: Restaurant[];
  onSelectRestaurant: (id: string) => void;
  onToggleFavorite: (id: string) => void;
}

export const TrendingSection: React.FC<TrendingSectionProps> = ({
  restaurants,
  onSelectRestaurant,
  onToggleFavorite,
}) => {
  return (
    <div className="py-8 px-4">
      <h2 className="text-2xl font-bold mb-4">Trending Restaurants</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {restaurants.map(restaurant => (
          <RestaurantCard
            key={restaurant.id}
            restaurant={restaurant}
            onClick={() => onSelectRestaurant(restaurant.id)}
            onFavorite={() => onToggleFavorite(restaurant.id)}
          />
        ))}
      </div>
    </div>
  );
};

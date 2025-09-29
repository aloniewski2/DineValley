import React from "react";
import { RestaurantCard } from "../../components/RestaurantCard";
import { Restaurant } from "../../../types";

interface RecommendationsPageProps {
  restaurants: Restaurant[];
  onSelectRestaurant: (id: string) => void;
  onToggleFavorite: (id: string) => void;
}

export const RecommendationsPage: React.FC<RecommendationsPageProps> = ({
  restaurants,
  onSelectRestaurant,
  onToggleFavorite,
}) => {
  // You may apply your recommendations logic/filter here
  const recommendedRestaurants = restaurants.filter(r => r.rating >= 4.3);

  return (
    <div className="py-8 px-4">
      <h2 className="text-2xl font-bold mb-4">Recommended For You</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {recommendedRestaurants.map(restaurant => (
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

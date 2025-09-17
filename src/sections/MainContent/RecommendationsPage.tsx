import React from "react";
import { Restaurant } from "../../../types";
import  RestaurantCard  from "../../components/RestaurantCard";

type Props = {
  restaurants: Restaurant[];
  onSelectRestaurant: (id: string) => void;
  onToggleFavorite: (id: string) => void;
};

export const RecommendationsPage = ({ restaurants, onSelectRestaurant, onToggleFavorite }: Props) => {
  // For now, just show all restaurants as a simple example
  // Later you can filter based on recommendations logic
  const recommendedRestaurants = restaurants.filter(r => r.isFavorite); // Example: favorites as recommendations

  return (
    <div className="p-6 grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
      {recommendedRestaurants.length > 0 ? (
        recommendedRestaurants.map(r => (
          <RestaurantCard
            key={r.id}
            {...r}
            onClick={() => onSelectRestaurant(r.id)}
          />
        ))
      ) : (
        <p className="text-gray-500 col-span-full text-center">No recommendations yet.</p>
      )}
    </div>
  );
};

import React from "react";
import { Restaurant } from "../../../types";
import RestaurantCard from "../../components/RestaurantCard";

type Props = {
  restaurants: Restaurant[];
  onSelectRestaurant: (id: string) => void;
  onToggleFavorite: (id: string) => void;
};

export const ProfilePage = ({ restaurants, onSelectRestaurant, onToggleFavorite }: Props) => {
  // Example: show favorite restaurants in profile
  const favoriteRestaurants = restaurants.filter(r => r.isFavorite);

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">Your Favorites</h2>
      {favoriteRestaurants.length > 0 ? (
        <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {favoriteRestaurants.map(r => (
            <RestaurantCard
              key={r.id}
              {...r}
              onClick={() => onSelectRestaurant(r.id)}
            />
          ))}
        </div>
      ) : (
        <p className="text-gray-500">You haven’t favorited any restaurants yet.</p>
      )}
    </div>
  );
};

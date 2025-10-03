import React from "react";
import { RestaurantCard } from "../../components/RestaurantCard";
import { Restaurant } from "../../../types";

interface ProfilePageProps {
  restaurants: Restaurant[];
  onSelectRestaurant: (restaurant: Restaurant) => void;
  onToggleFavorite: (id: string) => void;
  favorites: Restaurant[];
}

export const ProfilePage: React.FC<ProfilePageProps> = ({
  restaurants,
  onSelectRestaurant,
  onToggleFavorite,
  favorites,
}) => {
  const favoriteRestaurants = favorites.length
    ? favorites
    : Array.isArray(restaurants)
      ? restaurants.filter((r) => r.isFavorite)
      : [];

  return (
    <div className="py-8 px-4">
      <h2 className="text-2xl font-bold mb-4">My Favorites</h2>
      {favoriteRestaurants.length === 0 ? (
        <p className="text-gray-600">No favorites saved yet.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {favoriteRestaurants.map((restaurant) => (
          <RestaurantCard
            key={restaurant.id}
            restaurant={restaurant}
            onClick={() => onSelectRestaurant(restaurant)}
            onFavorite={() => onToggleFavorite(restaurant.id)}
          />
          ))}
        </div>
      )}
    </div>
  );
};

import React from "react";
import { Restaurant } from "../../../types";
import { RestaurantCard } from "../../components/RestaurantCard";

interface ProfilePageProps {
  restaurants: Restaurant[];
  onSelectRestaurant: (id: string) => void;
  onToggleFavorite: (id: string) => void;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({
  restaurants,
  onSelectRestaurant,
  onToggleFavorite,
}) => {
  const favoriteRestaurants = restaurants.filter(r => r.isFavorite);

  return (
    <div className="py-8 px-4">
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">Favorites</h2>
        {favoriteRestaurants.length === 0 && (
          <p className="text-gray-500">You have no favorites yet.</p>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {favoriteRestaurants.map(r => (
          <RestaurantCard
            key={r.id}
            restaurant={r}
            onClick={() => onSelectRestaurant(r.id)}
            onFavorite={() => onToggleFavorite(r.id)}
          />
        ))}
      </div>
    </div>
  );
};

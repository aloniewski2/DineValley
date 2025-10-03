import React from "react";
import { RestaurantCard } from "../../components/RestaurantCard";
import { RestaurantCardSkeleton } from "../../components/RestaurantCardSkeleton";
import { Restaurant } from "../../../types";

interface AllRestaurantsSectionProps {
  restaurants: Restaurant[];
  onSelectRestaurant: (restaurant: Restaurant) => void;
  onToggleFavorite: (id: string) => void;
  loading?: boolean;
  skeletonCount?: number;
}

export const AllRestaurantsSection: React.FC<AllRestaurantsSectionProps> = ({
  restaurants,
  onSelectRestaurant,
  onToggleFavorite,
  loading = false,
  skeletonCount = 6,
}) => {
  const showSkeletons = loading && restaurants.length === 0;

  return (
    <div className="py-8 px-4">
      <h2 className="text-2xl font-bold mb-4">All Restaurants</h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {showSkeletons
          ? Array.from({ length: skeletonCount }).map((_, index) => (
              <RestaurantCardSkeleton key={`all-skeleton-${index}`} />
            ))
          : restaurants.map((restaurant, index) => (
              <RestaurantCard
                key={`${restaurant.id}-${index}`}
                restaurant={restaurant}
                onClick={() => onSelectRestaurant(restaurant)}
                onFavorite={() => onToggleFavorite(restaurant.id)}
              />
            ))}
      </div>
      {restaurants.length === 0 && !loading && (
        <p className="mt-4 text-center text-sm text-gray-500">
          No restaurants match your filters yet. Try adjusting your selections.
        </p>
      )}
    </div>
  );
};

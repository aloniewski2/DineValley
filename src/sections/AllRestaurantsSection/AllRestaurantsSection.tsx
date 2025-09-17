import React from "react";
import RestaurantCard from "../../components/RestaurantCard";
import { Restaurant } from "../../../types";

interface AllRestaurantsSectionProps {
  restaurants: Restaurant[];
  onSelectRestaurant: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  onClick: (id: string) => void;
}

export const AllRestaurantsSection: React.FC<AllRestaurantsSectionProps> = ({
  restaurants,
  onSelectRestaurant,
  onToggleFavorite,
  onClick,
}) => {
  return (
    <div className="box-border">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">All Restaurants</h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {restaurants.map((restaurant) => (
          <RestaurantCard
            key={restaurant.id}
            name={restaurant.name}
            cuisineTypes={restaurant.cuisineTypes}  // adjust according to your Restaurant type
            rating={restaurant.rating}     // must be a number!
            imageUrl={restaurant.imageUrl}
            address={restaurant.address}
            priceRange={restaurant.priceRange}
            onClick={() => onClick(restaurant.id)}
          />
        ))}
      </div>
    </div>
  );
};

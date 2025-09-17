import React from 'react';
import RestaurantCard from "../../components/RestaurantCard";
import { Restaurant } from "../../../types";

type TrendingSectionProps = {
  restaurants: Restaurant[];
  onSelectRestaurant: (id: string) => void;
  onToggleFavorite: (id: string) => void;
};

export const TrendingSection: React.FC<TrendingSectionProps> = ({
  restaurants,
  onSelectRestaurant,
  onToggleFavorite,
}) => (
  <div className="box-border mb-6">
    <h2 className="flex gap-x-2 items-center mb-4">
      <img
        src="https://c.animaapp.com/mfn8xsm35Iri3M/assets/icon-11.svg"
        alt="Icon"
        className="h-5 w-5"
      />
      Trending Now
    </h2>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {restaurants.map((restaurant) => (
        <RestaurantCard
          key={restaurant.id}
          name={restaurant.name}
          rating={restaurant.rating}
          address={restaurant.address}
          cuisineTypes={restaurant.cuisineTypes}
          priceRange={restaurant.priceRange}
          onClick={() => onSelectRestaurant(restaurant.id)}
          // add onFavorite logic if supported
        />
      ))}
    </div>
  </div>
);

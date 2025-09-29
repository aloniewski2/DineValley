import React from "react";

import { Restaurant } from "../../../types";

type Props = {
  restaurant: Restaurant;
  onBack: () => void;
  onToggleFavorite: (id: string) => void;
};

export const RestaurantDetailsPage = ({ restaurant, onBack, onToggleFavorite }: Props) => {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <button
        onClick={onBack}
        className="mb-4 text-blue-600 hover:underline"
      >
        &larr; Back
      </button>

      <div className="bg-white rounded-xl shadow p-6">
        <img
          src={restaurant.imageUrl}
          alt={restaurant.name}
          className="w-full h-64 object-cover rounded-lg mb-4"
        />
        <h1 className="text-3xl font-bold mb-2">{restaurant.name}</h1>
        <p className="text-gray-600 mb-1">{restaurant.cuisineTypes.join(", ")}</p>
        <p className="text-gray-600 mb-1">{restaurant.address}</p>
        <p className="text-gray-600 mb-2">Rating: {restaurant.rating} ({restaurant.reviewCount} reviews)</p>
        <button
          onClick={() => onToggleFavorite(restaurant.id)}
          className={`px-4 py-2 rounded ${restaurant.isFavorite ? "bg-red-500 text-white" : "bg-gray-200 text-black"}`}
        >
          {restaurant.isFavorite ? "Unfavorite" : "Favorite"}
        </button>
      </div>
    </div>
  );
};

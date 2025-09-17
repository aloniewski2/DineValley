import React from "react";
import { Heart } from "lucide-react";
import { Restaurant } from "../../types";

interface RestaurantCardProps {
  restaurant: Restaurant;
  onClick: () => void;
  onFavorite: () => void;
}

export const RestaurantCard = ({
  restaurant,
  onClick,
  onFavorite,
}: RestaurantCardProps) => {
  const {
    imageUrl,
    name,
    rating,
    reviewCount,
    address,
    cuisineTypes,
    priceRange,
    isFavorite,

  } = restaurant;

  return (
    <div
      className="relative rounded-lg overflow-hidden shadow cursor-pointer"
      onClick={onClick}
      tabIndex={0}
      role="button"
    >
      <div className="relative">
        <img src={imageUrl} alt={name} className="h-48 w-full object-cover" />
        {closed && (
          <div className="absolute bg-red-500 text-white px-2 py-1 rounded text-xs font-medium top-2 left-2">
            Closed
          </div>
        )}
        <button
          className="absolute h-8 w-8 top-2 right-2 flex items-center justify-center rounded-full bg-white bg-opacity-70 hover:bg-opacity-100 transition"
          onClick={e => {
            e.stopPropagation();
            onFavorite();
          }}
          aria-label={isFavorite ? "Unsave" : "Save"}
        >
          <Heart
            size={22}
            strokeWidth={2}
            className={isFavorite ? "text-red-500 fill-red-500" : "text-gray-300"}
            fill={isFavorite ? "currentColor" : "white"}
          />
        </button>
      </div>
      <div className="p-4">
        <div className="flex gap-x-2 items-center mb-2">
          <h3 className="text-lg font-semibold">{name}</h3>
          <span className="text-sm text-gray-500">{priceRange}</span>
        </div>
        <div className="flex gap-x-1 flex-wrap mb-2">
          {cuisineTypes.map((cuisine, index) => (
            <span key={index} className="text-sm text-gray-600">
              {cuisine}
              {index < cuisineTypes.length - 1 && " • "}
            </span>
          ))}
        </div>
        <p className="text-sm text-gray-500 mb-2">{address}</p>
        <div className="flex items-center gap-x-1">
          <span className="text-yellow-500 text-sm">★</span>
          <span className="text-sm font-medium">{rating}</span>
          <span className="text-sm text-gray-500">
            ({reviewCount} reviews)
          </span>
        </div>
      </div>
    </div>
  );
};

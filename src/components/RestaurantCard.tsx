import React from "react";

interface RestaurantCardProps {
  name: string;
  cuisineTypes: string[];
  rating: number;
  imageUrl?: string;
  priceRange?: string;
  address?: string;
  onClick?: () => void;
}

const RestaurantCard: React.FC<RestaurantCardProps> = ({
  name,
  cuisineTypes,
  rating,
  imageUrl,
  priceRange,
  address,
}) => {
  return (
    <div className="bg-white rounded-2xl shadow-md overflow-hidden hover:shadow-lg transition-shadow">
      {/* Restaurant Image */}
      <div className="h-40 w-full overflow-hidden">
        <img
          src={
            imageUrl ||
            "https://via.placeholder.com/400x200.png?text=Restaurant+Image"
          }
          alt={name}
          className="h-full w-full object-cover"
        />
      </div>

      {/* Restaurant Info */}
      <div className="p-4">
        <h2 className="text-lg font-semibold text-gray-800">{name}</h2>
        <p className="text-sm text-gray-600">{cuisineTypes.join(", ")}</p>

        {address && (
          <p className="text-sm text-gray-500 mt-1">{address}</p>
        )}

        {/* Rating */}
        <div className="mt-2 flex items-center">
          <span className="text-yellow-500 mr-1">⭐</span>
          <span className="text-sm font-medium text-gray-700">
            {rating.toFixed(1)}
          </span>
        </div>
      </div>
    </div>
  );
};

export default RestaurantCard;

import React from 'react';

interface RestaurantCardProps {
  imageUrl: string;
  name: string;
  rating: string;
  reviewCount: string;
  address: string;
  cuisineTypes: string[];
  priceRange: string;
  favoriteIconUrl: string;
  favoriteIconClass: string;
  showClosedBadge?: boolean;
}

export const RestaurantCard = ({
  imageUrl,
  name,
  rating,
  reviewCount,
  address,
  cuisineTypes,
  priceRange,
  favoriteIconUrl,
  favoriteIconClass,
  showClosedBadge = false
}: RestaurantCardProps) => {
  return (
    <div className="relative box-border caret-transparent outline-[oklab(0.708_0_0_/_0.5)]">
      <div className="box-border caret-transparent outline-[oklab(0.708_0_0_/_0.5)] rounded-lg overflow-hidden">
        <div className="relative box-border caret-transparent outline-[oklab(0.708_0_0_/_0.5)]">
          <img
            src={imageUrl}
            alt={name}
            className="box-border caret-transparent h-48 outline-[oklab(0.708_0_0_/_0.5)] w-full object-cover"
          />
          {showClosedBadge && (
            <div className="absolute bg-red-500 text-white px-2 py-1 rounded text-xs font-medium top-2 left-2">
              Closed
            </div>
          )}
          <button className="absolute box-border caret-transparent h-8 outline-[oklab(0.708_0_0_/_0.5)] w-8 top-2 right-2">
            <img
              src={favoriteIconUrl}
              alt="Favorite"
              className={`box-border caret-transparent h-6 outline-[oklab(0.708_0_0_/_0.5)] w-6 ${favoriteIconClass}`}
            />
          </button>
        </div>
        <div className="box-border caret-transparent outline-[oklab(0.708_0_0_/_0.5)] p-4">
          <div className="box-border caret-transparent gap-x-2 flex outline-[oklab(0.708_0_0_/_0.5)] gap-y-2 mb-2">
            <h3 className="text-lg font-semibold box-border caret-transparent outline-[oklab(0.708_0_0_/_0.5)]">
              {name}
            </h3>
            <span className="text-sm text-gray-500 box-border caret-transparent outline-[oklab(0.708_0_0_/_0.5)]">
              {priceRange}
            </span>
          </div>
          <div className="box-border caret-transparent gap-x-1 flex outline-[oklab(0.708_0_0_/_0.5)] gap-y-1 mb-2">
            {cuisineTypes.map((cuisine, index) => (
              <span
                key={index}
                className="text-sm text-gray-600 box-border caret-transparent outline-[oklab(0.708_0_0_/_0.5)]"
              >
                {cuisine}
                {index < cuisineTypes.length - 1 && " • "}
              </span>
            ))}
          </div>
          <p className="text-sm text-gray-500 box-border caret-transparent outline-[oklab(0.708_0_0_/_0.5)] mb-2">
            {address}
          </p>
          <div className="box-border caret-transparent gap-x-1 flex outline-[oklab(0.708_0_0_/_0.5)] gap-y-1">
            <span className="text-yellow-500 text-sm box-border caret-transparent outline-[oklab(0.708_0_0_/_0.5)]">
              ★
            </span>
            <span className="text-sm font-medium box-border caret-transparent outline-[oklab(0.708_0_0_/_0.5)]">
              {rating}
            </span>
            <span className="text-sm text-gray-500 box-border caret-transparent outline-[oklab(0.708_0_0_/_0.5)]">
              ({reviewCount} reviews)
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

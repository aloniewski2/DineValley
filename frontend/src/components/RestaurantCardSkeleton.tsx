import React from "react";

interface RestaurantCardSkeletonProps {
  className?: string;
}

export const RestaurantCardSkeleton: React.FC<RestaurantCardSkeletonProps> = ({ className }) => {
  return (
    <div
      className={`relative rounded-lg bg-white shadow overflow-hidden animate-pulse ${className ?? ""}`.trim()}
      aria-hidden="true"
    >
      <div className="h-48 w-full bg-gray-200" />
      <div className="p-4 space-y-3">
        <div className="h-4 w-3/4 rounded bg-gray-200" />
        <div className="h-3 w-1/2 rounded bg-gray-200" />
        <div className="h-3 w-5/6 rounded bg-gray-200" />
        <div className="flex gap-2">
          <div className="h-3 w-16 rounded-full bg-gray-200" />
          <div className="h-3 w-12 rounded-full bg-gray-200" />
        </div>
      </div>
    </div>
  );
};

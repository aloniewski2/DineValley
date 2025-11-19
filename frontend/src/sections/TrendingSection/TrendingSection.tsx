import React, { useEffect, useMemo, useState } from "react";
import { RestaurantCard } from "../../components/RestaurantCard";
import { RestaurantCardSkeleton } from "../../components/RestaurantCardSkeleton";
import { Restaurant, VisitStatsMap } from "../../../types";

interface TrendingSectionProps {
  restaurants: Restaurant[];
  onSelectRestaurant: (restaurant: Restaurant) => void;
  onToggleFavorite: (id: string) => void;
  onLoadMore?: () => Promise<boolean> | boolean;
  hasMore?: boolean;
  loading?: boolean;
  resetKey?: number;
  pageSize?: number;
  onCheckIn?: (restaurant: Restaurant) => void;
  visitStats?: VisitStatsMap;
}

export const TrendingSection: React.FC<TrendingSectionProps> = ({
  restaurants,
  onSelectRestaurant,
  onToggleFavorite,
  onLoadMore,
  hasMore = false,
  loading = false,
  resetKey,
  pageSize = 6,
  onCheckIn,
  visitStats = {},
}) => {
  const [currentPage, setCurrentPage] = useState(0);
  const [pendingPage, setPendingPage] = useState<number | null>(null);

  const totalItems = restaurants.length;
  const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / pageSize);
  const start = currentPage * pageSize;
  const end = start + pageSize;
  const currentRestaurants = useMemo(() => restaurants.slice(start, end), [restaurants, start, end]);

  useEffect(() => {
    setCurrentPage(0);
    setPendingPage(null);
  }, [resetKey, pageSize]);

  useEffect(() => {
    const maxPageIndex = totalPages > 0 ? totalPages - 1 : 0;
    if (currentPage > maxPageIndex) {
      setCurrentPage(maxPageIndex);
    }
  }, [totalPages, currentPage]);

  useEffect(() => {
    if (pendingPage === null) return;

    const nextStart = pendingPage * pageSize;
    if (nextStart < restaurants.length) {
      setCurrentPage(pendingPage);
      setPendingPage(null);
    } else if (!loading && !hasMore) {
      setPendingPage(null);
    }
  }, [pendingPage, restaurants.length, pageSize, loading, hasMore]);

  const handlePrev = () => {
    setCurrentPage((prev) => Math.max(0, prev - 1));
  };

  const handleNext = async () => {
    const nextPage = currentPage + 1;
    const nextStart = nextPage * pageSize;

    if (nextStart < restaurants.length) {
      setCurrentPage(nextPage);
      return;
    }

    if (hasMore && onLoadMore && !loading) {
      setPendingPage(nextPage);
      const loaded = await onLoadMore();
      if (!loaded) {
        setPendingPage(null);
      }
    }
  };

  const canGoPrev = currentPage > 0;
  const canGoNext =
    (currentPage + 1) * pageSize < restaurants.length ||
    (hasMore && !loading);

  return (
    <div className="py-8 px-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-4">
        <h2 className="text-2xl font-bold">Trending Restaurants</h2>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">
            Page {totalItems === 0 ? 0 : currentPage + 1} of {totalPages || 0}
          </span>
          <div className="flex gap-2">
            <button
              className="px-3 py-2 rounded-md border font-medium disabled:opacity-50"
              onClick={handlePrev}
              disabled={!canGoPrev || loading}
              type="button"
            >
              Previous
            </button>
            <button
              className="px-3 py-2 rounded-md border font-medium disabled:opacity-50"
              onClick={handleNext}
              disabled={!canGoNext || loading || pendingPage !== null}
              type="button"
            >
              {loading && pendingPage !== null ? "Loading..." : "Next"}
            </button>
          </div>
        </div>
      </div>

      {currentRestaurants.length === 0 && loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: pageSize }).map((_, index) => (
            <RestaurantCardSkeleton key={`trending-skeleton-${index}`} />
          ))}
        </div>
      ) : currentRestaurants.length === 0 ? (
        <p className="text-gray-500">No trending restaurants found.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {currentRestaurants.map((restaurant, index) => (
            <RestaurantCard
              key={`${restaurant.id}-${start + index}`}
              restaurant={restaurant}
              onClick={() => onSelectRestaurant(restaurant)}
              onFavorite={() => onToggleFavorite(restaurant.id)}
              visited={Boolean(visitStats[restaurant.id])}
              visitCount={visitStats[restaurant.id]?.count}
              lastVisited={visitStats[restaurant.id]?.lastVisited}
              onCheckIn={onCheckIn ? () => onCheckIn(restaurant) : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
};

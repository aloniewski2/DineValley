import React, { useMemo } from "react";
import { RestaurantCard } from "../../components/RestaurantCard";
import { Restaurant, VisitRecord, VisitStatsMap } from "../../../types";
import { VisitTimeline } from "../../components/VisitTimeline";

interface ProfilePageProps {
  restaurants: Restaurant[];
  onSelectRestaurant: (restaurant: Restaurant) => void;
  onToggleFavorite: (id: string) => void;
  favorites: Restaurant[];
  visitHistory: VisitRecord[];
  visitStats: VisitStatsMap;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({
  restaurants,
  onSelectRestaurant,
  onToggleFavorite,
  favorites,
  visitHistory,
  visitStats,
}) => {
  const favoriteRestaurants = favorites.length
    ? favorites
    : Array.isArray(restaurants)
      ? restaurants.filter((r) => r.isFavorite)
      : [];

  const totalVisits = visitHistory.length;
  const lastVisit = visitHistory[0] ?? null;

  const topSpot = useMemo(() => {
    if (!visitHistory.length) return null;
    const visitCounts = new Map<string, { count: number; name: string }>();
    visitHistory.forEach((visit) => {
      const entry = visitCounts.get(visit.restaurantId) ?? { count: 0, name: visit.snapshot.name };
      entry.count += 1;
      entry.name = visit.snapshot.name;
      visitCounts.set(visit.restaurantId, entry);
    });
    const sorted = [...visitCounts.entries()].sort((a, b) => b[1].count - a[1].count);
    if (!sorted.length) return null;
    return { name: sorted[0][1].name, count: sorted[0][1].count };
  }, [visitHistory]);

  const timelineVisits = useMemo(() => visitHistory.slice(0, 8), [visitHistory]);

  return (
    <div className="py-8 px-4 text-gray-900 dark:text-gray-100">
      <h2 className="text-2xl font-bold mb-4">My Favorites</h2>
      {favoriteRestaurants.length === 0 ? (
        <p className="text-gray-600 dark:text-gray-400">No favorites saved yet.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {favoriteRestaurants.map((restaurant) => (
          <RestaurantCard
            key={restaurant.id}
            restaurant={restaurant}
            onClick={() => onSelectRestaurant(restaurant)}
            onFavorite={() => onToggleFavorite(restaurant.id)}
            visited={Boolean(visitStats[restaurant.id])}
            visitCount={visitStats[restaurant.id]?.count}
            lastVisited={visitStats[restaurant.id]?.lastVisited}
          />
          ))}
        </div>
      )}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-sm transition-colors">
          <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Total visits</p>
          <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{totalVisits || 0}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Keep exploring and check in to build your history.</p>
        </div>
        <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-sm transition-colors">
          <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Last check-in</p>
          <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{lastVisit ? lastVisit.snapshot.name : "No visits yet"}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {lastVisit ? new Date(lastVisit.timestamp).toLocaleString() : "Use “Been here” to log your visits."}
          </p>
        </div>
        <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-sm transition-colors">
          <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Top spot</p>
          <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {topSpot ? `${topSpot.name}` : "No favorite yet"}
          </p>
          {topSpot && <p className="text-xs text-gray-500 dark:text-gray-400">{topSpot.count} visits logged</p>}
        </div>
      </div>

      <div className="mt-8 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-semibold">Visit history timeline</h3>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {visitHistory.length ? "Most recent 8 check-ins" : "No visits recorded"}
          </span>
        </div>
        <VisitTimeline visits={timelineVisits} onSelectVisit={(visit) => onSelectRestaurant(restaurants.find((r) => r.id === visit.restaurantId) ?? {
          id: visit.snapshot.id,
          name: visit.snapshot.name,
          imageUrl: visit.snapshot.imageUrl,
          rating: visit.snapshot.rating,
          reviewCount: visit.snapshot.reviewCount,
          address: visit.snapshot.address,
          priceLevel: visit.snapshot.priceLevel,
          businessStatus: "UNKNOWN",
          types: visit.snapshot.types ?? [],
        })} />
      </div>
    </div>
  );
};

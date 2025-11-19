import React, { useMemo } from "react";
import { RestaurantCard } from "../../components/RestaurantCard";
import { Restaurant, VisitRecord, VisitStatsMap } from "../../../types";

interface RecommendationsPageProps {
  restaurants: Restaurant[];
  onSelectRestaurant: (restaurant: Restaurant) => void;
  onToggleFavorite: (id: string) => void;
  favorites: string[];
  recentlyViewed: Restaurant[];
  visitHistory: VisitRecord[];
  visitStats: VisitStatsMap;
  onCheckIn: (restaurant: Restaurant) => void;
}

const getCuisineScore = (restaurant: Restaurant, favorites: Restaurant[]): number => {
  if (!favorites.length) return 0;
  const favoriteTypes = favorites.flatMap((f) => f.types ?? []);
  const restaurantTypes = restaurant.types ?? [];
  const overlap = restaurantTypes.filter((type) => favoriteTypes.includes(type));
  return overlap.length;
};

const deduplicateRestaurants = (items: Restaurant[]): Restaurant[] => {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
};

export const RecommendationsPage: React.FC<RecommendationsPageProps> = ({
  restaurants,
  onSelectRestaurant,
  onToggleFavorite,
  favorites,
  recentlyViewed,
  visitHistory,
  visitStats,
  onCheckIn,
}) => {
  const favoriteRestaurants = useMemo(
    () => restaurants.filter((r) => favorites.includes(r.id)),
    [restaurants, favorites]
  );

  const visitedSet = useMemo(() => new Set(visitHistory.map((visit) => visit.restaurantId)), [visitHistory]);
  const latestVisit = visitHistory[0] ?? null;

  const personalized = useMemo(() => {
    const highRated = restaurants.filter((r) => r.rating >= 4.0);
    const scored = highRated
      .filter((r) => !favorites.includes(r.id))
      .map((restaurant) => ({
        restaurant,
        score: getCuisineScore(restaurant, favoriteRestaurants),
      }))
      .sort((a, b) => {
        if (b.score === a.score) {
          return (b.restaurant.rating ?? 0) - (a.restaurant.rating ?? 0);
        }
        return b.score - a.score;
      })
      .map(({ restaurant }) => restaurant)
      .slice(0, 12);
    return deduplicateRestaurants(scored);
  }, [restaurants, favorites, favoriteRestaurants]);

  const fallbackRecent = useMemo(
    () => recentlyViewed.filter((r) => !favorites.includes(r.id)).slice(0, 12),
    [recentlyViewed, favorites]
  );

  const becauseYouLikedSection = useMemo(() => {
    if (!latestVisit) return { label: "", list: [] as Restaurant[] };
    const likedTypes = latestVisit.snapshot.types ?? [];
    if (!likedTypes.length) return { label: latestVisit.snapshot.name, list: [] as Restaurant[] };

    const list = restaurants
      .filter((restaurant) => restaurant.id !== latestVisit.restaurantId)
      .filter((restaurant) => restaurant.types?.some((type) => likedTypes.includes(type)))
      .slice(0, 6);

    return { label: latestVisit.snapshot.name, list };
  }, [latestVisit, restaurants]);

  const historySmartSection = useMemo(() => {
    if (!visitHistory.length) return { list: [] as Restaurant[], topTypes: [] as string[] };
    const scores = new Map<string, number>();
    visitHistory.forEach((visit, index) => {
      const weight = visitHistory.length - index;
      (visit.snapshot.types ?? []).forEach((type) => {
        scores.set(type, (scores.get(type) ?? 0) + weight);
      });
    });

    const topTypes = [...scores.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([type]) => type);

    if (!topTypes.length) return { list: [] as Restaurant[], topTypes };

    const list = restaurants
      .filter((restaurant) => restaurant.types?.some((type) => topTypes.includes(type)))
      .filter((restaurant) => !visitedSet.has(restaurant.id))
      .slice(0, 6);

    return { list, topTypes };
  }, [restaurants, visitHistory, visitedSet]);

  const recommended = personalized.length > 0 ? personalized : fallbackRecent;

  return (
    <div className="py-8 px-4 space-y-6">
      <header>
        <h2 className="text-2xl font-bold mb-2">Recommended For You</h2>
        <p className="text-sm text-gray-500">
          Curated from your favorites and viewing history.
        </p>
      </header>

      {recommended.length === 0 ? (
        <p className="text-gray-500">
          Save a few favorites or browse restaurants to unlock personalized recommendations.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {recommended.map((restaurant) => (
            <RestaurantCard
              key={`recommended-${restaurant.id}`}
              restaurant={restaurant}
              onClick={() => onSelectRestaurant(restaurant)}
              onFavorite={() => onToggleFavorite(restaurant.id)}
              visited={Boolean(visitStats[restaurant.id])}
              visitCount={visitStats[restaurant.id]?.count}
              lastVisited={visitStats[restaurant.id]?.lastVisited}
              onCheckIn={() => onCheckIn(restaurant)}
            />
          ))}
        </div>
      )}

      {personalized.length === 0 && fallbackRecent.length > 0 && (
        <p className="text-sm text-gray-500">
          Showing recently viewed restaurants until we learn your preferences.
        </p>
      )}

      {becauseYouLikedSection.list.length > 0 && latestVisit && (
        <section className="space-y-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">Because you liked</p>
            <h3 className="text-lg font-semibold">{becauseYouLikedSection.label}</h3>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {becauseYouLikedSection.list.map((restaurant) => (
              <RestaurantCard
                key={`liked-${restaurant.id}`}
                restaurant={restaurant}
                onClick={() => onSelectRestaurant(restaurant)}
                onFavorite={() => onToggleFavorite(restaurant.id)}
                visited={Boolean(visitStats[restaurant.id])}
                visitCount={visitStats[restaurant.id]?.count}
                lastVisited={visitStats[restaurant.id]?.lastVisited}
                onCheckIn={() => onCheckIn(restaurant)}
              />
            ))}
          </div>
        </section>
      )}

      {historySmartSection.list.length > 0 && (
        <section className="space-y-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">Smart recommendations</p>
            <h3 className="text-lg font-semibold">
              Personalized for fans of {historySmartSection.topTypes.map((type) => type.replace(/_/g, " ")).join(", ")}
            </h3>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {historySmartSection.list.map((restaurant) => (
              <RestaurantCard
                key={`smart-${restaurant.id}`}
                restaurant={restaurant}
                onClick={() => onSelectRestaurant(restaurant)}
                onFavorite={() => onToggleFavorite(restaurant.id)}
                visited={Boolean(visitStats[restaurant.id])}
                visitCount={visitStats[restaurant.id]?.count}
                lastVisited={visitStats[restaurant.id]?.lastVisited}
                onCheckIn={() => onCheckIn(restaurant)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

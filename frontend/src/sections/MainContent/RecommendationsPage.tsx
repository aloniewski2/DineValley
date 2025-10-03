import React, { useMemo } from "react";
import { RestaurantCard } from "../../components/RestaurantCard";
import { Restaurant } from "../../../types";

interface RecommendationsPageProps {
  restaurants: Restaurant[];
  onSelectRestaurant: (restaurant: Restaurant) => void;
  onToggleFavorite: (id: string) => void;
  favorites: string[];
  recentlyViewed: Restaurant[];
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
}) => {
  const favoriteRestaurants = useMemo(
    () => restaurants.filter((r) => favorites.includes(r.id)),
    [restaurants, favorites]
  );

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
            />
          ))}
        </div>
      )}

      {personalized.length === 0 && fallbackRecent.length > 0 && (
        <p className="text-sm text-gray-500">
          Showing recently viewed restaurants until we learn your preferences.
        </p>
      )}
    </div>
  );
};

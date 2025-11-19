import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Restaurant, FilterOptions, DEFAULT_FILTERS, createDefaultFilters, VisitRecord, VisitStatsMap } from "../../../types";
import { RestaurantCard } from "../../components/RestaurantCard";
import { SearchSection } from "../SearchSection/SearchSection";
import { TrendingSection } from "../TrendingSection/TrendingSection";
import { fetchRestaurants } from "../../api/restaurants";
import { StatusBanner } from "../../components/StatusBanner";
import { buildRestaurantQueryParams, filterRestaurantsClientSide } from "../../utils/restaurantFilters";
import { VisitTimeline } from "../../components/VisitTimeline";

type Props = {
  onSelectRestaurant: (restaurant: Restaurant) => void;
  onToggleFavorite: (id: string) => void;
  favorites: string[];
  recentlyViewed: Restaurant[];
  visitHistory: VisitRecord[];
  visitStats: VisitStatsMap;
  onCheckIn: (restaurant: Restaurant) => void;
  theme: "light" | "dark";
  onToggleTheme: () => void;
};

const FILTERS_STORAGE_KEY = "discoverFilters";

export const DiscoverPage = ({
  onSelectRestaurant,
  onToggleFavorite,
  favorites,
  recentlyViewed,
  visitHistory,
  visitStats,
  onCheckIn,
  theme,
  onToggleTheme,
}: Props) => {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const favoritesRef = useRef<string[]>(favorites);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState<boolean>(() =>
    typeof navigator !== "undefined" ? !navigator.onLine : false
  );
  const [search, setSearch] = useState("");
  const [filters, setFiltersState] = useState<FilterOptions>(() => {
    if (typeof window !== "undefined") {
      const raw = window.localStorage.getItem(FILTERS_STORAGE_KEY);
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          const safeFilters: FilterOptions = {
            ...createDefaultFilters(),
            cuisines: Array.isArray(parsed?.cuisines) ? [...parsed.cuisines] : [...DEFAULT_FILTERS.cuisines],
            priceRanges: Array.isArray(parsed?.priceRanges) ? [...parsed.priceRanges] : [...DEFAULT_FILTERS.priceRanges],
            dietary: Array.isArray(parsed?.dietary) ? [...parsed.dietary] : [...DEFAULT_FILTERS.dietary],
            minRating: Number.isFinite(Number(parsed?.minRating))
              ? Number(parsed.minRating)
              : DEFAULT_FILTERS.minRating,
            openNow: Boolean(parsed?.openNow),
            distanceMiles: Number.isFinite(Number(parsed?.distanceMiles))
              ? Math.min(Math.max(Number(parsed.distanceMiles), 1), 30)
              : DEFAULT_FILTERS.distanceMiles,
          };
          return safeFilters;
        } catch (error) {
          console.warn("Failed to parse stored filters", error);
        }
      }
    }
    return createDefaultFilters();
  });
  const [resultsVersion, setResultsVersion] = useState(0);
  const [refreshToken, setRefreshToken] = useState(0);

  const applyFilters = useCallback((next: FilterOptions) => {
    setFiltersState({
      ...next,
      cuisines: [...next.cuisines],
      priceRanges: [...next.priceRanges],
      dietary: [...next.dietary],
    });
  }, []);

  const requestParams = useMemo(() => buildRestaurantQueryParams(filters, search), [filters, search]);

  useEffect(() => {
    favoritesRef.current = favorites;
  }, [favorites]);

  const attachFavoriteState = useCallback((list: Restaurant[]): Restaurant[] => {
    const favoriteSet = new Set(favoritesRef.current);
    if (favoriteSet.size === 0) {
      return list.map((restaurant) => ({ ...restaurant, isFavorite: false }));
    }
    return list.map((restaurant) => ({
      ...restaurant,
      isFavorite: favoriteSet.has(restaurant.id),
    }));
  }, []);

  // 🔹 Load first page
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchRestaurants(requestParams);
        const filtered = filterRestaurantsClientSide(data.results, filters);
        setRestaurants(attachFavoriteState(filtered));
        setNextPageToken(data.nextPageToken || null);
        setResultsVersion((prev) => prev + 1);
      } catch (err) {
        console.error("❌ Error fetching restaurants:", err);
        setError("We couldn’t load restaurants right now. Please try again.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [filters, requestParams, refreshToken, attachFavoriteState]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(filters));
    }
  }, [filters]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // 🔹 Load next page
  const loadMore = useCallback(async (): Promise<boolean> => {
    if (!nextPageToken || loading) return false;
    setLoading(true);
    try {
      const data = await fetchRestaurants({ ...requestParams, pageToken: nextPageToken });
      const filtered = filterRestaurantsClientSide(data.results, filters);
      setRestaurants((prev) => attachFavoriteState([...prev, ...filtered]));
      setNextPageToken(data.nextPageToken || null);
      setError(null);
      return filtered.length > 0;
    } catch (err) {
      console.error("❌ Error loading more:", err);
      setError("We couldn’t load more restaurants. Please try again.");
      return false;
    } finally {
      setLoading(false);
    }
  }, [nextPageToken, loading, requestParams, filters, attachFavoriteState]);

  // 🔹 Infinite scroll listener
  useEffect(() => {
    const handleScroll = () => {
      if (window.innerHeight + document.documentElement.scrollTop + 200 >= document.documentElement.scrollHeight) {
        loadMore();
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [loadMore]);

  const isInitialLoading = loading && restaurants.length === 0;

  useEffect(() => {
    setRestaurants((prev) => attachFavoriteState(prev));
  }, [favorites, attachFavoriteState]);

  const handleSurpriseMe = useCallback(() => {
    const pool = restaurants.length > 0 ? restaurants : recentlyViewed;
    if (!pool.length) {
      return;
    }
    const randomIndex = Math.floor(Math.random() * pool.length);
    const randomRestaurant = pool[randomIndex];
    onSelectRestaurant(randomRestaurant);
  }, [restaurants, recentlyViewed, onSelectRestaurant]);

  const latestVisit = visitHistory[0] ?? null;

  const becauseYouLikedSection = useMemo(() => {
    if (!latestVisit) {
      return { label: "", list: [] as Restaurant[] };
    }
    const likedTypes = latestVisit.snapshot.types ?? [];
    if (!likedTypes.length) {
      return { label: latestVisit.snapshot.name, list: [] as Restaurant[] };
    }
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

    if (!topTypes.length) {
      return { list: [] as Restaurant[], topTypes };
    }

    const list = restaurants
      .filter((restaurant) => restaurant.types?.some((type) => topTypes.includes(type)))
      .filter((restaurant) => !favorites.includes(restaurant.id))
      .slice(0, 6);

    return { list, topTypes };
  }, [favorites, restaurants, visitHistory]);

  const timelineVisits = useMemo(() => visitHistory.slice(0, 6), [visitHistory]);

  const handleVisitSelect = useCallback(
    (visit: VisitRecord) => {
      const fromList = restaurants.find((r) => r.id === visit.restaurantId);
      if (fromList) {
        onSelectRestaurant(fromList);
        return;
      }
      const fallback: Restaurant = {
        id: visit.snapshot.id,
        name: visit.snapshot.name,
        imageUrl: visit.snapshot.imageUrl,
        rating: visit.snapshot.rating,
        reviewCount: visit.snapshot.reviewCount,
        address: visit.snapshot.address,
        priceLevel: visit.snapshot.priceLevel,
        businessStatus: "UNKNOWN",
        types: visit.snapshot.types ?? [],
      };
      onSelectRestaurant(fallback);
    },
    [onSelectRestaurant, restaurants]
  );

  return (
    <div className="p-6 space-y-6">
      {isOffline && (
        <StatusBanner
          variant="warning"
          message="You’re offline. We’ll keep trying to reconnect."
        />
      )}
      {error && !isOffline && (
        <StatusBanner
          variant="error"
          message={error}
          onRetry={() => {
            setResultsVersion((prev) => prev + 1);
            setRefreshToken((prev) => prev + 1);
            setNextPageToken(null);
            setRestaurants([]);
            setError(null);
          }}
        />
      )}
      <SearchSection
        value={search}
        onChange={setSearch}
        filters={filters}
        setFilters={applyFilters}
        onSurprise={handleSurpriseMe}
        surpriseDisabled={isInitialLoading || (restaurants.length === 0 && recentlyViewed.length === 0)}
        theme={theme}
        onToggleTheme={onToggleTheme}
      />
      {becauseYouLikedSection.list.length > 0 && latestVisit && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500">Because you liked</p>
              <h2 className="text-xl font-semibold">{latestVisit.snapshot.name}</h2>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {becauseYouLikedSection.list.map((restaurant) => {
              const visitInfo = visitStats[restaurant.id];
              return (
                <RestaurantCard
                  key={`liked-${restaurant.id}`}
                  restaurant={restaurant}
                  onClick={() => onSelectRestaurant(restaurant)}
                  onFavorite={() => onToggleFavorite(restaurant.id)}
                  visited={Boolean(visitInfo)}
                  visitCount={visitInfo?.count}
                  lastVisited={visitInfo?.lastVisited}
                  onCheckIn={() => onCheckIn(restaurant)}
                />
              );
            })}
          </div>
        </section>
      )}
      {historySmartSection.list.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500">Smart recommendations</p>
              <h2 className="text-xl font-semibold">
                Inspired by your love for {historySmartSection.topTypes.map((type) => type.replace(/_/g, " ")).join(", ")}
              </h2>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {historySmartSection.list.map((restaurant) => {
              const visitInfo = visitStats[restaurant.id];
              return (
                <RestaurantCard
                  key={`history-${restaurant.id}`}
                  restaurant={restaurant}
                  onClick={() => onSelectRestaurant(restaurant)}
                  onFavorite={() => onToggleFavorite(restaurant.id)}
                  visited={Boolean(visitInfo)}
                  visitCount={visitInfo?.count}
                  lastVisited={visitInfo?.lastVisited}
                  onCheckIn={() => onCheckIn(restaurant)}
                />
              );
            })}
          </div>
        </section>
      )}
      <TrendingSection
        restaurants={restaurants}
        onLoadMore={loadMore}
        hasMore={Boolean(nextPageToken)}
        loading={isInitialLoading}
        resetKey={resultsVersion}
        onSelectRestaurant={onSelectRestaurant}
        onToggleFavorite={onToggleFavorite}
        onCheckIn={onCheckIn}
        visitStats={visitStats}
      />
      {recentlyViewed.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Recently Viewed</h2>
            <span className="text-sm text-gray-500">Up to 12 of your latest picks</span>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {recentlyViewed.map((restaurant, index) => {
              const visitInfo = visitStats[restaurant.id];
              return (
                <RestaurantCard
                  key={`recent-${restaurant.id}-${index}`}
                  restaurant={restaurant}
                  onClick={() => onSelectRestaurant(restaurant)}
                  onFavorite={() => onToggleFavorite(restaurant.id)}
                  visited={Boolean(visitInfo)}
                  visitCount={visitInfo?.count}
                  lastVisited={visitInfo?.lastVisited}
                  onCheckIn={() => onCheckIn(restaurant)}
                />
              );
            })}
          </div>
        </section>
      )}
      {timelineVisits.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Visit History</h2>
            <span className="text-sm text-gray-500">Tap to jump back into a favorite spot</span>
          </div>
          <VisitTimeline visits={timelineVisits} onSelectVisit={handleVisitSelect} />
        </section>
      )}
      {!loading && !nextPageToken && <p className="text-center text-gray-500">No more restaurants</p>}
    </div>
  );
};

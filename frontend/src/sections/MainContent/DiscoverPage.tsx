import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Restaurant, FilterOptions, DEFAULT_FILTERS, createDefaultFilters } from "../../../types";
import { RestaurantCard } from "../../components/RestaurantCard";
import { SearchSection } from "../SearchSection/SearchSection";
import { TrendingSection } from "../TrendingSection/TrendingSection";
import { fetchRestaurants } from "../../api/restaurants";
import { StatusBanner } from "../../components/StatusBanner";
import { buildRestaurantQueryParams, filterRestaurantsClientSide } from "../../utils/restaurantFilters";

type Props = {
  onSelectRestaurant: (restaurant: Restaurant) => void;
  onToggleFavorite: (id: string) => void;
  favorites: string[];
  onCheckIn: (restaurant: Restaurant) => void;
  theme: "light" | "dark";
  onToggleTheme: () => void;
};

const FILTERS_STORAGE_KEY = "discoverFilters";
const TRENDING_CUISINES = ["All", "Pizza", "Burgers", "Sushi", "Tacos", "BBQ", "Steak", "Pasta", "Thai"];
const isDefaultFilters = (filters: FilterOptions): boolean =>
  filters.cuisines.length === 0 &&
  filters.priceRanges.length === 0 &&
  filters.minRating === DEFAULT_FILTERS.minRating &&
  filters.openNow === DEFAULT_FILTERS.openNow &&
  filters.distanceMiles === DEFAULT_FILTERS.distanceMiles;

export const DiscoverPage = ({
  onSelectRestaurant,
  onToggleFavorite,
  favorites,
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
  const [pagesLoaded, setPagesLoaded] = useState(1);

  const applyFilters = useCallback((next: FilterOptions) => {
    setFiltersState({
      ...next,
      cuisines: [...next.cuisines],
      priceRanges: [...next.priceRanges],
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
        setPagesLoaded(1);
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
    if (!nextPageToken || loading || pagesLoaded >= 4) return false;
    setLoading(true);
    try {
      const data = await fetchRestaurants({ ...requestParams, pageToken: nextPageToken });
      const filtered = filterRestaurantsClientSide(data.results, filters);
      setRestaurants((prev) => attachFavoriteState([...prev, ...filtered]));
      setNextPageToken(data.nextPageToken || null);
      setPagesLoaded((prev) => prev + 1);
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

  const isInitialLoading = loading && restaurants.length === 0;

  useEffect(() => {
    setRestaurants((prev) => attachFavoriteState(prev));
  }, [favorites, attachFavoriteState]);

  const handleSurpriseMe = useCallback(() => {
    const pool = restaurants.length > 0 ? restaurants : [];
    if (!pool.length) {
      return;
    }
    const randomIndex = Math.floor(Math.random() * pool.length);
    const randomRestaurant = pool[randomIndex];
    onSelectRestaurant(randomRestaurant);
  }, [restaurants, onSelectRestaurant]);

  const handleTrendingSelect = (cuisine: string) => {
    if (cuisine === "All") {
      const reset = createDefaultFilters();
      applyFilters(reset);
      setSearch("");
      setPagesLoaded(1);
      setRefreshToken((prev) => prev + 1);
      return;
    }

    const next: FilterOptions = {
      ...filters,
      cuisines: [cuisine],
      priceRanges: [],
      minRating: filters.minRating,
      openNow: filters.openNow,
      distanceMiles: filters.distanceMiles,
    };
    applyFilters(next);
    setSearch(cuisine);
    setPagesLoaded(1);
    setRefreshToken((prev) => prev + 1);
  };

  useEffect(() => {
    if (search.trim() === "" && !isDefaultFilters(filters)) {
      setFiltersState(createDefaultFilters());
      setPagesLoaded(1);
      setRefreshToken((prev) => prev + 1);
    }
  }, [search, filters]);

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
        surpriseDisabled={isInitialLoading || restaurants.length === 0}
        theme={theme}
        onToggleTheme={onToggleTheme}
      />
      <div className="mb-4 flex flex-wrap gap-2">
        {TRENDING_CUISINES.map((cuisine) => (
          <button
            key={cuisine}
            type="button"
            onClick={() => handleTrendingSelect(cuisine)}
            className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 dark:border-indigo-500/40 dark:bg-indigo-600/20 dark:text-indigo-100 dark:hover:bg-indigo-600/30"
          >
            {cuisine}
          </button>
        ))}
      </div>
      <TrendingSection
        restaurants={restaurants}
        onLoadMore={loadMore}
        hasMore={Boolean(nextPageToken) && pagesLoaded < 4}
        loading={isInitialLoading}
        resetKey={resultsVersion}
        onSelectRestaurant={onSelectRestaurant}
        onToggleFavorite={onToggleFavorite}
        onCheckIn={onCheckIn}
      />
      {Boolean(nextPageToken) && pagesLoaded < 4 && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={loadMore}
            disabled={loading}
            className="mt-4 inline-flex items-center justify-center rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-300"
          >
            {loading ? "Loading..." : `Next page (${pagesLoaded}/4)`}
          </button>
        </div>
      )}
      {!loading && (!nextPageToken || pagesLoaded >= 4) && (
        <p className="text-center text-gray-500">No more restaurants</p>
      )}
    </div>
  );
};

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Restaurant, FilterOptions, DEFAULT_FILTERS, createDefaultFilters } from "../../../types";
import { RestaurantCard } from "../../components/RestaurantCard";
import { SearchSection } from "../SearchSection/SearchSection";
import { TrendingSection } from "../TrendingSection/TrendingSection";
import { fetchRestaurants } from "../../api/restaurants";
import { StatusBanner } from "../../components/StatusBanner";

type Props = {
  onSelectRestaurant: (restaurant: Restaurant) => void;
  onToggleFavorite: (id: string) => void;
  favorites: string[];
  recentlyViewed: Restaurant[];
};

const FILTERS_STORAGE_KEY = "discoverFilters";

export const DiscoverPage = ({
  onSelectRestaurant,
  onToggleFavorite,
  favorites,
  recentlyViewed,
}: Props) => {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
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

  const PRICE_RANGE_TO_LEVEL: Record<string, number> = useMemo(
    () => ({
      "$": 1,
      "$$": 2,
      "$$$": 3,
      "$$$$": 4,
    }),
    []
  );

  const requestParams = useMemo(() => {
    const trimmedSearch = search.trim();
    const keywordParts: string[] = [];

    if (trimmedSearch) keywordParts.push(trimmedSearch);
    if (filters.cuisines.length) keywordParts.push(filters.cuisines.join(" "));

    const keyword = keywordParts.join(" ").trim() || "restaurant";

    const priceSelections = filters.priceRanges
      .map((range) => PRICE_RANGE_TO_LEVEL[range])
      .filter((level): level is number => typeof level === "number");

    const minPrice = priceSelections.length ? Math.min(...priceSelections) : undefined;
    const maxPrice = priceSelections.length ? Math.max(...priceSelections) : undefined;

    const radiusMeters = Math.round(Math.max(1, filters.distanceMiles) * 1609.34);

    return {
      keyword,
      minPrice,
      maxPrice,
      openNow: filters.openNow,
      radiusMeters,
    };
  }, [
    search,
    filters.cuisines,
    filters.priceRanges,
    filters.openNow,
    filters.distanceMiles,
    PRICE_RANGE_TO_LEVEL,
  ]);

  const applyClientFilters = useCallback(
    (items: Restaurant[]) => {
      const normalize = (value: string) => value.replace(/_/g, " ").toLowerCase();

      const dietaryFilters = filters.dietary.map((item) => normalize(item));
      const minRating = filters.minRating;

      return items.filter((restaurant) => {
        const dietary = (restaurant.dietary ?? []).map(normalize);

        const matchesRating = (restaurant.rating ?? 0) >= minRating;
        const matchesDietary =
          dietaryFilters.length === 0 ||
          (dietary.length > 0 && dietaryFilters.every((option) => dietary.includes(option)));

        return matchesRating && matchesDietary;
      });
    },
    [filters.dietary, filters.minRating]
  );

  // 🔹 Load first page
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchRestaurants(requestParams);
        const filtered = applyClientFilters(data.results);
        setRestaurants(filtered);
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
  }, [requestParams, applyClientFilters, refreshToken]);

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
      const filtered = applyClientFilters(data.results);
      setRestaurants((prev) => [...prev, ...filtered]);
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
  }, [nextPageToken, loading, requestParams, applyClientFilters]);

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
      <SearchSection value={search} onChange={setSearch} filters={filters} setFilters={applyFilters} />
      <TrendingSection
        restaurants={restaurants}
        onLoadMore={loadMore}
        hasMore={Boolean(nextPageToken)}
        loading={isInitialLoading}
        resetKey={resultsVersion}
        onSelectRestaurant={onSelectRestaurant}
        onToggleFavorite={onToggleFavorite}
      />
      {recentlyViewed.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Recently Viewed</h2>
            <span className="text-sm text-gray-500">Up to 12 of your latest picks</span>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {recentlyViewed.map((restaurant, index) => (
              <RestaurantCard
                key={`recent-${restaurant.id}-${index}`}
                restaurant={restaurant}
                onClick={() => onSelectRestaurant(restaurant)}
                onFavorite={() => onToggleFavorite(restaurant.id)}
              />
            ))}
          </div>
        </section>
      )}
      {!loading && !nextPageToken && <p className="text-center text-gray-500">No more restaurants</p>}
    </div>
  );
};

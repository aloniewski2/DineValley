import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Sidebar } from "./sections/Sidebar/Sidebar";
import { DiscoverPage } from "./sections/MainContent/DiscoverPage";
import { RecommendationsPage } from "./sections/MainContent/RecommendationsPage";
import { ProfilePage } from "./sections/MainContent/ProfilePage";
import { RestaurantDetailsPage } from "./sections/MainContent/RestaurantDetailsPage";
import { Restaurant, RestaurantDetails } from "../types";
import { fetchRestaurants, fetchRestaurantDetails } from "./api/restaurants";
import { useLocalStorage } from "./hooks/useLocalStorage";

export type Page = "discover" | "recommendations" | "profile" | "restaurant-details";

export const App = () => {
  const [currentPage, setCurrentPage] = useState<Page>("discover");
  const [selectedRestaurantId, setSelectedRestaurantId] = useState<string | null>(null);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [selectedRestaurantSnapshot, setSelectedRestaurantSnapshot] = useState<Restaurant | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [selectedRestaurantDetails, setSelectedRestaurantDetails] = useState<RestaurantDetails | null>(null);
  const [favoriteIds, setFavoriteIds] = useLocalStorage<string[]>("favoriteRestaurants", []);
  const [recentlyViewed, setRecentlyViewed] = useLocalStorage<string[]>("recentRestaurants", []);
  const [favoriteSnapshots, setFavoriteSnapshots] = useLocalStorage<Record<string, Restaurant>>(
    "favoriteRestaurantData",
    {}
  );

  // Load restaurants once on startup
  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchRestaurants({ keyword: "restaurant" });
        console.log("Fetched restaurants:", data);
        setRestaurants(data.results);
      } catch (err) {
        console.error("Failed to load restaurants", err);
      }
    };
    load();
  }, []);

  useEffect(() => {
    if (!selectedRestaurantId || currentPage !== "restaurant-details") {
      setSelectedRestaurantDetails(null);
      setDetailsError(null);
      setDetailsLoading(false);
      return;
    }

    let ignore = false;

    const loadDetails = async () => {
      setDetailsLoading(true);
      setDetailsError(null);
      try {
        const details = await fetchRestaurantDetails(selectedRestaurantId);
        if (!ignore) {
          setSelectedRestaurantDetails(details);
        }
      } catch (err) {
        if (!ignore) {
          console.error("Failed to load restaurant details", err);
          setDetailsError("Unable to load restaurant details right now.");
        }
      } finally {
        if (!ignore) {
          setDetailsLoading(false);
        }
      }
    };

    loadDetails();

    return () => {
      ignore = true;
    };
  }, [selectedRestaurantId, currentPage]);

  const mapDetailsToRestaurant = useCallback(
    (details: RestaurantDetails, fallback?: Restaurant | null): Restaurant => ({
      id: details.id,
      name: details.name,
      imageUrl: details.imageUrl,
      rating: details.rating ?? fallback?.rating ?? 0,
      reviewCount: fallback?.reviewCount ?? details.reviewSummary?.total ?? 0,
      address: details.address || fallback?.address || "",
      priceLevel: fallback?.priceLevel ?? null,
      businessStatus: fallback?.businessStatus ?? "UNKNOWN",
      types: details.types ?? fallback?.types ?? [],
      isFavorite: true,
      dietary: fallback?.dietary,
    }),
    []
  );

  const shouldUpdateFavoriteSnapshot = useCallback(
    (existing: Restaurant | undefined, next: Restaurant) => {
      if (!existing) return true;
      if (existing.name !== next.name) return true;
      if (existing.imageUrl !== next.imageUrl) return true;
      if (existing.rating !== next.rating) return true;
      if (existing.reviewCount !== next.reviewCount) return true;
      if (existing.address !== next.address) return true;
      if (existing.priceLevel !== next.priceLevel) return true;
      if (existing.businessStatus !== next.businessStatus) return true;
      if (existing.types.length !== next.types.length) return true;
      for (let index = 0; index < existing.types.length; index += 1) {
        if (existing.types[index] !== next.types[index]) {
          return true;
        }
      }
      return false;
    },
    []
  );

  const handleNavigate = (page: Page) => setCurrentPage(page);

  const handleSelectRestaurant = (restaurant: Restaurant) => {
    setSelectedRestaurantId(restaurant.id);
    setSelectedRestaurantSnapshot(restaurant);
    setRecentlyViewed((prev) => {
      const without = prev.filter((id) => id !== restaurant.id);
      return [restaurant.id, ...without].slice(0, 12);
    });
    setCurrentPage("restaurant-details");
  };

  const handleBackFromRestaurant = () => {
    setSelectedRestaurantId(null);
    setSelectedRestaurantSnapshot(null);
    setSelectedRestaurantDetails(null);
    setCurrentPage("discover");
  };

  const handleToggleFavorite = useCallback(
    (id: string) => {
      let shouldAdd = false;

      setFavoriteIds((prev) => {
        const exists = prev.includes(id);
        shouldAdd = !exists;
        if (exists) {
          return prev.filter((favId) => favId !== id);
        }
        return [id, ...prev].slice(0, 100);
      });

      setFavoriteSnapshots((prev) => {
        if (shouldAdd) {
          const fromList = restaurants.find((restaurant) => restaurant.id === id) ?? null;
          const fallback = fromList ?? selectedRestaurantSnapshot ?? prev[id] ?? null;
          const candidate =
            fromList ??
            selectedRestaurantSnapshot ??
            (selectedRestaurantDetails
              ? mapDetailsToRestaurant(selectedRestaurantDetails, fallback)
              : fallback);

          if (!candidate) {
            return prev;
          }

          if (prev[id] && !shouldUpdateFavoriteSnapshot(prev[id], candidate)) {
            return prev;
          }

          return {
            ...prev,
            [id]: { ...candidate, isFavorite: true },
          };
        }

        if (!(id in prev)) {
          return prev;
        }

        const { [id]: _removed, ...rest } = prev;
        return rest;
      });

      setRestaurants((prev) =>
        prev.map((r) => (r.id === id ? { ...r, isFavorite: !r.isFavorite } : r))
      );
      setSelectedRestaurantSnapshot((prev) =>
        prev && prev.id === id ? { ...prev, isFavorite: !prev.isFavorite } : prev
      );
    },
    [
      mapDetailsToRestaurant,
      restaurants,
      selectedRestaurantDetails,
      selectedRestaurantSnapshot,
      setFavoriteIds,
      setFavoriteSnapshots,
      shouldUpdateFavoriteSnapshot,
    ]
  );

  useEffect(() => {
    setRestaurants((prev) =>
      prev.map((restaurant) => ({
        ...restaurant,
        isFavorite: favoriteIds.includes(restaurant.id),
      }))
    );
    setSelectedRestaurantSnapshot((prev) =>
      prev ? { ...prev, isFavorite: favoriteIds.includes(prev.id) } : prev
    );
  }, [favoriteIds]);

  useEffect(() => {
    if (!restaurants.length || !favoriteIds.length) {
      return;
    }

    const restaurantMap = new Map(restaurants.map((restaurant) => [restaurant.id, restaurant]));

    setFavoriteSnapshots((prev) => {
      let changed = false;
      const next = { ...prev };

      favoriteIds.forEach((id) => {
        const match = restaurantMap.get(id);
        if (!match) return;

        if (shouldUpdateFavoriteSnapshot(next[id], match)) {
          next[id] = { ...match, isFavorite: true };
          changed = true;
        }
      });

      return changed ? next : prev;
    });
  }, [favoriteIds, restaurants, setFavoriteSnapshots, shouldUpdateFavoriteSnapshot]);

  useEffect(() => {
    if (!selectedRestaurantDetails) {
      return;
    }

    const id = selectedRestaurantDetails.id;
    if (!favoriteIds.includes(id)) {
      return;
    }

    setFavoriteSnapshots((prev) => {
      const fallback = selectedRestaurantSnapshot ?? prev[id] ?? null;
      const candidate = mapDetailsToRestaurant(selectedRestaurantDetails, fallback);

      if (prev[id] && !shouldUpdateFavoriteSnapshot(prev[id], candidate)) {
        return prev;
      }

      return {
        ...prev,
        [id]: { ...candidate, isFavorite: true },
      };
    });
  }, [
    favoriteIds,
    mapDetailsToRestaurant,
    selectedRestaurantDetails,
    selectedRestaurantSnapshot,
    setFavoriteSnapshots,
    shouldUpdateFavoriteSnapshot,
  ]);

  const recentRestaurants = useMemo(() =>
    recentlyViewed
      .map((id) => restaurants.find((r) => r.id === id) || null)
      .filter(Boolean) as Restaurant[],
    [recentlyViewed, restaurants]
  );

  const favoriteRestaurants = useMemo(() => {
    if (!favoriteIds.length) return [];

    const favoritesFromList = restaurants.filter((restaurant) =>
      favoriteIds.includes(restaurant.id)
    );
    const existingIds = new Set(favoritesFromList.map((restaurant) => restaurant.id));

    const storedExtras = favoriteIds
      .map((id) => favoriteSnapshots[id])
      .filter((restaurant): restaurant is Restaurant => Boolean(restaurant))
      .filter((restaurant) => !existingIds.has(restaurant.id))
      .map((restaurant) => ({ ...restaurant, isFavorite: true }));

    return [...favoritesFromList, ...storedExtras];
  }, [favoriteIds, favoriteSnapshots, restaurants]);

  const renderPage = () => {
    switch (currentPage) {
      case "discover":
        return (
          <DiscoverPage
            onSelectRestaurant={handleSelectRestaurant}
            onToggleFavorite={handleToggleFavorite}
            favorites={favoriteIds}
            recentlyViewed={recentRestaurants}
          />
        );
      case "recommendations":
        return (
          <RecommendationsPage
            restaurants={restaurants}
            onSelectRestaurant={handleSelectRestaurant}
            onToggleFavorite={handleToggleFavorite}
            favorites={favoriteIds}
            recentlyViewed={recentRestaurants}
          />
        );
      case "profile":
        return (
          <ProfilePage
            restaurants={restaurants}
            onSelectRestaurant={handleSelectRestaurant}
            onToggleFavorite={handleToggleFavorite}
            favorites={favoriteRestaurants}
          />
        );
      case "restaurant-details":
        if (!selectedRestaurantId) return null;
        return (
          <RestaurantDetailsPage
            restaurantId={selectedRestaurantId}
            fallbackRestaurant={selectedRestaurantSnapshot}
            details={selectedRestaurantDetails}
            loading={detailsLoading}
            error={detailsError}
            onBack={handleBackFromRestaurant}
            onToggleFavorite={handleToggleFavorite}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar onNavigate={handleNavigate} currentPage={currentPage} />
      <div className="flex-1 flex flex-col overflow-y-auto">{renderPage()}</div>
    </div>
  );
};

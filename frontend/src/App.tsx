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

  // 🔹 Load restaurants once on startup
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

  const handleToggleFavorite = useCallback((id: string) => {
    setFavoriteIds((prev) => {
      const exists = prev.includes(id);
      if (exists) {
        return prev.filter((favId) => favId !== id);
      }
      return [id, ...prev].slice(0, 100);
    });
    setRestaurants((prev) =>
      prev.map((r) => (r.id === id ? { ...r, isFavorite: !r.isFavorite } : r))
    );
    setSelectedRestaurantSnapshot((prev) =>
      prev && prev.id === id ? { ...prev, isFavorite: !prev.isFavorite } : prev
    );
  }, [setFavoriteIds]);

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

  const recentRestaurants = useMemo(() =>
    recentlyViewed
      .map((id) => restaurants.find((r) => r.id === id) || null)
      .filter(Boolean) as Restaurant[],
    [recentlyViewed, restaurants]
  );

  const favoriteRestaurants = useMemo(
    () => restaurants.filter((restaurant) => favoriteIds.includes(restaurant.id)),
    [restaurants, favoriteIds]
  );

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

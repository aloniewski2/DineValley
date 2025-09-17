import React, { useState } from "react";
import { Sidebar } from "./sections/Sidebar";
import { DiscoverPage } from "../src/sections/MainContent/DiscoverPage";
import { RecommendationsPage } from "./sections/MainContent/RecommendationsPage";
import { ProfilePage } from "../src/sections/MainContent/ProfilePage";
import { RestaurantDetailsPage } from "../src/sections/MainContent/RestaurantDetailsPage";
import { mockRestaurants } from "../data/mockdata";
import { Restaurant } from "../types";

export type Page = "discover" | "recommendations" | "profile" | "restaurant-details";

export const App = () => {
  const [currentPage, setCurrentPage] = useState<Page>("discover");
  const [selectedRestaurantId, setSelectedRestaurantId] = useState<string | null>(null);
  const [restaurants, setRestaurants] = useState<Restaurant[]>(mockRestaurants);

  const selectedRestaurant = selectedRestaurantId
    ? restaurants.find((r) => r.id === selectedRestaurantId)
    : null;

  const handleNavigate = (page: Page) => setCurrentPage(page);
  const handleSelectRestaurant = (id: string) => {
    setSelectedRestaurantId(id);
    setCurrentPage("restaurant-details");
  };
  const handleBackFromRestaurant = () => {
    setSelectedRestaurantId(null);
    setCurrentPage("discover");
  };
  const handleToggleFavorite = (id: string) =>
    setRestaurants((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, isFavorite: !r.isFavorite } : r
      )
    );

  const renderPage = () => {
    switch (currentPage) {
      case "discover":
        return (
          <DiscoverPage
            restaurants={restaurants}
            onSelectRestaurant={handleSelectRestaurant}
            onToggleFavorite={handleToggleFavorite}
          />
        );
      case "recommendations":
        return (
          <RecommendationsPage
            restaurants={restaurants}
            onSelectRestaurant={handleSelectRestaurant}
            onToggleFavorite={handleToggleFavorite}
          />
        );
      case "profile":
        return (
          <ProfilePage
            restaurants={restaurants}
            onSelectRestaurant={handleSelectRestaurant}
            onToggleFavorite={handleToggleFavorite}
          />
        );
      case "restaurant-details":
        if (!selectedRestaurant) return null;
        return (
          <RestaurantDetailsPage
            restaurant={selectedRestaurant}
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
      <Sidebar onNavigate={handleNavigate} />
      <div className="flex-1 flex flex-col overflow-hidden">
        {renderPage()}
      </div>
    </div>
  );
};

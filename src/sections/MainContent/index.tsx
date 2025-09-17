import React from 'react';
import { Header } from "./components/Header";
import { SearchSection } from "../SearchSection";
import { TrendingSection } from "../TrendingSection";
import { AllRestaurantsSection } from "../AllRestaurantsSection";

export const MainContent = () => {
  return (
    <main className="box-border caret-transparent flex basis-[0%] flex-col grow outline-[oklab(0.708_0_0_/_0.5)]">
      <Header />
      <div className="box-border caret-transparent basis-[0%] grow outline-[oklab(0.708_0_0_/_0.5)] p-6">
        <div className="box-border caret-transparent outline-[oklab(0.708_0_0_/_0.5)]">
          <div className="box-border caret-transparent outline-[oklab(0.708_0_0_/_0.5)] mb-6">
            <h1 className="text-2xl font-medium box-border caret-transparent leading-9 outline-[oklab(0.708_0_0_/_0.5)]">
              Discover Great Restaurants
            </h1>
            <p className="text-gray-500 box-border caret-transparent outline-[oklab(0.708_0_0_/_0.5)] mt-1">
              Find your next favorite dining spot in the Lehigh Valley
            </p>
          </div>
          <SearchSection />
          <TrendingSection />
          <AllRestaurantsSection />
        </div>
      </div>
    </main>
  );
};

import React, { useState } from 'react';
import { Header } from "./components/Header";
import { SearchSection } from "../SearchSection/SearchSection";
import { TrendingSection } from "../TrendingSection/TrendingSection";
import { Restaurant, FilterOptions, createDefaultFilters } from "../../../types";

// ----- MOCK DATA (Replace with real data/state) -----
const restaurants: Restaurant[] = [
  {
    id: "1",
    name: "Bella Vista Italian",
    types: ["Italian", "Mediterranean"],
    rating: 4.8,
    imageUrl: "https://c.animaapp.com/mfn8xsm35Iri3M/assets/1.jpg",
    address: "123 Main St, Bethlehem, PA 18018",
    reviewCount: 120,
    priceLevel: 3,
    businessStatus: "OPERATIONAL",
  },
  {
    id: "2",
    name: "The Copper Kettle",
    types: ["American", "Contemporary"],
    rating: 4.5,
    imageUrl: "https://c.animaapp.com/mfn8xsm35Iri3M/assets/2.jpg",
    address: "654 Third St, Bethlehem, PA 18015",
    reviewCount: 95,
    priceLevel: 3,
    businessStatus: "OPERATIONAL",
  },
  {
    id: "3",
    name: "Sakura Sushi House",
    types: ["Japanese", "Sushi"],
    rating: 4.6,
    imageUrl: "https://c.animaapp.com/mfn8xsm35Iri3M/assets/3.jpg",
    address: "456 Cedar Ave, Allentown, PA 18104",
    reviewCount: 95,
    priceLevel: 2,
    businessStatus: "OPERATIONAL",
  },
  // ...add as many as you need
];

// These are the top 3 trending (example)
const trendingRestaurants = restaurants.slice(0, 3);

// ----- MOCK HANDLERS (Replace with real handlers or state dispatch) -----
const onSelectRestaurant = (restaurant: Restaurant) => {
  console.log("Selected restaurant:", restaurant.id);
};

const onToggleFavorite = (id: string) => {
  console.log("Toggle favorite for restaurant:", id);
};
// -----------------------------------------------------------

export const MainContent: React.FC = () => {
  const [searchValue, setSearchValue] = useState("");
  const [filters, setFilters] = useState<FilterOptions>(createDefaultFilters());

  const handleSearchChange = (value: string) => setSearchValue(value);
  const handleFiltersChange = (value: FilterOptions) => setFilters(value);

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
          <SearchSection
            value={searchValue}
            onChange={handleSearchChange}
            filters={filters}
            setFilters={handleFiltersChange}
            onSurprise={() => trendingRestaurants.length && onSelectRestaurant(trendingRestaurants[0])}
            surpriseDisabled={trendingRestaurants.length === 0}
          />
          <TrendingSection
            restaurants={trendingRestaurants}
            onSelectRestaurant={onSelectRestaurant}
            onToggleFavorite={onToggleFavorite}
          />
        </div>
      </div>
    </main>
  );
};

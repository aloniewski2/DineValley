import React from 'react';
import { SearchBar } from "./components/SearchBar";
import { FilterButton } from "./components/FilterButton";
import { SurpriseMeButton } from "./components/SurpriseMeButton";

export const SearchSection = () => {
  return (
    <div className="box-border caret-transparent outline-[oklab(0.708_0_0_/_0.5)] mb-6">
      <div className="box-border caret-transparent gap-x-2 flex outline-[oklab(0.708_0_0_/_0.5)] gap-y-2">
        <SearchBar />
        <FilterButton />
        <SurpriseMeButton />
      </div>
    </div>
  );
};

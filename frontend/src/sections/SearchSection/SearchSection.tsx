
import React, { useState } from "react";
import { SearchBar } from "./components/SearchBar";
import { FilterButton } from "./components/FilterButton";
import { SurpriseMeButton } from "./components/SurpriseMeButton";
import { FilterModel } from "../MainContent/components/FilterModel";
import { FilterOptions, createDefaultFilters } from "../../../types";

interface SearchSectionProps {
  value: string;
  onChange: (v: string) => void;
  filters: FilterOptions;
  setFilters: (f: FilterOptions) => void;
}

export const SearchSection: React.FC<SearchSectionProps> = ({ value, onChange, filters, setFilters }) => {
  const [filterOpen, setFilterOpen] = useState(false);

  return (
    <div className="box-border caret-transparent outline-[oklab(0.708_0_0_/_0.5)] mb-6">
      <div className="box-border caret-transparent gap-x-2 flex outline-[oklab(0.708_0_0_/_0.5)] gap-y-2">
        <SearchBar value={value} onChange={onChange} />
        <FilterButton onClick={() => setFilterOpen(true)} />
        <SurpriseMeButton />
      </div>
      <FilterModel
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        value={filters}
        onChange={setFilters}
        onClear={() => setFilters(createDefaultFilters())}
      />
    </div>
  );
};

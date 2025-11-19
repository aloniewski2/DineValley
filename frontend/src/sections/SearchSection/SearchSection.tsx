import React, { useState } from "react";
import { SearchBar } from "./components/SearchBar";
import { FilterButton } from "./components/FilterButton";
import { SurpriseMeButton } from "./components/SurpriseMeButton";
import { ThemeToggleButton } from "./components/ThemeToggleButton";
import { FilterModel } from "../MainContent/components/FilterModel";
import { FilterOptions, createDefaultFilters } from "../../../types";

interface SearchSectionProps {
  value: string;
  onChange: (v: string) => void;
  filters: FilterOptions;
  setFilters: (f: FilterOptions) => void;
  onSurprise?: () => void;
  surpriseDisabled?: boolean;
  theme: "light" | "dark";
  onToggleTheme: () => void;
}

export const SearchSection: React.FC<SearchSectionProps> = ({
  value,
  onChange,
  filters,
  setFilters,
  onSurprise,
  surpriseDisabled = false,
  theme,
  onToggleTheme,
}) => {
  const [filterOpen, setFilterOpen] = useState(false);

  return (
    <div className="box-border caret-transparent outline-[oklab(0.708_0_0_/_0.5)] mb-6">
      <div className="box-border caret-transparent flex flex-col gap-2 md:flex-row md:items-center outline-[oklab(0.708_0_0_/_0.5)]">
        <div className="flex-1">
          <SearchBar value={value} onChange={onChange} />
        </div>
        <div className="flex flex-wrap items-center gap-2 justify-end">
          <FilterButton onClick={() => setFilterOpen(true)} />
          <SurpriseMeButton onClick={onSurprise} disabled={surpriseDisabled} />
          <ThemeToggleButton theme={theme} onToggle={onToggleTheme} />
        </div>
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

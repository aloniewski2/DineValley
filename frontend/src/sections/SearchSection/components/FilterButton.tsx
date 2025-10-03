import React from "react";
interface FilterButtonProps {
  onClick?: () => void;
}
export const FilterButton: React.FC<FilterButtonProps> = ({ onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="text-sm font-medium items-center bg-white caret-transparent gap-x-2 flex shrink-0 h-9 justify-center leading-5 outline-[oklab(0.708_0_0_/_0.5)] gap-y-2 text-nowrap border px-3 py-2 rounded-lg border-solid border-black/10"
  >
    Filters
  </button>
);

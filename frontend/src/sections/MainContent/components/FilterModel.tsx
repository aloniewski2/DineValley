import React, { useState, useEffect } from "react";
import { Dialog } from "@headlessui/react";
import { X } from "lucide-react";
import { FilterOptions, createDefaultFilters } from "../../../../types";

const ALL_CUISINES = [
  "American", "Italian", "Mexican", "Chinese", "Japanese", "Indian", "Thai", "French"
];
const ALL_PRICE_RANGES = ["$", "$$", "$$$", "$$$$"];

interface FilterModelProps {
  open: boolean;
  onClose: () => void;
  value: FilterOptions;
  onChange: (filters: FilterOptions) => void;
  onClear: () => void;
}

export const FilterModel: React.FC<FilterModelProps> = ({
  open,
  onClose,
  value,
  onChange,
  onClear,
}) => {
  const [local, setLocal] = useState<FilterOptions>(value);

  useEffect(() => {
    if (open) {
      setLocal(value);
    }
  }, [open, value]);

  const update = (update: Partial<FilterOptions>) =>
    setLocal((prev) => ({ ...prev, ...update }));

  const handleApply = () => {
    onChange({
      ...local,
      cuisines: [...local.cuisines],
      priceRanges: [...local.priceRanges],
    });
    onClose();
  };

  const toggleArr = (arr: string[], val: string) =>
    arr.includes(val) ? arr.filter((a) => a !== val) : [...arr, val];

  return (
    <Dialog open={open} onClose={onClose} className="fixed z-50 inset-0 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="fixed inset-0 bg-black bg-opacity-30" aria-hidden="true" />
        <div className="relative z-10 w-full max-w-md mx-auto bg-white rounded-2xl shadow-lg p-6">
          {/* Close X Button */}
          <button
            onClick={onClose}
            className="absolute top-5 right-5 text-gray-400 hover:text-black p-2 rounded-full"
            aria-label="Close"
            type="button"
          >
            <X size={20} />
          </button>

          <Dialog.Title className="text-2xl font-bold">Filter Restaurants</Dialog.Title>
          <Dialog.Description className="mb-4 text-gray-500">
            Refine your search to find the perfect dining experience.
          </Dialog.Description>

          {/* Cuisine Multi-select */}
          <div className="mb-4">
            <label className="block font-semibold mb-1">Cuisine</label>
            <div className="flex flex-wrap gap-2">
              {ALL_CUISINES.map((cuisine) => (
                <button
                  key={cuisine}
                  type="button"
                  onClick={() => update({ cuisines: toggleArr(local.cuisines, cuisine) })}
                  className={`px-4 py-1 rounded-full text-sm border font-medium transition-colors
                    ${local.cuisines.includes(cuisine)
                      ? "bg-black text-white border-black"
                      : "bg-white text-gray-700 border-gray-300 hover:bg-black hover:text-white"}
                  `}
                >
                  {cuisine}
                </button>
              ))}
            </div>
          </div>

          {/* Price Range */}
          <div className="mb-4">
            <label className="block font-semibold mb-1">Price Range</label>
            <div className="grid grid-cols-2 gap-2">
              {ALL_PRICE_RANGES.map(range => (
                <button
                  key={range}
                  className={`rounded-lg px-4 py-2 font-semibold border transition-colors ${
                    local.priceRanges.includes(range)
                      ? "bg-black text-white border-black"
                      : "bg-white text-black border-gray-300 hover:bg-black hover:text-white"
                  }`}
                  onClick={() =>
                    update({ priceRanges: toggleArr(local.priceRanges, range) })
                  }
                  type="button"
                >
                  {range}
                </button>
              ))}
            </div>
          </div>

          {/* Minimum Rating */}
          <div className="mb-4">
            <label className="block font-semibold mb-1">
              Minimum Rating: {local.minRating.toFixed(1)} stars
            </label>
            <input
              type="range"
              min={0}
              max={5}
              step={0.1}
              value={local.minRating}
              onChange={e => update({ minRating: Number(e.target.value) })}
              className="w-full accent-indigo-500 mb-2"
            />
          </div>

          {/* Availability */}
          <div className="mb-4">
            <label className="block font-semibold mb-1">Availability</label>
            <button
              type="button"
              onClick={() => update({ openNow: !local.openNow })}
              className={`px-4 py-2 rounded-lg border font-medium transition-colors ${
                local.openNow
                  ? "bg-black text-white border-black"
                  : "bg-white text-gray-700 border-gray-300 hover:bg-black hover:text-white"
              }`}
            >
              {local.openNow ? "Showing open now" : "Include closed"}
            </button>
          </div>

          {/* Distance */}
          <div className="mb-4">
            <label className="block font-semibold mb-1">
              Max Distance: {local.distanceMiles.toFixed(0)} miles
            </label>
            <input
              type="range"
              min={1}
              max={30}
              step={1}
              value={local.distanceMiles}
              onChange={(e) => update({ distanceMiles: Number(e.target.value) })}
              className="w-full accent-indigo-500"
            />
            <p className="mt-1 text-xs text-gray-500">
              Adjust to search within a specific radius of the Lehigh Valley.
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-4 mt-6">
            <button
              className="flex-1 py-3 rounded-lg border font-semibold"
              onClick={() => {
                setLocal(createDefaultFilters());
                onClear();
              }}
              type="button"
            >
              Clear All
            </button>
            <button
              className="flex-1 py-3 rounded-lg bg-black text-white font-semibold"
              onClick={handleApply}
              type="button"
            >
              Apply Filters
            </button>
          </div>
        </div>
      </div>
    </Dialog>
  );
};

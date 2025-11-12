import { FilterOptions, Restaurant } from "../../types";

export const KNOWN_CUISINES = [
  "American",
  "Italian",
  "Mexican",
  "Chinese",
  "Japanese",
  "Indian",
  "Thai",
  "French",
  "Mediterranean",
  "Greek",
  "Spanish",
  "Korean",
  "Vietnamese",
  "Lebanese",
  "Turkish",
  "Brazilian",
  "Caribbean",
  "Ethiopian",
  "Moroccan",
  "BBQ",
  "Seafood",
  "Sushi",
  "Steakhouse",
];

export const KNOWN_DIETARY_OPTIONS = [
  "Vegetarian",
  "Vegan",
  "Gluten-Free",
  "Dairy-Free",
  "Nut-Free",
  "Egg-Free",
  "Soy-Free",
  "Shellfish-Free",
];

export const PRICE_RANGE_TO_LEVEL: Record<string, number> = {
  "$": 1,
  "$$": 2,
  "$$$": 3,
  "$$$$": 4,
};

export const cloneFilterOptions = (filters: FilterOptions): FilterOptions => ({
  ...filters,
  cuisines: [...filters.cuisines],
  priceRanges: [...filters.priceRanges],
  dietary: [...filters.dietary],
});

export const buildRestaurantQueryParams = (filters: FilterOptions, search: string) => {
  const trimmedSearch = search.trim();
  const keywordParts: string[] = [];

  if (trimmedSearch) keywordParts.push(trimmedSearch);
  if (filters.cuisines.length) keywordParts.push(filters.cuisines.join(" "));

  const keyword = keywordParts.join(" ").trim() || "restaurant";

  const priceSelections = filters.priceRanges
    .map((range) => PRICE_RANGE_TO_LEVEL[range])
    .filter((level): level is number => typeof level === "number");

  const minPrice = priceSelections.length ? Math.min(...priceSelections) : undefined;
  const maxPrice = priceSelections.length ? Math.max(...priceSelections) : undefined;

  const radiusMeters = Math.round(Math.max(1, filters.distanceMiles) * 1609.34);

  return {
    keyword,
    minPrice,
    maxPrice,
    openNow: filters.openNow,
    radiusMeters,
  };
};

export const filterRestaurantsClientSide = (restaurants: Restaurant[], filters: FilterOptions) => {
  const normalize = (value: string) => value.replace(/_/g, " ").toLowerCase();

  const dietaryFilters = filters.dietary.map((item) => normalize(item));
  const minRating = filters.minRating;

  return restaurants.filter((restaurant) => {
    const dietary = (restaurant.dietary ?? []).map(normalize);

    const matchesRating = (restaurant.rating ?? 0) >= minRating;
    const matchesDietary =
      dietaryFilters.length === 0 ||
      (dietary.length > 0 && dietaryFilters.every((option) => dietary.includes(option)));

    return matchesRating && matchesDietary;
  });
};

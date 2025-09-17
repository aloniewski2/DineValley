import { Restaurant } from "../types";

export const mockRestaurants: Restaurant[] = [
  {
    id: "1",
    name: "Pizza Palace",
    cuisineTypes: ["Italian", "Pizza"],
    rating: 4.5,
    imageUrl: "pizza.jpg",
    address: "123 Main St",
    reviewCount: 120,
    priceRange: "$$",
  },
  {
    id: "2",
    name: "Sushi Central",
    cuisineTypes: ["Japanese", "Sushi"],
    rating: 4.8,
    imageUrl: "sushi.jpg",
    address: "456 Ocean Ave",
    reviewCount: 95,
    priceRange: "$$$",
  },
];

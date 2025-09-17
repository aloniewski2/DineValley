import { Restaurant } from "../types";

export const mockRestaurants: Restaurant[] = [
  {
    id: "1",
    name: "Pizza Palace",
    cuisineTypes: ["Italian", "Pizza"],
    rating: 4.5,
    imageUrl: "https://i0.wp.com/olivesandlamb.com/wp-content/uploads/2024/05/Chicken-Parmesan-Pizza-10-4x5-1.jpg?resize=819%2C1024&ssl=1",
    address: "123 Main St",
    reviewCount: 120,
    priceRange: "$$",
    isFavorite: false,
    dietary: ["Vegetarian"],
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
    isFavorite: false,
    dietary: ["Gluten-Free", "Dairy-Free"],
  },
];

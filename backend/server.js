import express from "express";
import axios from "axios";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());

// Default location = Lehigh Valley
const DEFAULT_LOCATION = "40.6084,-75.4902"; // Allentown-ish center
const DEFAULT_RADIUS = 20000; // 20 km

// Root route
app.get("/", (req, res) => {
  res.send("✅ Backend is alive and ready!");
});

// Health check route
app.get("/health", (req, res) => {
  res.json({ status: "ok", message: "Backend is running 🚀" });
});

// Restaurants route
app.get("/restaurants", async (req, res) => {
  const {
    keyword,
    minPrice,
    maxPrice,
    openNow,
    minRating,
    minReviews,
  } = req.query;

  try {
    // Build Google Places request params
    const params = {
      location: DEFAULT_LOCATION,
      radius: DEFAULT_RADIUS,
      type: "restaurant",
      keyword,
      minprice: minPrice,
      maxprice: maxPrice,
      opennow: openNow === "true",
      key: process.env.GOOGLE_PLACES_API_KEY,
    };

    console.log("➡️ Google API request params:", params);

    const response = await axios.get(
      "https://maps.googleapis.com/maps/api/place/nearbysearch/json",
      { params }
    );

    let results = response.data.results || [];

    // Apply custom filters (rating + reviews)
    if (minRating) {
      results = results.filter((place) => place.rating >= Number(minRating));
    }
    if (minReviews) {
      results = results.filter(
        (place) => place.user_ratings_total >= Number(minReviews)
      );
    }

    res.json(results);
  } catch (error) {
    if (error.response) {
      console.error("❌ Google API Error:", error.response.data);
      return res.status(error.response.status).json(error.response.data);
    }
    console.error("❌ Server Error:", error.message);
    res.status(500).json({ error: "Failed to fetch restaurants" });
  }
});

const PORT = process.env.PORT || 5050;
app.listen(PORT, () =>
  console.log(`🚀 Backend running on http://localhost:${PORT}`)
);

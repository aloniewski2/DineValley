import express from "express";
import axios from "axios";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());

const PORT = process.env.PORT || 5050;
const API_KEY = process.env.GOOGLE_PLACES_API_KEY;

// 🔑 Fail fast if key is missing
if (!API_KEY) {
  console.error("❌ ERROR: GOOGLE_PLACES_API_KEY is missing in .env");
  process.exit(1);
}

// ✅ Health check
app.get("/", (req, res) => {
  res.send("✅ Backend is alive and ready!");
});

app.get("/health", (req, res) => {
  res.json({ status: "ok", port: PORT });
});

// ✅ Restaurants endpoint
app.get("/restaurants", async (req, res) => {
  try {
    const { keyword, minPrice, maxPrice, opennow } = req.query;

    const params = {
      location: "40.6084,-75.4902", // Lehigh Valley
      radius: 20000,
      type: "restaurant",
      keyword,
      minprice: minPrice,
      maxprice: maxPrice,
      opennow: opennow === "true" ? true : undefined,
      key: API_KEY,
    };

    const response = await axios.get(
      "https://maps.googleapis.com/maps/api/place/nearbysearch/json",
      { params }
    );

    // 🔹 Map raw Google response -> simplified restaurant object
    const mappedResults = response.data.results.map((r) => ({
      id: r.place_id,
      name: r.name,
      imageUrl: r.photos
        ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${r.photos[0].photo_reference}&key=${API_KEY}`
        : "https://source.unsplash.com/400x300/?restaurant,food",
      rating: r.rating || 0,
      reviewCount: r.user_ratings_total || 0,
      address: r.vicinity || "",
      priceLevel: r.price_level ?? null,
      businessStatus: r.business_status || "UNKNOWN",
      types: r.types || [],
    }));

    res.json(mappedResults);
  } catch (error) {
    if (error.response) {
      console.error("❌ Google API Error:", error.response.data);
      return res
        .status(error.response.status)
        .json({ error: error.response.data });
    }
    console.error("❌ Server Error:", error.message);
    res.status(500).json({ error: "Failed to fetch restaurants" });
  }
});

app.listen(PORT, () =>
  console.log(`🚀 Backend running on http://localhost:${PORT}`)
);

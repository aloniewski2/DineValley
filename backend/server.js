import express from "express";
import axios from "axios";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors({ origin: "*" }));

const PORT = process.env.PORT || 5050;
const API_KEY = process.env.GOOGLE_PLACES_API_KEY;

// 🔑 Fail fast if missing API key
if (!API_KEY) {
  console.error("❌ ERROR: GOOGLE_PLACES_API_KEY is missing in .env");
  process.exit(1);
}

// ✅ Health check
app.get("/", (_, res) => res.send("✅ Backend is alive!"));

// ✅ Nearby Restaurants (with pagination support)
app.get("/restaurants", async (req, res) => {
  try {
    const { keyword, minPrice, maxPrice, openNow, pageToken, radius } = req.query;

    const parsedRadius = radius ? Number(radius) : undefined;
    const radiusMeters = Number.isFinite(parsedRadius)
      ? Math.min(Math.max(parsedRadius, 500), 50000)
      : 20000;

    const params = {
      location: "40.6084,-75.4902", // Lehigh Valley
      radius: radiusMeters,
      type: "restaurant",
      keyword,
      minprice: minPrice,
      maxprice: maxPrice,
      opennow: openNow === "true" ? true : undefined,
      key: API_KEY,
      pagetoken: pageToken,
    };

    const response = await axios.get(
      "https://maps.googleapis.com/maps/api/place/nearbysearch/json",
      { params }
    );

    // Map results into a simpler structure for the frontend
    const mapped = response.data.results.map((r) => ({
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

    res.json({
      results: mapped,
      nextPageToken: response.data.next_page_token || null,
    });
  } catch (error) {
    console.error("❌ Nearby error:", error.message);
    res.status(500).json({ error: "Failed to fetch restaurants" });
  }
});

// ✅ Restaurant Details
app.get("/restaurant/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const params = {
      place_id: id,
      key: API_KEY,
      fields:
        "name,rating,formatted_address,formatted_phone_number,opening_hours,website,review,photo,url,geometry,types",
    };

    const response = await axios.get(
      "https://maps.googleapis.com/maps/api/place/details/json",
      { params }
    );

    const r = response.data.result;

    const photoUrls = Array.isArray(r.photos)
      ? r.photos.slice(0, 8).map((photo) =>
          `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference=${photo.photo_reference}&key=${API_KEY}`
        )
      : [];

    const lat = r.geometry?.location?.lat;
    const lng = r.geometry?.location?.lng;
    const mapImageUrl = lat && lng
      ? `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=14&size=600x320&scale=2&maptype=roadmap&markers=color:red%7C${lat},${lng}&key=${API_KEY}`
      : null;

    const reviewSummary = {
      total: r.user_ratings_total ?? (Array.isArray(r.reviews) ? r.reviews.length : 0),
      average: r.rating ?? null,
    };

    const details = {
      id: r.place_id,
      name: r.name,
      rating: r.rating,
      address: r.formatted_address,
      phone: r.formatted_phone_number,
      website: r.website,
      openingHours: r.opening_hours?.weekday_text || [],
      reviews: r.reviews || [],
      imageUrl: photoUrls[0] || "https://source.unsplash.com/600x400/?restaurant,food",
      photoUrls,
      googleMapsUrl: r.url || null,
      mapImageUrl,
      coordinates: lat && lng ? { lat, lng } : null,
      types: r.types || [],
      reviewSummary,
    };

    res.json(details);
  } catch (error) {
    console.error("❌ Details error:", error.message);
    res.status(500).json({ error: "Failed to fetch restaurant details" });
  }
});

app.listen(PORT, () =>
  console.log(`🚀 Backend running on http://localhost:${PORT}`)
);

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

    const { status, error_message: errorMessage, results = [], next_page_token: nextPageToken } =
      response.data ?? {};

    if (!status) {
      console.error("❌ Nearby error: Missing status from Google Places response");
      return res.status(502).json({ error: "Unexpected response from Google Places API" });
    }

    if (status !== "OK" && status !== "ZERO_RESULTS") {
      console.error("❌ Nearby error:", status, errorMessage);
      return res
        .status(502)
        .json({ error: errorMessage || `Google Places responded with status ${status}` });
    }

    const baseUrl = `${req.protocol}://${req.get("host")}`;

    // Map results into a simpler structure for the frontend
    const mapped = results.map((r) => ({
      id: r.place_id,
      name: r.name,
      imageUrl: r.photos
        ? `${baseUrl}/place-photo/${encodeURIComponent(r.photos[0].photo_reference)}?maxwidth=400`
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
      nextPageToken: nextPageToken || null,
    });
  } catch (error) {
    const message =
      error.response?.data?.error_message ||
      error.response?.data?.status ||
      error.message ||
      "Unknown error";
    console.error("❌ Nearby request failed:", message);
    res.status(500).json({ error: "Failed to fetch restaurants", details: message });
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

    const { status, error_message: errorMessage, result } = response.data ?? {};

    if (!status) {
      console.error("❌ Details error: Missing status from Google Places response");
      return res.status(502).json({ error: "Unexpected response from Google Places API" });
    }

    if (status !== "OK") {
      console.error("❌ Details error:", status, errorMessage);
      return res
        .status(502)
        .json({ error: errorMessage || `Google Places responded with status ${status}` });
    }

    const r = result;
    const baseUrl = `${req.protocol}://${req.get("host")}`;

    const photoUrls = Array.isArray(r.photos)
      ? r.photos
          .slice(0, 8)
          .map((photo) => `${baseUrl}/place-photo/${encodeURIComponent(photo.photo_reference)}?maxwidth=800`)
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
    const message =
      error.response?.data?.error_message ||
      error.response?.data?.status ||
      error.message ||
      "Unknown error";
    console.error("❌ Details request failed:", message);
    res.status(500).json({ error: "Failed to fetch restaurant details", details: message });
  }
});

app.get("/place-photo/:reference", async (req, res) => {
  const { reference } = req.params;
  const { maxwidth, maxheight } = req.query;

  if (!reference) {
    return res.status(400).json({ error: "Missing photo reference" });
  }

  try {
    const params = {
      photoreference: reference,
      key: API_KEY,
    };

    if (maxwidth) params.maxwidth = maxwidth;
    if (maxheight) params.maxheight = maxheight;

    const response = await axios.get(
      "https://maps.googleapis.com/maps/api/place/photo",
      {
        params,
        responseType: "stream",
      }
    );

    if (response.headers["content-type"]) {
      res.setHeader("Content-Type", response.headers["content-type"]);
    }
    if (response.headers["cache-control"]) {
      res.setHeader("Cache-Control", response.headers["cache-control"]);
    }

    response.data.pipe(res);
  } catch (error) {
    const message =
      error.response?.data?.error_message ||
      error.response?.data?.status ||
      error.message ||
      "Unknown error";
    console.error("❌ Photo request failed:", message);
    res.status(500).json({ error: "Failed to fetch restaurant photo", details: message });
  }
});

app.listen(PORT, () =>
  console.log(`🚀 Backend running on http://localhost:${PORT}`)
);

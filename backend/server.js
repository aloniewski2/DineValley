import express from "express";
import axios from "axios";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const DEFAULT_ALLOWED_ORIGINS = [
  "https://dinevalley-frontend.onrender.com",
  "http://localhost:5173",
];
const FRONTEND_ORIGINS = (process.env.FRONTEND_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const allowedOrigins = FRONTEND_ORIGINS.length ? FRONTEND_ORIGINS : DEFAULT_ALLOWED_ORIGINS;
console.log("Configured CORS origins:", allowedOrigins.join(", "));

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      console.warn("CORS blocked origin:", origin);
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

app.set("trust proxy", 1);
app.use(express.json({ limit: "1mb" }));

const PORT = process.env.PORT || 5050;
const API_KEY = process.env.GOOGLE_PLACES_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const DEFAULT_GROQ_MODEL = "llama-3.1-8b-instant";
const GROQ_MODEL = process.env.GROQ_MODEL || DEFAULT_GROQ_MODEL;
const logChat = (...args) => console.log("[GroqChat]", ...args);

// 🔑 Fail fast if missing API key
if (!API_KEY) {
  console.error("❌ ERROR: GOOGLE_PLACES_API_KEY is missing in .env");
  process.exit(1);
}

if (!GROQ_API_KEY) {
  console.warn("⚠️ WARNING: GROQ_API_KEY is missing. The AI assistant endpoint will be unavailable.");
} else {
  logChat("Groq model configured:", GROQ_MODEL);
  if (!process.env.GROQ_MODEL) {
    logChat(`Using default model ${DEFAULT_GROQ_MODEL}. Override via GROQ_MODEL env variable if needed.`);
  }
}

const describeRestaurant = (restaurant, index) => {
  const name = typeof restaurant?.name === "string" && restaurant.name.trim() ? restaurant.name.trim() : "Unknown";
  const rating =
    typeof restaurant?.rating === "number" && Number.isFinite(restaurant.rating)
      ? `Rating ${restaurant.rating.toFixed(1)}/5`
      : null;
  const reviewCount =
    typeof restaurant?.reviewCount === "number" && Number.isFinite(restaurant.reviewCount)
      ? `${restaurant.reviewCount} reviews`
      : null;
  const priceLevel =
    typeof restaurant?.priceLevel === "number" && Number.isFinite(restaurant.priceLevel) && restaurant.priceLevel > 0
      ? `${"$".repeat(Math.min(Math.max(1, Math.round(restaurant.priceLevel)), 4))}`
      : null;
  const address = typeof restaurant?.address === "string" ? restaurant.address : null;
  const tags =
    Array.isArray(restaurant?.types) && restaurant.types.length
      ? `Tags: ${restaurant.types
          .slice(0, 5)
          .map((type) => type.replace(/_/g, " "))
          .join(", ")}`
      : null;

  const parts = [`${index + 1}. ${name}`];
  if (rating) parts.push(rating);
  if (reviewCount) parts.push(reviewCount);
  if (priceLevel) parts.push(priceLevel);
  if (address) parts.push(address);
  if (tags) parts.push(tags);

  return parts.join(" | ");
};

// ✅ Health checks
app.get("/", (_, res) => res.send("✅ Backend is alive!"));
app.get("/health", (_, res) => res.status(200).send("ok"));
app.get("/api/hello", (_, res) => res.json({ ok: true, message: "DineValley API is up" }));

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

const buildRestaurantContext = (restaurants = []) => {
  if (!Array.isArray(restaurants) || restaurants.length === 0) {
    return null;
  }

  const formatted = restaurants
    .filter((restaurant) => restaurant && typeof restaurant === "object")
    .slice(0, 8)
    .map((restaurant, index) => describeRestaurant(restaurant, index))
    .join("\n");

  return formatted || null;
};

app.get("/chat", (_, res) => {
  logChat("Received GET /chat (method not allowed)");
  res.status(405).json({
    error: "Use POST /chat",
    instructions: "Send { question, history?, restaurants? } as JSON via POST to receive Groq answers.",
  });
});

app.post("/chat", async (req, res) => {
  if (!GROQ_API_KEY) {
    return res.status(503).json({ error: "GROQ_API_KEY is not configured on the server" });
  }

  const { question, history, restaurants } = req.body ?? {};

  if (!question || typeof question !== "string") {
    logChat("Rejected request: missing question");
    return res.status(400).json({ error: "A question string is required" });
  }

  logChat("Incoming chat question", {
    questionPreview: question.slice(0, 120),
    historyCount: Array.isArray(history) ? history.length : 0,
    restaurantCount: Array.isArray(restaurants) ? restaurants.length : 0,
  });

  const sanitizedHistory = Array.isArray(history)
    ? history
        .filter(
          (entry) =>
            entry &&
            typeof entry === "object" &&
            typeof entry.content === "string" &&
            (entry.role === "user" || entry.role === "assistant")
        )
        .slice(-8)
        .map((entry) => ({
          role: entry.role,
          content: entry.content,
        }))
    : [];

  const sanitizedRestaurants = Array.isArray(restaurants)
    ? restaurants
        .filter((restaurant) => restaurant && typeof restaurant === "object")
        .slice(0, 8)
        .map((restaurant) => ({
          id: restaurant.id,
          name: restaurant.name,
          rating: restaurant.rating,
          reviewCount: restaurant.reviewCount,
          address: restaurant.address,
          priceLevel: restaurant.priceLevel,
          types: Array.isArray(restaurant.types)
            ? restaurant.types.filter((type) => typeof type === "string")
            : [],
        }))
    : [];

  logChat("Sanitized payload", {
    sanitizedHistoryCount: sanitizedHistory.length,
    sanitizedRestaurantCount: sanitizedRestaurants.length,
  });

  const restaurantContext = buildRestaurantContext(sanitizedRestaurants);

  const systemPrompt = [
    "You are the AI concierge for Dine Valley, a Lehigh Valley restaurant discovery web app.",
    "Provide concise, friendly answers that either explain app features or reference the supplied restaurant context.",
    "When the question is about dining, only rely on the provided restaurant list. If information is missing, say so and suggest how to find it in the app.",
    "If the question is about the product itself, highlight smart filters, favorites, recent views, and Google Places powered data.",
  ].join(" ");

  const userContent = [
    `User question: ${question.trim()}`,
    restaurantContext ? `Restaurant context:\n${restaurantContext}` : null,
    "If the user asks for suggestions, reference the most relevant restaurants from the list.",
  ]
    .filter(Boolean)
    .join("\n\n");

  const messages = [
    { role: "system", content: systemPrompt },
    ...sanitizedHistory,
    { role: "user", content: userContent },
  ];

  try {
    const requestStartedAt = Date.now();
    logChat("Sending request to Groq", {
      model: GROQ_MODEL,
      messageCount: messages.length,
    });

    const response = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: GROQ_MODEL,
        temperature: 0.3,
        max_tokens: 512,
        messages,
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${GROQ_API_KEY}`,
        },
        timeout: 20000,
      }
    );

    const latencyMs = Date.now() - requestStartedAt;
    const answer = response?.data?.choices?.[0]?.message?.content?.trim();

    logChat("Groq response received", {
      latencyMs,
      usage: response?.data?.usage ?? null,
      answerPreview: answer ? answer.slice(0, 120) : null,
    });

    if (!answer) {
      console.error("❌ Groq chat error: Missing completion", response?.data);
      return res.status(502).json({ error: "Groq did not return a completion" });
    }

    res.json({
      answer,
      usage: response?.data?.usage ?? null,
    });
  } catch (error) {
    const message =
      error.response?.data?.error?.message ||
      error.response?.data?.error ||
      error.response?.data ||
      error.message ||
      "Unknown Groq error";
    console.error("❌ Groq chat request failed:", message, {
      status: error.response?.status,
      data: error.response?.data,
    });
    res.status(500).json({ error: "Failed to fetch response from Groq", details: message });
  }
});

app.listen(PORT, "0.0.0.0", () =>
  console.log(`🚀 Backend running on http://localhost:${PORT}`)
);

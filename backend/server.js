import express from "express";
import axios from "axios";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();

const DEFAULT_ALLOWED_ORIGINS = [
  "https://dinevalley-frontend.onrender.com",
  "https://dinevalley.netlify.app",
  "http://localhost:5173",
  "http://localhost:5174",
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
const API_KEY = (process.env.GOOGLE_PLACES_API_KEY || "").trim();
const DEFAULT_LOCATION = "40.6084,-75.4902";
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const DEFAULT_GROQ_MODEL = "llama-3.1-8b-instant";
const GROQ_MODEL = process.env.GROQ_MODEL || DEFAULT_GROQ_MODEL;
const logChat = (...args) => console.log("[GroqChat]", ...args);
const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const clampRating = (value) => clamp(value ?? 0, 0, 5);

if (!API_KEY) {
  console.error("❌ ERROR: GOOGLE_PLACES_API_KEY is missing in .env");
  process.exit(1);
}

console.log("[Config] Places API key detected (length):", API_KEY.length);

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
  const dietary =
    Array.isArray(restaurant?.dietary) && restaurant.dietary.length
      ? `Dietary: ${restaurant.dietary.slice(0, 5).join(", ")}`
      : null;
  const favorite = restaurant?.isFavorite ? "⭐ Favorite" : null;

  const parts = [`${index + 1}. ${name}`];
  if (rating) parts.push(rating);
  if (reviewCount) parts.push(reviewCount);
  if (priceLevel) parts.push(priceLevel);
  if (address) parts.push(address);
  if (tags) parts.push(tags);
  if (dietary) parts.push(dietary);
  if (favorite) parts.push(favorite);

  return parts.join(" | ");
};

const sanitizeReviews = (reviews) => {
  if (!Array.isArray(reviews)) return [];

  return reviews
    .filter((review) => review && typeof review === "object" && typeof review.text === "string" && review.text.trim())
    .slice(0, 4)
    .map((review) => ({
      text: review.text.trim().slice(0, 320),
      rating: Number.isFinite(review.rating) ? clampRating(review.rating) : null,
      authorName:
        typeof review.authorName === "string" && review.authorName.trim()
          ? review.authorName.trim().slice(0, 80)
          : null,
      relativeTimeDescription:
        typeof review.relativeTimeDescription === "string" && review.relativeTimeDescription.trim()
          ? review.relativeTimeDescription.trim().slice(0, 60)
          : null,
    }));
};

const validatePlacesStatus = (status, errorMessage, res, label) => {
  if (!status) {
    console.error(`❌ ${label} error: Missing status from Google Places response`);
    res.status(502).json({ error: "Unexpected response from Google Places API" });
    return false;
  }

  if (status !== "OK" && status !== "ZERO_RESULTS") {
    console.error(`❌ ${label} error:`, status, errorMessage);
    res
      .status(502)
      .json({ error: errorMessage || `Google Places responded with status ${status}` });
    return false;
  }

  return true;
};

// ✅ Root & health checks
app.get("/", (_, res) => res.send("✅ Backend is alive!"));
app.get("/health", (_, res) => res.status(200).send("ok"));
app.get("/api/hello", (_, res) => res.json({ ok: true, message: "DineValley API is up" }));

// ✅ Nearby Restaurants
app.get("/restaurants", async (req, res) => {
  try {
    const { keyword, minPrice, maxPrice, openNow, pageToken, radius } = req.query;

    const parsedRadius = radius ? Number(radius) : undefined;
    const radiusMeters = Number.isFinite(parsedRadius) ? clamp(parsedRadius, 500, 50000) : 20000;

    const params = {
      location: DEFAULT_LOCATION,
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

    if (!validatePlacesStatus(status, errorMessage, res, "Nearby")) {
      return;
    }

    const baseUrl = `${req.protocol}://${req.get("host")}`;

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

    if (!validatePlacesStatus(status, errorMessage, res, "Details")) {
      return;
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



// ✅ Restaurant photo proxy
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

const buildReviewContext = (restaurants = []) => {
  const lines = [];

  restaurants
    .filter((restaurant) => restaurant && typeof restaurant === "object" && restaurant.name)
    .slice(0, 6)
    .forEach((restaurant) => {
      const reviews = Array.isArray(restaurant.reviews) ? restaurant.reviews.slice(0, 3) : [];
      if (!reviews.length) return;

      reviews.forEach((review) => {
        const parts = [
          `${restaurant.name}:`,
          review.rating ? `⭐ ${review.rating.toFixed(1)}` : null,
          review.text,
          review.authorName ? `- ${review.authorName}` : null,
          review.relativeTimeDescription ? `(${review.relativeTimeDescription})` : null,
        ].filter(Boolean);

        lines.push(parts.join(" "));
      });
    });

  return lines.length ? lines.join("\n") : null;
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

  const { question, history, restaurants, filters, focusRestaurantId, useCase } = req.body ?? {};
  const isComparison = useCase === "comparison_tool";

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
          dietary: Array.isArray(restaurant.dietary)
            ? restaurant.dietary.filter((item) => typeof item === "string")
            : [],
          isFavorite: restaurant.isFavorite === true,
          reviews: sanitizeReviews(restaurant.reviews),
        }))
    : [];

  const filterKeywords = Array.isArray(filters?.keywords)
    ? filters.keywords
        .map((keyword) => (typeof keyword === "string" ? keyword.toLowerCase().trim() : null))
        .filter(Boolean)
    : [];

  logChat("Sanitized payload", {
    sanitizedHistoryCount: sanitizedHistory.length,
    sanitizedRestaurantCount: sanitizedRestaurants.length,
    filterKeywords,
  });

  const getRestaurantSearchText = (restaurant) =>
    [
      restaurant?.name,
      ...(restaurant?.types ?? []).map((type) => type.replace(/_/g, " ")),
      ...(restaurant?.dietary ?? []),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

  const filteredRestaurants =
    filterKeywords.length === 0
      ? sanitizedRestaurants
      : sanitizedRestaurants.filter((restaurant) => {
          const haystack = getRestaurantSearchText(restaurant);
          return filterKeywords.some((keyword) => haystack.includes(keyword));
        });

  const restaurantsForPrompt =
    filterKeywords.length > 0
      ? filteredRestaurants.length > 0
        ? filteredRestaurants
        : []
      : sanitizedRestaurants;

  const restaurantContext = buildRestaurantContext(restaurantsForPrompt);
  const reviewContext = buildReviewContext(restaurantsForPrompt);
  const focusRestaurant =
    typeof focusRestaurantId === "string"
      ? restaurantsForPrompt.find((restaurant) => restaurant.id === focusRestaurantId)
      : null;

const baseSystemPrompt = [
  "You are the AI concierge for Dine Valley, a Lehigh Valley restaurant discovery web app.",
  "Provide concise, friendly answers that either explain app features or reference the supplied restaurant context.",
  "When review snippets are provided, prefer citing them verbatim to answer questions about menu highlights, crowd favorites, service quality, or ambiance.",
  "When the question is about dining, only rely on the provided restaurant list. If information is missing, say so and suggest how to find it in the app.",
  "Never recommend or mention restaurants that are not explicitly included in the provided context; if none match the user’s request, say so plainly.",
  "Default to a single restaurant recommendation; only offer multiple options when the user explicitly asks for more than one or mentions alternatives.",
  "Only suggest using filters or other cuisines when zero restaurants in context match the requested cuisine or criteria.",
  "Explicitly weave in each restaurant's cuisines/types, dietary tags, price level, and favorite status when relevant so users understand how filters impact the results.",
  "If the question is about the product itself, highlight smart filters, favorites, recent views, and Google Places powered data.",
  "Answer in no more than two sentences, focusing only on essential information.",
];

  const comparisonSystemPrompt = [
    "You are the Instant Restaurant Comparison Tool for Dine Valley.",
    "Only compare the restaurants provided in the context and never invent others.",
    "Return ONLY valid JSON with this shape:",
    '{ "overview": "short motivating sentence", "insights": [ { "category": "Best value", "winner": "Name or \\"Split decision\\"", "rationale": "<110 char reason>" } ] }',
    'Include exactly one insight per category: "Best value", "Most options for dietary needs", "Best for groups", "Most popular dishes", "Best for quick service".',
    'If data is insufficient for a category, set winner to "Split decision" and explain briefly.',
    "Use evidence from ratings, review counts, price level symbols, cuisine/types, dietary tags, and takeaway/delivery hints.",
    "Do not write prose outside the JSON.",
  ];

  const systemPrompt = (isComparison ? comparisonSystemPrompt : baseSystemPrompt).join(" ");

  const comparisonContent = [
    `User question: ${question.trim()}`,
    restaurantContext ? `Restaurants to compare:\n${restaurantContext}` : "No restaurants provided.",
    reviewContext ? `Google review snippets:\n${reviewContext}` : null,
    'Return JSON only. Categories: Best value, Most options for dietary needs, Best for groups, Most popular dishes, Best for quick service.',
  ];

  const chatContent = [
    `User question: ${question.trim()}`,
    restaurantContext ? `Restaurant context:\n${restaurantContext}` : null,
    reviewContext ? `Google review snippets:\n${reviewContext}` : null,
    focusRestaurant
      ? `Current restaurant focus: ${focusRestaurant.name}. When the user asks about "this place" or menu items, answer about this restaurant and do not recommend other restaurants unless explicitly requested.`
      : null,
    filterKeywords.length > 0 && restaurantsForPrompt.length > 0
      ? `Only recommend places matching: ${filterKeywords.join(", ")}.`
      : null,
    filterKeywords.length > 0 && restaurantsForPrompt.length === 0
      ? `No restaurants in the current dataset match: ${filterKeywords.join(", ")}. Explain this limitation, suggest adjusting filters, and do not invent places.`
      : null,
    filterKeywords.length > 0
      ? "Do not mention any other cuisine or restaurant category unless the user explicitly asks for something else."
      : "If the user asks for suggestions, reference the most relevant restaurants from the list.",
  ];

  const userContent = (isComparison ? comparisonContent : chatContent).filter(Boolean).join("\n\n");

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

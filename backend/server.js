import express from "express";
import axios from "axios";
import cors from "cors";
import dotenv from "dotenv";
import {
  loadPlaces, meta, searchPlaces, findPlace,
  toCard, toDetails, placeholderSvg,
} from "./places.js";
import { areaFor, centerForZip, loadZips, findCached } from "./areas.js";
import { decide, TRAVEL_SPEEDS } from "./solver.js";
import { imageForPlace, loadImageCache, imageCacheStats } from "./preview.js";

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
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const DEFAULT_GROQ_MODEL = "llama-3.1-8b-instant";
const GROQ_MODEL = process.env.GROQ_MODEL || DEFAULT_GROQ_MODEL;
const logChat = (...args) => console.log("[GroqChat]", ...args);
const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const clampRating = (value) => clamp(value ?? 0, 0, 5);


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

// ✅ Root & health checks
app.get("/", (_, res) => res.send("✅ Backend is alive!"));
app.get("/health", (_, res) => res.status(200).send("ok"));
app.get("/api/hello", (_, res) => res.json({ ok: true, message: "DineValley API is up" }));

// ✅ Nearby Restaurants — served from the local OpenStreetMap index
app.get("/restaurants", async (req, res) => {
  try {
    const { keyword, minPrice, maxPrice, openNow, pageToken, radius, zip, lat, lng } = req.query;
    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const radiusMeters = Number.isFinite(Number(radius)) ? Number(radius) : 20000;

    // Where to search: an explicit ZIP, explicit coordinates, or home.
    let center = null;
    if (zip) {
      center = centerForZip(zip);
      if (!center) {
        // Some real ZIPs (PO-box and IRS-only ones) have no Census ZCTA and so
        // no centroid — say that rather than calling them invalid.
        return res.status(400).json({
          error: /^\d{5}$/.test(String(zip))
            ? `We don't have a location for ZIP ${zip}. Try a nearby one.`
            : `"${String(zip).slice(0, 12)}" isn't a five-digit ZIP code.`,
        });
      }
    } else if (Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))) {
      center = { lat: Number(lat), lng: Number(lng) };
    }

    let area = null;
    if (center) {
      try {
        area = await areaFor({ ...center, radius: radiusMeters }, meta().dataset);
      } catch (err) {
        if (err.code === "AREA_UNAVAILABLE") {
          // Better an honest "try again" than a confident empty list.
          return res.status(503).json({
            error: "Couldn't load restaurants for that area just now — OpenStreetMap is busy. Try again in a moment.",
          });
        }
        throw err;
      }
    }

    const { matches, total, nextPageToken } = searchPlaces({
      keyword, minPrice, maxPrice, openNow, radius, pageToken, area,
    });

    res.json({
      results: matches.map((place) => toCard(place, baseUrl)),
      nextPageToken,
      total,
      attribution: meta().attribution,
      area: {
        zip: center?.zip ?? null,
        center: area?.center ?? meta().center,
        source: area?.source ?? "local",
      },
    });
  } catch (error) {
    console.error("❌ Search failed:", error.message);
    res.status(500).json({ error: "Failed to fetch restaurants", details: error.message });
  }
});


/* The decision endpoint.
 *
 * `/restaurants` answers "what is near here", which is the question Google
 * Maps already answers better. This answers "given these constraints, where
 * should we go" — and returns the short list with its reasoning attached,
 * rather than a thousand rows and a star rating we do not have. */
app.get("/decide", async (req, res) => {
  try {
    const {
      zip, lat, lng, minutes, mode, kinds, cuisines,
      independent, openNow, maxPrice, dietary, limit,
    } = req.query;

    let center = null;
    if (zip) {
      center = centerForZip(zip);
      if (!center) {
        return res.status(400).json({
          error: /^\d{5}$/.test(String(zip))
            ? `We don't have a location for ZIP ${zip}. Try a nearby one.`
            : `"${String(zip).slice(0, 12)}" isn't a five-digit ZIP code.`,
        });
      }
    } else if (Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))) {
      center = { lat: Number(lat), lng: Number(lng) };
    } else {
      center = meta().center;          // the valley itself, so the page is never empty
    }

    const list = (v) => String(v || "").split(",").map((x) => x.trim()).filter(Boolean);
    const travelMode = mode === "walk" ? "walk" : "drive";
    const maxMinutes = Math.min(60, Math.max(1, Number(minutes) || 15));

    const { results, considered, matchedTag } = decide({
      places: meta().dataset.places,
      center,
      maxMinutes,
      mode: travelMode,
      kinds: list(kinds),
      cuisines: list(cuisines),
      independentOnly: independent === "true",
      openNow: openNow === "true",
      maxPrice: Number.isFinite(Number(maxPrice)) ? Number(maxPrice) : null,
      dietary: list(dietary),
      limit: Math.min(20, Math.max(1, Number(limit) || 8)),
    });

    const baseUrl = `${req.protocol}://${req.get("host")}`;
    res.json({
      results: results.map((r) => ({
        ...toCard(r.place, baseUrl),
        minutes: r.minutes,
        metres: Math.round(r.metres),
        matchScore: r.score,
        reasons: r.reasons,
        independent: !r.place.brand,
      })),
      considered,
      matchedTag,
      center,
      budget: { minutes: maxMinutes, mode: travelMode, metres: maxMinutes * TRAVEL_SPEEDS[travelMode] },
      attribution: meta().attribution,
    });
  } catch (error) {
    console.error("❌ Decide failed:", error.message);
    res.status(500).json({ error: "Failed to work out a shortlist", details: error.message });
  }
});

// ✅ Restaurant Details
app.get("/restaurant/:id", async (req, res) => {
  try {
    // Could be from the baked region or from an area fetched for a ZIP search.
    const place = findPlace(req.params.id) || findCached(req.params.id);
    if (!place) return res.status(404).json({ error: "Restaurant not found" });
    res.json(toDetails(place, `${req.protocol}://${req.get("host")}`));
  } catch (error) {
    console.error("❌ Details failed:", error.message);
    res.status(500).json({ error: "Failed to fetch restaurant details", details: error.message });
  }
});

// ✅ Generated cover art — OSM carries no photos, and the old Unsplash
// fallback was retired (it returns 503), so every card gets a deterministic
// SVG keyed to its cuisine instead of a broken image.
app.get("/place-photo/:id", async (req, res) => {
  const id = decodeURIComponent(req.params.id);
  const place = findPlace(id) || findCached(id);
  if (!place) return res.status(404).json({ error: "Unknown place" });

  // If the restaurant's own site advertises an og:image, send the browser
  // there. Resolution is capped so a slow site can't hold up the response —
  // it finishes in the background and the next request gets the answer.
  if (place.website) {
    const image = await imageForPlace(place, { timeoutMs: 2500 }).catch(() => null);
    if (image?.url) {
      res.setHeader("Cache-Control", "public, max-age=86400");
      res.setHeader("X-Image-Kind", image.kind);   // photo | logo, for debugging
      return res.redirect(302, image.url);
    }
  }

  res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
  // Shorter than the old week: a place whose image resolves later should
  // stop showing the placeholder reasonably soon.
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.send(placeholderSvg(place));
});

// ✅ Static map — one OpenStreetMap tile, proxied and cached, replacing the
// paid Google Static Maps image. Tile usage policy: keep volume modest and
// always send a real User-Agent.
const tileCache = new Map();
app.get("/map-image", async (req, res) => {
  const lat = Number(req.query.lat), lng = Number(req.query.lng);
  const zoom = Math.min(Math.max(Number(req.query.zoom) || 16, 1), 19);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.status(400).json({ error: "lat and lng are required" });
  }

  const n = 2 ** zoom;
  const x = Math.floor(((lng + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(((1 - Math.asinh(Math.tan(latRad)) / Math.PI) / 2) * n);
  const key = `${zoom}/${x}/${y}`;

  try {
    if (!tileCache.has(key)) {
      const tile = await axios.get(`https://tile.openstreetmap.org/${key}.png`, {
        responseType: "arraybuffer",
        headers: { "User-Agent": "DineValley/1.0 (portfolio project)" },
        timeout: 8000,
      });
      if (tileCache.size > 500) tileCache.clear();
      tileCache.set(key, Buffer.from(tile.data));
    }
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.send(tileCache.get(key));
  } catch (error) {
    console.error("❌ Tile fetch failed:", error.message);
    res.status(502).json({ error: "Failed to fetch map tile" });
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
  "If the question is about the product itself, highlight smart filters, favorites, recent views, and the OpenStreetMap-powered dataset.",
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
    reviewContext ? `Review snippets:\n${reviewContext}` : null,
    'Return JSON only. Categories: Best value, Most options for dietary needs, Best for groups, Most popular dishes, Best for quick service.',
  ];

  const chatContent = [
    `User question: ${question.trim()}`,
    restaurantContext ? `Restaurant context:\n${restaurantContext}` : null,
    reviewContext ? `Review snippets:\n${reviewContext}` : null,
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
      // Don't log the body: it echoes the visitor's question straight back,
      // which puts user-controlled text into the log stream.
      console.error("❌ Groq chat error: response contained no completion");
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

await loadPlaces();
await loadZips();
await loadImageCache();
const { count, generatedAt, attribution } = meta();
console.log(`[Places] ${count} places loaded (built ${generatedAt}) — ${attribution}`);
console.log(`[Images] ${imageCacheStats().withImage} cover images cached`);

app.listen(PORT, "0.0.0.0", () =>
  console.log(`🚀 Backend running on http://localhost:${PORT}`)
);

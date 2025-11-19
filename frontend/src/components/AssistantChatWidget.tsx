import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bot, Loader2, Send, X } from "lucide-react";
import {
  askAssistant,
  ChatHistoryItem,
  RestaurantContextPayload,
} from "../api/assistant";
import { fetchRestaurants } from "../api/restaurants";
import { FilterOptions, Restaurant, createDefaultFilters } from "../../types";
import waiterImage from "../assets/waiter.png";
import {
  KNOWN_CUISINES,
  KNOWN_DIETARY_OPTIONS,
  buildRestaurantQueryParams,
  cloneFilterOptions,
  filterRestaurantsClientSide,
} from "../utils/restaurantFilters";
import { useLocalStorage } from "../hooks/useLocalStorage";

type Props = {
  restaurants: Restaurant[];
  onSelectRestaurant?: (restaurant: Restaurant) => void;
};

const FALLBACK_IMAGE = "https://source.unsplash.com/160x160/?restaurant,food";

type ChatMessage = ChatHistoryItem & {
  recommendations?: RestaurantContextPayload[];
};

const INITIAL_MESSAGE: ChatMessage = {
  role: "assistant",
  content:
    "Hi! I’m your DineValley concierge. Ask me about finding the perfect spot, how filters work, or what’s trending nearby.",
};

const normalize = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const tokenizeText = (value?: string | null) => {
  if (!value) return [];
  const normalized = normalize(value);
  if (!normalized) return [];
  return normalized
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length >= 3);
};

const STOP_WORDS = new Set([
  "restaurant",
  "restaurants",
  "food",
  "foods",
  "place",
  "places",
  "spot",
  "spots",
  "eat",
  "eats",
  "eating",
  "dining",
  "dinner",
  "lunch",
  "breakfast",
  "cuisine",
  "cuisines",
  "recommendation",
  "recommendations",
  "find",
  "finding",
  "looking",
  "nearby",
  "around",
  "good",
  "best",
  "please",
  "thanks",
  "another",
  "option",
  "options",
]);

const PRICE_WORD_MAP: Record<string, string[]> = {
  cheap: ["$"],
  budget: ["$"],
  affordable: ["$", "$$"],
  casual: ["$", "$$"],
  moderate: ["$$"],
  mid: ["$$"],
  pricey: ["$$$", "$$$$"],
  expensive: ["$$$", "$$$$"],
  fancy: ["$$$", "$$$$"],
  upscale: ["$$$", "$$$$"],
  luxury: ["$$$", "$$$$"],
};

const clampDistance = (value: number) => Math.min(Math.max(Math.round(value), 1), 30);

type ParsedFiltersResult = {
  filters: FilterOptions;
  keywords: string[];
  searchTerm: string;
};

const deriveFiltersFromQuestion = (
  question: string,
  previousFilters: FilterOptions
): ParsedFiltersResult => {
  const normalized = question.toLowerCase();
  const tokens = tokenizeText(question);
  const semanticTokens = tokens.filter((token) => !STOP_WORDS.has(token));
  const filters = cloneFilterOptions(previousFilters);

  const mentionedCuisines = KNOWN_CUISINES.filter((cuisine) =>
    normalized.includes(cuisine.toLowerCase())
  );
  if (mentionedCuisines.length) {
    filters.cuisines = Array.from(new Set(mentionedCuisines));
  }

  const dietaryMatches = KNOWN_DIETARY_OPTIONS.filter((option) =>
    normalized.includes(option.toLowerCase())
  );
  if (dietaryMatches.length) {
    filters.dietary = Array.from(new Set([...filters.dietary, ...dietaryMatches]));
  }

  const priceSymbols = question.match(/\${1,4}/g);
  if (priceSymbols?.length) {
    filters.priceRanges = Array.from(new Set(priceSymbols.map((symbol) => symbol.slice(0, 4))));
  } else {
    const priceWordEntry = Object.entries(PRICE_WORD_MAP).find(([word]) => normalized.includes(word));
    if (priceWordEntry) {
      filters.priceRanges = Array.from(new Set(priceWordEntry[1]));
    }
    const priceValueMatch = question.match(/(?:under|below|less than)\s*\$?\s*(\d+)/i);
    if (priceValueMatch) {
      const value = Number(priceValueMatch[1]);
      if (!Number.isNaN(value)) {
        if (value <= 20) filters.priceRanges = ["$"];
        else if (value <= 40) filters.priceRanges = ["$", "$$"];
        else if (value <= 70) filters.priceRanges = ["$$", "$$$"];
        else filters.priceRanges = ["$$$", "$$$$"];
      }
    }
  }

  const distanceMatch = question.match(/(?:within|under|less than)\s*(\d+)\s*(?:miles?|mi)\b/i);
  if (distanceMatch) {
    const miles = Number(distanceMatch[1]);
    if (!Number.isNaN(miles)) {
      filters.distanceMiles = clampDistance(miles);
    }
  } else if (/\bnear me\b|\bnearby\b/.test(normalized)) {
    filters.distanceMiles = Math.min(filters.distanceMiles, 5);
  }

  const ratingMatch = question.match(/(\d(?:\.\d)?)\s*(?:stars?|rating)/i);
  if (ratingMatch) {
    const rating = Number(ratingMatch[1]);
    if (!Number.isNaN(rating)) {
      filters.minRating = Math.min(Math.max(rating, 0), 5);
    }
  } else if (/\bhighly rated\b|\bhigher rated\b|\bfive star\b/.test(normalized)) {
    filters.minRating = Math.max(filters.minRating, 4.5);
  }

  if (/\bopen now\b|\bcurrently open\b/.test(normalized)) {
    filters.openNow = true;
  }

  const keywordSet = new Set<string>();
  [...filters.cuisines, ...filters.dietary].forEach((item) => keywordSet.add(item.toLowerCase()));
  semanticTokens.slice(0, 5).forEach((token) => keywordSet.add(token));

  const searchTerm = semanticTokens.join(" ") || filters.cuisines[0] || question;

  return {
    filters,
    keywords: Array.from(keywordSet).slice(0, 8),
    searchTerm,
  };
};

const toContextPayloadList = (items: Restaurant[]): RestaurantContextPayload[] =>
  items.slice(0, 8).map(toContextPayload);

const toContextPayload = (restaurant: Restaurant): RestaurantContextPayload => ({
  id: restaurant.id,
  name: restaurant.name,
  rating: restaurant.rating,
  reviewCount: restaurant.reviewCount,
  address: restaurant.address,
  priceLevel: restaurant.priceLevel,
  types: Array.isArray(restaurant.types) ? restaurant.types.slice(0, 6) : [],
  dietary: Array.isArray(restaurant.dietary) ? restaurant.dietary.slice(0, 6) : undefined,
  isFavorite: Boolean(restaurant.isFavorite),
  imageUrl: restaurant.imageUrl,
});

const extractRecommendations = (
  answer: string,
  candidates: RestaurantContextPayload[]
): RestaurantContextPayload[] => {
  const normalizedAnswer = normalize(answer);
  if (!normalizedAnswer) return [];

  const matches = candidates.filter((restaurant) => {
    if (!restaurant?.name) return false;
    const normalizedName = normalize(restaurant.name);
    if (!normalizedName) return false;
    return normalizedAnswer.includes(normalizedName);
  });

  const unique: RestaurantContextPayload[] = [];
  const seen = new Set<string>();

  matches.forEach((restaurant) => {
    if (restaurant.id && !seen.has(restaurant.id)) {
      seen.add(restaurant.id);
      unique.push(restaurant);
    }
  });

  return unique;
};

const formatPriceLevel = (level?: number | null) => {
  if (!Number.isFinite(level)) return null;
  const value = Math.max(1, Math.min(4, Math.round(level as number)));
  return "$".repeat(value);
};

export const AssistantChatWidget: React.FC<Props> = ({ restaurants, onSelectRestaurant }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE]);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [chatFilters, setChatFilters] = useLocalStorage<FilterOptions>(
    "assistantChatFilters",
    createDefaultFilters()
  );
  const [fetchedRestaurants, setFetchedRestaurants] = useState<Restaurant[]>([]);

  const effectiveRestaurants = fetchedRestaurants.length ? fetchedRestaurants : restaurants;

  const restaurantLookup = useMemo(() => {
    const map = new Map<string, Restaurant>();
    restaurants.forEach((restaurant) => map.set(restaurant.id, restaurant));
    fetchedRestaurants.forEach((restaurant) => map.set(restaurant.id, restaurant));
    return map;
  }, [restaurants, fetchedRestaurants]);

  useEffect(() => {
    if (!isOpen || !scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isOpen]);

  const handleSend = useCallback(
    async (event?: React.FormEvent) => {
      event?.preventDefault();
      const question = input.trim();
      if (!question || isSending) {
        return;
      }

      const userMessage: ChatMessage = { role: "user", content: question };
      const historyForApi: ChatHistoryItem[] = [...messages, userMessage].map(({ role, content }) => ({
        role,
        content,
      }));

      const parsed = deriveFiltersFromQuestion(question, chatFilters);
      setChatFilters(() => cloneFilterOptions(parsed.filters));

      let contextSource = effectiveRestaurants;

      setMessages((prev) => [...prev, userMessage]);
      setInput("");
      setIsSending(true);
      setError(null);

      try {
        const queryParams = buildRestaurantQueryParams(parsed.filters, parsed.searchTerm);
        const data = await fetchRestaurants(queryParams);
        const filtered = filterRestaurantsClientSide(data.results, parsed.filters);
        if (filtered.length) {
          contextSource = filtered;
          setFetchedRestaurants(filtered);
        } else if (data.results.length) {
          contextSource = data.results;
          setFetchedRestaurants(data.results);
        }
      } catch (contextError) {
        console.warn("Assistant context fetch failed", contextError);
      }

      const context = toContextPayloadList(contextSource.length ? contextSource : restaurants);

      try {
        const response = await askAssistant(question, historyForApi, context, {
          keywords: parsed.keywords,
        });
        const recommendations = extractRecommendations(response.answer, context);
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: response.answer,
            recommendations: recommendations.length ? recommendations : undefined,
          },
        ]);
      } catch (assistantError) {
        console.error("Assistant chat failed", assistantError);
        const fallbackMessage =
          assistantError instanceof Error
            ? assistantError.message
            : "The assistant is unavailable right now.";
        setError(fallbackMessage);
      } finally {
        setIsSending(false);
      }
    },
    [chatFilters, effectiveRestaurants, input, isSending, messages, restaurants, setChatFilters]
  );

  const handleRecommendationSelect = useCallback(
    (restaurantId: string) => {
      if (!onSelectRestaurant) return;
      const restaurant = restaurantLookup.get(restaurantId);
      if (restaurant) {
        onSelectRestaurant(restaurant);
        setIsOpen(false);
      }
    },
    [onSelectRestaurant, restaurantLookup]
  );

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {isOpen ? (
        <div className="flex h-[32rem] w-80 flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900">
          <header className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-4 py-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
              <span className="rounded-full bg-indigo-50 dark:bg-indigo-600/30 p-1.5 text-indigo-600 dark:text-indigo-200">
                <Bot size={18} />
              </span>
              DineValley AI
            </div>
            <button
              type="button"
              className="text-gray-500 dark:text-gray-400 transition hover:text-gray-700 dark:hover:text-gray-200"
              onClick={() => setIsOpen(false)}
            >
              <X size={18} />
            </button>
          </header>
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-gray-50 dark:bg-gray-900 px-4 py-3 text-sm">
            {messages.map((message, index) => (
              <div key={`${message.role}-${index}`} className="space-y-2">
                <div className={`flex ${message.role === "assistant" ? "justify-start" : "justify-end"}`}>
                  <div
                    className={`max-w-[85%] rounded-2xl px-3 py-2 ${
                      message.role === "assistant"
                        ? "bg-white text-gray-800 shadow-sm dark:bg-gray-800 dark:text-gray-100"
                        : "bg-indigo-600 text-white shadow"
                    }`}
                  >
                    {message.content}
                  </div>
                </div>
                {message.recommendations && message.recommendations.length > 0 && (
                  <div className="flex flex-col gap-2">
                    {message.recommendations.map((recommendation) => {
                      const full = restaurantLookup.get(recommendation.id);
                      const image = full?.imageUrl || recommendation.imageUrl || FALLBACK_IMAGE;
                      const price = formatPriceLevel(full?.priceLevel ?? recommendation.priceLevel);
                      const dietary = full?.dietary ?? recommendation.dietary;
                      const favorite = full?.isFavorite ?? recommendation.isFavorite;

                      return (
                        <button
                          type="button"
                          key={recommendation.id}
                          onClick={() => handleRecommendationSelect(recommendation.id)}
                          className="flex gap-3 rounded-2xl border border-gray-200 bg-white p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-200 focus:outline-none focus:ring-2 focus:ring-indigo-300 dark:border-gray-700 dark:bg-gray-900 dark:hover:border-indigo-400/40"
                        >
                          <img
                            src={image}
                            alt={full?.name || recommendation.name}
                            className="h-16 w-16 flex-shrink-0 rounded-xl object-cover"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                {full?.name || recommendation.name}
                              </p>
                              {favorite && <span className="text-xs text-amber-500">★ Favorite</span>}
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                              {full?.address || recommendation.address}
                            </p>
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                              {typeof (full?.rating ?? recommendation.rating) === "number" && (
                                <span>Rating {(full?.rating ?? recommendation.rating)?.toFixed(1)}</span>
                              )}
                              {typeof (full?.reviewCount ?? recommendation.reviewCount) === "number" && (
                                <span>· {(full?.reviewCount ?? recommendation.reviewCount)} reviews</span>
                              )}
                              {price && <span>· {price}</span>}
                            </div>
                            {dietary && dietary.length > 0 && (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {dietary.slice(0, 3).map((tag) => (
                                  <span
                                    key={tag}
                                    className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-600"
                                  >
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
            {isSending && (
              <div className="flex items-center gap-2 text-gray-500">
                <Loader2 size={16} className="animate-spin" />
                Thinking…
              </div>
            )}
          </div>
          <div className="border-t border-gray-200 dark:border-gray-700 p-3">
            {error && <p className="mb-2 text-xs text-red-600">{error}</p>}
            <form onSubmit={handleSend} className="flex flex-col gap-2">
              <textarea
                rows={3}
                placeholder="Ask about cuisines, filters, or recommendations..."
                className="w-full resize-none rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:border-indigo-400 dark:focus:ring-indigo-500/30"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isSending}
              />
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-300"
                disabled={!input.trim() || isSending}
              >
                <Send size={16} />
                {isSending ? "Sending..." : "Send"}
              </button>
            </form>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="inline-flex items-center gap-3 rounded-full border border-transparent bg-white dark:bg-gray-900 px-4 py-3 text-sm font-semibold text-gray-900 dark:text-gray-100 shadow-xl transition hover:-translate-y-0.5 hover:border-indigo-100 hover:shadow-2xl dark:hover:border-indigo-400/40"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-50 dark:bg-indigo-600/30">
            <img src={waiterImage} alt="Chat with your waiter" className="h-8 w-8 rounded-full object-cover" />
          </span>
          Ask DineValley AI
        </button>
      )}
    </div>
  );
};

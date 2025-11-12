import { Restaurant } from "../../types";

const API_BASE =
  typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE_URL
    ? import.meta.env.VITE_API_BASE_URL.replace(/\/$/, "")
    : "https://dinevalley-backend.onrender.com";

export type ChatHistoryItem = {
  role: "user" | "assistant";
  content: string;
};

export type RestaurantContextPayload = Pick<
  Restaurant,
  | "id"
  | "name"
  | "rating"
  | "reviewCount"
  | "address"
  | "priceLevel"
  | "types"
  | "dietary"
  | "isFavorite"
  | "imageUrl"
>;

export interface AssistantResponse {
  answer: string;
}

export interface AssistantFiltersPayload {
  keywords?: string[];
}

export const askAssistant = async (
  question: string,
  history: ChatHistoryItem[] = [],
  restaurants: RestaurantContextPayload[] = [],
  filters?: AssistantFiltersPayload
): Promise<AssistantResponse> => {
  const payload: Record<string, unknown> = { question: question.trim() };

  if (history.length) {
    payload.history = history;
  }

  if (restaurants.length) {
    payload.restaurants = restaurants;
  }

  if (filters && (filters.keywords?.length ?? 0) > 0) {
    payload.filters = {
      keywords: filters.keywords?.slice(0, 6),
    };
  }

  const startedAt = performance.now?.() ?? Date.now();
  console.log("[AssistantAPI] Sending question", {
    questionPreview: question.slice(0, 120),
    historyCount: history.length,
    restaurantCount: restaurants.length,
  });

  const response = await fetch(`${API_BASE}/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let details: string | undefined;

    try {
      const errorData = await response.json();
      details = errorData?.error || errorData?.details;
    } catch (error) {
      // Ignore JSON parsing errors for non-JSON responses
    }

    console.error("[AssistantAPI] Request failed", {
      status: response.status,
      statusText: response.statusText,
      details,
    });

    throw new Error(details || "Assistant request failed");
  }

  const data = await response.json();
  const durationMs = (performance.now?.() ?? Date.now()) - startedAt;
  console.log("[AssistantAPI] Response received", {
    durationMs,
    hasAnswer: Boolean(data?.answer),
  });

  return {
    answer:
      typeof data?.answer === "string"
        ? data.answer
        : "I couldn't find an answer right now. Please try asking in a different way.",
  };
};

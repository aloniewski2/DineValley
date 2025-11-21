import { Restaurant } from "../../types";

const API_BASE =
  typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE_URL
    ? import.meta.env.VITE_API_BASE_URL.replace(/\/$/, "")
    : "https://dinevalley-backend.onrender.com";

export type ChatHistoryItem = {
  role: "user" | "assistant";
  content: string;
};

export type AssistantUseCase =
  | "restaurant_recs"
  | "filter_help"
  | "product_help"
  | "comparison_tool";

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
  structured?: StructuredAssistantAnswer;
  comparison?: ComparisonResult;
}

export interface AssistantFiltersPayload {
  keywords?: string[];
}

export interface AssistantRequestOptions {
  useCase?: AssistantUseCase;
}

export interface StructuredAssistantAnswer {
  summary?: string;
  highlights?: string[];
  filters?: string[];
  followUp?: string;
}

export interface ComparisonInsight {
  category: string;
  winner: string;
  rationale: string;
}

export interface ComparisonResult {
  overview?: string;
  insights: ComparisonInsight[];
}

const STRUCTURED_RESPONSE_GUIDE = `
You are DineValley AI, an upbeat dining concierge. Base guidance on provided restaurant context first.
Return ONLY valid JSON matching this schema:
{
  "summary": "Two short sentences or less that directly answer the user",
  "highlights": ["<=3 punchy bullet fragments highlighting next steps or insights"],
  "filters": ["<=3 smart filter ideas or tags relevant to the request"],
  "followUp": "One short CTA that nudges the user to keep exploring"
}
- Keep every string under 160 characters.
- If a field is not relevant, return an empty string or [] for it.
- Mention restaurant names only when they are provided in context.
- Avoid markdown, prose paragraphs, or extra commentary.
`;

const COMPARISON_RESPONSE_GUIDE = `
You are the Instant Restaurant Comparison Tool for DineValley. Compare the provided restaurants and crown winners for:
- Best value
- Most options for dietary needs
- Best for groups
- Most popular dishes
- Best for quick service
Return ONLY valid JSON shaped like:
{
  "overview": "short motivating sentence",
  "insights": [
    {"category": "Best value", "winner": "Restaurant name", "rationale": "<110 char reason>"}
  ]
}
- Include exactly one insight per category above (use "Split decision" when tied).
- Never invent restaurants outside provided context.
- Highlight evidence like price level, ratings, tags.
`;

const buildGuidedQuestion = (question: string, useCase: AssistantUseCase = "restaurant_recs") => {
  const trimmed = question.trim();
  if (useCase === "comparison_tool") {
    return `${COMPARISON_RESPONSE_GUIDE}
Restaurants summary:
${trimmed}`;
  }
  return `${STRUCTURED_RESPONSE_GUIDE}
Use-case:${useCase}.
User question:"""${trimmed}"""`;
};

const tryParseStructuredAnswer = (answer: string): StructuredAssistantAnswer | undefined => {
  if (typeof answer !== "string") return undefined;
  const trimmed = answer.trim();
  if (!trimmed) return undefined;

  const match = trimmed.match(/```json([\s\S]*?)```/i);
  const candidate = match ? match[1].trim() : trimmed;
  try {
    const parsed = JSON.parse(candidate);
    if (!parsed || typeof parsed !== "object") {
      return undefined;
    }
    const summary =
      typeof parsed.summary === "string" && parsed.summary.trim().length
        ? parsed.summary.trim()
        : undefined;
    const coerceList = (value: unknown): string[] | undefined => {
      if (!Array.isArray(value)) return undefined;
      const next = value
        .filter((item): item is string => typeof item === "string" && item.trim().length)
        .map((item) => item.trim())
        .slice(0, 3);
      return next.length ? next : undefined;
    };
    const highlights = coerceList(parsed.highlights);
    const filters = coerceList(parsed.filters);
    const followUp =
      typeof parsed.followUp === "string" && parsed.followUp.trim().length
        ? parsed.followUp.trim()
        : undefined;
    if (!summary && !highlights && !filters && !followUp) {
      return undefined;
    }
    return { summary, highlights, filters, followUp };
  } catch {
    return undefined;
  }
};

const tryParseComparisonAnswer = (answer: string): ComparisonResult | undefined => {
  if (typeof answer !== "string") return undefined;
  const block = answer.match(/```json([\s\S]*?)```/i)?.[1]?.trim() ?? answer.trim();
  if (!block) return undefined;
  try {
    const parsed = JSON.parse(block);
    if (!parsed || typeof parsed !== "object") return undefined;
    const overview = typeof parsed.overview === "string" ? parsed.overview.trim() : undefined;
    const rawInsights: unknown = parsed.insights;
    if (!Array.isArray(rawInsights)) {
      if (overview) {
        return { overview, insights: [] };
      }
      return undefined;
    }
    const insights: ComparisonInsight[] = rawInsights
      .map((entry) => {
        if (typeof entry !== "object" || !entry) return null;
        const category = typeof entry.category === "string" ? entry.category.trim() : "";
        const winner = typeof entry.winner === "string" ? entry.winner.trim() : "";
        const rationale = typeof entry.rationale === "string" ? entry.rationale.trim() : "";
        if (!category || !winner || !rationale) return null;
        return { category, winner, rationale };
      })
      .filter((entry): entry is ComparisonInsight => Boolean(entry));
    if (!insights.length && !overview) return undefined;
    return { overview, insights };
  } catch (error) {
    console.warn("[AssistantAPI] comparison parse failed", error);
    return undefined;
  }
};

export const askAssistant = async (
  question: string,
  history: ChatHistoryItem[] = [],
  restaurants: RestaurantContextPayload[] = [],
  filters?: AssistantFiltersPayload,
  options?: AssistantRequestOptions
): Promise<AssistantResponse> => {
  const trimmedQuestion = question.trim();
  const payload: Record<string, unknown> = {
    question: buildGuidedQuestion(trimmedQuestion, options?.useCase),
    userQuestion: trimmedQuestion,
  };

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
    questionPreview: trimmedQuestion.slice(0, 120),
    historyCount: history.length,
    restaurantCount: restaurants.length,
    useCase: options?.useCase ?? "restaurant_recs",
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

  const answer =
    typeof data?.answer === "string"
      ? data.answer
      : "I couldn't find an answer right now. Please try asking in a different way.";

  return {
    answer,
    structured: options?.useCase === "comparison_tool" ? undefined : tryParseStructuredAnswer(answer),
    comparison: options?.useCase === "comparison_tool" ? tryParseComparisonAnswer(answer) : undefined,
  };
};

import React, { useMemo, useRef, useState, useEffect } from "react";
import { Loader2, MessageCircle, Send } from "lucide-react";
import { Restaurant } from "../../types";
import { askAssistant, ChatHistoryItem } from "../api/assistant";

interface AssistantWidgetProps {
  restaurants: Restaurant[];
  onClose?: () => void;
}

type AssistantRole = "user" | "assistant" | "error";

type AssistantMessage = {
  id: string;
  role: AssistantRole;
  content: string;
};

const createId = () => `${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 8)}`;

export const AssistantWidget: React.FC<AssistantWidgetProps> = ({ restaurants, onClose }) => {
  const [messages, setMessages] = useState<AssistantMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Hi! I'm the Dine Valley concierge. Ask about restaurants, filters, or how to make the most of the app.",
    },
  ]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const contextRestaurants = useMemo(
    () =>
      (restaurants ?? [])
        .filter((restaurant): restaurant is Restaurant => Boolean(restaurant?.id))
        .slice(0, 6)
        .map((restaurant) => ({
          id: restaurant.id,
          name: restaurant.name,
          rating: restaurant.rating,
          reviewCount: restaurant.reviewCount,
          address: restaurant.address,
          priceLevel: restaurant.priceLevel,
          types: restaurant.types,
        })),
    [restaurants]
  );

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isSending) return;

    const userMessage: AssistantMessage = {
      id: createId(),
      role: "user",
      content: trimmed,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsSending(true);

    const history: ChatHistoryItem[] = [...messages, userMessage]
      .filter((message) => message.role === "user" || message.role === "assistant")
      .map((message) => ({
        role: message.role as "user" | "assistant",
        content: message.content,
      }))
      .slice(-8);

    try {
      const response = await askAssistant(trimmed, history, contextRestaurants);
      const assistantMessage: AssistantMessage = {
        id: createId(),
        role: "assistant",
        content: response.answer,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Something went wrong. Please try again.";
      console.error("[AssistantWidget] Failed to fetch response", error);
      setMessages((prev) => [
        ...prev,
        {
          id: createId(),
          role: "error",
          content: errorMessage,
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50/80 p-4 shadow-[0_4px_12px_rgb(15_23_42/0.04)]">
      <div className="flex items-center gap-2 pb-3">
        <div className="rounded-full bg-indigo-100 p-2 text-indigo-600">
          <MessageCircle size={18} />
        </div>
        <div className="flex flex-1 flex-col">
          <p className="text-sm font-semibold text-slate-900">AI Dining Guide</p>
          <p className="text-xs text-slate-500">Powered by Groq</p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close assistant"
          >
            ×
          </button>
        )}
      </div>

      <div
        ref={scrollRef}
        className="flex max-h-64 min-h-[160px] flex-col gap-2 overflow-y-auto pr-1 text-sm text-slate-800"
      >
        {messages.map((message) => (
          <div
            key={message.id}
            className={`rounded-lg px-3 py-2 leading-snug ${
              message.role === "user"
                ? "self-end bg-indigo-100 text-indigo-950"
                : message.role === "assistant"
                  ? "bg-white text-slate-900 shadow-[0_1px_4px_rgb(15_23_42/0.08)]"
                  : "bg-red-50 text-red-700"
            }`}
          >
            {message.content}
          </div>
        ))}
      </div>

      <form className="mt-3 space-y-2" onSubmit={handleSubmit}>
        <textarea
          rows={2}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Ask about cuisines, hours, pricing, or how to use filters..."
          className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 disabled:cursor-not-allowed disabled:bg-slate-100"
          disabled={isSending}
        />
        <button
          type="submit"
          disabled={isSending || !input.trim()}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-indigo-300"
        >
          {isSending ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Thinking...
            </>
          ) : (
            <>
              <Send size={16} />
              Ask Assistant
            </>
          )}
        </button>
      </form>
    </div>
  );
};

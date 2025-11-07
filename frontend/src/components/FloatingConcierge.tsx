import React, { useState } from "react";
import { Restaurant } from "../../types";
import conciergeGraphic from "../assets/waiter.png";
import { AssistantWidget } from "./AssistantWidget";
import { MessageSquareX } from "lucide-react";

interface FloatingConciergeProps {
  restaurants: Restaurant[];
}

export const FloatingConcierge: React.FC<FloatingConciergeProps> = ({ restaurants }) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleToggle = () => setIsOpen((prev) => !prev);
  const handleClose = () => setIsOpen(false);

  return (
    <div className="fixed bottom-4 right-4 z-40 flex flex-col items-end gap-3">
      {isOpen && (
        <div className="w-80 max-w-[min(90vw,20rem)] transition duration-200">
          <AssistantWidget restaurants={restaurants} onClose={handleClose} />
        </div>
      )}

      <button
        type="button"
        onClick={handleToggle}
        className="group relative flex w-60 items-center gap-3 rounded-2xl border border-slate-200 bg-white/95 px-4 py-3 text-left shadow-[0_10px_30px_rgb(15_23_42/0.10)] transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-[0_15px_35px_rgb(79_70_229/0.25)]"
      >
        <img
          src={conciergeGraphic}
          alt="Concierge waiter"
          className="h-20 w-20 rounded-full border border-white/70 object-cover shadow"
        />
        <div className="flex flex-1 flex-col text-sm leading-tight text-slate-800">
          <span className="font-semibold text-slate-900">Need dining tips?</span>
          <span className="text-xs text-slate-500">Tap to chat with the Groq concierge.</span>
        </div>
        {isOpen && (
          <MessageSquareX size={16} className="text-slate-400 transition group-hover:text-indigo-500" />
        )}
      </button>
    </div>
  );
};

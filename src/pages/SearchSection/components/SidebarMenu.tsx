import React from "react";
import { Search, Sparkles, User } from "lucide-react";
import type { Page } from "../../../App";

interface SidebarProps {
  onNavigate: (page: Page) => void;
  currentPage?: Page;
}

const navItems = [
  {
    key: "discover",
    label: "Discover",
    icon: <Search size={20} />,
  },
  {
    key: "recommendations",
    label: "Recommendations",
    icon: <Sparkles size={20} />,
  },
  {
    key: "profile",
    label: "Profile",
    icon: <User size={20} />,
  },
] as const;

export const Sidebar: React.FC<SidebarProps> = ({ onNavigate, currentPage }) => (
  <aside className="w-60 h-full bg-white px-4 py-6 border-r flex flex-col gap-2">
    <nav className="flex flex-col gap-1">
      {navItems.map((item) => (
        <button
          key={item.key}
          className={`flex items-center gap-3 px-3 py-2 text-base font-medium rounded-lg transition
            ${
              currentPage === item.key
                ? "bg-gray-100 text-black"
                : "text-gray-600 hover:bg-gray-50"
            }`}
          onClick={() => onNavigate(item.key as Page)}
        >
          {item.icon}
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  </aside>
);

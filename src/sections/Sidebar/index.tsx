import React from "react";
import { SidebarMenu } from "./components/SidebarMenu";

// import Page type from App (or declare it in a shared types file)
import { Page } from "../../App";

export const Sidebar = ({ onNavigate }: { onNavigate: (page: Page) => void }) => (
  <nav className="w-64 bg-white p-4">
    <button onClick={() => onNavigate("discover")}>Discover</button>
    <button onClick={() => onNavigate("recommendations")}>Recommendations</button>
    <button onClick={() => onNavigate("profile")}>Profile</button>
  </nav>
);

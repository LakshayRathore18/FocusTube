"use client";

import { useState, useCallback } from "react";
import Sidebar from "./Sidebar";
import Navbar from "./Navbar";

const COLLAPSED_KEY = "focustube-sidebar-collapsed";

/**
 * Layout shell — orchestrates the single top header + collapsible sidebar.
 *
 * Structure:
 *   ┌────────────────────────────────────────────┐
 *   │         Navbar (full-width header)         │
 *   ├────────────┬───────────────────────────────┤
 *   │  Sidebar   │        Main Content           │
 *   │ (w-64/w-16)│                               │
 *   └────────────┴───────────────────────────────┘
 *
 * Mobile: sidebar is a fixed overlay, toggled via hamburger in Navbar.
 * Desktop: sidebar is a static flex item, collapsed/expanded via toggle in Navbar.
 */
export default function LayoutShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // Lazy-init from localStorage to avoid flash on reload
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(COLLAPSED_KEY) === "true";
    }
    return false;
  });

  const toggleCollapse = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(COLLAPSED_KEY, next ? "true" : "false");
      return next;
    });
  }, []);

  return (
    <div className="flex flex-col h-screen w-full">
      {/* Single full-width header */}
      <Navbar
        onMenuClick={() => setSidebarOpen(true)}
      />

      {/* Sidebar + Main content row */}
      <div className="flex flex-1 min-h-0">
        <Sidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          collapsed={collapsed}
          onToggleCollapse={toggleCollapse}
        />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

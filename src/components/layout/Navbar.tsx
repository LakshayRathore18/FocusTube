"use client";

import { useState } from "react";
import AuthButton from "./AuthButton";
import SearchOverlay from "../search/SearchOverlay";
import { Menu, Search } from "lucide-react";

interface NavbarProps {
  onMenuClick: () => void;
}

function PlayIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="shrink-0">
      <defs>
        <linearGradient id="play-gradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#6366F1" />
          <stop offset="100%" stopColor="#3B82F6" />
        </linearGradient>
      </defs>
      <path d="M8 5.14v14.72a1 1 0 0 0 1.5.86l11-7.36a1 1 0 0 0 0-1.72l-11-7.36A1 1 0 0 0 8 5.14Z" fill="url(#play-gradient)" />
    </svg>
  );
}

export default function Navbar({ onMenuClick }: NavbarProps) {
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <>
      <header className="flex items-center justify-between px-4 lg:px-6 py-3 bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-2">
          {/* Mobile hamburger */}
          <button
            onClick={onMenuClick}
            className="lg:hidden p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label="Open sidebar"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Logo */}
          <a href="/" className="flex items-center gap-2 group">
            <PlayIcon />
            <span className="text-base font-semibold text-gray-900 dark:text-white tracking-tight">FocusTube</span>
          </a>
        </div>

        {/* Right: search + auth */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSearchOpen(true)}
            className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label="Search courses"
          >
            <Search className="w-5 h-5" />
          </button>
          <AuthButton />
        </div>
      </header>

      <SearchOverlay isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}

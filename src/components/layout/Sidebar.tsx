"use client";

import { useEffect, useState, useCallback } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import Image from "next/image";
import { LayoutDashboard, FileText, Settings, CheckCircle2, Menu } from "lucide-react";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/notes", label: "All Notes", icon: FileText },
  { href: "/settings", label: "Settings", icon: Settings },
];

type WeeklyStats = {
  videosCompletedThisWeek: number;
  watchTimeThisWeek: number;
  totalVideosCompleted: number;
  totalVideosCount: number;
};

function MiniCircularProgress({ pct }: { pct: number }) {
  const r = 10;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <div className="relative w-7 h-7 flex items-center justify-center">
      <svg className="w-7 h-7 -rotate-90" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r={r} stroke="currentColor" strokeWidth="2.5" className="text-gray-200 dark:text-gray-700" />
        <circle cx="12" cy="12" r={r} stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset} className="text-blue-500" />
      </svg>
    </div>
  );
}

function CircularProgress({ pct }: { pct: number }) {
  const r = 28;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <div className="relative w-20 h-20 flex items-center justify-center">
      <svg className="w-20 h-20 -rotate-90" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r={r} stroke="currentColor" strokeWidth="4" className="text-gray-200 dark:text-gray-700" />
        <circle cx="32" cy="32" r={r} stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset} className="text-blue-500" />
      </svg>
      <span className="text-xs font-semibold text-gray-900 dark:text-white absolute inset-0 flex items-center justify-center">
        {pct}%
      </span>
    </div>
  );
}

export default function Sidebar({ isOpen, onClose, collapsed, onToggleCollapse }: SidebarProps) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [weeklyStats, setWeeklyStats] = useState<WeeklyStats | null>(null);

  // Lock body scroll when sidebar is open on mobile
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  // Fetch weekly stats on mount and whenever a stats refresh is requested
  useEffect(() => {
    function fetchStats() {
      fetch("/api/stats/weekly")
        .then((res) => res.json())
        .then((data) => {
          if (data && typeof data.videosCompletedThisWeek === "number") {
            setWeeklyStats(data);
          }
        })
        .catch(() => {});
    }

    fetchStats();

    window.addEventListener("refresh-stats", fetchStats);
    return () => window.removeEventListener("refresh-stats", fetchStats);
  }, []);

  const isActive = useCallback((href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  }, [pathname]);

  const weeklyPct =
    weeklyStats && weeklyStats.totalVideosCount > 0
      ? Math.min(100, Math.round((weeklyStats.totalVideosCompleted / weeklyStats.totalVideosCount) * 100))
      : 0;

  return (
    <>
      {/* Mobile overlay backdrop */}
      {isOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={onClose} />
      )}

      {/* Sidebar panel — no logo/header area, that lives in Navbar now */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50
          bg-white dark:bg-gray-950 border-r border-gray-200 dark:border-gray-800
          flex flex-col
          transition-all duration-300 ease-in-out
          lg:relative lg:z-auto lg:translate-x-0 lg:shrink-0 lg:h-full
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
          ${collapsed ? "w-16" : "w-64"}
        `}
      >

        {/* Toggle button — collapses/expands sidebar, desktop only */}
        <div className={`shrink-0 ${collapsed ? "flex justify-center py-3" : "flex items-center justify-between px-3 pt-3 pb-1"}`}>
          <button
            onClick={onToggleCollapse}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 transition-colors"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation items — scroll independently if they exceed available space */}
        <nav className={`flex-1 space-y-1 overflow-y-auto min-h-0 ${collapsed ? "px-2 pb-4" : "px-3 pb-4"}`}>
          {    navItems.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={`
                  relative flex items-center rounded-lg text-sm font-medium transition-all
                  ${collapsed ? "justify-center py-2.5 px-0" : "gap-3 px-3 py-2.5"}
                  ${
                    active
                      ? "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20"
                      : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
                  }
                `}
                title={collapsed ? item.label : undefined}
              >
                {active && !collapsed && (
                  <div className="absolute left-0 top-1 bottom-1 w-[3px] rounded-r-full bg-blue-500" />
                )}
                {active && collapsed && (
                  <div className="absolute left-0 inset-y-1 w-[3px] rounded-r-full bg-blue-500" />
                )}
                <item.icon className={`w-5 h-5 shrink-0 ${active ? "text-blue-600 dark:text-blue-400" : "text-gray-400 dark:text-gray-500"}`} />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Bottom block — always pinned to bottom, never scrolls */}
        <div className="shrink-0">

        {/* Weekly Progress */}
        {session?.user && weeklyStats && (
          collapsed ? (
            <div className="flex justify-center py-3 mx-2 mb-1">
              <MiniCircularProgress pct={weeklyPct} />
            </div>
          ) : (
            <div className="px-4 py-3 mx-3 mb-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
              <div className="flex items-center gap-3">
                <CircularProgress pct={weeklyPct} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Progress</p>
                  <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>{weeklyStats.totalVideosCompleted}/{weeklyStats.totalVideosCount} videos done</span>
                  </div>
                </div>
              </div>
            </div>
          )
        )}

        {/* User info */}
        {session?.user ? (
          <div className={`border-t border-gray-200 dark:border-gray-800 ${collapsed ? "px-0 py-4 flex justify-center" : "px-4 py-4"}`}>
            {collapsed ? (
              session.user.image ? (
                <Image src={session.user.image} alt={session.user.name ?? "avatar"} width={32} height={32} className="rounded-full ring-2 ring-gray-200 dark:ring-gray-700" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-700 flex items-center justify-center text-sm font-medium text-gray-700 dark:text-gray-300">
                  {session.user.name?.[0] ?? "U"}
                </div>
              )
            ) : (
              <div className="flex items-center gap-3">
                {session.user.image ? (
                  <Image src={session.user.image} alt={session.user.name ?? "avatar"} width={36} height={36} className="rounded-full ring-2 ring-gray-200 dark:ring-gray-700" />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-gray-300 dark:bg-gray-700 flex items-center justify-center text-sm font-medium text-gray-700 dark:text-gray-300 shrink-0">
                    {session.user.name?.[0] ?? "U"}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{session.user.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{session.user.email}</p>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className={`border-t border-gray-200 dark:border-gray-800 ${collapsed ? "px-2 py-4" : "px-4 py-4"}`}>
            {collapsed ? (
              <Link href="/sign-in" onClick={onClose} className="flex items-center justify-center w-8 h-8 mx-auto rounded-lg bg-blue-600 hover:bg-blue-700 transition-colors">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
                </svg>
              </Link>
            ) : (
              <Link href="/sign-in" onClick={onClose} className="block w-full text-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors">
                Sign in
              </Link>
            )}
          </div>
        )}
        </div>
      </aside>
    </>
  );
}

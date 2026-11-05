"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useSession } from "@/components/auth/AuthProvider";
import { ArrowUpRight, BookOpen, Check, ChevronRight, FileText, LayoutDashboard, LogIn, PanelLeftClose, PanelLeftOpen, Settings, X } from "lucide-react";
import styles from "./LayoutChrome.module.css";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}
const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/courses", label: "Courses", icon: BookOpen },
  { href: "/study-library", label: "Study Library", icon: FileText },
];
type LearningProgress = { totalVideosCompleted: number; totalVideosCount: number };

export default function Sidebar({ isOpen, onClose, collapsed, onToggleCollapse }: SidebarProps) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [progress, setProgress] = useState<LearningProgress | null>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") { event.preventDefault(); onClose(); }
      if (event.key !== "Tab") return;
      const elements = Array.from(sidebarRef.current?.querySelectorAll<HTMLElement>('a[href],button:not([disabled])') ?? []).filter((element) => element.getClientRects().length);
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
    document.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKey);
      previousFocus?.focus();
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    const controller = new AbortController();
    async function fetchProgress() {
      try {
        const response = await fetch("/api/stats/weekly", { signal: controller.signal });
        if (!response.ok) return;
        const data = await response.json();
        if (!controller.signal.aborted && typeof data?.totalVideosCompleted === "number" && typeof data?.totalVideosCount === "number") setProgress(data);
      } catch { /* Progress is optional; navigation remains available offline. */ }
    }
    void fetchProgress();
    window.addEventListener("refresh-stats", fetchProgress);
    return () => {
      controller.abort();
      window.removeEventListener("refresh-stats", fetchProgress);
    };
  }, []);

  const pct = progress && progress.totalVideosCount > 0
    ? Math.min(100, Math.max(0, Math.round(progress.totalVideosCompleted / progress.totalVideosCount * 100))) : 0;
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");
  const compact = collapsed && !isOpen;

  return (
    <>
      {isOpen && <div className={styles.backdrop} onClick={onClose} aria-hidden="true" />}
      <aside ref={sidebarRef} id="workspace-sidebar" className={styles.sidebar} data-collapsed={compact} data-open={isOpen} role={isOpen ? "dialog" : undefined} aria-modal={isOpen || undefined} aria-label={isOpen ? "Workspace navigation" : "Sidebar"}>
        <div className={styles.sidebarHeading}>
          <span className={styles.sidebarLabel}>WORKSPACE</span>
          <button onClick={onToggleCollapse} className={styles.collapseButton} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-expanded={!collapsed} aria-controls="workspace-sidebar" title={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
            {collapsed ? <PanelLeftOpen size={17} aria-hidden="true" /> : <PanelLeftClose size={17} aria-hidden="true" />}
          </button>
          <button ref={closeRef} onClick={onClose} className={styles.closeButton} aria-label="Close sidebar"><X size={20} aria-hidden="true" /></button>
        </div>
        <nav className={styles.navigation} aria-label="Main navigation">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} onClick={onClose} className={styles.navItem} data-active={isActive(href)} aria-current={isActive(href) ? "page" : undefined} aria-label={label} title={compact ? label : undefined}>
              <Icon size={19} strokeWidth={1.7} aria-hidden="true" /><span className={styles.navLabel}>{label}</span><span className={styles.activeDot} aria-hidden="true" />
            </Link>
          ))}
        </nav>
        <div className={styles.sidebarBottom}>
          <Link href="/settings" onClick={onClose} className={styles.navItem} data-active={isActive("/settings")} aria-current={isActive("/settings") ? "page" : undefined} aria-label="Settings" title={compact ? "Settings" : undefined}><Settings size={19} strokeWidth={1.7} aria-hidden="true" /><span className={styles.navLabel}>Settings</span><span className={styles.activeDot} aria-hidden="true" /></Link>
          {session?.user && progress && (
            <div className={styles.sidebarProgress} title={`${pct}% of your lessons completed`}>
              <div className={styles.progressHeading}><span className={styles.progressCaption}>Your learning journey</span><strong>{pct}%</strong></div>
              <progress value={pct} max={100} aria-label="Overall lesson completion" />
              <p><Check size={13} aria-hidden="true" /> {progress.totalVideosCompleted} of {progress.totalVideosCount} lessons completed</p>
              <Link href="/courses" onClick={onClose} className={styles.progressAction}>Keep exploring <ArrowUpRight size={13} aria-hidden="true" /></Link>
            </div>
          )}
          <div className={styles.sidebarAccount}>
            {session?.user ? (
              <Link href="/settings" onClick={onClose} className={styles.workspaceAccount} aria-label="Your workspace settings" title={compact ? session.user.name ?? "Your workspace" : undefined}>
                <span className={styles.avatar}>{session.user.image ? <Image src={session.user.image} alt="" width={34} height={34} /> : session.user.name?.[0] ?? "U"}</span>
                <span className={styles.accountText}><strong>{session.user.name ?? "Your workspace"}</strong><span>Personal workspace</span></span>
                <ChevronRight size={14} className={styles.accountArrow} aria-hidden="true" />
              </Link>
            ) : <Link href="/sign-in" onClick={onClose} className={styles.navItem} aria-label="Sign in"><LogIn size={18} aria-hidden="true" /><span className={styles.navLabel}>Sign in to your workspace</span></Link>}
          </div>
        </div>
      </aside>
    </>
  );
}

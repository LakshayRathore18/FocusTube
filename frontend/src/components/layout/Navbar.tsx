"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { ChevronRight, Menu, Play, Search } from "lucide-react";
import AuthButton from "./AuthButton";
import SearchOverlay from "../search/SearchOverlay";
import styles from "./LayoutChrome.module.css";

interface NavbarProps {
  onMenuClick: () => void;
  sidebarOpen: boolean;
}

export default function Navbar({ onMenuClick, sidebarOpen }: NavbarProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const pathname = usePathname();
  const section = pathname.startsWith("/dashboard") ? "Dashboard"
    : pathname.startsWith("/courses") ? "Courses"
    : pathname.startsWith("/study-library") ? "Study Library"
    : pathname.startsWith("/settings") ? "Settings" : null;

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen((open) => !open);
      }
    }
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  return (
    <>
      <header className={styles.navbar}>
        <div className={styles.brandGroup}>
          <button onClick={onMenuClick} className={styles.mobileMenuButton} aria-label="Open sidebar" aria-expanded={sidebarOpen} aria-controls="workspace-sidebar"><Menu size={20} aria-hidden="true" /></button>
          <Link href="/" className={styles.brand} aria-label="FocusTube home">
            <span className={styles.brandMark}><Play size={17} fill="currentColor" strokeWidth={1.5} aria-hidden="true" /></span>
            <span>Focus<span className={styles.brandAccent}>Tube</span></span>
          </Link>
        </div>
        {section && <div className={styles.breadcrumb} aria-label="Current section"><span>Workspace</span><ChevronRight size={13} aria-hidden="true" /><strong>{section}</strong></div>}
        <div className={styles.navbarActions}>
          <button onClick={() => setSearchOpen(true)} className={styles.searchTrigger} aria-label="Search courses" aria-keyshortcuts="Control+k Meta+k">
            <Search size={17} aria-hidden="true" /><span>Search your courses</span><kbd>⌘ / Ctrl K</kbd>
          </button>
          <span className={styles.actionDivider} aria-hidden="true" />
          <AuthButton />
        </div>
      </header>
      <SearchOverlay isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}

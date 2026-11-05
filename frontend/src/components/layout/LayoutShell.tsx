"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import Sidebar from "./Sidebar";
import Navbar from "./Navbar";
import styles from "./LayoutChrome.module.css";

const COLLAPSED_KEY = "focustube-sidebar-collapsed";
const COLLAPSED_EVENT = "focustube-sidebar-change";

function subscribeSidebar(listener: () => void) {
  window.addEventListener("storage", listener);
  window.addEventListener(COLLAPSED_EVENT, listener);
  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener(COLLAPSED_EVENT, listener);
  };
}
function getCollapsed() {
  try { return localStorage.getItem(COLLAPSED_KEY) === "true"; }
  catch { return false; }
}
function subscribeMobile(listener: () => void) {
  const media = window.matchMedia("(max-width: 1023px)");
  media.addEventListener("change", listener);
  return () => media.removeEventListener("change", listener);
}
const getMobile = () => window.matchMedia("(max-width: 1023px)").matches;
const getServerSnapshot = () => false;

export default function LayoutShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const collapsed = useSyncExternalStore(subscribeSidebar, getCollapsed, getServerSnapshot);
  const isMobile = useSyncExternalStore(subscribeMobile, getMobile, getServerSnapshot);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);
  const toggleCollapse = useCallback(() => {
    try {
      localStorage.setItem(COLLAPSED_KEY, String(!getCollapsed()));
      window.dispatchEvent(new Event(COLLAPSED_EVENT));
    } catch { /* Navigation stays expanded if browser storage is unavailable. */ }
  }, []);
  const mobileOpen = sidebarOpen && isMobile;

  return (
    <div className={styles.shell}>
      <div inert={mobileOpen || undefined}>
        <Navbar onMenuClick={() => setSidebarOpen(true)} sidebarOpen={mobileOpen} />
      </div>
      <div className={styles.workspace}>
        <Sidebar isOpen={mobileOpen} onClose={closeSidebar} collapsed={collapsed} onToggleCollapse={toggleCollapse} />
        <main className={styles.mainContent} inert={mobileOpen || undefined}>{children}</main>
      </div>
    </div>
  );
}

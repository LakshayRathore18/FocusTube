"use client";

import { useState, useEffect } from "react";
import DashboardPage from "@/components/dashboard/DashboardPage";
import FirstTimeExperience from "@/components/dashboard/FirstTimeExperience";
import StreakPopup from "@/components/dashboard/StreakPopup";
import StreakToast from "@/components/dashboard/StreakToast";

export default function Dashboard() {
  const [playlistCount, setPlaylistCount] = useState<number | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    fetch("/api/stats/learning")
      .then((res) => res.json())
      .then((data) => {
        if (data && typeof data.totalPlaylists === "number") {
          setPlaylistCount(data.totalPlaylists);
        } else {
          setPlaylistCount(0);
        }
      })
      .catch((err) => {
        console.error("Failed to check playlists:", err);
        setPlaylistCount(0);
      })
      .finally(() => setChecking(false));
  }, []);

  // While checking, render nothing (brief flash prevented by layout)
  if (checking) return null;

  // First-time user — show onboarding
  if (playlistCount === 0) {
    return <FirstTimeExperience />;
  }

  // Returning user — show normal dashboard
  return (
    <>
      <StreakPopup />
      <StreakToast />
      <DashboardPage />
    </>
  );
}
"use client";

import { useEffect, useState } from "react";

export function useVideoChat() {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/rag/capabilities", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (response.ok) {
          const data = await response.json();
          if (!controller.signal.aborted) setEnabled(data.videoChat === true);
        }
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);
  return enabled;
}

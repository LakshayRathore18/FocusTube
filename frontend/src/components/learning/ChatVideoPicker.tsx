"use client";

import { useEffect, useState } from "react";
import type { Video } from "@/components/course/types";

export default function ChatVideoPicker({ courseId, onOpen }: { courseId: string; onOpen: (id: string, title: string, youtubeId: string) => void }) {
  const [videos, setVideos] = useState<Video[] | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/courses/${courseId}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        const data = await response.json();
        if (!controller.signal.aborted) { setVideos(data.videos); setError(false); }
      })
      .catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [courseId, attempt]);
  if (error) return <div><p>Could not load videos.</p><button onClick={() => setAttempt((n) => n + 1)}>Retry</button></div>;
  if (!videos) return <p className="text-sm text-zinc-400">Loading videos…</p>;
  if (!videos.length) return <p>No videos in this course yet.</p>;
  return <div className="space-y-2">{videos.map((video) => <button key={video.id} onClick={() => onOpen(video.id, video.title, video.youtubeVideoId)} className="block w-full text-left rounded-xl border border-zinc-800 p-4 hover:bg-zinc-800">
    <span className="text-sm text-zinc-200">{video.title}</span><span className="block text-xs text-blue-400 mt-1">Ask this video</span>
  </button>)}</div>;
}

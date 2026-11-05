"use client";

import { useEffect, useRef } from "react";
import type { Video } from "./types";

export default function VideoPlayerModal({
  video,
  onClose,
  onMarkCompleted,
  onOpenNotes,
}: {
  video: Video;
  onClose: () => void;
  onMarkCompleted: (videoId: string) => void;
  onOpenNotes: (video: Video) => void;
}) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCloseRef.current();
    }
    document.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, []);

  return (
    <div
      ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
    >
      <div
        className="w-full max-w-4xl rounded-2xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 dark:border-zinc-800">
          <div className="min-w-0 flex-1">
            <span className="text-xs font-medium text-blue-600 dark:text-blue-400 shrink-0">Now Playing</span>
            <h2 className="text-sm font-medium text-gray-900 dark:text-white truncate mt-0.5">{video.title}</h2>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 ml-3 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
            aria-label="Close player"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Video */}
        <div className="bg-black">
          <div className="aspect-video max-h-[60vh] mx-auto">
            <iframe
              src={`https://www.youtube.com/embed/${video.youtubeVideoId}?autoplay=1&rel=0`}
              title={video.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="w-full h-full"
            />
          </div>
        </div>

        {/* Bottom bar: quick actions */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-gray-200 dark:border-zinc-800">
          <button
            onClick={() => onOpenNotes(video)}
            className="flex items-center gap-2 rounded-lg border border-gray-300 dark:border-zinc-700 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-200 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
            </svg>
            Notes
          </button>
          {video.status !== "completed" ? (
            <button
              onClick={() => { onMarkCompleted(video.id); onClose(); }}
              className="flex items-center gap-1.5 rounded-lg bg-green-600 hover:bg-green-700 active:bg-green-800 px-3 py-1.5 text-xs font-semibold text-white transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
              Mark complete
            </button>
          ) : (
            <span className="flex items-center gap-1 text-xs text-green-500">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
              Completed
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

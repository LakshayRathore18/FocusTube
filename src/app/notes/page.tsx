"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Search, FileText } from "lucide-react";
import NoteEditor, { type NoteEditorHandle } from "@/components/notes/NoteEditor";

// ─── Types ───────────────────────────────────────────────────────────────────

type NoteItem = {
  id: string;
  videoId: string;
  content: string;
  updatedAt: string;
  video: {
    id: string;
    title: string;
    youtubeVideoId: string;
    course: {
      id: string;
      title: string;
    };
  };
};

type GroupedNotes = Record<string, NoteItem[]>;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "");
}

function formatTimeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function groupByCourse(notes: NoteItem[]): GroupedNotes {
  const groups: GroupedNotes = {};
  for (const note of notes) {
    const key = note.video.course.title;
    if (!groups[key]) groups[key] = [];
    groups[key].push(note);
  }
  return groups;
}

// ─── Notes Modal ─────────────────────────────────────────────────────────────

function NotesModal({
  note,
  onClose,
}: {
  note: NoteItem;
  onClose: () => void;
}) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const noteEditorRef = useRef<NoteEditorHandle>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const flushAndClose = useCallback(async () => {
    await noteEditorRef.current?.flushAndSave();
    onCloseRef.current();
  }, []);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") flushAndClose();
    }
    document.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [flushAndClose]);

  return (
    <div
      ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current) flushAndClose(); }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
    >
      <div
        className="w-full max-w-[800px] rounded-2xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-zinc-800">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                Notes
              </span>
              <span className="text-xs text-gray-400 dark:text-zinc-500">
                {note.video.course.title}
              </span>
            </div>
            <h2 className="text-sm font-medium text-gray-900 dark:text-white truncate mt-0.5">
              {note.video.title}
            </h2>
          </div>
          <button
            onClick={flushAndClose}
            className="shrink-0 ml-3 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
            aria-label="Close notes"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Editor */}
        <div className="p-5">
          <NoteEditor ref={noteEditorRef} videoId={note.videoId} />
        </div>

        {/* Save & Close footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-gray-200 dark:border-zinc-800">
          <button
            onClick={flushAndClose}
            className="rounded-lg bg-blue-600 hover:bg-blue-700 active:bg-blue-800 px-5 py-2 text-sm font-semibold text-white transition-colors"
          >
            Save &amp; Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Notes Page ──────────────────────────────────────────────────────────────

export default function NotesPage() {
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [activeNote, setActiveNote] = useState<NoteItem | null>(null);

  useEffect(() => {
    fetch("/api/notes")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setNotes(data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Client-side search filter
  const filteredNotes = notes.filter((note) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const plainText = stripHtml(note.content);
    return (
      plainText.toLowerCase().includes(q) ||
      note.video.title.toLowerCase().includes(q)
    );
  });

  const grouped = groupByCourse(filteredNotes);
  const courseNames = Object.keys(grouped);

  // Loading state
  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-8">
          All Notes
        </h1>
        <div className="space-y-4 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-xl bg-gray-200 dark:bg-gray-800" />
          ))}
        </div>
      </div>
    );
  }

  // Empty state
  if (notes.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-8">
          All Notes
        </h1>
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
            <FileText className="w-8 h-8 text-gray-400 dark:text-gray-500" />
          </div>
          <p className="text-gray-500 dark:text-gray-400 text-lg max-w-sm">
            No notes yet — start adding notes while watching videos.
          </p>
        </div>
      </div>
    );
  }

  // No search results
  if (filteredNotes.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-8">
          All Notes
        </h1>
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search notes by text or video title..."
            className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 pl-10 pr-4 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="text-center py-16">
          <p className="text-gray-500 dark:text-gray-400 text-lg">
            No notes match &ldquo;{searchQuery}&rdquo;
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-8">
        All Notes
      </h1>

      {/* Search input */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search notes by text or video title..."
          className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 pl-10 pr-4 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Notes grouped by course */}
      <div className="space-y-8">
        {courseNames.map((courseTitle) => (
          <section key={courseTitle}>
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
              {courseTitle}
            </h2>
            <div className="space-y-2">
              {grouped[courseTitle].map((note) => {
                const preview = stripHtml(note.content).slice(0, 100);
                return (
                  <button
                    key={note.id}
                    onClick={() => setActiveNote(note)}
                    className="w-full text-left group block rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 hover:shadow-md hover:border-blue-300 dark:hover:border-blue-700 transition-all"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {note.video.title}
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          {note.video.course.title}
                        </p>
                        {preview && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 line-clamp-2 leading-relaxed">
                            {preview}
                            {stripHtml(note.content).length > 100 && (
                              <span className="text-blue-500 dark:text-blue-400">...</span>
                            )}
                          </p>
                        )}
                      </div>
                      <span className="shrink-0 text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                        {formatTimeAgo(note.updatedAt)}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {/* Notes modal */}
      {activeNote && (
        <NotesModal
          note={activeNote}
          onClose={() => setActiveNote(null)}
        />
      )}
    </div>
  );
}

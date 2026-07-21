"use client";

import { useState, useEffect, useRef, forwardRef, useImperativeHandle, useCallback } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  List,
  ListOrdered,
  Heading2,
  Heading3,
  RemoveFormatting,
} from "lucide-react";

import { getPlainText, isNoteContentEmpty as isEditorContentEmpty, formatTimeAgo as formatTimeAgoUtil } from "@/lib/utils";

// ─── Toast ──────────────────────────────────────────────────────────────────

type ToastMessage = {
  id: number;
  text: string;
};

let toastIdCounter = 0;

// ─── Toolbar button ─────────────────────────────────────────────────────────

function ToolBtn({
  active,
  onClick,
  title,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`p-1.5 rounded-md transition-colors ${
        active
          ? "bg-blue-600/20 text-blue-400"
          : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
      }`}
    >
      {children}
    </button>
  );
}

// ─── Save status indicator ──────────────────────────────────────────────────

type SaveState = "idle" | "saving" | "saved" | "error";

function SaveIndicator({ state, lastSaved }: { state: SaveState; lastSaved: Date | null }) {
  if (state === "idle" && !lastSaved) return null;

  const styles = {
    idle: "text-zinc-500",
    saving: "text-amber-400",
    saved: "text-green-400",
    error: "text-red-400",
  };

  const labels = {
    idle: lastSaved ? `Saved ${formatTimeAgoUtil(lastSaved)}` : "",
    saving: "Saving...",
    saved: lastSaved ? `Saved ${formatTimeAgoUtil(lastSaved)}` : "Saved",
    error: "Failed to save",
  };

  return (
    <span className={`text-xs transition-colors duration-300 ${styles[state]}`}>
      {labels[state]}
    </span>
  );
}

// ─── NoteEditor component ────────────────────────────────────────────────────

export type NoteEditorHandle = {
  /** Force-save any pending changes immediately.
   *  Returns `true` if the save (or delete) was performed, or `false` if
   *  the content was empty and there was nothing to save — letting the
   *  parent decide not to close the modal. */
  flushAndSave: () => Promise<boolean>;
};

interface NoteEditorProps {
  videoId: string;
  onHasContentChange?: (videoId: string, hasContent: boolean) => void;
}

const NoteEditor = forwardRef<NoteEditorHandle, NoteEditorProps>(
  function NoteEditor({ videoId, onHasContentChange }, ref) {
  const [loaded, setLoaded] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialContentSet = useRef(false);
  const lastHtmlRef = useRef<string>("<p></p>");
  const hasExistingNoteRef = useRef(false);
  // Promise resolver for the delete confirmation dialog
  const deleteResolverRef = useRef<((confirmed: boolean) => void) | null>(null);
  // Track the latest in-flight fetch so flushAndSave can await it
  const savePromiseRef = useRef<Promise<void> | null>(null);

  const showToast = useCallback((text: string) => {
    const id = ++toastIdCounter;
    setToast({ id, text });
    setTimeout(() => {
      setToast((current) => (current?.id === id ? null : current));
    }, 3000);
  }, []);

  const saveContent = useCallback((html: string): Promise<void> => {
    // Frontend guard: don't save empty content
    if (isEditorContentEmpty(html)) {
      setSaveState("idle");
      return Promise.resolve();
    }

    const promise = fetch(`/api/videos/${videoId}/notes`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: html }),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Save failed");
        setSaveState("saved");
        setLastSaved(new Date());
        hasExistingNoteRef.current = true;
        // Immediately update the parent — notes button turns blue right away
        onHasContentChange?.(videoId, true);
      })
      .catch(() => {
        setSaveState("error");
      });

    savePromiseRef.current = promise;
    return promise;
  }, [videoId, onHasContentChange]);

  const deleteNote = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch(`/api/videos/${videoId}/notes`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Delete failed");
      hasExistingNoteRef.current = false;
      onHasContentChange?.(videoId, false);
      setSaveState("idle");
      setLastSaved(null);
      return true;
    } catch {
      setSaveState("error");
      return false;
    }
  }, [videoId, onHasContentChange]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Underline,
      Placeholder.configure({
        placeholder: "Add your notes for this video...",
      }),
    ],
    content: "<p></p>",
    editorProps: {
      attributes: {
        class:
          "focus:outline-none min-h-[300px] px-4 py-3 text-sm leading-relaxed text-zinc-200 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-zinc-100 [&_h2]:mt-4 [&_h2]:mb-2 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-zinc-100 [&_h3]:mt-3 [&_h3]:mb-1.5 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:text-zinc-200 [&_li_p]:m-0 [&_p]:text-zinc-200 [&_p]:leading-relaxed [&_p.is-editor-empty]:before:text-zinc-600",
      },
    },
    onUpdate: ({ editor: ed }) => {
      const html = ed.getHTML();
      lastHtmlRef.current = html;

      if (debounceRef.current) clearTimeout(debounceRef.current);

      // Skip auto-save if content is empty (don't create a DB record for nothing)
      if (isEditorContentEmpty(html)) {
        setSaveState("idle");
        return;
      }

      debounceRef.current = setTimeout(() => {
        setSaveState("saving");
        saveContent(html);
      }, 1500);
    },
  });

  // Expose flushAndSave via imperative handle so the parent modal can force-save
  useImperativeHandle(
    ref,
    () => ({
      flushAndSave: async (): Promise<boolean> => {
        if (debounceRef.current) {
          clearTimeout(debounceRef.current);
          debounceRef.current = null;
        }
        if (!editor) return true; // nothing to save, just close

        const html = editor.getHTML();
        const isEmpty = isEditorContentEmpty(html);

        if (isEmpty) {
          if (hasExistingNoteRef.current) {
            // User deleted all content of an existing note — ask to delete
            setShowDeleteConfirm(true);
            const confirmed = await new Promise<boolean>((resolve) => {
              deleteResolverRef.current = resolve;
            });
            setShowDeleteConfirm(false);
            if (confirmed) {
              const ok = await deleteNote();
              return ok; // true = deleted, close modal
            }
            return false; // user cancelled — stay open
          }
          // No existing note and content is empty — nothing to save
          showToast("Write something before saving.");
          return false; // stay open
        }

        // Has content — save normally
        if (html === lastHtmlRef.current && savePromiseRef.current) {
          // Content unchanged & a save is already in flight — wait for it
          await savePromiseRef.current;
          return true;
        }
        setSaveState("saving");
        await saveContent(html);
        return true;
      },
    }),
    [editor, saveContent, deleteNote, showToast],
  );

  // Fetch existing note on mount and set it once
  useEffect(() => {
    fetch(`/api/videos/${videoId}/notes`)
      .then((res) => res.json())
      .then((data) => {
        // Only process on the first successful fetch with editor ready.
        // Subsequent re-runs (due to onHasContentChange reference changing,
        // editor re-initialization, etc.) must NOT overwrite the state.
        if (initialContentSet.current) {
          setLoaded(true);
          return;
        }

        if (data && data.content && editor) {
          initialContentSet.current = true;
          lastHtmlRef.current = data.content;
          hasExistingNoteRef.current = true;
          editor.commands.setContent(data.content);
          onHasContentChange?.(videoId, true);
        } else if (editor) {
          // Editor is ready and either no note exists or the note is empty
          initialContentSet.current = true;
          hasExistingNoteRef.current = false;
          onHasContentChange?.(videoId, false);
        }
        // If editor isn't ready yet, keep initialContentSet.current = false
        // so the next re-render re-fetches and processes correctly.
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [videoId, editor, onHasContentChange]);

  // Close delete confirmation dialog on Escape (capture phase to beat modal handler)
  useEffect(() => {
    if (!showDeleteConfirm) return;

    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        deleteResolverRef.current?.(false);
        setShowDeleteConfirm(false);
      }
    }

    document.addEventListener("keydown", handleKey, true);
    return () => document.removeEventListener("keydown", handleKey, true);
  }, [showDeleteConfirm]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  if (!loaded || !editor) {
    return (
      <div className="animate-pulse h-[300px] rounded-lg bg-zinc-800/50" />
    );
  }

  return (
    <div className="relative rounded-xl border border-zinc-800 bg-zinc-900/50 overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-zinc-800 bg-zinc-900">
        <ToolBtn
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="Bold"
        >
          <Bold className="w-4 h-4" />
        </ToolBtn>
        <ToolBtn
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="Italic"
        >
          <Italic className="w-4 h-4" />
        </ToolBtn>
        <ToolBtn
          active={editor.isActive("underline")}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          title="Underline"
        >
          <UnderlineIcon className="w-4 h-4" />
        </ToolBtn>

        <div className="w-px h-5 mx-1 bg-zinc-800" />

        <ToolBtn
          active={editor.isActive("heading", { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          title="Heading 2"
        >
          <Heading2 className="w-4 h-4" />
        </ToolBtn>
        <ToolBtn
          active={editor.isActive("heading", { level: 3 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          title="Heading 3"
        >
          <Heading3 className="w-4 h-4" />
        </ToolBtn>

        <div className="w-px h-5 mx-1 bg-zinc-800" />

        <ToolBtn
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          title="Bullet list"
        >
          <List className="w-4 h-4" />
        </ToolBtn>
        <ToolBtn
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          title="Numbered list"
        >
          <ListOrdered className="w-4 h-4" />
        </ToolBtn>

        <div className="flex-1" />

        <SaveIndicator state={saveState} lastSaved={lastSaved} />

        <ToolBtn
          active={false}
          onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}
          title="Clear formatting"
        >
          <RemoveFormatting className="w-4 h-4" />
        </ToolBtn>
      </div>

      {/* Delete confirmation dialog */}
      {showDeleteConfirm && (
        <div
          className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 backdrop-blur-sm rounded-xl"
          onClick={() => {
            deleteResolverRef.current?.(false);
            setShowDeleteConfirm(false);
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm mx-4 rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl"
          >
            <div className="p-5">
              <div className="flex gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-500/15">
                  <svg className="h-5 w-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0 3h.008M10.29 3.86 1.82 18a2 2 0 001.73 3h16.9a2 2 0 001.73-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-base font-semibold text-white">Delete Note?</h3>
                  <p className="mt-1 text-sm text-zinc-400">
                    This note is now empty. Do you want to delete it?
                  </p>
                </div>
              </div>
              <div className="mt-5 flex justify-end gap-2.5">
                <button
                  onClick={() => {
                    deleteResolverRef.current?.(false);
                    setShowDeleteConfirm(false);
                  }}
                  className="h-9 rounded-lg border border-zinc-700 px-4 text-xs font-medium text-zinc-300 transition hover:bg-zinc-800"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    deleteResolverRef.current?.(true);
                    // Don't setShowDeleteConfirm(false) here — flushAndSave handles it
                  }}
                  className="h-9 rounded-lg bg-red-600 px-4 text-xs font-semibold text-white transition hover:bg-red-700 active:scale-[0.98]"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast notification */}
      {toast && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10">
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-700/95 text-zinc-200 text-xs font-medium shadow-lg backdrop-blur-sm animate-in fade-in slide-in-from-bottom-1">
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m15 9-6 6m0-6 6 6m7-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
            {toast.text}
          </div>
        </div>
      )}

      {/* Editor content */}
      <EditorContent editor={editor} />
    </div>
  );
});

export default NoteEditor;

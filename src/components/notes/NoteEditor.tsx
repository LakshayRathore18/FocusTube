"use client";

import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from "react";
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
    idle: lastSaved ? `Saved ${formatTimeAgo(lastSaved)}` : "",
    saving: "Saving...",
    saved: lastSaved ? `Saved ${formatTimeAgo(lastSaved)}` : "Saved",
    error: "Failed to save",
  };

  return (
    <span className={`text-xs transition-colors duration-300 ${styles[state]}`}>
      {labels[state]}
    </span>
  );
}

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ago`;
}

// ─── NoteEditor component ────────────────────────────────────────────────────

export type NoteEditorHandle = {
  /** Force-save any pending changes immediately. Returns a promise that
   *  resolves when the save request completes (success or failure). */
  flushAndSave: () => Promise<void>;
};

interface NoteEditorProps {
  videoId: string;
  onHasContentChange?: (videoId: string, hasContent: boolean) => void;
}

const NoteEditor = forwardRef<NoteEditorHandle, NoteEditorProps>(
  ({ videoId, onHasContentChange }, ref) => {
  const [loaded, setLoaded] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialContentSet = useRef(false);
  const lastHtmlRef = useRef<string>("<p></p>");
  // Track the latest in-flight fetch so flushAndSave can await it
  const savePromiseRef = useRef<Promise<void> | null>(null);

  function saveContent(html: string): Promise<void> {
    const promise = fetch(`/api/videos/${videoId}/notes`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: html }),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Save failed");
        setSaveState("saved");
        setLastSaved(new Date());
        // Immediately update the parent — notes button turns blue right away
        onHasContentChange?.(videoId, true);
      })
      .catch(() => {
        setSaveState("error");
      });

    savePromiseRef.current = promise;
    return promise;
  }

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
      flushAndSave: async () => {
        if (debounceRef.current) {
          clearTimeout(debounceRef.current);
          debounceRef.current = null;
        }
        if (!editor) return;
        const html = editor.getHTML();
        if (html === lastHtmlRef.current && savePromiseRef.current) {
          // Content unchanged & a save is already in flight — wait for it
          await savePromiseRef.current;
          return;
        }
        setSaveState("saving");
        await saveContent(html);
      },
    }),
    [editor],
  );

  // Fetch existing note on mount and set it once
  useEffect(() => {
    fetch(`/api/videos/${videoId}/notes`)
      .then((res) => res.json())
      .then((data) => {
        if (data && data.content && editor && !initialContentSet.current) {
          initialContentSet.current = true;
          lastHtmlRef.current = data.content;
          editor.commands.setContent(data.content);
          onHasContentChange?.(videoId, true);
        } else {
          onHasContentChange?.(videoId, false);
        }
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [videoId, editor]);

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
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 overflow-hidden">
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

      {/* Editor content */}
      <EditorContent editor={editor} />
    </div>
  );
});

export default NoteEditor;

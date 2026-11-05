"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, BookOpen, Search, X } from "lucide-react";
import styles from "../layout/LayoutChrome.module.css";

interface SearchOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SearchOverlay({ isOpen, onClose }: SearchOverlayProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [courses, setCourses] = useState<{ id: string; title: string }[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const controller = new AbortController();
    fetch("/api/courses", { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("Search unavailable");
        return response.json();
      })
      .then((data) => {
        if (Array.isArray(data)) setCourses(data.map((course: { id: string; title: string }) => ({ id: course.id, title: course.title })));
      })
      .catch(() => {});
    return () => controller.abort();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement as HTMLElement | null;
    dialog?.showModal();
    inputRef.current?.focus();
    return () => {
      dialog?.close();
      previousFocus?.focus();
    };
  }, [isOpen]);

  const filtered = courses.filter((course) => course.title.toLowerCase().includes(query.toLowerCase()));
  const navigateTo = useCallback((courseId: string) => {
    onClose();
    router.push(`/courses/${courseId}`);
  }, [onClose, router]);

  function handleKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setSelectedIndex((index) => Math.max(0, Math.min(index + 1, filtered.length - 1)));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setSelectedIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter" && filtered[selectedIndex]) {
      navigateTo(filtered[selectedIndex].id);
    }
  }
  if (!isOpen) return null;

  return (
    <dialog ref={dialogRef} className={styles.searchDialog} aria-label="Search courses" onCancel={(event) => { event.preventDefault(); onClose(); }} onClick={(event) => {
      const bounds = event.currentTarget.getBoundingClientRect();
      if (event.target === event.currentTarget && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) onClose();
    }}>
      <div className={styles.searchInputRow}>
        <Search size={19} aria-hidden="true" />
        <input ref={inputRef} aria-label="Search your courses" value={query} onChange={(event) => { setQuery(event.target.value); setSelectedIndex(0); }} onKeyDown={handleKeyDown} placeholder="What would you like to learn?" autoComplete="off" />
        <button onClick={onClose} className={styles.searchClose} aria-label="Close search"><X size={17} aria-hidden="true" /></button>
      </div>
      <div className={styles.searchResults}>
        <p className={styles.searchCaption}>{query ? "SEARCH RESULTS" : "YOUR COURSE LIBRARY"}</p>
        {filtered.length === 0 ? <p className={styles.searchEmpty}>{query ? <>No courses match &ldquo;{query}&rdquo;.</> : "Your imported courses will appear here."}</p> : filtered.map((course, index) => (
          <button key={course.id} onClick={() => navigateTo(course.id)} onMouseEnter={() => setSelectedIndex(index)} className={styles.searchResult} data-selected={index === selectedIndex}>
            <span className={styles.resultIcon}><BookOpen size={18} aria-hidden="true" /></span><span>{course.title}</span><ArrowUpRight size={15} aria-hidden="true" />
          </button>
        ))}
      </div>
      <div className={styles.searchFooter}><span><kbd>↑</kbd><kbd>↓</kbd> to browse <kbd>↵</kbd> to open</span><span><kbd>esc</kbd> to close</span></div>
    </dialog>
  );
}

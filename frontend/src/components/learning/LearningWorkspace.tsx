"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Brain, FileText, MessageCircle, Sparkles, X } from "lucide-react";
import NoteEditor, { type NoteEditorHandle } from "@/components/notes/NoteEditor";
import QuizPlayer from "@/components/shared/QuizPlayer";
import type { StudySummary, QuizPayload, LearningResourceType } from "@/components/course/types";
import { useVideoChat } from "@/lib/use-video-chat";
import { aiErrorMessage } from "@/lib/ai-errors";
import AiGenerationProgress from "../course/AiGenerationProgress";
import VideoChat from "./VideoChat";
import styles from "./LearningWorkspace.module.css";

const tabs = [
  { id: "notes", label: "Personal notes", icon: FileText },
  { id: "summary", label: "AI summary", icon: Sparkles },
  { id: "quiz", label: "Quiz", icon: Brain },
  { id: "chat", label: "Ask AI", icon: MessageCircle },
] as const;
type AiContent = { summary: StudySummary | null; quiz: QuizPayload | null };

interface LearningWorkspaceProps {
  videoId: string;
  youtubeVideoId: string;
  videoTitle: string;
  courseId: string;
  initialTab?: LearningResourceType;
  savedOnly?: boolean;
  onClose: () => void;
}

export default function LearningWorkspace({ videoId, youtubeVideoId, videoTitle, courseId, initialTab = "notes", savedOnly = false, onClose }: LearningWorkspaceProps) {
  const chatEnabled = useVideoChat();
  const [activeTab, setActiveTab] = useState(initialTab);
  const [notesOpened, setNotesOpened] = useState(initialTab === "notes");
  const [chatOpened, setChatOpened] = useState(initialTab === "chat");
  const [aiContent, setAiContent] = useState<AiContent | null>(null);
  const [aiLoading, setAiLoading] = useState(initialTab === "summary" || initialTab === "quiz");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiError, setAiError] = useState("");
  const [reload, setReload] = useState(0);
  const [transitioning, setTransitioning] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const noteEditor = useRef<NoteEditorHandle>(null);
  const lifetime = useRef<AbortController | null>(null);
  const changing = useRef(false);
  const generationInFlight = useRef(false);

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    const element = dialog.current;
    const controller = new AbortController();
    lifetime.current = controller;
    element?.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      controller.abort();
      element?.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    if (activeTab !== "summary" && activeTab !== "quiz") return;
    const controller = new AbortController();
    fetch(`/api/videos/${encodeURIComponent(videoId)}/ai-content`, {
      cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]),
    }).then(async (response) => {
      if (!response.ok) throw new Error("Could not load saved study material. Please retry.");
      return response.json();
    }).then((data) => {
      if (controller.signal.aborted) return;
      setAiContent(data.summary || data.quiz ? { summary: data.summary, quiz: data.quiz } : null);
      setAiLoading(false);
    }).catch((error) => {
      if (!controller.signal.aborted) {
        setAiLoading(false);
        setAiError(error.name === "TimeoutError" ? "Loading took too long. Please retry." : error.message);
      }
    });
    return () => controller.abort();
  }, [activeTab, videoId, reload]);

  async function transition(next?: LearningResourceType) {
    if (changing.current || next === activeTab) return;
    changing.current = true;
    setTransitioning(true);
    try {
      if (activeTab === "notes" && noteEditor.current) {
        if (!await noteEditor.current.flushAndSave({ allowEmpty: true })) return;
      }
      if (!next) { onClose(); return; }
      if (next === "notes") setNotesOpened(true);
      if (next === "chat") setChatOpened(true);
      if ((next === "summary" || next === "quiz") && !aiContent) {
        setAiLoading(true); setAiError("");
      }
      setActiveTab(next);
    } finally {
      changing.current = false;
      setTransitioning(false);
    }
  }

  async function generate() {
    if (savedOnly || generationInFlight.current || !youtubeVideoId) return;
    generationInFlight.current = true;
    setAiGenerating(true); setAiError("");
    const signal = lifetime.current!.signal;
    try {
      for (let attempt = 0; attempt <= 30; attempt++) {
        if (signal.aborted) return;
        const response = await fetch("/api/ai/content", {
          method: "POST", signal: AbortSignal.any([signal, AbortSignal.timeout(100000)]),
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ youtubeVideoId, courseId }),
        });
        const data = await response.json();
        if (signal.aborted) return;
        if (!response.ok) throw new Error("Could not prepare study material. Please try again.");
        if (data.status === "ready" && data.summary && data.quiz) {
          setAiContent({ summary: data.summary, quiz: data.quiz }); return;
        }
        if (data.status !== "pending") throw new Error(aiErrorMessage(data.reason));
        if (attempt === 30) throw new Error("Still processing. Please try again in a moment.");
        await new Promise<void>((resolve) => {
          const finish = () => { clearTimeout(timer); signal.removeEventListener("abort", finish); resolve(); };
          const timer = setTimeout(finish, 3000);
          signal.addEventListener("abort", finish, { once: true });
        });
      }
    } catch (error) {
      if (!signal.aborted) setAiError(error instanceof Error && error.name !== "TimeoutError" ? error.message : "The request took too long. Please retry.");
    } finally {
      generationInFlight.current = false;
      if (!signal.aborted) { setAiGenerating(false); setAiLoading(false); }
    }
  }

  const aiTab = activeTab === "summary" || activeTab === "quiz";
  const hasResource = activeTab === "summary" ? Boolean(aiContent?.summary) : Boolean(aiContent?.quiz);

  return <dialog ref={dialog} className={styles.dialog} aria-labelledby="study-workspace-title"
    onKeyDown={(event) => {
      if (event.key !== "Tab" || event.defaultPrevented) return;
      const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [contenteditable="true"], [tabindex]:not([tabindex="-1"])')].filter((control) => control.getClientRects().length && !control.closest("[inert]"));
      const first = controls[0], last = controls[controls.length - 1];
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }}
    onCancel={(event) => { event.preventDefault(); void transition(); }} onClick={(event) => { if (event.target === event.currentTarget) { const rect = event.currentTarget.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) void transition(); } }}>
    <div className={styles.frame}>
      <header className={styles.header}><div><span>{activeTab === "chat" ? "ASK THIS VIDEO" : "STUDY WORKSPACE"}</span><h2 id="study-workspace-title">{videoTitle}</h2></div><button aria-label="Close study workspace" disabled={transitioning} onClick={() => void transition()}><X size={19} /></button></header>
      <div className={styles.tabs} role="group" aria-label="Study tools">{tabs.filter((tab) => tab.id !== "chat" || chatEnabled).map(({ id, label, icon: Icon }) => <button key={id} aria-pressed={activeTab === id} disabled={transitioning} onClick={() => void transition(id)}><Icon size={15} aria-hidden="true" />{label}</button>)}</div>
      <div className={`${styles.body} ${activeTab === "chat" ? styles.chatBody : ""}`}>
        {notesOpened && <div className={styles.note} hidden={activeTab !== "notes"}><NoteEditor ref={noteEditor} videoId={videoId} /></div>}
        {chatEnabled && chatOpened && <div className={styles.chat} hidden={activeTab !== "chat"}><VideoChat key={videoId} videoId={videoId} /></div>}
        {aiTab && (aiLoading && !aiContent ? <div className={styles.loading} role="status">Loading your saved material…</div>
          : hasResource ? activeTab === "summary" && aiContent?.summary ? <div className={styles.summary}><p className={styles.hook}>{aiContent.summary.hook}</p><h3>KEY TAKEAWAYS</h3><ol>{aiContent.summary.keyPoints.map((point, index) => <li key={index}><span>{index + 1}</span><p>{point}</p></li>)}</ol></div> : <div className={styles.quiz}><QuizPlayer questions={aiContent!.quiz!.questions} resetLabel="Reset" /></div>
          : <div className={styles.empty}><Sparkles size={27} aria-hidden="true" /><h3>{aiGenerating ? "Preparing your study material" : "No saved material available"}</h3><p role={aiError ? "alert" : undefined}>{aiError || "This resource may have been removed or needs to be generated from its course."}</p>{aiGenerating ? <AiGenerationProgress videoId={videoId} /> : <><button onClick={() => { setAiError(""); setAiLoading(true); setReload((value) => value + 1); }}>Retry loading</button>{savedOnly ? <Link href={`/courses/${encodeURIComponent(courseId)}`}>Open course</Link> : <button disabled={!youtubeVideoId} onClick={() => void generate()}>Generate AI content</button>}</>}</div>)}
      </div>
      <footer className={styles.footer}><span>{transitioning ? "Saving your changes…" : activeTab === "notes" ? "Your notes save as you write." : "A little review goes a long way."}</span><button disabled={transitioning} onClick={() => void transition()}>{transitioning ? "Saving…" : "Done"}</button></footer>
    </div>
  </dialog>;
}

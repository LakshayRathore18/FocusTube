"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import Image from "next/image";
import { ArrowLeft, ArrowRight, Archive, BookOpen, Check, CircleCheck, Clock3, FileText, MessageCircle, Play, Search, Sparkles, Trash2, X } from "lucide-react";
import { formatDuration } from "@/lib/utils";
import styles from "./Courses.module.css";
import { useRouter } from "next/navigation";
import type { Video, Course, StudySummary, QuizPayload, AiGenerationState } from "./types";
import NotesModal from "./NotesModal";
import VideoPlayerModal from "./VideoPlayerModal";
import AIContentModal from "./AIContentModal";
import AiGenerationProgress from "./AiGenerationProgress";
import SyncButton from "./SyncButton";
import { aiErrorMessage } from "@/lib/ai-errors";
import { useVideoChat } from "@/lib/use-video-chat";

const LearningWorkspace = dynamic(() => import("../learning/LearningWorkspace"));

// ─── Main component ─────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 2000;
const MAX_POLL_ATTEMPTS = 45;

export default function CourseContent({ course, playVideoId }: { course: Course; playVideoId?: string }) {
  const router = useRouter();
  const [lessonQuery, setLessonQuery] = useState("");
  const [lessonFilter, setLessonFilter] = useState("all");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const deleteDialogRef = useRef<HTMLDialogElement>(null);
  const chatEnabled = useVideoChat();
  const [chatVideo, setChatVideo] = useState<Video | null>(null);
  const [playingVideo, setPlayingVideo] = useState<Video | null>(null);
  const [noteModalVideoId, setNoteModalVideoId] = useState<string | null>(null);
  const [aiModalVideo, setAiModalVideo] = useState<Video | null>(null);
  const [aiContentData, setAiContentData] = useState<{ summary: StudySummary; quiz: QuizPayload } | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [videosWithNotes, setVideosWithNotes] = useState<Record<string, boolean>>({});
  const [aiGenStates, setAiGenStates] = useState<Record<string, AiGenerationState>>({});
  const pollTimersRef = useRef<Record<string, ReturnType<typeof setInterval>>>({});
  const pollAttemptsRef = useRef<Record<string, number>>({});

  const [localStatuses, setLocalStatuses] = useState<
    Record<string, { status: string; lastWatchedSeconds?: number | null }>
  >({});

  // On mount: fetch existing notes and AI content status for all videos
  useEffect(() => {
    let active = true;
    fetch(`/api/courses/${course.id}/content-status`)
      .then((res) => {
        if (!res.ok) throw new Error("Could not load content status");
        return res.json();
      })
      .then(
        (
          data: Record<
            string,
            { hasNotes: boolean; aiStatus: string }
          >
        ) => {
          if (!active) return;
          const notesMap: Record<string, boolean> = {};
          const aiMap: Record<string, AiGenerationState> = {};

          for (const [videoId, status] of Object.entries(data)) {
            if (status.hasNotes) notesMap[videoId] = true;
            if (status.aiStatus === "ready") {
              aiMap[videoId] = { status: "ready" };
            } else if (status.aiStatus === "pending") {
              aiMap[videoId] = { status: "pending" };
              const video = course.videos.find((item) => item.id === videoId);
              if (video) startPolling(video);
            } else if (status.aiStatus === "failed") {
              aiMap[videoId] = { status: "failed" };
            }
          }

          setVideosWithNotes(notesMap);
          setAiGenStates(aiMap);
        }
      )
      .catch(() => {});
    return () => { active = false; };
    // Polling uses the current course and owns its own bounded timer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [course.id]);

  // Cleanup all poll timers on unmount
  useEffect(() => {
    const timers = pollTimersRef.current;
    return () => {
      Object.values(timers).forEach(clearInterval);
    };
  }, []);

  function updateVideoStatus(videoId: string, status: string, lastWatchedSeconds?: number | null) {
    setLocalStatuses((prev) => ({
      ...prev,
      [videoId]: { status, lastWatchedSeconds },
    }));

    fetch(`/api/videos/${videoId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, lastWatchedSeconds }),
    })
      .then(() => window.dispatchEvent(new CustomEvent("refresh-stats")))
      .catch(() => {});
  }

  function handlePlayVideo(video: Video) {
    setPlayingVideo(video);
    if (video.status !== "in_progress" && video.status !== "completed") {
      updateVideoStatus(video.id, "in_progress");
    }
  }

  function handleMarkCompleted(videoId: string) {
    updateVideoStatus(videoId, "completed", null);
    setPlayingVideo(null);
  }

  function resolveVideo(v: Video): Video {
    const local = localStatuses[v.id];
    if (!local) return v;
    return {
      ...v,
      status: local.status,
      lastWatchedSeconds: local.lastWatchedSeconds !== undefined ? local.lastWatchedSeconds : v.lastWatchedSeconds,
    };
  }

  function handleOpenNotes(video: Video) {
    setNoteModalVideoId(video.id);
  }

  function handleCloseNotes() {
    setNoteModalVideoId(null);
  }

  function handleHasContentChange(videoId: string, hasContent: boolean) {
    setVideosWithNotes((prev) => {
      if (hasContent) {
        return { ...prev, [videoId]: true };
      }
      // Note was deleted — remove from map so button styling updates immediately
      const next = { ...prev };
      delete next[videoId];
      return next;
    });
  }

  // ─── AI Content Generation ───────────────────────────────────

  async function triggerGeneration(video: Video) {
    const current = aiGenStates[video.id];
    if (current?.status === "generating" || current?.status === "pending") return;

    setAiGenStates((prev) => ({ ...prev, [video.id]: { status: "generating" } }));

    try {
      const res = await fetch("/api/ai/content", {
        method: "POST",
        signal: AbortSignal.timeout(100_000),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ youtubeVideoId: video.youtubeVideoId, courseId: course.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not generate AI content");
      handleGenerationResponse(video, data);
    } catch (err) {
      setAiGenStates((prev) => ({
        ...prev,
        [video.id]: { status: "failed", reason: err instanceof Error ? err.message : "Network error" },
      }));
    }
  }

  function handleGenerationResponse(video: Video, data: { status: string; summary?: StudySummary; quiz?: QuizPayload; reason?: string }) {
    if (data.status === "ready") {
      stopPolling(video.id);
      setAiGenStates((prev) => ({
        ...prev,
        [video.id]: { status: "ready", summary: data.summary, quiz: data.quiz },
      }));
      setAiModalVideo(video);
      setAiContentData(data.summary && data.quiz ? { summary: data.summary, quiz: data.quiz } : null);
    } else if (data.status === "pending") {
      setAiGenStates((prev) => ({ ...prev, [video.id]: { status: "pending" } }));
      startPolling(video);
    } else {
      stopPolling(video.id);
      setAiGenStates((prev) => ({
        ...prev,
        [video.id]: { status: "failed", reason: data.reason ?? "unknown" },
      }));
    }
  }

  function startPolling(video: Video) {
    if (pollTimersRef.current[video.id]) return;
    pollAttemptsRef.current[video.id] = 0;
    let inFlight = false;

    const timer = setInterval(async () => {
      if (inFlight) return;
      const attempts = (pollAttemptsRef.current[video.id] ?? 0) + 1;
      pollAttemptsRef.current[video.id] = attempts;

      if (attempts > MAX_POLL_ATTEMPTS) {
        clearInterval(timer);
        delete pollTimersRef.current[video.id];
        setAiGenStates((prev) => ({
          ...prev,
          [video.id]: { status: "failed", reason: "Still processing, try again in a moment" },
        }));
        return;
      }

      try {
        inFlight = true;
        const res = await fetch("/api/ai/content", {
          method: "POST",
          signal: AbortSignal.timeout(100_000),
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ youtubeVideoId: video.youtubeVideoId, courseId: course.id }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Could not check AI generation");
        handleGenerationResponse(video, data);
      } catch (err) {
        stopPolling(video.id);
        setAiGenStates((prev) => ({
          ...prev,
          [video.id]: { status: "failed", reason: err instanceof Error ? err.message : "Network error" },
        }));
      } finally {
        inFlight = false;
      }
    }, POLL_INTERVAL_MS);

    pollTimersRef.current[video.id] = timer;
  }

  function stopPolling(videoId: string) {
    if (pollTimersRef.current[videoId]) {
      clearInterval(pollTimersRef.current[videoId]);
      delete pollTimersRef.current[videoId];
    }
  }

  const [aiContentLoading, setAiContentLoading] = useState(false);

  async function handleOpenAiContent(video: Video) {
    const state = aiGenStates[video.id];
    if (state?.status !== "ready") return;

    if (state.summary && state.quiz) {
      setAiContentData({ summary: state.summary, quiz: state.quiz });
      setAiModalVideo(video);
      return;
    }

    setAiContentLoading(true);
    try {
      const res = await fetch(`/api/videos/${video.id}/ai-content`);
      if (!res.ok) throw new Error("Failed to load AI content");
      const data = await res.json();
      if (data.needsRegeneration) {
        // AIContent row is missing or stale — reset to idle so the user
        // sees the Generate button and can trigger a fresh Gemini call.
        setAiGenStates((prev) => {
          const next = { ...prev };
          delete next[video.id];
          return next;
        });
      } else if (data.summary && data.quiz) {
        setAiContentData({ summary: data.summary, quiz: data.quiz });
        setAiModalVideo(video);
      }
    } catch {
      // Fall back to showing nothing — user can retry by clicking again
    } finally {
      setAiContentLoading(false);
    }
  }

  function handleCloseAiContent() {
    setAiModalVideo(null);
    setAiContentData(null);
  }

  // ─── Delete Course ────────────────────────────────────────

  async function handleDeleteCourse() {
    setDeleting(true);
    setDeleteError(null);
    try {
      const response = await fetch(`/api/courses/${course.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Could not delete course");
      setShowDeleteConfirm(false);
      router.push("/courses");
    } catch {
      setDeleteError("The course could not be deleted. Please try again.");
    } finally {
      setDeleting(false);
    }
  }

  // ─── Sync Complete ───────────────────────────────────────

  /**
   * Called by SyncButton after a successful sync.
   * router.refresh() (inside SyncButton) reloads server data;
   * here we just clear any locally-cached AI / notes state so
   * the re-fetched server data is the single source of truth.
   */
  const handleSyncComplete = useCallback(() => {
    // Reset local UI caches — they'll be rebuilt from fresh server data
    setAiGenStates({});
    setVideosWithNotes({});
    setLocalStatuses({});
    setPlayingVideo(null);
  }, []);

  const resolvedVideos = course.videos.map(resolveVideo);
  const completedCount = resolvedVideos.filter((v) => v.status === "completed").length;
  const activeVideo = playingVideo ? resolveVideo(playingVideo) : null;
  const noteModalVideo = resolvedVideos.find((v) => v.id === noteModalVideoId) ?? null;

  // On mount: if ?play=VIDEO_ID is provided, auto-play that specific video
  useEffect(() => {
    if (!playVideoId) return;
    const target = course.videos.find((v) => v.id === playVideoId && v.isAvailable);
    if (target) {
      handlePlayVideo(target);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!showDeleteConfirm) return;
    const dialog = deleteDialogRef.current;
    const previousFocus = document.activeElement as HTMLElement | null;
    dialog?.showModal();
    return () => { dialog?.close(); previousFocus?.focus(); };
  }, [showDeleteConfirm]);

  const totalCount = resolvedVideos.length;
  const pct = totalCount ? Math.round(completedCount / totalCount * 100) : 0;
  const nextVideo = resolvedVideos.find((video) => video.isAvailable && video.status === "in_progress")
    ?? resolvedVideos.find((video) => video.isAvailable && video.status !== "completed")
    ?? resolvedVideos.find((video) => video.isAvailable);
  const hasStarted = resolvedVideos.some((video) => video.status !== "not_started");
  const totalMinutes = Math.round(resolvedVideos.reduce((sum, video) => sum + (video.durationSeconds ?? 0), 0) / 60);
  const visibleVideos = resolvedVideos.filter((video) => video.title.toLowerCase().includes(lessonQuery.trim().toLowerCase()) && (lessonFilter === "all" || video.status === lessonFilter));

  return (
    <div className={styles.page}><div className={styles.inner}>
      <div className={styles.detailTopbar}>
        <Link href="/courses" className={styles.backLink}><ArrowLeft size={15} aria-hidden="true" /> Back to courses</Link>
        <div className={styles.detailActions}><SyncButton courseId={course.id} onSyncComplete={handleSyncComplete} /><button className={styles.deleteTrigger} onClick={() => { setDeleteError(null); setShowDeleteConfirm(true); }}><Trash2 size={14} aria-hidden="true" /> Delete course</button></div>
      </div>
      <header className={styles.courseHero}>
        <div className={styles.detailImage}>{course.thumbnailUrl ? <Image src={course.thumbnailUrl} alt="" fill sizes="(max-width: 700px) 100vw, 380px" className={styles.coverImage} /> : <BookOpen size={54} strokeWidth={1.2} aria-hidden="true" />}<span className={styles.detailImageLabel}><BookOpen size={12} aria-hidden="true" /> YOUR PERSONAL CLASSROOM</span></div>
        <div className={styles.courseHeroBody}>
          <p className={styles.kicker}><span /> {pct === 100 && totalCount > 0 ? "COURSE COMPLETED" : "ONE LESSON AT A TIME"}</p>
          <h1>{course.title}</h1>
          <div className={styles.courseMeta}><span><Play size={14} aria-hidden="true" />{totalCount} lessons</span>{totalMinutes > 0 && <span><Clock3 size={14} aria-hidden="true" />{totalMinutes >= 60 ? `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m` : `${totalMinutes} min`}</span>}<span><CircleCheck size={14} aria-hidden="true" />{completedCount} completed</span></div>
          <div className={styles.heroProgress}><div><span>Your course progress</span><strong>{pct}%</strong></div><progress max={100} value={pct} aria-label="Course completion" /></div>
          {nextVideo && <button onClick={() => handlePlayVideo(nextVideo)} className={styles.primaryButton}><Play size={14} fill="currentColor" aria-hidden="true" />{pct === 100 ? "Revisit course" : hasStarted ? "Continue learning" : "Start learning"}<ArrowRight size={15} aria-hidden="true" /></button>}
        </div>
      </header>
      <div className={styles.curriculumHeading}><div><h2>Your learning path</h2><p>Watch, take notes, and make each lesson stick.</p></div><span className={styles.curriculumCount}>{completedCount} / {totalCount} completed</span></div>
      <div className={styles.lessonToolbar}>
        <div className={styles.filters} aria-label="Filter lessons">{[{key:"all",label:"All lessons"},{key:"in_progress",label:"In progress"},{key:"completed",label:"Completed"}].map(({key,label}) => <button key={key} className={styles.filterButton} aria-pressed={lessonFilter === key} onClick={() => setLessonFilter(key)}>{label}<span>{key === "all" ? totalCount : resolvedVideos.filter((video) => video.status === key).length}</span></button>)}</div>
        <div className={styles.searchField}><Search size={16} aria-hidden="true" /><input aria-label="Search lessons" value={lessonQuery} onChange={(event) => setLessonQuery(event.target.value)} placeholder="Find a lesson…" />{lessonQuery && <button onClick={() => setLessonQuery("")} aria-label="Clear lesson search"><X size={14} aria-hidden="true" /></button>}</div>
      </div>
      <div className={styles.lessonList}>
        {visibleVideos.map((video) => {
          const complete = video.status === "completed";
          const hasNotes = !!videosWithNotes[video.id];
          const aiState = aiGenStates[video.id];
          const generating = aiState?.status === "generating" || aiState?.status === "pending";
          const ready = aiState?.status === "ready";
          const failed = aiState?.status === "failed";
          return (
            <article key={video.id} className={styles.lessonRow} data-completed={complete} data-active={activeVideo?.id === video.id} data-archived={!video.isAvailable}>
              <button className={styles.completionToggle} disabled={!video.isAvailable} aria-pressed={complete} aria-label={`${complete ? "Mark as not started" : "Mark as completed"}: ${video.title}`} title={complete ? "Mark as not started" : "Mark as completed"} onClick={() => { const status = complete ? "not_started" : "completed"; updateVideoStatus(video.id, status, status === "completed" ? null : undefined); }}>{complete ? <Check size={17} aria-hidden="true" /> : String(course.videos.findIndex((item) => item.id === video.id) + 1).padStart(2,"0")}</button>
              <button className={styles.lessonImage} onClick={() => handlePlayVideo(video)} disabled={!video.isAvailable} aria-label={`Play ${video.title}`}>{video.thumbnailUrl ? <Image src={video.thumbnailUrl} alt="" fill sizes="110px" className={styles.coverImage} /> : <Play size={22} aria-hidden="true" />}<span className={styles.lessonPlay}><Play size={13} fill="currentColor" aria-hidden="true" /></span></button>
              <div className={styles.lessonInfo}><button className={styles.lessonTitle} disabled={!video.isAvailable} onClick={() => handlePlayVideo(video)}>{video.title}</button><div className={styles.lessonMeta}><span className={styles.lessonStatus} data-state={video.status}>{!video.isAvailable ? <><Archive size={11} aria-hidden="true" /> Archived</> : complete ? <><CircleCheck size={11} aria-hidden="true" /> Completed</> : video.status === "in_progress" ? "In progress" : "Not started"}</span>{video.durationSeconds ? <span><Clock3 size={11} aria-hidden="true" />{formatDuration(video.durationSeconds)}</span> : null}{hasNotes && <span className={styles.savedNote}><FileText size={11} aria-hidden="true" /> Notes saved</span>}</div></div>
              <div className={styles.lessonActions}>
                {video.isAvailable && (generating ? <div className={styles.generationIndicator}><AiGenerationProgress key={video.id} videoId={video.id} /></div> : <button className={styles.lessonAction} data-ready={ready} data-failed={failed} disabled={aiContentLoading} onClick={() => ready ? handleOpenAiContent(video) : triggerGeneration(video)} aria-label={`${ready ? "View study notes" : failed ? "Retry study notes" : "Generate study notes"}: ${video.title}`} title={failed ? `${aiErrorMessage(aiState.reason)} Click to retry.` : ready ? "Open summary and quiz" : "Generate a summary and quiz"}><Sparkles size={14} aria-hidden="true" />{ready ? "Study notes" : failed ? "Retry notes" : "Generate notes"}</button>)}
                {chatEnabled && video.isAvailable && <button className={styles.lessonAction} data-chat="true" onClick={() => setChatVideo(video)} aria-label={`Ask AI about ${video.title}`}><MessageCircle size={14} aria-hidden="true" /> Ask AI</button>}
                <button className={styles.lessonAction} data-ready={hasNotes} onClick={() => handleOpenNotes(video)} aria-label={`Open notes: ${video.title}`}><FileText size={14} aria-hidden="true" /> Notes</button>
              </div>
            </article>
          );
        })}
        {visibleVideos.length === 0 && <div className={styles.emptyState}><span className={styles.emptyIcon}><BookOpen size={25} aria-hidden="true" /></span><h3>{totalCount === 0 ? "No lessons in this course yet." : "No lessons match."}</h3><p>{totalCount === 0 ? "Sync the playlist to check for available videos." : "Try a different title or filter."}</p>{totalCount > 0 && <button className={styles.secondaryButton} onClick={() => {setLessonQuery("");setLessonFilter("all");}}>Show all lessons</button>}</div>}
      </div>
      <p className={styles.detailFootnote}><Check size={13} aria-hidden="true" /> Your progress and notes stay with your course.</p>

      {activeVideo && activeVideo.isAvailable && <VideoPlayerModal video={activeVideo} onClose={() => setPlayingVideo(null)} onMarkCompleted={handleMarkCompleted} onOpenNotes={handleOpenNotes} />}
      {chatEnabled && chatVideo && <LearningWorkspace key={chatVideo.id} videoId={chatVideo.id} youtubeVideoId={chatVideo.youtubeVideoId} videoTitle={chatVideo.title} courseId={course.id} initialTab="chat" onClose={() => setChatVideo(null)} />}
      {noteModalVideo && <NotesModal video={noteModalVideo} onClose={handleCloseNotes} onHasContentChange={handleHasContentChange} />}
      {aiModalVideo && aiContentData && <AIContentModal video={aiModalVideo} content={aiContentData} onClose={handleCloseAiContent} />}
      {showDeleteConfirm && <dialog ref={deleteDialogRef} className={styles.deleteDialog} aria-labelledby="delete-course-heading" onCancel={(event) => { event.preventDefault(); if (!deleting) setShowDeleteConfirm(false); }}>
        <div className={styles.dialogHeading}><span className={styles.dangerIcon}><Trash2 size={23} aria-hidden="true" /></span><button onClick={() => setShowDeleteConfirm(false)} disabled={deleting} className={styles.dialogClose} aria-label="Close delete confirmation"><X size={19} aria-hidden="true" /></button></div>
        <h2 id="delete-course-heading">Delete this course?</h2><p>This will permanently remove <strong>{course.title}</strong>, all {totalCount} lessons, their notes, and your progress.</p><p className={styles.dangerText}>This action cannot be undone.</p>
        {deleteError && <p className={styles.dangerText} role="alert">{deleteError}</p>}
        <div className={styles.dialogActions}><button className={styles.secondaryButton} onClick={() => setShowDeleteConfirm(false)} disabled={deleting}>Keep course</button><button className={styles.dangerButton} onClick={handleDeleteCourse} disabled={deleting}>{deleting ? "Deleting…" : "Delete course"}</button></div>
      </dialog>}
    </div></div>
  );
}

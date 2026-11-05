"use client";

import { useState, useEffect } from "react";
import { useSession } from "@/components/auth/AuthProvider";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, ArrowUpRight, BookOpen, Check, CircleCheck, Clock3, FileText, Link2, LoaderCircle, Play, Plus, Sparkles, SquarePlay } from "lucide-react";
import { formatDuration, formatTimeAgo } from "@/lib/utils";
import styles from "./DashboardPage.module.css";

type ContinueVideo = {
  id: string;
  youtubeVideoId: string;
  title: string;
  thumbnailUrl: string | null;
  durationSeconds: number | null;
  lastWatchedSeconds: number | null;
  isAvailable: boolean;
  updatedAt: string;
  course: { id: string; title: string };
};
type LearningStats = {
  totalPlaylists: number;
  totalVideos: number;
  completedVideos: number;
  personalNotes: number;
  aiSummaries: number;
};

function ContinueLearning({ video, loading }: { video: ContinueVideo | null; loading: boolean }) {
  const progress = video?.durationSeconds
    ? Math.min(100, Math.max(0, Math.round(((video.lastWatchedSeconds ?? 0) / video.durationSeconds) * 100))) : 0;
  return (
    <section aria-labelledby="continue-heading">
      <div className={styles.sectionHeading}><h2 id="continue-heading">Pick up where you left off</h2><span className={styles.eyebrow}>CONTINUE LEARNING</span></div>
      {loading ? <div className={`${styles.skeleton} ${styles.heroSkeleton}`} role="status" aria-label="Loading your next lesson" /> : video ? (
        <article className={styles.continueCard}>
          <Link href={`/courses/${video.course.id}`} className={styles.heroImage} aria-label={`Continue ${video.title}`}>
            {video.thumbnailUrl ? <Image src={video.thumbnailUrl} alt="" fill sizes="(max-width: 600px) 100vw, 680px" className={styles.thumbnail} /> : <BookOpen size={56} aria-hidden="true" />}
            <span className={styles.imageShade} />
            <span className={styles.resumePill}><span /> IN PROGRESS</span>
            <span className={styles.playCircle}><Play size={25} fill="currentColor" aria-hidden="true" /></span>
            {video.durationSeconds ? <span className={styles.duration}>{formatDuration(video.durationSeconds)}</span> : null}
          </Link>
          <div className={styles.heroBody}>
            <p className={styles.courseLabel}>{video.course.title}</p><h3>{video.title}</h3>
            <div className={styles.lessonProgress}><div><span>Your progress</span><strong>{progress}%</strong></div><progress value={progress} max={100} aria-label="Current video progress" /></div>
            <div className={styles.heroFooter}>
              <Link href={`/courses/${video.course.id}`} className={styles.primaryButton}><Play size={15} fill="currentColor" aria-hidden="true" /> Continue learning <ArrowRight size={16} aria-hidden="true" /></Link>
              <span className={styles.savedPosition}><Check size={14} aria-hidden="true" /> Progress saved</span>
            </div>
          </div>
        </article>
      ) : (
        <div className={styles.emptyCard}>
          <span className={styles.emptyIcon}><Play size={24} aria-hidden="true" /></span><h3>Your next lesson is waiting.</h3>
          <p>Open a course and start a video. You can pick it up here next time.</p>
          <Link href="/courses" className={styles.primaryButton}>Explore your courses <ArrowRight size={16} aria-hidden="true" /></Link>
        </div>
      )}
    </section>
  );
}

function QuickStats({ stats, loading }: { stats: LearningStats | null; loading: boolean }) {
  const items = [
    { icon: BookOpen, label: "Your courses", value: stats?.totalPlaylists, detail: "Playlists in your library", color: "violet" },
    { icon: CircleCheck, label: "Lessons completed", value: stats?.completedVideos, detail: stats ? `of ${stats.totalVideos} total lessons` : "Across your courses", color: "green" },
    { icon: FileText, label: "Personal notes", value: stats?.personalNotes, detail: "Ideas worth keeping", color: "blue" },
    { icon: Sparkles, label: "AI summaries", value: stats?.aiSummaries, detail: "Ready for a quick recap", color: "amber" },
  ];
  return (
    <section className={styles.statsGrid} aria-label="Your learning at a glance" aria-busy={loading}>
      {items.map(({ icon: Icon, label, value, detail, color }) => (
        <div className={styles.statCard} key={label}>
          <div className={styles.statTop}><span className={styles.statLabel}>{label}</span><span className={styles.statIcon} data-color={color}><Icon size={17} aria-hidden="true" /></span></div>
          <p className={styles.statValue}>{loading ? <span className={styles.numberSkeleton} /> : value?.toLocaleString() ?? "—"}</p><p className={styles.statDetail}>{detail}</p>
        </div>
      ))}
    </section>
  );
}

function RecentlyWatched({ videos, loading }: { videos: ContinueVideo[]; loading: boolean }) {
  return (
    <section aria-labelledby="recent-heading" className={styles.recentSection}>
      <div className={styles.sectionHeading}><h2 id="recent-heading">Recently watched</h2><Link href="/courses" className={styles.textLink}>All courses <ArrowUpRight size={14} aria-hidden="true" /></Link></div>
      {loading ? <div className={`${styles.skeleton} ${styles.recentSkeleton}`} role="status" aria-label="Loading recent lessons" /> : videos.length ? (
        <div className={styles.recentList}>{videos.slice(0, 4).map((video) => (
          <Link key={video.id} href={`/courses/${video.course.id}`} className={styles.recentItem}>
            <div className={styles.recentImage}>{video.thumbnailUrl ? <Image src={video.thumbnailUrl} alt="" fill sizes="96px" className={styles.thumbnail} /> : <Play size={22} aria-hidden="true" />}</div>
            <div className={styles.recentInfo}><p>{video.course.title}</p><h3>{video.title}</h3><span><Clock3 size={12} aria-hidden="true" /> {formatTimeAgo(video.updatedAt)}</span></div>
            <ArrowUpRight size={17} className={styles.recentArrow} aria-hidden="true" />
          </Link>
        ))}</div>
      ) : <div className={styles.recentEmpty}><Clock3 size={20} aria-hidden="true" /><p>Your recently watched lessons will appear here.</p></div>}
    </section>
  );
}

function ImportPlaylist() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function handleImport(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim() || importing) return;
    setError(null);
    setImporting(true);
    try {
      const res = await fetch("/api/courses", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: url.trim() }) });
      const data = await res.json().catch(() => null);
      if ((res.ok || res.status === 409) && typeof data?.courseId === "string") {
        router.push(`/courses/${data.courseId}`);
        return;
      }
      setError(typeof data?.error === "string" ? data.error : "Could not import this playlist. Please try again.");
    } catch {
      setError("Could not connect. Check your connection and try again.");
    } finally {
      setImporting(false);
    }
  }
  return (
    <section className={styles.importCard} id="dashboard-import" aria-labelledby="import-heading">
      <div className={styles.importTop}><span className={styles.youtubeIcon}><SquarePlay size={25} aria-hidden="true" /></span><span className={styles.eyebrow}>A NEW CHAPTER</span></div>
      <h2 id="import-heading">Curiosity looks<br />good on you.</h2><p>Turn a YouTube playlist into your next course. One link is all it takes.</p>
      <form onSubmit={handleImport}>
        <label htmlFor="playlist-url">YouTube playlist URL or ID</label>
        <div className={styles.inputWrap}><Link2 size={16} aria-hidden="true" /><input id="playlist-url" type="text" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Paste your playlist link…" disabled={importing} aria-describedby={error ? "import-error" : undefined} aria-invalid={!!error} autoComplete="off" /></div>
        <button type="submit" className={styles.primaryButton} disabled={importing || !url.trim()}>{importing ? <LoaderCircle size={16} className={styles.spinner} aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />}{importing ? "Importing playlist…" : "Import playlist"}</button>
        {error && <p id="import-error" className={styles.importError} role="alert">{error}</p>}
        <p className={styles.importHint} role="status">{importing ? "Fetching the lessons in your playlist. Hang tight." : "Your videos, notes, and progress. In one place."}</p>
      </form>
    </section>
  );
}

function LearningProgress({ stats }: { stats: LearningStats | null }) {
  if (!stats) return null;
  const pct = stats.totalVideos ? Math.min(100, Math.round(stats.completedVideos / stats.totalVideos * 100)) : 0;
  return (
    <section className={styles.progressCard} aria-labelledby="progress-heading">
      <div className={styles.sectionHeading}><h2 id="progress-heading">Small steps add up.</h2><CircleCheck size={18} aria-hidden="true" /></div>
      <div className={styles.progressContent}>
        <div className={styles.progressRing}><svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="42" /><circle cx="50" cy="50" r="42" pathLength="100" strokeDasharray={`${pct} 100`} /></svg><strong>{pct}<span>%</span></strong></div>
        <div><strong>{stats.completedVideos} lessons down</strong><p>Every lesson brings you<br />a little further.</p></div>
      </div>
      <Link href="/study-library" className={styles.progressLink}>Revisit your notes & summaries <ArrowRight size={15} aria-hidden="true" /></Link>
    </section>
  );
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const [continueVideo, setContinueVideo] = useState<ContinueVideo | null>(null);
  const [recentVideos, setRecentVideos] = useState<ContinueVideo[]>([]);
  const [stats, setStats] = useState<LearningStats | null>(null);
  const [fetchError, setFetchError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setFetchError(false);
      async function read(path: string) {
        const res = await fetch(path, { signal: controller.signal });
        if (!res.ok) throw new Error("Dashboard request failed");
        return res.json();
      }
      const results = await Promise.allSettled([read("/api/videos/continue-watching"), read("/api/videos/recently-watched"), read("/api/stats/learning")]);
      if (controller.signal.aborted) return;
      const [continued, recent, overview] = results;
      if (continued.status === "fulfilled" && Array.isArray(continued.value)) setContinueVideo(continued.value.find((video: ContinueVideo) => video.isAvailable) ?? null);
      if (recent.status === "fulfilled" && Array.isArray(recent.value)) setRecentVideos(recent.value);
      if (overview.status === "fulfilled" && typeof overview.value?.totalPlaylists === "number") setStats(overview.value);
      setFetchError(results.some((result) => result.status === "rejected"));
      setLoading(false);
    }
    void load();
    return () => controller.abort();
  }, [attempt]);
  const firstName = session?.user?.name?.trim().split(/\s+/)[0] || "Learner";
  return (
    <div className={styles.dashboard}><div className={styles.pageInner}>
      <header className={styles.welcome}>
        <div><p className={styles.kicker}><span /> YOUR LEARNING SPACE</p><h1>Welcome back, {firstName}<span className={styles.headingDot}>.</span></h1><p>A little focus today. A little further tomorrow.</p></div>
        <Link href="/courses" className={styles.browseButton}>Your course library <ArrowUpRight size={16} aria-hidden="true" /></Link>
      </header>
      {fetchError && <div className={styles.errorBanner} role="alert"><p>Some of your learning data could not be loaded.</p><button onClick={() => setAttempt((value) => value + 1)} disabled={loading}>{loading ? "Loading…" : "Try again"}</button></div>}
      <QuickStats stats={stats} loading={loading} />
      <div className={styles.contentGrid}>
        <div className={styles.mainColumn}><ContinueLearning video={continueVideo} loading={loading} /><RecentlyWatched videos={recentVideos} loading={loading} /></div>
        <aside className={styles.sideColumn} aria-label="Grow your learning"><ImportPlaylist /><LearningProgress stats={stats} /><p className={styles.footerNote}><Sparkles size={14} aria-hidden="true" /> Make time for what interests you.</p></aside>
      </div>
    </div></div>
  );
}

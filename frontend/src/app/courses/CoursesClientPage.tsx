"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, ArrowUpDown, BookOpen, Check, CircleCheck, Clock3, Play, Plus, RefreshCw, Search, X } from "lucide-react";
import styles from "@/components/course/Courses.module.css";

type Course = {
  id: string;
  title: string;
  thumbnailUrl: string | null;
  _count: { videos: number; completedVideos: number; inProgressVideos: number };
  remainingDurationSeconds: number;
};
type CourseFilter = "all" | "in_progress" | "completed" | "not_started";
type SortKey = "recent" | "title" | "progress";
const FILTERS: { key: CourseFilter; label: string }[] = [
  { key: "all", label: "All courses" },
  { key: "in_progress", label: "In progress" },
  { key: "not_started", label: "Not started" },
  { key: "completed", label: "Completed" },
];
const percent = (course: Course) => course._count.videos > 0 ? Math.min(100, Math.round(course._count.completedVideos / course._count.videos * 100)) : 0;
function courseState(course: Course): Exclude<CourseFilter, "all"> {
  if (course._count.videos > 0 && course._count.completedVideos >= course._count.videos) return "completed";
  return course._count.inProgressVideos > 0 || course._count.completedVideos > 0 ? "in_progress" : "not_started";
}
function timeLeft(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor(seconds % 3600 / 60);
  return hours > 0 ? `${hours}h ${minutes}m left` : seconds > 0 && seconds < 60 ? "Less than a minute left" : `${minutes}m left`;
}

function CourseCard({ course }: { course: Course }) {
  const state = courseState(course);
  const pct = percent(course);
  const completed = state === "completed";
  return (
    <article className={styles.courseCard}>
      <Link href={`/courses/${course.id}`} className={styles.cardImage} aria-label={`Open ${course.title}`}>
        {course.thumbnailUrl ? <Image src={course.thumbnailUrl} alt="" fill sizes="(max-width: 600px) 100vw, (max-width: 1200px) 50vw, 400px" className={styles.coverImage} /> : <BookOpen size={42} strokeWidth={1.2} aria-hidden="true" />}
        <span className={styles.imageOverlay} />
        <span className={styles.stateBadge} data-state={state}>{completed ? <Check size={11} aria-hidden="true" /> : <span />}{completed ? "Completed" : state === "in_progress" ? "In progress" : "Ready to start"}</span>
        <span className={styles.lessonCount}><Play size={10} fill="currentColor" aria-hidden="true" />{course._count.videos} lessons</span>
        <span className={styles.cardPlay}><Play size={19} fill="currentColor" aria-hidden="true" /></span>
      </Link>
      <div className={styles.cardBody}>
        <p className={styles.overline}>YOUTUBE PLAYLIST</p>
        <Link href={`/courses/${course.id}`} className={styles.cardTitle}><h2>{course.title}</h2></Link>
        <p className={styles.timeLeft}>{completed ? <><CircleCheck size={13} aria-hidden="true" /> All lessons completed</> : course.remainingDurationSeconds > 0 ? <><Clock3 size={13} aria-hidden="true" />{timeLeft(course.remainingDurationSeconds)}</> : <><BookOpen size={13} aria-hidden="true" /> Learn at your own pace</>}</p>
        <div className={styles.cardProgress}><div><span>{course._count.completedVideos} of {course._count.videos} completed</span><strong>{pct}%</strong></div><progress value={pct} max={100} aria-label={`Completion for ${course.title}`} /></div>
        <Link href={`/courses/${course.id}`} className={styles.cardAction} data-completed={completed}>{completed ? <CircleCheck size={15} aria-hidden="true" /> : <Play size={14} fill="currentColor" aria-hidden="true" />}{completed ? "Revisit course" : state === "in_progress" ? "Continue learning" : "Start learning"}<ArrowRight size={15} aria-hidden="true" /></Link>
      </div>
    </article>
  );
}

export default function CoursesClientPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<CourseFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("recent");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    async function loadCourses() {
      setLoading(true);
      setError(false);
      try {
        const response = await fetch("/api/courses", { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) });
        if (!response.ok) throw new Error("Could not load courses");
        const data = await response.json();
        if (!Array.isArray(data)) throw new Error("Invalid course response");
        if (!controller.signal.aborted) setCourses(data);
      } catch {
        if (!controller.signal.aborted) setError(true);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void loadCourses();
    return () => controller.abort();
  }, [attempt]);

  const counts = useMemo(() => ({
    all: courses.length,
    in_progress: courses.filter((course) => courseState(course) === "in_progress").length,
    completed: courses.filter((course) => courseState(course) === "completed").length,
    not_started: courses.filter((course) => courseState(course) === "not_started").length,
  }), [courses]);
  const processedCourses = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const result = courses.filter((course) => (!query || course.title.toLowerCase().includes(query)) && (activeFilter === "all" || courseState(course) === activeFilter));
    if (sortKey === "title") result.sort((a, b) => a.title.localeCompare(b.title));
    if (sortKey === "progress") result.sort((a, b) => percent(b) - percent(a));
    return result;
  }, [courses, searchQuery, activeFilter, sortKey]);

  return (
    <div className={styles.page}><div className={styles.inner}>
      <header className={styles.pageHeader}>
        <div><p className={styles.kicker}><span /> A LITTLE MORE CURIOUS, EVERY DAY</p><h1>Your course library<span>.</span></h1><p>Your interests, organized. Pick a course and make it yours.</p></div>
        <Link href="/dashboard#dashboard-import" className={styles.primaryButton}><Plus size={16} aria-hidden="true" /> Import playlist</Link>
      </header>
      {!loading && !error && courses.length > 0 && <div className={styles.libraryOverview}><span><BookOpen size={15} aria-hidden="true" /><strong>{courses.length}</strong> courses</span><span><Play size={14} aria-hidden="true" /><strong>{counts.in_progress}</strong> in progress</span><span><CircleCheck size={15} aria-hidden="true" /><strong>{courses.reduce((sum, course) => sum + course._count.completedVideos, 0)}</strong> lessons completed</span></div>}
      {loading ? <div className={styles.courseGrid} role="status" aria-label="Loading courses">{[0,1,2].map((key) => <div className={styles.skeletonCard} key={key}><div /><span /><span /><span /></div>)}</div> : error ? (
        <div className={styles.emptyState} role="alert"><span className={styles.emptyIcon}><RefreshCw size={25} aria-hidden="true" /></span><h2>Let’s try that again.</h2><p>We couldn’t load your courses. Check your connection and give it another try.</p><button onClick={() => setAttempt((value) => value + 1)} className={styles.primaryButton}><RefreshCw size={15} aria-hidden="true" /> Try again</button></div>
      ) : courses.length === 0 ? (
        <div className={styles.emptyState}><span className={styles.emptyIcon}><BookOpen size={28} aria-hidden="true" /></span><h2>A whole world to learn.</h2><p>Bring your first YouTube playlist here and turn your curiosity into a course.</p><Link href="/dashboard#dashboard-import" className={styles.primaryButton}><Plus size={15} aria-hidden="true" /> Import your first playlist</Link></div>
      ) : (
        <>
          <div className={styles.toolbar}>
            <div className={styles.filters} aria-label="Filter courses">{FILTERS.map(({key,label}) => <button key={key} onClick={() => setActiveFilter(key)} aria-pressed={activeFilter === key} className={styles.filterButton}>{label}<span>{counts[key]}</span></button>)}</div>
            <div className={styles.libraryTools}>
              <div className={styles.searchField}><Search size={16} aria-hidden="true" /><input aria-label="Search course library" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Find a course…" />{searchQuery && <button onClick={() => setSearchQuery("")} aria-label="Clear course search"><X size={14} aria-hidden="true" /></button>}</div>
              <div className={styles.sortField}><ArrowUpDown size={14} aria-hidden="true" /><select aria-label="Sort courses" value={sortKey} onChange={(event) => setSortKey(event.target.value as SortKey)}><option value="recent">Recently updated</option><option value="title">Title A–Z</option><option value="progress">Most progress</option></select></div>
            </div>
          </div>
          <p className={styles.resultCount} aria-live="polite">{processedCourses.length} {processedCourses.length === 1 ? "course" : "courses"}{activeFilter !== "all" || searchQuery.trim() ? " found" : " in your library"}</p>
          {processedCourses.length === 0 ? <div className={styles.emptyState}><span className={styles.emptyIcon}><Search size={25} aria-hidden="true" /></span><h2>No courses found.</h2><p>Try another title or clear your filters to see your full library.</p><button className={styles.secondaryButton} onClick={() => {setSearchQuery("");setActiveFilter("all");}}>Clear filters</button></div> : <div className={styles.courseGrid}>{processedCourses.map((course) => <CourseCard key={course.id} course={course} />)}</div>}
        </>
      )}
    </div></div>
  );
}

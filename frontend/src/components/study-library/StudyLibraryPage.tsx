"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, BookOpen, Brain, ChevronLeft, ChevronRight, FileText, Library, Search, Sparkles, X } from "lucide-react";
import type { LibraryResource, ResourceType, StudyLibraryData } from "./types";
import styles from "./StudyLibrary.module.css";

const LearningWorkspace = dynamic(() => import("../learning/LearningWorkspace"));
const resources = [
  { id: "notes", label: "Personal notes", singular: "Personal note", icon: FileText, description: "Your ideas, in your own words." },
  { id: "summary", label: "AI summaries", singular: "AI summary", icon: Sparkles, description: "The key points, ready to revisit." },
  { id: "quiz", label: "Quizzes", singular: "Quiz", icon: Brain, description: "A little practice goes a long way." },
] as const;

export default function StudyLibraryPage({ initialCourseId = "" }: { initialCourseId?: string }) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState<ResourceType | "all">("all");
  const [courseId, setCourseId] = useState(initialCourseId);
  const [sort, setSort] = useState("recent");
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<{ key: string; data?: StudyLibraryData; error?: string }>({ key: "" });
  const [workspace, setWorkspace] = useState<LibraryResource | null>(null);
  const requestKey = JSON.stringify([query.trim(), type, courseId, sort, page]);
  const loading = result.key !== requestKey;
  const data = result.data;

  useEffect(() => {
    const controller = new AbortController();
    const [q, kind, course, order, currentPage] = JSON.parse(requestKey);
    const params = new URLSearchParams({ q, type: kind, sort: order, page: String(currentPage), pageSize: "24" });
    if (course) params.set("courseId", course);
    // Debounce searches; abort old requests so late results cannot overwrite newer filters.
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/study-library?${params}`, {
          cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]),
        });
        if (!response.ok) throw new Error(response.status === 404 || response.status === 403
          ? "This course is no longer available. Clear the filters to browse your library."
          : response.status === 401 ? "Your session has expired. Please sign in again."
          : "We couldn't load your study library. Please try again.");
        const next: StudyLibraryData = await response.json();
        if (!controller.signal.aborted) setResult({ key: requestKey, data: next });
      } catch (error) {
        if (!controller.signal.aborted) setResult((previous) => ({
          key: requestKey, data: previous.data,
          error: error instanceof Error && error.name !== "TimeoutError" ? error.message : "The request took too long. Please try again.",
        }));
      }
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [requestKey, revision]);

  function clearFilters() { setQuery(""); setType("all"); setCourseId(""); setSort("recent"); setPage(1); }
  const hasFilters = Boolean(query || type !== "all" || courseId);
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <header className={styles.header}>
          <div><div className={styles.kicker}><span /> KEEP WHAT YOU LEARN</div>
            <h1>Study Library<span>.</span></h1>
            <p>Your notes, key ideas, and practice. All within reach.</p>
          </div>
          <Link href="/courses" className={styles.courseLink}><BookOpen size={15} aria-hidden="true" /> Your courses <ArrowUpRight size={15} aria-hidden="true" /></Link>
        </header>

        <div className={styles.stats} aria-label="Matching resources">
          {resources.map(({ id, label, icon: Icon, description }) => (
            <button key={id} className={styles.stat} aria-pressed={type === id} onClick={() => { setType(id); setPage(1); }}>
              <span className={styles.statIcon}><Icon size={19} aria-hidden="true" /></span>
              <span className={styles.statBody}><span>{label}</span><strong>{loading || result.error ? "—" : data?.counts[id] ?? 0}</strong><small>{description}</small></span>
              <ArrowUpRight size={16} className={styles.statArrow} aria-hidden="true" />
            </button>
          ))}
        </div>

        <section className={styles.collection} aria-label="Saved resources">
          <div className={styles.collectionHeading}><h2>Made for your next revision</h2><span>ONE LIBRARY. EVERY COURSE.</span></div>
          <div className={styles.toolbar}>
            <label className={styles.search}><Search size={17} aria-hidden="true" /><input aria-label="Search study library" placeholder="Search titles, notes, or key ideas…" maxLength={200} value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} />{query && <button onClick={() => { setQuery(""); setPage(1); }} aria-label="Clear search"><X size={15} /></button>}</label>
            <select aria-label="Filter by course" value={courseId} onChange={(event) => { setCourseId(event.target.value); setPage(1); }}>
              <option value="">All courses</option>
              {courseId && !data?.courses.some((course) => course.id === courseId) && <option value={courseId}>Selected course</option>}
              {data?.courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}
            </select>
            <select aria-label="Sort resources" value={sort} onChange={(event) => { setSort(event.target.value); setPage(1); }}><option value="recent">Recently updated</option><option value="oldest">Oldest first</option><option value="title">Lesson title A–Z</option></select>
          </div>
          <div className={styles.filterRow}>
            <div className={styles.filters} role="group" aria-label="Resource type">
              {[{ id: "all" as const, label: "All resources" }, ...resources].map(({ id, label }) => <button key={id} aria-pressed={type === id} onClick={() => { setType(id); setPage(1); }}>{label}<span>{loading || result.error ? "—" : data?.counts[id] ?? 0}</span></button>)}
            </div>
            {hasFilters && <button className={styles.clear} onClick={clearFilters}>Clear filters <X size={12} aria-hidden="true" /></button>}
          </div>

          <div aria-busy={loading}>
            {loading ? <div className={styles.grid} aria-label="Loading resources">{[0, 1, 2, 3, 4, 5].map((id) => <div key={id} className={styles.skeleton} />)}</div>
              : result.error ? <div className={styles.empty} role="alert"><Library size={30} aria-hidden="true" /><h3>Your library is taking a moment</h3><p>{result.error}</p><button className={styles.primary} onClick={() => setRevision((value) => value + 1)}>Try again</button>{hasFilters && <button className={styles.clear} onClick={clearFilters}>Clear filters</button>}</div>
              : !data?.items.length ? <div className={styles.empty}><Library size={32} aria-hidden="true" /><h3>{data?.resourceTotal ? "No resources match just yet" : "Your next good idea belongs here"}</h3><p>{data?.resourceTotal ? "Try another search or clear your filters." : "Save a note or generate study material from a lesson. You'll find it here, ready when you are."}</p>{hasFilters ? <button className={styles.primary} onClick={clearFilters}>Clear filters</button> : <Link href="/courses" className={styles.primary}>Explore your courses <ArrowRight size={15} aria-hidden="true" /></Link>}</div>
              : <><p className={styles.resultCount} role="status">{data.total} resource{data.total === 1 ? "" : "s"}{courseId ? " in this course" : " across your courses"}</p><div className={styles.grid}>
                {data.items.map((item) => { const config = resources.find((resource) => resource.id === item.type)!; const Icon = config.icon;
                  return <button key={item.id} className={styles.card} onClick={() => setWorkspace(item)} aria-label={`Open ${config.singular.toLowerCase()}: ${item.videoTitle}`}>
                    <div className={styles.cardTop}><span className={styles.badge}><Icon size={13} aria-hidden="true" />{config.singular}</span><ArrowUpRight size={16} aria-hidden="true" /></div>
                    <p className={styles.courseName}>{item.courseTitle}</p><h3>{item.videoTitle}</h3><p className={styles.preview}>{item.preview}</p>
                    <div className={styles.cardFooter}><time dateTime={item.updatedAt}>{new Date(item.updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</time><span>{item.isAvailable ? "Open resource" : "Saved · video unavailable"}<ArrowRight size={12} aria-hidden="true" /></span></div>
                  </button>;
                })}
              </div><nav className={styles.pagination} aria-label="Resource pages"><span>Page {data.page} of {totalPages}</span><div><button aria-label="Previous page" disabled={data.page <= 1} onClick={() => setPage(data.page - 1)}><ChevronLeft size={16} /></button><button aria-label="Next page" disabled={data.page >= totalPages} onClick={() => setPage(data.page + 1)}><ChevronRight size={16} /></button></div></nav></>}
          </div>
        </section>
        <p className={styles.footer}><Library size={13} aria-hidden="true" /> A little review. A lot more remembered.</p>
      </div>
      {workspace && <LearningWorkspace key={workspace.id} videoId={workspace.videoId} youtubeVideoId={workspace.youtubeVideoId} videoTitle={workspace.videoTitle} courseId={workspace.courseId} initialTab={workspace.type} savedOnly onClose={() => { setWorkspace(null); setRevision((value) => value + 1); }} />}
    </div>
  );
}

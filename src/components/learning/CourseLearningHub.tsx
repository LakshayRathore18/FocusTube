"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, FileText, Sparkles, Brain, Book, Clock } from "lucide-react";
import LearningWorkspace from "./LearningWorkspace";
import { formatTimeAgo, stripHtml } from "@/lib/utils";
import type { LearningResourceType } from "@/components/course/types";

// ─── Types ───────────────────────────────────────────────────────────────────

type ResourceType = LearningResourceType;

interface ResourceConfig {
  id: ResourceType;
  label: string;
  description: string;
  icon: React.ReactNode;
  emptyMessage: string;
  color: string;
}

const RESOURCES: ResourceConfig[] = [
  {
    id: "notes",
    label: "Personal Notes",
    description: "Your own notes for each video.",
    icon: <FileText className="w-5 h-5" />,
    emptyMessage:
      "No personal notes yet — add notes while watching videos in this course.",
    color: "blue",
  },
  {
    id: "summary",
    label: "AI Summaries",
    description: "AI-generated summaries and key takeaways.",
    icon: <Sparkles className="w-5 h-5" />,
    emptyMessage:
      "No AI summaries yet — generate summaries from the course page.",
    color: "emerald",
  },
  {
    id: "quiz",
    label: "AI Quizzes",
    description: "Practice what you've learned with generated quizzes.",
    icon: <Brain className="w-5 h-5" />,
    emptyMessage:
      "No quizzes yet — generate AI content from the course page first.",
    color: "purple",
  },
];

type PersonalNoteVideo = {
  videoId: string;
  videoTitle: string;
  youtubeVideoId: string;
  thumbnailUrl: string | null;
  noteId: string;
  contentPreview: string;
  updatedAt: string;
};

type AiSummaryVideo = {
  videoId: string;
  videoTitle: string;
  youtubeVideoId: string;
  thumbnailUrl: string | null;
  status: string;
  generatedAt: string;
};

// ─── Color helpers ──────────────────────────────────────────────────────────

function resourceColorClasses(color: string) {
  switch (color) {
    case "blue":
      return {
        bg: "bg-blue-500/10",
        border: "border-blue-500/20",
        icon: "text-blue-400",
        badgeBg: "bg-blue-900/30",
        badgeText: "text-blue-300",
        hover: "hover:border-blue-500/40 hover:bg-blue-500/15",
      };
    case "emerald":
      return {
        bg: "bg-emerald-500/10",
        border: "border-emerald-500/20",
        icon: "text-emerald-400",
        badgeBg: "bg-emerald-900/30",
        badgeText: "text-emerald-300",
        hover: "hover:border-emerald-500/40 hover:bg-emerald-500/15",
      };
    case "purple":
      return {
        bg: "bg-purple-500/10",
        border: "border-purple-500/20",
        icon: "text-purple-400",
        badgeBg: "bg-purple-900/30",
        badgeText: "text-purple-300",
        hover: "hover:border-purple-500/40 hover:bg-purple-500/15",
      };
    default:
      return {
        bg: "bg-zinc-500/10",
        border: "border-zinc-500/20",
        icon: "text-zinc-400",
        badgeBg: "bg-zinc-700",
        badgeText: "text-zinc-300",
        hover: "hover:border-zinc-500/40 hover:bg-zinc-500/15",
      };
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ─── Resource Selector Card ──────────────────────────────────────────────────

function ResourceCard({
  resource,
  count,
  selected,
  onSelect,
}: {
  resource: ResourceConfig;
  count: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const cc = resourceColorClasses(resource.color);

  return (
    <button
      onClick={onSelect}
      className={`relative flex items-start gap-4 rounded-xl border p-5 text-left transition-all ${
        selected
          ? `${cc.border} ${cc.bg} ring-2 ring-${resource.color}-500/30`
          : `border-zinc-800 hover:${cc.border} hover:${cc.bg} bg-zinc-900`
      }`}
    >
      <div
        className={`flex items-center justify-center w-10 h-10 rounded-xl ${cc.bg} shrink-0`}
      >
        <span className={cc.icon}>{resource.icon}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-zinc-100">{resource.label}</p>
          {count > 0 && (
            <span
              className={`text-[11px] px-1.5 py-0.5 rounded-full font-medium ${cc.badgeBg} ${cc.badgeText}`}
            >
              {count}
            </span>
          )}
        </div>
        <p className="text-xs text-zinc-500 mt-1">{resource.description}</p>
      </div>
      <svg
        className={`w-4 h-4 shrink-0 self-center transition-colors ${
          selected ? "text-zinc-300" : "text-zinc-600"
        }`}
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="m8.25 4.5 7.5 7.5-7.5 7.5"
        />
      </svg>
    </button>
  );
}

// ─── Video Card (Personal Note) ──────────────────────────────────────────────

function PersonalNoteVideoCard({
  video,
  onOpen,
}: {
  video: PersonalNoteVideo;
  onOpen: (videoId: string, videoTitle: string, youtubeVideoId?: string) => void;
}) {
  const preview = stripHtml(video.contentPreview);

  return (
    <button
      onClick={() => onOpen(video.videoId, video.videoTitle, video.youtubeVideoId)}
      className="group w-full text-left rounded-xl border border-zinc-800 bg-zinc-900 p-4 hover:border-blue-500/40 hover:bg-zinc-800/80 transition-all"
    >
      <div className="flex items-start gap-3">
        <div className="relative w-24 shrink-0 aspect-video rounded-lg overflow-hidden bg-zinc-800">
          {video.thumbnailUrl && (
            <img
              src={video.thumbnailUrl}
              alt={video.videoTitle}
              className="w-full h-full object-cover"
            />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-900/30 text-[11px] font-semibold text-blue-300 mb-1.5">
            <FileText className="w-3 h-3" />
            Personal Note
          </span>
          <h3 className="text-sm font-medium text-zinc-100 line-clamp-2 leading-snug group-hover:text-blue-400 transition-colors">
            {video.videoTitle}
          </h3>
          {preview && (
            <p className="text-xs text-zinc-500 mt-1 line-clamp-1">
              {preview.slice(0, 80)}
            </p>
          )}
          <div className="flex items-center gap-1 mt-1.5">
            <Clock className="w-3 h-3 text-zinc-500" />
            <span className="text-[11px] text-zinc-500">
              {formatTimeAgo(video.updatedAt)}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}

// ─── Video Card (AI Summary / Quiz) ──────────────────────────────────────────

function AiVideoCard({
  video,
  label,
  icon,
  color,
  onOpen,
}: {
  video: AiSummaryVideo;
  label: string;
  icon: React.ReactNode;
  color: string;
  onOpen: (videoId: string, videoTitle: string, youtubeVideoId?: string) => void;
}) {
  const cc = resourceColorClasses(color);

  return (
    <button
      onClick={() => onOpen(video.videoId, video.videoTitle, video.youtubeVideoId)}
      className={`group w-full text-left rounded-xl border border-zinc-800 bg-zinc-900 p-4 transition-all ${cc.hover}`}
    >
      <div className="flex items-start gap-3">
        <div className="relative w-24 shrink-0 aspect-video rounded-lg overflow-hidden bg-zinc-800">
          {video.thumbnailUrl && (
            <img
              src={video.thumbnailUrl}
              alt={video.videoTitle}
              className="w-full h-full object-cover"
            />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold mb-1.5 ${cc.badgeBg} ${cc.badgeText}`}
          >
            {icon}
            {label}
          </span>
          <h3 className="text-sm font-medium text-zinc-100 line-clamp-2 leading-snug group-hover:text-emerald-400 transition-colors">
            {video.videoTitle}
          </h3>
          <div className="flex items-center gap-3 mt-1.5">
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Generated
            </span>
            {video.generatedAt && (
              <span className="text-[11px] text-zinc-500">
                {formatDate(video.generatedAt)}
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

// ─── Loading Skeleton ────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="rounded-xl border border-zinc-800 bg-zinc-900 p-4"
        >
          <div className="flex gap-3">
            <div className="w-24 aspect-video rounded-lg bg-zinc-800" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-zinc-800 rounded w-1/4" />
              <div className="h-4 bg-zinc-800 rounded w-3/4" />
              <div className="h-3 bg-zinc-800 rounded w-1/2" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

interface CourseLearningHubProps {
  courseId: string;
}

export default function CourseLearningHub({
  courseId,
}: CourseLearningHubProps) {
  const router = useRouter();
  const [view, setView] = useState<"selector" | "videos">("selector");
  const [selectedResource, setSelectedResource] =
    useState<ResourceType | null>(null);
  const [personalVideos, setPersonalVideos] = useState<PersonalNoteVideo[]>([]);
  const [aiVideos, setAiVideos] = useState<AiSummaryVideo[]>([]);
  const [courseTitle, setCourseTitle] = useState("");
  const [courseThumbnail, setCourseThumbnail] = useState<string | null>(null);
  const [videosCount, setVideosCount] = useState(0);
  const [loadingPersonal, setLoadingPersonal] = useState(true);
  const [loadingAi, setLoadingAi] = useState(false);
  const [personalError, setPersonalError] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [courseError, setCourseError] = useState<string | null>(null);
  // LearningWorkspace state
  const [workspaceVideo, setWorkspaceVideo] = useState<{
    videoId: string;
    youtubeVideoId: string;
    videoTitle: string;
    tab: ResourceType;
  } | null>(null);

  // Fetch personal notes data
  const loadPersonalNotes = useCallback(() => {
    setPersonalError(null);
    setLoadingPersonal(true);
    fetch(`/api/notes/${courseId}?tab=personal`)
      .then((res) => res.json())
      .then((data) => {
        if (data && Array.isArray(data.videos)) {
          setPersonalVideos(data.videos);
          setCourseTitle(data.courseTitle ?? "");
          setCourseThumbnail(data.thumbnailUrl ?? null);
        }
      })
      .catch((err) => {
        console.error("Failed to load personal notes:", err);
        setPersonalError("Could not load personal notes.");
      })
      .finally(() => setLoadingPersonal(false));
  }, [courseId]);

  // Fetch AI summaries data
  const loadAiData = useCallback(() => {
    setAiError(null);
    setLoadingAi(true);
    fetch(`/api/notes/${courseId}?tab=ai`)
      .then((res) => res.json())
      .then((data) => {
        if (data && Array.isArray(data.videos)) {
          setAiVideos(data.videos);
          if (!courseTitle) setCourseTitle(data.courseTitle ?? "");
          if (!courseThumbnail)
            setCourseThumbnail(data.thumbnailUrl ?? null);
        }
      })
      .catch((err) => {
        console.error("Failed to load AI data:", err);
        setAiError("Could not load AI summaries.");
      })
      .finally(() => setLoadingAi(false));
  }, [courseId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch course video count
  const loadCourseInfo = useCallback(() => {
    setCourseError(null);
    fetch(`/api/courses/${courseId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data && data._count) {
          setVideosCount(data._count.videos);
          if (!courseTitle) setCourseTitle(data.title ?? "");
          if (!courseThumbnail)
            setCourseThumbnail(data.thumbnailUrl ?? null);
        }
      })
      .catch((err) => {
        console.error("Failed to load course info:", err);
        setCourseError("Could not load course information.");
      });
  }, [courseId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadPersonalNotes(); }, [loadPersonalNotes]);
  useEffect(() => { loadAiData(); }, [loadAiData]);
  useEffect(() => { loadCourseInfo(); }, [loadCourseInfo]);

  const handleSelectResource = useCallback((resource: ResourceType) => {
    setSelectedResource(resource);
    setView("videos");
  }, []);

  const handleOpenLearningWorkspace = useCallback(
    (videoId: string, videoTitle: string, youtubeVideoId?: string) => {
      setWorkspaceVideo({
        videoId,
        youtubeVideoId: youtubeVideoId ?? "",
        videoTitle,
        tab: selectedResource ?? "notes",
      });
    },
    [selectedResource]
  );

  const handleCloseWorkspace = useCallback(() => {
    setWorkspaceVideo(null);
  }, []);

  const resourceConfig = RESOURCES.find(
    (r) => r.id === selectedResource
  );

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* ── Back button ────────────────────────────────────────────── */}
      <button
        onClick={() => {
          if (view === "videos") {
            setView("selector");
          } else {
            router.push("/learning");
          }
        }}
        className="inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-200 transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>{view === "videos" ? "Back to resources" : "Back to Learning"}</span>
      </button>

      {/* ── Course header ──────────────────────────────────────────── */}
      <div className="flex items-center gap-4 mb-8">
        <div className="relative w-24 h-16 shrink-0 rounded-xl overflow-hidden bg-zinc-800">
          {courseThumbnail && (
            <img
              src={courseThumbnail}
              alt={courseTitle}
              className="w-full h-full object-cover"
            />
          )}
        </div>
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-zinc-100 truncate">
            {courseTitle || "Loading..."}
          </h1>
          <div className="flex items-center gap-1.5 mt-1">
            <Book className="w-4 h-4 text-zinc-500" />
            <span className="text-sm text-zinc-500">
              {videosCount > 0
                ? `${videosCount} video${videosCount !== 1 ? "s" : ""}`
                : "Loading..."}
            </span>
          </div>
        </div>
      </div>

      {/* ── Resource Selector ──────────────────────────────────────── */}
      {view === "selector" && (
        <div>
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4">
            Choose a resource
          </h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {RESOURCES.map((r) => {
              const count =
                r.id === "notes"
                  ? personalVideos.length
                  : aiVideos.length;
              return (
                <ResourceCard
                  key={r.id}
                  resource={r}
                  count={count}
                  selected={false}
                  onSelect={() => handleSelectResource(r.id)}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* ── Video List ─────────────────────────────────────────────── */}
      {view === "videos" && resourceConfig && (
        <div>
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4">
            {resourceConfig.label}
          </h2>

          {/* Personal Notes */}
          {selectedResource === "notes" &&
            (loadingPersonal ? (
              <LoadingSkeleton />
            ) : personalError ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <FileText className="w-8 h-8 text-zinc-600 mb-3" />
                <p className="text-red-400 text-sm mb-3">{personalError}</p>
                <button
                  onClick={loadPersonalNotes}
                  className="rounded-lg bg-blue-600 hover:bg-blue-700 px-4 py-2 text-xs font-semibold text-white transition-colors"
                >
                  Retry
                </button>
              </div>
            ) : personalVideos.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <FileText className="w-8 h-8 text-zinc-600 mb-3" />
                <p className="text-zinc-500 text-sm max-w-xs">
                  {resourceConfig.emptyMessage}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {personalVideos.map((video) => (
                  <PersonalNoteVideoCard
                    key={video.videoId}
                    video={video}
                    onOpen={handleOpenLearningWorkspace}
                  />
                ))}
              </div>
            ))}

          {/* AI Summaries / Quizzes */}
          {(selectedResource === "summary" || selectedResource === "quiz") &&
            (loadingAi ? (
              <LoadingSkeleton />
            ) : aiError ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                {selectedResource === "summary" ? (
                  <Sparkles className="w-8 h-8 text-zinc-600 mb-3" />
                ) : (
                  <Brain className="w-8 h-8 text-zinc-600 mb-3" />
                )}
                <p className="text-red-400 text-sm mb-3">{aiError}</p>
                <button
                  onClick={loadAiData}
                  className="rounded-lg bg-blue-600 hover:bg-blue-700 px-4 py-2 text-xs font-semibold text-white transition-colors"
                >
                  Retry
                </button>
              </div>
            ) : aiVideos.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                {selectedResource === "summary" ? (
                  <Sparkles className="w-8 h-8 text-zinc-600 mb-3" />
                ) : (
                  <Brain className="w-8 h-8 text-zinc-600 mb-3" />
                )}
                <p className="text-zinc-500 text-sm max-w-xs">
                  {resourceConfig.emptyMessage}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {aiVideos.map((video) => (
                  <AiVideoCard
                    key={video.videoId}
                    video={video}
                    label={
                      selectedResource === "summary"
                        ? "AI Summary"
                        : "AI Quiz"
                    }
                    icon={
                      selectedResource === "summary" ? (
                        <Sparkles className="w-3 h-3 mr-1" />
                      ) : (
                        <Brain className="w-3 h-3 mr-1" />
                      )
                    }
                    color={
                      selectedResource === "summary" ? "emerald" : "purple"
                    }
                    onOpen={handleOpenLearningWorkspace}
                  />
                ))}
              </div>
            ))}
        </div>
      )}

      {/* ── Learning Workspace ─────────────────────────────────────── */}
      {workspaceVideo && (
        <LearningWorkspace
          videoId={workspaceVideo.videoId}
          youtubeVideoId={workspaceVideo.youtubeVideoId}
          videoTitle={workspaceVideo.videoTitle}
          courseId={courseId}
          initialTab={workspaceVideo.tab}
          onClose={handleCloseWorkspace}
        />
      )}
    </div>
  );
}

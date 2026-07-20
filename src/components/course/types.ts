export type Video = {
  id: string;
  courseId: string;
  youtubeVideoId: string;
  title: string;
  position: number;
  durationSeconds: number | null;
  thumbnailUrl: string | null;
  isAvailable: boolean;
  status: string;
  lastWatchedSeconds?: number | null;
};

export type Course = {
  id: string;
  title: string;
  thumbnailUrl: string | null;
  videos: Video[];
  _count: { videos: number };
};

export type StudySummary = {
  hook: string;
  keyPoints: string[];
};

export type QuizPayload = {
  questions: { question: string; options: string[]; answer: number }[];
};

export type AiGenerationState = {
  status: "idle" | "generating" | "pending" | "ready" | "failed";
  summary?: StudySummary;
  quiz?: QuizPayload;
  reason?: string;
};

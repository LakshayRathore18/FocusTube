import type { Video } from "./types";

function NotStartedRing() {
  return (
    <svg className="w-8 h-8 -rotate-90" viewBox="0 0 24 24" fill="none">
      <circle
        cx="12" cy="12" r="9"
        stroke="currentColor"
        strokeWidth="2"
        className="text-gray-400 dark:text-gray-500"
      />
    </svg>
  );
}

function InProgressRing({ progress = 40 }: { progress?: number }) {
  const r = 9;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <svg className="w-8 h-8 -rotate-90" viewBox="0 0 24 24" fill="none">
      <circle
        cx="12" cy="12" r={r}
        stroke="currentColor"
        strokeWidth="2"
        className="text-gray-300 dark:text-gray-600"
      />
      <circle
        cx="12" cy="12" r={r}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        className="text-amber-500"
      />
    </svg>
  );
}

function CompletedCheck() {
  return (
    <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
      <svg
        className="w-4 h-4 text-white"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={3}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="m4.5 12.75 6 6 9-13.5"
        />
      </svg>
    </div>
  );
}

export default function StatusBadge({ video }: { video: Video }) {
  if (video.status === "completed") return <CompletedCheck />;
  if (video.status === "in_progress") {
    const pct =
      video.durationSeconds && video.lastWatchedSeconds
        ? Math.min(100, Math.round((video.lastWatchedSeconds / video.durationSeconds) * 100))
        : 40;
    return <InProgressRing progress={pct} />;
  }
  return <NotStartedRing />;
}

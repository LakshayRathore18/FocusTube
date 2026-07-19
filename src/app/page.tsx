import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function Home() {
  const session = await auth();

  // If already signed in, go straight to dashboard
  if (session?.user) {
    redirect("/dashboard");
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4">
      <main className="flex flex-col items-center text-center max-w-2xl py-24">
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-gray-900 dark:text-white mb-6">
          Learn from YouTube <span className="text-blue-600">without distractions</span>
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-400 mb-8 max-w-lg">
          Import YouTube playlists as structured courses. Track your progress, take notes,
          and get AI-generated summaries and quizzes — all in one focused workspace.
        </p>
        <div className="flex gap-4">
          <Link
            href="/sign-in"
            className="rounded-lg bg-blue-600 px-6 py-3 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            Get Started
          </Link>
          <Link
            href="/dashboard"
            className="rounded-lg border border-gray-300 dark:border-gray-700 px-6 py-3 text-sm font-medium text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            Dashboard
          </Link>
        </div>

        {/* Feature highlights */}
        <div className="grid gap-8 sm:grid-cols-3 mt-24 w-full">
          <div className="flex flex-col items-center gap-2">
            <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 text-xl font-bold">
              1
            </div>
            <h3 className="font-semibold text-gray-900 dark:text-white">Import</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
              Paste any YouTube playlist URL. We fetch the title, thumbnails, and all videos.
            </p>
          </div>
          <div className="flex flex-col items-center gap-2">
            <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 text-xl font-bold">
              2
            </div>
            <h3 className="font-semibold text-gray-900 dark:text-white">Study</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
              Watch videos in-app with notes beside the player. Mark progress as you go.
            </p>
          </div>
          <div className="flex flex-col items-center gap-2">
            <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 text-xl font-bold">
              3
            </div>
            <h3 className="font-semibold text-gray-900 dark:text-white">Review</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
              Get AI summaries and auto-generated quizzes to reinforce what you learned.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
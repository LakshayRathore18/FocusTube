"use client";

import CourseLibrary from "@/components/notes/CourseLibrary";
import { FileText, Sparkles, Brain, ChevronRight } from "lucide-react";

export default function LearningPage() {
  const scrollToCourses = () => {
    const el = document.getElementById("course-library");
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* ── Hero section ───────────────────────────────────────────── */}
      <div className="mb-10">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Learning
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1.5 max-w-xl">
          Everything you've created and generated while learning.
        </p>

        {/* What you can do here — informational, not decorative cards */}
        <div className="space-y-2 mt-6">
          <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
            Pick a course below to access:
          </p>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <span className="inline-flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
              <FileText className="w-4 h-4 text-blue-500 shrink-0" />
              Personal Notes
            </span>
            <span className="inline-flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
              <Sparkles className="w-4 h-4 text-emerald-500 shrink-0" />
              AI Summaries
            </span>
            <span className="inline-flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
              <Brain className="w-4 h-4 text-purple-500 shrink-0" />
              AI Quizzes
            </span>
          </div>
        </div>

        {/* CTA to scroll to courses */}
        <button
          onClick={scrollToCourses}
          className="inline-flex items-center gap-1 mt-4 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
        >
          Browse your courses
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* ── Course library ─────────────────────────────────────────── */}
      <div id="course-library">
        <CourseLibrary />
      </div>
    </div>
  );
}

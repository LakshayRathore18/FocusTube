"use client";

import { useState, useCallback } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

export type QuizQuestion = {
  question: string;
  options: string[];
  answer: number;
};

interface QuizPlayerProps {
  questions: QuizQuestion[];
  /** Label shown on the reveal/reset button after an answer is selected.
   *  Default: "Try again" (matches AIContentModal usage) */
  resetLabel?: string;
}

// ─── QuizPlayer ──────────────────────────────────────────────────────────────

/**
 * Reusable quiz interaction component.
 *
 * Manages answer selection, reveal, and reset state internally.
 * Used by both AIContentModal (course page) and LearningWorkspace (learning hub)
 * to eliminate duplicated quiz logic.
 */
export default function QuizPlayer({
  questions,
  resetLabel = "Try again",
}: QuizPlayerProps) {
  const [selectedAnswers, setSelectedAnswers] = useState<
    Record<number, number | null>
  >({});

  const selectAnswer = useCallback(
    (questionIdx: number, optionIdx: number) => {
      setSelectedAnswers((prev) => {
        if (prev[questionIdx] !== undefined) return prev;
        return { ...prev, [questionIdx]: optionIdx };
      });
    },
    [],
  );

  const revealAnswer = useCallback(
    (questionIdx: number) => {
      setSelectedAnswers((prev) => {
        if (prev[questionIdx] !== undefined) {
          const next = { ...prev };
          delete next[questionIdx];
          return next;
        }
        return {
          ...prev,
          [questionIdx]: questions[questionIdx].answer,
        };
      });
    },
    [questions],
  );

  if (questions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-zinc-500 text-sm">No questions available.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {questions.map((q, i) => {
        const isAnswered = selectedAnswers[i] !== undefined;
        const selectedIdx = selectedAnswers[i];
        const correctAnswer = q.answer;

        return (
          <div
            key={i}
            className="rounded-xl bg-zinc-800/50 p-4 border border-zinc-800"
          >
            <p className="text-sm font-semibold text-zinc-100 mb-3">
              {i + 1}. {q.question}
            </p>

            <div className="space-y-2">
              {q.options.map((opt, oi) => {
                const isCorrectOption = oi === correctAnswer;
                const isSelectedOption = isAnswered && selectedIdx === oi;
                const isWrongSelection = isSelectedOption && !isCorrectOption;

                let containerStyle =
                  "border-zinc-700 text-zinc-400 hover:bg-zinc-700/50 cursor-pointer";
                let badgeStyle = "bg-zinc-700 text-zinc-300";

                if (isAnswered) {
                  if (isCorrectOption) {
                    containerStyle =
                      "border-emerald-600 bg-emerald-500/10 text-emerald-200 font-medium cursor-default";
                    badgeStyle = "bg-emerald-500 text-white";
                  } else if (isWrongSelection) {
                    containerStyle =
                      "border-red-600 bg-red-500/10 text-red-200 font-medium cursor-default";
                    badgeStyle = "bg-red-500 text-white";
                  } else {
                    containerStyle =
                      "border-zinc-700 text-zinc-500 cursor-default";
                    badgeStyle = "bg-zinc-700 text-zinc-500";
                  }
                }

                return (
                  <button
                    key={oi}
                    onClick={() => selectAnswer(i, oi)}
                    disabled={isAnswered}
                    className={`flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-sm text-left transition-all ${containerStyle}`}
                  >
                    <span
                      className={`flex items-center justify-center w-5 h-5 shrink-0 rounded-full text-[11px] font-semibold transition-colors ${badgeStyle}`}
                    >
                      {String.fromCharCode(65 + oi)}
                    </span>
                    <span className="flex-1">{opt}</span>

                    {isAnswered && isCorrectOption && (
                      <svg
                        className="w-4 h-4 shrink-0 text-emerald-500"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={2.5}
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="m4.5 12.75 6 6 9-13.5"
                        />
                      </svg>
                    )}
                    {isWrongSelection && (
                      <svg
                        className="w-4 h-4 shrink-0 text-red-500"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={2.5}
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M6 18 18 6M6 6l12 12"
                        />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Reveal / Reset button */}
            <button
              onClick={() => revealAnswer(i)}
              className={`mt-3 text-xs font-medium transition-colors ${
                isAnswered
                  ? "text-zinc-500 hover:text-zinc-300"
                  : "text-blue-400 hover:text-blue-300"
              }`}
            >
              {isAnswered ? resetLabel : "Reveal answer"}
            </button>
          </div>
        );
      })}
    </div>
  );
}

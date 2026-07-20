/**
 * AI Provider interface for generating study notes from transcripts.
 *
 * Allows swapping between different AI backends (Gemini, Grok, etc.)
 * without changing the route or UI code.
 */

export type StudySummary = {
  hook: string;
  keyPoints: string[];
};

export type QuizPayload = {
  questions: {
    question: string;
    options: string[];
    answer: number;
  }[];
};

export type GenerateNotesResult =
  | { success: true; summary: StudySummary; quiz: QuizPayload }
  | { success: false; reason: "parse_error" | "api_error" | "empty_transcript" | "invalid_quiz_shape" };

export interface AIProvider {
  /**
   * Generate structured study notes (summary + quiz) from a transcript.
   * Returns a tagged union result — handle both success and failure paths.
   */
  generateNotes(transcript: string): Promise<GenerateNotesResult>;
}

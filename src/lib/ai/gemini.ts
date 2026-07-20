/**
 * Gemini AI provider — implements AIProvider for Google Gemini.
 *
 * Uses @google/genai SDK with the Gemini model specified by the
 * GEMINI_MODEL env var (defaults to gemini-3.1-flash-lite).
 */

import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import type { AIProvider, GenerateNotesResult, QuizPayload } from "./provider";

const MODEL = process.env.GEMINI_MODEL || "gemini-3.1-flash-lite";

// ─────────────────────────────────────────────────────────────
// Schema (Zod validation)
// ─────────────────────────────────────────────────────────────

const QuizQuestionSchema = z.object({
  question: z.string().min(1),
  options: z.array(z.string()).length(4),
  answer: z.number().int().min(0).max(3),
});

const NotesSchema = z.object({
  summary: z.string().min(1),
  quiz: z.object({
    questions: z.array(QuizQuestionSchema).length(5),
  }),
});

// ─────────────────────────────────────────────────────────────
// Prompt builder
// ─────────────────────────────────────────────────────────────

function buildPrompt(transcript: string) {
  return `You are a study note generator. Create structured study notes from the provided transcript.

Return ONLY valid JSON with NO markdown formatting, NO code fences, and NO additional text before or after. The JSON must match this exact schema:

{
  "summary": "A concise educational summary of the transcript covering the key concepts",
  "quiz": {
    "questions": [
      {
        "question": "The question text",
        "options": ["Option A", "Option B", "Option C", "Option D"],
        "answer": 0
      }
    ]
  }
}

Requirements:
- "summary": a single concise paragraph covering the key concepts from the transcript
- "questions": exactly 5 comprehension quiz questions
- Each question must have exactly 4 options (array of 4 strings)
- "answer" must be the zero-based index (0, 1, 2, or 3) of the correct option
- Focus on concepts, not wording. Avoid trivial questions. Avoid ambiguity.

Transcript:
${transcript}`;
}

// ─────────────────────────────────────────────────────────────
// Provider export
// ─────────────────────────────────────────────────────────────

export const geminiProvider: AIProvider = {
  async generateNotes(transcript: string): Promise<GenerateNotesResult> {
    if (transcript.trim().length < 50) {
      return { success: false, reason: "empty_transcript" };
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return { success: false, reason: "api_error" };
    }

    try {
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: MODEL,
        contents: [
          { role: "user", parts: [{ text: "You create accurate study notes from educational transcripts." }] },
          { role: "user", parts: [{ text: buildPrompt(transcript) }] },
        ],
      });

      const output = response.text;
      if (!output) {
        return { success: false, reason: "api_error" };
      }

      // Strip markdown code fences if present (common model behavior)
      let cleaned = output.trim();
      const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (fenceMatch) {
        cleaned = fenceMatch[1].trim();
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(cleaned);
      } catch {
        console.error("[gemini] invalid JSON:", cleaned.slice(0, 500));
        return { success: false, reason: "parse_error" };
      }

      const validated = NotesSchema.safeParse(parsed);
      if (!validated.success) {
        console.error("[gemini] invalid response shape", validated.error);
        return { success: false, reason: "invalid_quiz_shape" };
      }

      return {
        success: true,
        summary: validated.data.summary,
        quiz: validated.data.quiz as QuizPayload,
      };
    } catch (err) {
      console.error(
        "[gemini] generateNotes failed:",
        err instanceof Error ? err.message : err
      );
      return { success: false, reason: "api_error" };
    }
  },
};

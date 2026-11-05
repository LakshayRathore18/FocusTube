"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRight, ArrowUp, BookOpen, Check, ChevronDown, ExternalLink,
  FileText, Lightbulb, LoaderCircle, MessageCircle, ShieldCheck, Sparkles,
} from "lucide-react";

type Citation = { sourceId: string; excerpt: string; videoTitle: string; videoUrl: string };
type Message = { role: "user" | "assistant"; content: string; citations?: Citation[]; insufficient?: boolean };
type Preparation = "loading" | "not_prepared" | "pending" | "ready" | "failed";

const ERRORS: Record<string, string> = {
  no_captions: "Captions are unavailable for this video. Chat needs a transcript.",
  video_unavailable: "This video's transcript is unavailable.",
  transcript_unavailable: "Could not fetch captions. Please try preparing again.",
  provider_quota: "The AI provider's request allowance was reached. Please try later.",
  rate_limited: "You've made several requests. Please wait a minute before retrying.",
  provider_not_configured: "Video chat is unavailable because its AI service needs configuration.",
  feature_disabled: "Video chat is currently unavailable.",
  not_prepared: "Please prepare this video before asking a question.",
  timeout: "The request took too long. You can retry or refresh preparation status.",
  preparation_interrupted: "Preparation was interrupted. Please prepare again.",
  index_incompatible: "This video needs preparation again after a chat update.",
};

export default function VideoChat({ videoId }: { videoId: string }) {
  const [preparation, setPreparation] = useState<Preparation>("loading");
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slow, setSlow] = useState(false);
  const lifetime = useRef<AbortController | null>(null);
  const submitting = useRef(false);
  const statusInFlight = useRef(false);
  const conversation = useRef<HTMLDivElement | null>(null);
  const composer = useRef<HTMLTextAreaElement | null>(null);
  const base = `/api/rag/videos/${encodeURIComponent(videoId)}`;

  const request = useCallback(async (path: string, body?: object) => {
    const signal = lifetime.current?.signal;
    if (!signal || signal.aborted) throw new DOMException("Closed", "AbortError");
    const response = await fetch(`${base}/${path}`, {
      method: body ? "POST" : "GET",
      cache: "no-store",
      signal: AbortSignal.any([signal, AbortSignal.timeout(path === "prepare" ? 100_000 : 65_000)]),
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await response.json();
    if (signal.aborted) throw new DOMException("Closed", "AbortError");
    if (!response.ok) {
      const code = data.code ?? data.error;
      const wait = response.headers.get("Retry-After");
      throw new Error((ERRORS[code] ?? "Video chat could not complete this request. Please retry.") +
        (response.status === 429 && wait ? ` Retry after ${wait} seconds.` : ""));
    }
    return data;
  }, [base]);

  const refresh = useCallback(async () => {
    if (statusInFlight.current) return;
    statusInFlight.current = true;
    const controller = lifetime.current;
    try {
      const data = await request("status");
      setPreparation(data.status);
      setError(data.reason ? ERRORS[data.reason] ?? "Preparation failed. Please retry." : null);
    } catch (reason) {
      if (controller && !controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Could not check preparation.");
    } finally {
      if (lifetime.current === controller) statusInFlight.current = false;
    }
  }, [request]);

  useEffect(() => {
    const controller = new AbortController();
    lifetime.current = controller;
    statusInFlight.current = true;
    request("status").then((data) => {
      if (controller.signal.aborted) return;
      setPreparation(data.status);
      setError(data.reason ? ERRORS[data.reason] ?? "Preparation failed. Please retry." : null);
    }).catch((reason) => {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Could not check preparation.");
    }).finally(() => {
      if (lifetime.current === controller) statusInFlight.current = false;
    });
    return () => controller.abort();
  }, [request]);

  useEffect(() => {
    if (preparation !== "pending" || slow) return;
    const started = Date.now();
    const timer = setInterval(() => {
      if (Date.now() - started >= 120_000) {
        clearInterval(timer);
        setSlow(true);
        return;
      }
      void refresh();
    }, 3000);
    return () => clearInterval(timer);
  }, [preparation, refresh, slow]);

  useEffect(() => {
    if (preparation === "ready" && (messages.length || (busy && question.trim()))) {
      const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      const pane = conversation.current;
      pane?.scrollTo?.({ top: pane.scrollHeight, behavior: reducedMotion ? "auto" : "smooth" });
    }
    // Only scroll when conversation activity changes, never while typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, busy, preparation]);

  useEffect(() => {
    const input = composer.current;
    if (!input) return;
    input.style.height = "40px";
    input.style.height = `${Math.min(Math.max(input.scrollHeight, 40), 104)}px`;
  }, [question, preparation]);

  async function prepare() {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError(null);
    setSlow(false);
    setPreparation("pending");
    try {
      const data = await request("prepare", {});
      setPreparation(data.status);
    } catch (reason) {
      if (!lifetime.current?.signal.aborted) {
        setPreparation("failed");
        setError(reason instanceof Error ? reason.message : "Could not prepare chat.");
      }
    } finally {
      submitting.current = false;
      if (!lifetime.current?.signal.aborted) setBusy(false);
    }
  }

  async function send() {
    const current = question.trim();
    if (!current || current.length > 2000 || submitting.current || preparation !== "ready") return;
    submitting.current = true;
    setBusy(true);
    setError(null);
    try {
      const history = messages.slice(-6).map(({ role, content }) => ({ role, content: content.slice(0, 4000) }));
      const data = await request("ask", { question: current, history });
      setMessages((previous) => [...previous,
        { role: "user", content: current },
        { role: "assistant", content: data.answer, citations: data.citations, insufficient: data.status === "insufficient_evidence" },
      ]);
      setQuestion("");
    } catch (reason) {
      if (!lifetime.current?.signal.aborted) setError(reason instanceof Error ? reason.message : "Could not answer. Please retry.");
    } finally {
      submitting.current = false;
      if (!lifetime.current?.signal.aborted) setBusy(false);
    }
  }

  const ready = preparation === "ready";
  const preparing = preparation === "pending" || preparation === "loading";
  const suggestions = [
    { icon: BookOpen, title: "Get the big picture", question: "What are the main ideas?" },
    { icon: Lightbulb, title: "Break down an example", question: "Explain the main example in this video." },
    { icon: MessageCircle, title: "Put it into practice", question: "What should I practice after this lesson?" },
  ];

  return (
    <section className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)_auto] bg-zinc-950/40 [color-scheme:dark]" aria-label="Ask this video">
      <div className="flex items-center justify-between gap-3 border-b border-white/5 px-5 py-2.5 sm:px-7">
        <div className="flex items-center gap-2 text-xs font-medium text-zinc-400">
          <ShieldCheck className="h-4 w-4 text-blue-400" aria-hidden="true" />
          Answers from this video
        </div>
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium ${ready ? "border-emerald-500/15 bg-emerald-500/5 text-emerald-400" : "border-white/10 text-zinc-400"}`}>
          {ready ? <Check className="h-3 w-3" aria-hidden="true" /> : preparing && !slow ? <LoaderCircle className="h-3 w-3 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <FileText className="h-3 w-3" aria-hidden="true" />}
          {ready ? "Transcript ready" : preparation === "loading" ? "Checking" : preparing ? "Preparing" : "Setup needed"}
        </span>
      </div>

      <div ref={conversation} tabIndex={0} role="region" aria-label="Chat messages" className="chat-scrollbar min-h-0 overflow-y-auto overscroll-contain px-3 py-4 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-500/40 sm:px-5 sm:py-5">
        {!ready && (
          <div className="mx-auto flex min-h-full max-w-2xl flex-col items-start justify-center py-3 text-left">
            <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-blue-400/20 bg-gradient-to-br from-blue-400/15 to-blue-600/5 shadow-[0_0_40px_-12px_rgba(59,130,246,0.3)]">
              {preparing && !slow ? <LoaderCircle className="h-6 w-6 animate-spin motion-reduce:animate-none text-blue-400" aria-hidden="true" /> : <FileText className="h-6 w-6 text-blue-400" aria-hidden="true" />}
            </div>
            <h3 className="text-xl font-semibold tracking-tight text-zinc-100">
              {preparing ? "Getting your video ready" : "A conversation with your video"}
            </h3>
            <p className="mt-3 max-w-lg text-sm leading-6 text-zinc-400">
              {preparation === "pending" ? slow ? "Preparation is taking longer. Refresh status later, or prepare again if it was interrupted." : "Preparing the full transcript for chat... You can start asking as soon as it?s ready."
                : preparation === "loading" ? "Checking whether this video's transcript is ready to use?" : "Prepare the transcript once. Then explore ideas, unpack examples, and ask follow-up questions. No summary needed."}
            </p>
            <button type="button" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-blue-950/30 transition hover:bg-blue-500 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-400 disabled:cursor-wait disabled:opacity-50" disabled={busy}
              onClick={() => preparing ? void refresh() : void prepare()}>
              {busy && <LoaderCircle className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
              {preparing ? "Refresh status" : "Prepare video chat"}
              {!preparing && <ArrowRight className="h-4 w-4" aria-hidden="true" />}
            </button>
          </div>
        )}

        {ready && messages.length === 0 && !busy && (
          <div className="mx-auto flex min-h-full max-w-2xl flex-col justify-center py-2">
            <div className="mb-3 flex items-center gap-2 text-xs font-medium text-blue-400">
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              Your video companion
            </div>
            <h3 className="text-xl font-semibold tracking-tight text-zinc-100 sm:text-2xl">What would you like to understand?</h3>
            <p className="mt-2 max-w-lg text-sm leading-6 text-zinc-400">Explore an idea, break down an example, or ask a follow-up. Answers include sources from this video.</p>
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              {suggestions.map(({ icon: Icon, title, question: suggestion }) => (
                <button key={suggestion} type="button" onClick={() => { setQuestion(suggestion); composer.current?.focus(); }}
                  className="group flex min-w-0 items-center gap-2.5 rounded-xl border border-white/[0.08] bg-white/[0.02] p-3 text-left transition hover:border-blue-400/30 hover:bg-blue-400/5 focus-visible:outline-2 focus-visible:outline-blue-400">
                  <Icon className="h-4 w-4 shrink-0 text-blue-400/80" aria-hidden="true" />
                  <span className="min-w-0 flex-1 text-xs font-medium leading-5 text-zinc-300">{title}</span>
                  <ArrowRight className="h-3.5 w-3.5 text-zinc-600 transition group-hover:translate-x-0.5 group-hover:text-blue-400 motion-reduce:transform-none sm:hidden" aria-hidden="true" />
                </button>
              ))}
            </div>
          </div>
        )}

        <div role="log" aria-live="polite" aria-label="Conversation" className="mx-auto max-w-2xl space-y-6">
          {messages.map((message, index) => (
            <article key={index} className={message.role === "user" ? "ml-auto max-w-[88%]" : "max-w-full"}>
              {message.role === "user" ? (
                <>
                  <p className="mb-1.5 pr-1 text-right text-[10px] font-medium text-zinc-500">You</p>
                  <p className="rounded-2xl rounded-tr-sm border border-blue-400/10 bg-blue-500/10 px-4 py-3 text-sm leading-6 whitespace-pre-wrap break-words text-blue-50">{message.content}</p>
                </>
              ) : (
                <>
                  <div className="mb-2.5 flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-400/10"><Sparkles className="h-3.5 w-3.5 text-blue-400" aria-hidden="true" /></span>
                    <p className={`text-xs font-medium ${message.insufficient ? "text-amber-300" : "text-zinc-300"}`}>{message.insufficient ? "Not enough transcript evidence" : "Video answer"}</p>
                  </div>
                  <p className="text-sm leading-7 whitespace-pre-wrap break-words text-zinc-300">{message.content}</p>
                  {!!message.citations?.length && (
                    <div className="mt-4 space-y-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">From the transcript / {message.citations.length} {message.citations.length === 1 ? "source" : "sources"}</p>
                      {message.citations.map((citation) => (
                        <details key={citation.sourceId} className="group/source overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.02] text-sm open:border-blue-400/20">
                          <summary className="flex cursor-pointer list-none items-center gap-2.5 px-3.5 py-3 [&::-webkit-details-marker]:hidden">
                            <span className="rounded-md bg-blue-400/10 px-1.5 py-0.5 text-[10px] font-semibold text-blue-300">{citation.sourceId}</span>
                            <span className="min-w-0 flex-1 truncate text-xs text-zinc-400">{citation.videoTitle}</span>
                            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-zinc-500 transition group-open/source:rotate-180 motion-reduce:transition-none" aria-hidden="true" />
                          </summary>
                          <div className="border-t border-white/5 px-3.5 py-3.5">
                            <blockquote className="border-l-2 border-blue-400/30 pl-3 text-xs leading-6 whitespace-pre-wrap break-words text-zinc-400">{citation.excerpt}</blockquote>
                            <a className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-blue-400 hover:text-blue-300" href={citation.videoUrl} target="_blank" rel="noopener noreferrer">Open video <ExternalLink className="h-3 w-3" aria-hidden="true" /></a>
                          </div>
                        </details>
                      ))}
                    </div>
                  )}
                </>
              )}
            </article>
          ))}
          {ready && busy && (
            <div role="status" className="space-y-5">
              <p className="ml-auto max-w-[88%] rounded-2xl rounded-tr-sm border border-blue-400/10 bg-blue-500/10 px-4 py-3 text-sm leading-6 whitespace-pre-wrap break-words text-blue-50">{question}</p>
              <div className="flex items-center gap-2.5 py-2 text-xs text-zinc-400"><LoaderCircle className="h-4 w-4 animate-spin motion-reduce:animate-none text-blue-400" aria-hidden="true" />Finding evidence and writing your answer...</div>
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-white/5 bg-zinc-900 px-5 py-3 sm:px-7">
        <div className="mx-auto max-w-2xl">
        {error && <div role="alert" className="mb-3 rounded-xl border border-amber-400/15 bg-amber-400/5 px-3.5 py-3 text-xs leading-5 text-amber-200">{error}</div>}
        {ready && (
          <form onSubmit={(event) => { event.preventDefault(); void send(); }} className="flex items-end gap-2 rounded-xl border border-zinc-700/80 bg-zinc-950/70 p-2 transition focus-within:border-blue-400/50 focus-within:ring-2 focus-within:ring-blue-400/5">
            <label htmlFor="video-question" className="sr-only">Your question</label>
            <textarea ref={composer} id="video-question" value={question} maxLength={2000} disabled={busy} onChange={(event) => setQuestion(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void send(); }
              }}
              rows={1} className="chat-scrollbar block max-h-[104px] min-h-10 min-w-0 flex-1 resize-none overflow-y-auto bg-transparent px-2 py-2 text-sm leading-6 text-zinc-100 placeholder:text-zinc-500 focus:outline-none disabled:opacity-60" placeholder="Ask about this video..." />
              <button type="submit" disabled={busy || !question.trim()} className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-xs font-medium text-white transition hover:bg-blue-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500">
                {busy ? <LoaderCircle className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />}
                {busy ? "Answering..." : error ? "Retry question" : "Send"}
              </button>
          </form>
        )}
        <div className="mt-2 flex items-center justify-between gap-3 text-[10px] leading-4 text-zinc-500">
          <p>AI can make mistakes. Check sources.</p>
          <span className="shrink-0">{question.length > 1500 ? `${question.length}/2000` : "Chat clears on close"}</span>
        </div>
        </div>
      </div>
    </section>
  );
}

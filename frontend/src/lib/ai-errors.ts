const messages: Record<string, string> = {
  service_unavailable: "The AI service is temporarily busy. Please try again shortly.",
  rate_limited: "The provider's request limit was reached. Please try again later.",
  model_unavailable: "The configured AI model is unavailable. Please check the backend model setting.",
  ai_not_configured: "AI access is unavailable. Please check the backend API key and billing settings.",
  no_api_key: "Transcript access is not configured.",
  no_captions: "This video has no available captions to summarize.",
  video_unavailable: "This video's transcript is unavailable.",
  max_attempts: "This video reached its generation attempt limit.",
  timeout: "AI generation took too long. Please try again.",
  api_error: "AI generation failed. Please try again shortly.",
};

export function aiErrorMessage(reason?: string): string {
  return (reason && messages[reason]) || reason || "AI generation failed. Please try again.";
}

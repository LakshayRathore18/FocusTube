import { notFound, redirect } from "next/navigation";
import { backendFetch, requireSession } from "@/lib/backend";

export default async function LearningCoursePage({ params }: { params: Promise<{ courseId: string }> }) {
  await requireSession();
  const { courseId } = await params;
  const response = await backendFetch(`/api/courses/${encodeURIComponent(courseId)}`);
  if (response.status === 404 || response.status === 403) notFound();
  if (response.status === 401) redirect("/sign-in");
  if (!response.ok) throw new Error("Could not load this course. Please try again.");
  redirect(`/study-library?courseId=${encodeURIComponent(courseId)}`);
}

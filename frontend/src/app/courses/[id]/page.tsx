import { notFound, redirect } from "next/navigation";
import { backendFetch } from "@/lib/backend";
import type { Course } from "@/components/course/types";
import CourseContent from "@/components/course/CourseContent";

export default async function CoursePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { id } = await params;
  const response = await backendFetch(`/api/courses/${encodeURIComponent(id)}`);
  if (response.status === 401) redirect("/sign-in");
  if (response.status === 403 || response.status === 404) notFound();
  if (!response.ok) throw new Error("Unable to load course");
  const course: Course = await response.json();

  const { play } = await searchParams;
  const playVideoId = typeof play === "string" ? play : undefined;

  return (
    <CourseContent
      course={course}
      playVideoId={playVideoId}
    />
  );
}

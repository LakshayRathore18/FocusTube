import { useLoaderData, useSearchParams } from "react-router-dom";
import CourseContent from "@/components/course/CourseContent";
import type { Course } from "@/components/course/types";

export default function CoursePage() {
  const course = useLoaderData() as Course;
  const [searchParams] = useSearchParams();
  const playVideoId = searchParams.get("play") ?? undefined;
  return <CourseContent key={`${course.id}:${playVideoId ?? ""}`} course={course} playVideoId={playVideoId} />;
}

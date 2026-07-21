"use client";

import { use } from "react";
import CourseLearningHub from "@/components/learning/CourseLearningHub";

export default function CourseLearningPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { courseId } = use(params);

  return <CourseLearningHub courseId={courseId} />;
}

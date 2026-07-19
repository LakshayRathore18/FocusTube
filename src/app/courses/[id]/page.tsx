import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import CourseContent from "@/components/CourseContent";

export default async function CoursePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    redirect("/sign-in");
  }

  const { id } = await params;

  // Run course fetch & video count in parallel for ~2x query speedup
  const [course, videoCount] = await Promise.all([
    db.course.findUnique({
      where: { id },
      include: {
        videos: {
          orderBy: { position: "asc" },
        },
      },
    }),
    db.video.count({
      where: { courseId: id },
    }),
  ]);

  if (!course || course.userId !== userId) {
    notFound();
  }

  return (
    <CourseContent
      course={{
        ...course,
        _count: { videos: videoCount },
      }}
    />
  );
}

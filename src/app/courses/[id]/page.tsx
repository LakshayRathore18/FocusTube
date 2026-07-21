import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import CourseContent from "@/components/course/CourseContent";

export default async function CoursePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
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

  const { play } = await searchParams;
  const playVideoId = typeof play === "string" ? play : undefined;

  return (
    <CourseContent
      course={{
        ...course,
        lastSyncedAt: course.lastSyncedAt?.toISOString() ?? null,
        _count: { videos: videoCount },
      }}
      playVideoId={playVideoId}
    />
  );
}

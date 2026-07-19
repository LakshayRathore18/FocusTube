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

  const course = await db.course.findUnique({
    where: { id },
    include: {
      videos: {
        orderBy: { position: "asc" },
      },
      _count: { select: { videos: true } },
    },
  });

  if (!course || course.userId !== userId) {
    notFound();
  }

  return <CourseContent course={course} />;
}

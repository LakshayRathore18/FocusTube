import StudyLibraryPage from "@/components/study-library/StudyLibraryPage";

export const metadata = { title: "Study Library · FocusTube" };

export default async function Page({ searchParams }: {
  searchParams: Promise<{ courseId?: string }>;
}) {
  const { courseId } = await searchParams;
  const selectedCourse = typeof courseId === "string" ? courseId : "";
  return <StudyLibraryPage key={selectedCourse} initialCourseId={selectedCourse} />;
}

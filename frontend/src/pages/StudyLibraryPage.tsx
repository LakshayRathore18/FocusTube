import { useSearchParams } from "react-router-dom";
import StudyLibrary from "@/components/study-library/StudyLibraryPage";

export default function StudyLibraryPage() {
  const [searchParams] = useSearchParams();
  const selectedCourse = searchParams.get("courseId") ?? "";
  return <StudyLibrary key={selectedCourse} initialCourseId={selectedCourse} />;
}

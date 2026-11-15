export type ResourceType = "notes" | "summary" | "quiz";
export type LibraryResource = {
  id: string;
  type: ResourceType;
  videoId: string;
  youtubeVideoId: string;
  videoTitle: string;
  courseId: string;
  courseTitle: string;
  preview: string;
  updatedAt: string;
  isAvailable: boolean;
};
export type StudyLibraryData = {
  items: LibraryResource[];
  total: number;
  resourceTotal: number;
  counts: Record<ResourceType | "all", number>;
  courses: { id: string; title: string }[];
  page: number;
  pageSize: number;
};

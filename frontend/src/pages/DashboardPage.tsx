import { useLoaderData } from "react-router-dom";
import Dashboard from "@/components/dashboard/DashboardPage";
import FirstTimeExperience from "@/components/dashboard/FirstTimeExperience";

export default function DashboardPage() {
  const playlistCount = useLoaderData() as number;
  return playlistCount === 0 ? <FirstTimeExperience /> : <Dashboard />;
}

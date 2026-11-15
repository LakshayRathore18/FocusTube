import { Navigate, Outlet } from "react-router-dom";
import { useSession } from "./AuthProvider";

export default function ProtectedLayout() {
  const { data: session } = useSession();
  return session ? <Outlet /> : <Navigate to="/sign-in" replace />;
}

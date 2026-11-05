import { requireSession } from "@/lib/backend";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  await requireSession();
  return children;
}

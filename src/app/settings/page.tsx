import { auth } from "@/auth";
import { redirect } from "next/navigation";

/**
 * Settings page — stub for now.
 * Will contain user preferences and app configuration options.
 */
export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
        Settings
      </h1>
      <p className="text-gray-500 dark:text-gray-400">
        Account and app settings coming soon.
      </p>
    </div>
  );
}

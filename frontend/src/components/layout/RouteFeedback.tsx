import { Link, isRouteErrorResponse, useRevalidator, useRouteError } from "react-router-dom";

export function LoadingPage() {
  return <p role="status" className="p-8 text-center text-gray-500">Loading FocusTube…</p>;
}

export function NotFoundPage() {
  return <div className="mx-auto max-w-lg px-6 py-16 text-center">
    <h1 className="text-xl font-semibold">Page not found</h1>
    <p className="mt-3 text-gray-500">This page or course is unavailable.</p>
    <Link to="/courses" className="mt-5 inline-block text-blue-600">Go to your courses</Link>
  </div>;
}

export function RouteError() {
  const error = useRouteError();
  const revalidator = useRevalidator();
  if (isRouteErrorResponse(error) && error.status === 404) return <NotFoundPage />;
  return <div role="alert" className="mx-auto max-w-lg px-6 py-16 text-center">
    <h1 className="text-xl font-semibold">Unable to load this page</h1>
    <p className="mt-3 text-gray-500">The service may be temporarily unavailable. Please try again.</p>
    <button onClick={() => void revalidator.revalidate()} disabled={revalidator.state !== "idle"} className="mt-5 rounded-lg bg-blue-600 px-4 py-2 text-white">Try again</button>
  </div>;
}

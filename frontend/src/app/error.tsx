"use client";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div role="alert" className="max-w-lg mx-auto px-6 py-16 text-center">
      <h1 className="text-xl font-semibold">Unable to load this page</h1>
      <p className="mt-3 text-gray-500">The service may be temporarily unavailable. Please try again.</p>
      <button onClick={reset} className="mt-5 rounded-lg bg-blue-600 px-4 py-2 text-white">Try again</button>
    </div>
  );
}

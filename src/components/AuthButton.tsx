'use client';

import { signIn, signOut, useSession } from 'next-auth/react';
import Image from 'next/image';
import { useState, useRef, useEffect } from 'react';

/**
 * Authentication button shown in the global navbar.
 *
 * - Unauthenticated: "Sign in with Google" button.
 * - Authenticated: user avatar with a click-to-toggle dropdown containing "Sign out".
 */
export default function AuthButton() {
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  if (status === 'loading') {
    return <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse" />;
  }

  if (!session) {
    return (
      <button
        onClick={() => signIn('google')}
        className="px-4 py-1.5 text-sm font-medium bg-gray-900 text-white rounded-md hover:bg-gray-700 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200 transition-colors"
      >
        Sign in with Google
      </button>
    );
  }

  const avatarSrc = session.user?.image ?? null;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 focus:outline-none"
        aria-label="User menu"
      >
        {avatarSrc ? (
          <Image
            src={avatarSrc}
            alt={session.user?.name ?? 'avatar'}
            width={32}
            height={32}
            className="rounded-full ring-2 ring-gray-300 dark:ring-gray-600"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center text-sm font-medium text-gray-700 dark:text-gray-200">
            {session.user?.name?.[0] ?? 'U'}
          </div>
        )}
        <span className="hidden sm:inline text-sm text-gray-700 dark:text-gray-300">
          {session.user?.name}
        </span>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-44 rounded-md bg-white dark:bg-gray-900 shadow-lg border border-gray-100 dark:border-gray-800 z-50">
          <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-800">
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{session.user?.email}</p>
          </div>
          <button
            onClick={() => { setOpen(false); signOut(); }}
            className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

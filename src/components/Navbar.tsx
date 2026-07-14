'use client';

import AuthButton from './AuthButton';
import Link from 'next/link';

/**
 * Global navigation bar — rendered as a client component because
 * it contains AuthButton which uses the useSession hook.
 */
export default function Navbar() {
  return (
    <header className="flex items-center justify-between px-6 py-3 bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800">
      <Link href="/" className="text-lg font-semibold text-gray-900 dark:text-white tracking-tight">
        FocusTube
      </Link>
      <AuthButton />
    </header>
  );
}

/**
 * CUSTOM 404 PAGE
 *
 * PURPOSE:
 * - Branded 404 error page
 * - Help users find their way back
 */

import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-black via-gray-900 to-black flex items-center justify-center px-4">
      <div className="text-center">
        <h1 className="text-8xl sm:text-9xl font-bold text-blue-500 mb-4">404</h1>
        <h2 className="text-2xl sm:text-3xl font-bold mb-4">Page Not Found</h2>
        <p className="text-gray-400 mb-8 max-w-md mx-auto">
          The page you are looking for does not exist or has been moved.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/"
            className="w-full sm:w-auto rounded-lg bg-blue-500 px-8 py-3 font-semibold hover:bg-blue-600 transition"
          >
            Go Home
          </Link>
          <Link
            href="/chat"
            className="w-full sm:w-auto rounded-lg border border-gray-600 px-8 py-3 font-semibold hover:bg-white/5 transition"
          >
            Start Chatting
          </Link>
        </div>
      </div>
    </main>
  );
}

/**
 * LANDING PAGE
 *
 * PURPOSE:
 * - Marketing/landing page for Delta-2
 * - Show product features, pricing, and "Enter App" CTA
 * - Public route accessible to all visitors
 *
 * PUBLIC ROUTES:
 * - / (root)
 *
 * SERVER ACTIONS:
 * - None (static marketing page)
 *
 * SECURITY/RLS NOTES:
 * - Public route, no auth required
 * - Check auth state to show "Enter App" vs "Sign In"
 *
 * RATE LIMITS:
 * - None (static page)
 *
 * DEPENDENCIES/ENVS:
 * - NEXT_PUBLIC_SUPABASE_URL
 * - NEXT_PUBLIC_SUPABASE_ANON_KEY
 *
 * TODO:
 * - [ ] Design hero section with product overview
 * - [ ] Add features showcase (tools, chat, admin)
 * - [ ] Implement pricing table
 * - [ ] Add "Enter App" button that redirects to /chat
 * - [ ] Show Google OAuth sign-in button if not authenticated
 * - [ ] Add footer with Privacy/Terms links
 *
 * TEST PLAN:
 * - Verify unauthenticated users see sign-in CTA
 * - Verify authenticated users see "Enter App" button
 * - Test responsive layout on mobile
 * - Validate all links work correctly
 */

import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="glass-morphism max-w-2xl rounded-3xl p-12 text-center">
        <h1 className="mb-4 text-6xl font-bold">Delta-2</h1>
        <p className="mb-8 text-xl text-gray-300">AI Chat Interface with Advanced Tools</p>

        <div className="space-y-4">
          <Link
            href="/chat"
            className="inline-block rounded-lg bg-white px-8 py-4 text-lg font-semibold text-black transition hover:bg-gray-200"
          >
            Enter App
          </Link>

          <p className="text-sm text-gray-400">
            Powered by OpenAI, XAI, and cutting-edge AI technology
          </p>
        </div>
      </div>

      <footer className="mt-12 text-center text-sm text-gray-500">
        <Link href="/privacy" className="hover:text-gray-300">
          Privacy
        </Link>
        {' • '}
        <Link href="/terms" className="hover:text-gray-300">
          Terms
        </Link>
        {' • '}
        <Link href="/contact" className="hover:text-gray-300">
          Contact
        </Link>
      </footer>
    </main>
  );
}

/**
 * LANDING PAGE LOGO
 *
 * Professional SVG wordmark. No API dependency — renders instantly.
 * The cross motif is built into the "J" letterform for subtlety.
 */

import Link from 'next/link';

export default function LandingLogo() {
  return (
    <Link href="/" className="group inline-flex items-center gap-2.5">
      {/* Logo mark — abstract cross/shield */}
      <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-amber-500 shadow-[0_0_16px_rgba(251,191,36,0.2)]">
        <svg
          viewBox="0 0 24 24"
          className="h-4.5 w-4.5 text-zinc-900"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
        >
          {/* Cross motif */}
          <line x1="12" y1="4" x2="12" y2="20" />
          <line x1="6" y1="10" x2="18" y2="10" />
        </svg>
      </div>
      {/* Wordmark */}
      <span className="text-lg font-bold tracking-tight text-white">
        JCIL<span className="text-amber-400">.AI</span>
      </span>
    </Link>
  );
}

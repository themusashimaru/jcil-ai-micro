/**
 * IMAGE GENERATION TOOL - DISCONTINUED
 * This feature has been removed from the platform.
 */

'use client';

import Link from 'next/link';

export default function ImageGenPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: 'var(--background)' }}>
      <div className="max-w-md text-center">
        <div className="text-6xl mb-6">🎨</div>
        <h1 className="text-2xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
          Image Generation Discontinued
        </h1>
        <p className="mb-6" style={{ color: 'var(--text-secondary)' }}>
          We&apos;ve discontinued our image generation feature to focus on what we do best:
          intelligent AI chat, real-time fact-checking, and professional document creation.
        </p>
        <Link
          href="/chat"
          className="inline-block px-6 py-3 rounded-lg font-semibold transition"
          style={{ backgroundColor: 'var(--primary)', color: 'var(--background)' }}
        >
          Go to Chat
        </Link>
      </div>
    </div>
  );
}

/**
 * FINAL CTA
 *
 * Clean bottom-of-page call to action.
 * Composio-inspired with pill buttons.
 */

import Link from 'next/link';
import Section from './Section';

export default function FinalCTA() {
  return (
    <Section id="final-cta">
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
          Ready to get started?
        </h2>
        <p className="mt-5 text-lg text-zinc-400">
          Start free. No credit card required. Build something meaningful.
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            href="/signup"
            className="w-full rounded-full bg-white px-8 py-3.5 text-base font-semibold text-black transition-all hover:bg-zinc-200 sm:w-auto"
          >
            Get started free
          </Link>
          <Link
            href="/contact"
            className="w-full rounded-full border border-white/[0.1] px-8 py-3.5 text-base font-medium text-zinc-300 transition-all hover:border-white/[0.2] hover:text-white sm:w-auto"
          >
            Contact sales
          </Link>
        </div>
      </div>
    </Section>
  );
}

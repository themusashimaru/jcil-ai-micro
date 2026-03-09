/**
 * FINAL CTA
 *
 * Clean bottom-of-page call to action.
 */

import Link from 'next/link';

export default function FinalCTA() {
  return (
    <section className="bg-black py-24 lg:py-32">
      <div className="mx-auto max-w-3xl px-6 text-center">
        <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          Ready to get started?
        </h2>
        <p className="mt-4 text-lg text-slate-400">
          Start free. No credit card required. Build something meaningful.
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            href="/signup"
            className="w-full rounded-lg bg-white px-8 py-3.5 text-base font-semibold text-black transition-all hover:bg-slate-100 sm:w-auto"
          >
            Get started free
          </Link>
          <Link
            href="/contact"
            className="w-full rounded-lg border border-white/15 px-8 py-3.5 text-base font-medium text-slate-300 transition-all hover:border-white/30 hover:text-white sm:w-auto"
          >
            Contact sales
          </Link>
        </div>
      </div>
    </section>
  );
}

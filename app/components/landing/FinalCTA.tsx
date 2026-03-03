/**
 * FINAL CTA SECTION
 *
 * Bottom-of-page call to action
 */

import Link from 'next/link';
import Section from './Section';
import { CrossIcon } from './Icons';

export default function FinalCTA() {
  return (
    <Section padding="xl">
      <div className="relative mx-auto max-w-4xl">
        <div className="absolute inset-0 bg-gradient-to-r from-amber-600/20 via-orange-600/20 to-amber-600/20 rounded-3xl blur-xl" />

        <div className="relative bg-gradient-to-br from-slate-900 to-slate-950 rounded-3xl p-8 lg:p-16 border border-white/10 text-center">
          <CrossIcon className="w-10 h-10 text-amber-400 mx-auto mb-6" />
          <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">
            Ready to build with faith-aligned AI?
          </h2>
          <p className="text-lg text-slate-400 mb-8 max-w-xl mx-auto">
            Join the community building something meaningful for the Kingdom. Start free, grow with
            us.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/signup"
              className="w-full sm:w-auto rounded-xl bg-amber-600 hover:bg-amber-500 px-10 py-4 text-base font-semibold text-white transition-all shadow-lg shadow-amber-500/20"
            >
              Get Started Free
            </Link>
            <Link
              href="/contact"
              className="w-full sm:w-auto rounded-xl border border-white/20 bg-white/5 px-10 py-4 text-base font-semibold text-white hover:bg-white/10 transition-all"
            >
              Contact Sales
            </Link>
          </div>
          <p className="mt-6 text-sm text-slate-500">
            No credit card required. Start building in minutes.
          </p>
        </div>
      </div>
    </Section>
  );
}

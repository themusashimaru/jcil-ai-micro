/**
 * HOW IT WORKS
 *
 * Clean 3-step workflow. Composio-inspired minimal design.
 */

import Section, { SectionHeader } from './Section';

export default function HowItWorks() {
  return (
    <Section id="how-it-works">
      <SectionHeader
        title="How it works"
        description="From idea to impact in three steps."
      />

      <div className="grid gap-8 md:grid-cols-3 md:gap-12 max-w-4xl mx-auto">
        <Step
          number="01"
          title="Describe"
          description="Tell the AI what you need in plain English. Sermon prep, code projects, research — anything."
        />
        <Step
          number="02"
          title="Execute"
          description="The agent plans, writes code, runs tests, and fixes errors automatically in a secure sandbox."
        />
        <Step
          number="03"
          title="Deploy"
          description="Get working code pushed to GitHub, documents ready to share, or research compiled and cited."
        />
      </div>
    </Section>
  );
}

function Step({ number, title, description }: { number: string; title: string; description: string }) {
  return (
    <div className="text-center">
      <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/[0.06] bg-white/[0.02] text-sm font-bold text-violet-400">
        {number}
      </div>
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      <p className="mt-2 leading-relaxed text-zinc-500">{description}</p>
    </div>
  );
}

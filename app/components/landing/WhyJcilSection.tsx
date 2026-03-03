/**
 * WHY JCIL SECTION
 *
 * Core value propositions for the platform
 */

import Section, { SectionHeader } from './Section';
import FeatureCard from './FeatureCard';
import { BibleIcon, ShieldIcon, BrainIcon } from './Icons';

export default function WhyJcilSection() {
  return (
    <Section id="why-jcil" padding="lg">
      <SectionHeader
        badge="Why JCIL"
        badgeColor="amber"
        title="AI that supports our community"
        description="Other AI platforms prioritize neutrality. We prioritize truth. JCIL is built from the ground up for believers who want AI assistance without compromising their values."
      />

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 max-w-5xl mx-auto">
        <FeatureCard
          icon={<BibleIcon className="w-6 h-6" />}
          title="Scripture-Grounded"
          description="Every response is informed by Biblical truth. Ask theological questions with confidence that the answers align with Scripture."
          variant="gradient"
          color="amber"
        />
        <FeatureCard
          icon={<ShieldIcon className="w-6 h-6" />}
          title="Values-Aligned"
          description="No moral relativism. JCIL understands Christian ethics and provides guidance that respects your worldview."
          variant="gradient"
          color="purple"
        />
        <FeatureCard
          icon={<BrainIcon className="w-6 h-6" />}
          title="Multi-Model Intelligence"
          description="Claude Opus, GPT-5.2, Gemini, Grok, and DeepSeek. Choose the best model for your task, all with faith-first values."
          variant="gradient"
          color="blue"
        />
      </div>

      <div className="mt-12 max-w-3xl mx-auto">
        <div className="bg-slate-900/50 rounded-2xl p-6 lg:p-8 border border-amber-500/20 text-center">
          <p className="text-slate-300 leading-relaxed">
            <span className="text-amber-400 font-semibold">AI is a tool, not a replacement.</span>{' '}
            JCIL does not replace God, pastors, teachers, or mentors. We build technology that
            supplements your work, helping you stay ahead without compromising your values or your
            relationships.
          </p>
        </div>
      </div>
    </Section>
  );
}

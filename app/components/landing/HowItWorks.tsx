/**
 * HOW IT WORKS SECTION
 *
 * Simple 3-step workflow visualization
 */

import Section, { SectionHeader } from './Section';
import { ChatIcon, AgentIcon, CrossIcon } from './Icons';

const steps = [
  {
    step: '01',
    title: 'Describe',
    description:
      'Tell the AI what you need in plain English. "Help me prepare a sermon on grace" or "Build me a church management app."',
    icon: <ChatIcon className="w-6 h-6" />,
  },
  {
    step: '02',
    title: 'Execute',
    description:
      'The agent plans, writes code, runs tests, and fixes errors automatically. All in a secure E2B sandbox with your values intact.',
    icon: <AgentIcon className="w-6 h-6" />,
  },
  {
    step: '03',
    title: 'Deploy',
    description:
      'Get working code pushed to GitHub, sermon outlines ready to preach, or research compiled and cited. Ready to serve.',
    icon: <CrossIcon className="w-6 h-6" />,
  },
];

export default function HowItWorks() {
  return (
    <Section background="muted" padding="lg" className="border-y border-white/5">
      <SectionHeader
        badge="How it works"
        badgeColor="green"
        title="From idea to impact in minutes"
        description="Simple workflow. Powerful results. More time for what matters."
      />

      <div className="max-w-4xl mx-auto">
        <div className="grid gap-8 md:grid-cols-3">
          {steps.map((item) => (
            <div key={item.step} className="relative">
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 flex items-center justify-center mb-6">
                  <span className="text-amber-400">{item.icon}</span>
                </div>
                <span className="text-xs font-bold text-amber-400 mb-2">{item.step}</span>
                <h3 className="text-xl font-semibold text-white mb-3">{item.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{item.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}

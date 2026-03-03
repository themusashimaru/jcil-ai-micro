/**
 * COMPARISON SECTION COMPONENT
 *
 * JCIL vs Generic AI platforms comparison table
 * TrustClaw-inspired design with honest, verifiable claims
 */

import Section, { SectionHeader } from './Section';

interface ComparisonRow {
  feature: string;
  jcil: string | boolean;
  generic: string | boolean;
}

const comparisons: ComparisonRow[] = [
  { feature: 'Scripture-grounded responses', jcil: true, generic: false },
  { feature: 'Faith-aligned content filtering', jcil: true, generic: false },
  { feature: 'Real code execution (E2B sandbox)', jcil: true, generic: 'Limited' },
  { feature: 'Multi-model support', jcil: '6+ models', generic: '1 model' },
  { feature: 'Real AI tools (not stubs)', jcil: '51 tools', generic: 'Varies' },
  { feature: 'Document generation (Word, Excel, PDF)', jcil: true, generic: 'Limited' },
  { feature: 'Web search with citations', jcil: true, generic: 'Some' },
  { feature: 'Composio integrations', jcil: '136+ apps', generic: false },
  { feature: 'Data never used for training', jcil: true, generic: 'Varies' },
  { feature: 'Built for churches & ministries', jcil: true, generic: false },
];

function CellValue({ value }: { value: string | boolean }) {
  if (value === true) {
    return (
      <svg className="w-5 h-5 text-green-400 mx-auto" fill="currentColor" viewBox="0 0 20 20">
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
          clipRule="evenodd"
        />
      </svg>
    );
  }
  if (value === false) {
    return (
      <svg className="w-5 h-5 text-slate-600 mx-auto" fill="currentColor" viewBox="0 0 20 20">
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
          clipRule="evenodd"
        />
      </svg>
    );
  }
  return <span className="text-sm text-slate-300">{value}</span>;
}

export default function ComparisonSection() {
  return (
    <Section id="comparison" padding="lg" background="muted" className="border-y border-white/5">
      <SectionHeader
        badge="Why JCIL"
        badgeColor="amber"
        title="How we compare"
        description="JCIL isn't just another AI wrapper. Every feature listed here is real, tested, and deployed."
      />

      <div className="max-w-4xl mx-auto">
        <div className="rounded-2xl border border-white/10 overflow-hidden">
          {/* Table Header */}
          <div className="grid grid-cols-3 bg-slate-900/80">
            <div className="px-6 py-4 text-sm font-medium text-slate-400">Feature</div>
            <div className="px-6 py-4 text-center">
              <span className="text-sm font-bold text-amber-400">JCIL.AI</span>
            </div>
            <div className="px-6 py-4 text-center">
              <span className="text-sm font-medium text-slate-500">Generic AI</span>
            </div>
          </div>

          {/* Table Body */}
          {comparisons.map((row, i) => (
            <div
              key={row.feature}
              className={`grid grid-cols-3 ${i % 2 === 0 ? 'bg-slate-950/50' : 'bg-slate-900/30'} ${i < comparisons.length - 1 ? 'border-b border-white/5' : ''}`}
            >
              <div className="px-6 py-4 text-sm text-slate-300">{row.feature}</div>
              <div className="px-6 py-4 flex items-center justify-center">
                <CellValue value={row.jcil} />
              </div>
              <div className="px-6 py-4 flex items-center justify-center">
                <CellValue value={row.generic} />
              </div>
            </div>
          ))}
        </div>

        <p className="text-center text-xs text-slate-600 mt-4">
          All JCIL capabilities listed above are implemented and verified in production.
        </p>
      </div>
    </Section>
  );
}

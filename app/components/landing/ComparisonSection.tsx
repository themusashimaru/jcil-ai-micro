/**
 * COMPARISON SECTION
 *
 * JCIL vs Generic AI platforms comparison table.
 * Composio-inspired clean design with unified styling.
 */

import Section, { SectionHeader } from './Section';

interface ComparisonRow {
  feature: string;
  jcil: string | boolean;
  generic: string | boolean;
}

const comparisons: ComparisonRow[] = [
  { feature: 'BYOK — bring your own API keys, any provider', jcil: '5 providers', generic: false },
  { feature: 'Switch models mid-conversation', jcil: true, generic: false },
  { feature: 'Full coding IDE in the browser', jcil: true, generic: false },
  { feature: 'Extended thinking / reasoning mode', jcil: true, generic: 'Limited' },
  { feature: 'Parallel AI research (up to 100 scouts)', jcil: true, generic: false },
  { feature: 'Real-time web search (native)', jcil: true, generic: 'Limited' },
  { feature: 'AI image generation (FLUX.2)', jcil: '5 models', generic: 'DALL-E only' },
  { feature: 'Real code execution (E2B sandbox)', jcil: true, generic: 'Limited' },
  { feature: 'Document generation (Word, Excel, PDF, PPTX)', jcil: true, generic: 'Limited' },
  { feature: 'Real AI tools (not stubs)', jcil: '91 tools', generic: 'Varies' },
  { feature: '67+ app integrations via Composio (SOC 2)', jcil: true, generic: false },
  { feature: 'Persistent memory across sessions', jcil: true, generic: false },
  { feature: 'Scripture-grounded responses', jcil: true, generic: false },
  { feature: 'Data never used for training', jcil: true, generic: 'Varies' },
];

function CellValue({ value }: { value: string | boolean }) {
  if (value === true) {
    return (
      <svg className="w-5 h-5 text-emerald-400 mx-auto" fill="currentColor" viewBox="0 0 20 20">
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
      <svg className="w-5 h-5 text-zinc-500 mx-auto" fill="currentColor" viewBox="0 0 20 20">
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
          clipRule="evenodd"
        />
      </svg>
    );
  }
  return <span className="text-sm text-zinc-400">{value}</span>;
}

export default function ComparisonSection() {
  return (
    <Section id="comparison" className="border-y border-white/[0.04]">
      <SectionHeader
        badge="Why JCIL"
        title="How we compare"
        description="JCIL isn't just another AI wrapper. Every feature listed here is real, tested, and deployed."
      />

      <div className="max-w-4xl mx-auto">
        <div className="rounded-2xl border border-white/[0.06] overflow-hidden">
          {/* Table Header */}
          <div className="grid grid-cols-3 bg-white/[0.02]">
            <div className="px-6 py-4 text-sm font-medium text-zinc-500">Feature</div>
            <div className="px-6 py-4 text-center">
              <span className="text-sm font-bold text-white">JCIL.AI</span>
            </div>
            <div className="px-6 py-4 text-center">
              <span className="text-sm font-medium text-zinc-400">Generic AI</span>
            </div>
          </div>

          {/* Table Body */}
          {comparisons.map((row, i) => (
            <div
              key={row.feature}
              className={`grid grid-cols-3 ${i % 2 === 0 ? 'bg-zinc-950/50' : 'bg-white/[0.01]'} ${i < comparisons.length - 1 ? 'border-b border-white/[0.04]' : ''}`}
            >
              <div className="px-6 py-4 text-sm text-zinc-400">{row.feature}</div>
              <div className="px-6 py-4 flex items-center justify-center">
                <CellValue value={row.jcil} />
              </div>
              <div className="px-6 py-4 flex items-center justify-center">
                <CellValue value={row.generic} />
              </div>
            </div>
          ))}
        </div>

        <p className="text-center text-xs text-zinc-500 mt-4">
          All JCIL capabilities listed above are implemented and verified in production.
        </p>
      </div>
    </Section>
  );
}

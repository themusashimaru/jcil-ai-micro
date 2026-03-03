/**
 * TOOLS SHOWCASE SECTION
 *
 * Displays the 51 real tools organized by category
 * All tools listed are implemented and tested
 */

import Section, { SectionHeader } from './Section';

interface ToolCategory {
  name: string;
  color: string;
  tools: string[];
}

const toolCategories: ToolCategory[] = [
  {
    name: 'Core',
    color: 'amber',
    tools: ['Web Search', 'Web Scraping', 'Code Execution', 'Format Code', 'Run Code'],
  },
  {
    name: 'Web & Research',
    color: 'blue',
    tools: ['Google Search', 'URL Fetch', 'Site Crawler', 'Research Agent', 'YouTube Transcript'],
  },
  {
    name: 'Code & Dev',
    color: 'fuchsia',
    tools: ['GitHub Integration', 'Error Fixer', 'Code Refactor', 'Diff Compare', 'SQL Query'],
  },
  {
    name: 'Documents',
    color: 'green',
    tools: ['Word Generator', 'Excel Builder', 'PDF Creator', 'Table Extractor', 'PDF Manipulate'],
  },
  {
    name: 'Media & Data',
    color: 'purple',
    tools: [
      'Image Analysis',
      'Chart Creator',
      'Image Transform',
      'OCR Text Extract',
      'Audio Transcribe',
    ],
  },
  {
    name: 'Scientific',
    color: 'cyan',
    tools: ['Math Solver', 'Statistics', 'Unit Converter', 'Formula Engine'],
  },
];

const colorMap: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  amber: {
    bg: 'bg-amber-500/5',
    border: 'border-amber-500/20',
    text: 'text-amber-400',
    dot: 'bg-amber-400',
  },
  blue: {
    bg: 'bg-blue-500/5',
    border: 'border-blue-500/20',
    text: 'text-blue-400',
    dot: 'bg-blue-400',
  },
  fuchsia: {
    bg: 'bg-fuchsia-500/5',
    border: 'border-fuchsia-500/20',
    text: 'text-fuchsia-400',
    dot: 'bg-fuchsia-400',
  },
  green: {
    bg: 'bg-green-500/5',
    border: 'border-green-500/20',
    text: 'text-green-400',
    dot: 'bg-green-400',
  },
  purple: {
    bg: 'bg-purple-500/5',
    border: 'border-purple-500/20',
    text: 'text-purple-400',
    dot: 'bg-purple-400',
  },
  cyan: {
    bg: 'bg-cyan-500/5',
    border: 'border-cyan-500/20',
    text: 'text-cyan-400',
    dot: 'bg-cyan-400',
  },
};

export default function ToolsShowcase() {
  return (
    <Section id="tools" padding="lg">
      <SectionHeader
        badge="51 Real Tools"
        badgeColor="fuchsia"
        title="Every tool works. No stubs."
        description="Unlike platforms with hundreds of placeholder tools, every JCIL tool is fully implemented, tested, and production-ready."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 max-w-5xl mx-auto">
        {toolCategories.map((category) => {
          const colors = colorMap[category.color];
          return (
            <div
              key={category.name}
              className={`rounded-2xl p-6 border ${colors.border} ${colors.bg}`}
            >
              <h3 className={`text-sm font-bold uppercase tracking-wider ${colors.text} mb-4`}>
                {category.name}
              </h3>
              <div className="space-y-2">
                {category.tools.map((tool) => (
                  <div key={tool} className="flex items-center gap-2 text-sm text-slate-400">
                    <div className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
                    {tool}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-8 text-center">
        <p className="text-sm text-slate-500">
          Plus 67+ additional integrations via Composio (GitHub, Slack, Notion, Google Drive, and
          more)
        </p>
      </div>
    </Section>
  );
}

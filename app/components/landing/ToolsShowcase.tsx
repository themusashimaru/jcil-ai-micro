/**
 * TOOLS SHOWCASE SECTION
 *
 * Displays the 51 real tools organized by category with descriptions.
 * All tools listed are implemented and production-ready.
 */

import Section, { SectionHeader } from './Section';

interface Tool {
  name: string;
  description: string;
}

interface ToolCategory {
  name: string;
  color: string;
  icon: string;
  tools: Tool[];
}

const toolCategories: ToolCategory[] = [
  {
    name: 'Web & Research',
    color: 'blue',
    icon: 'search',
    tools: [
      {
        name: 'Web Search',
        description: 'Real-time search powered by Anthropic native integration',
      },
      { name: 'URL Fetch', description: 'Extract and parse content from any webpage' },
      {
        name: 'Browser Visit',
        description: 'Full Puppeteer browser for JavaScript-heavy sites',
      },
      { name: 'Screenshot', description: 'Capture full-page screenshots of any website' },
      { name: 'Web Capture', description: 'Advanced page capture with metadata extraction' },
      {
        name: 'Parallel Research',
        description: 'Launch multiple AI agents to research complex topics simultaneously',
      },
      {
        name: 'YouTube Transcript',
        description: 'Extract and analyze transcripts from YouTube videos',
      },
    ],
  },
  {
    name: 'Code & Development',
    color: 'fuchsia',
    icon: 'code',
    tools: [
      { name: 'Code Execution', description: 'Run Python and JavaScript in a secure E2B sandbox' },
      { name: 'GitHub Integration', description: 'Read repos, issues, PRs, and commit history' },
      { name: 'Error Fixer', description: 'Analyze stack traces and suggest targeted fixes' },
      { name: 'Code Refactor', description: 'Restructure code for readability and performance' },
      { name: 'Format Code', description: 'Auto-format with Prettier across 20+ languages' },
      { name: 'Diff Compare', description: 'Side-by-side comparison of code or text changes' },
      { name: 'SQL Query', description: 'Build, explain, and optimize SQL queries' },
      { name: 'HTTP Request', description: 'Make API calls and inspect responses' },
    ],
  },
  {
    name: 'Documents',
    color: 'green',
    icon: 'document',
    tools: [
      {
        name: 'Word Generator',
        description: 'Create professional .docx files with formatting and styles',
      },
      {
        name: 'Excel Builder',
        description: 'Generate spreadsheets with formulas, charts, and data validation',
      },
      {
        name: 'PDF Creator',
        description: 'Build polished PDF reports, invoices, and certificates',
      },
      {
        name: 'PowerPoint Builder',
        description: 'Create slide decks with layouts, themes, and speaker notes',
      },
      { name: 'PDF Extractor', description: 'Pull text and data from uploaded PDF documents' },
      {
        name: 'Table Extractor',
        description: 'Extract structured data from images and screenshots',
      },
      { name: 'File Converter', description: 'Convert between document formats seamlessly' },
    ],
  },
  {
    name: 'Media & Vision',
    color: 'purple',
    icon: 'media',
    tools: [
      {
        name: 'Image Analysis',
        description: 'AI vision to understand photos, charts, and screenshots',
      },
      { name: 'Chart Creator', description: 'Generate data visualizations and interactive charts' },
      { name: 'Image Transform', description: 'Resize, crop, compress, and convert images' },
      {
        name: 'OCR Text Extract',
        description: 'Read text from images, documents, and handwriting',
      },
      { name: 'Audio Transcribe', description: 'Convert speech to text from audio files' },
      { name: 'Media Process', description: 'Manipulate audio and video files' },
      { name: 'QR & Barcode', description: 'Generate and read QR codes and barcodes' },
    ],
  },
  {
    name: 'Data & Analytics',
    color: 'amber',
    icon: 'data',
    tools: [
      { name: 'Math Compute', description: 'Solve equations, calculus, linear algebra, and more' },
      { name: 'Statistics', description: 'Run statistical analysis on datasets' },
      { name: 'Unit Converter', description: 'Convert between any measurement units' },
      {
        name: 'NLP Analysis',
        description: 'Sentiment analysis, entity extraction, and text processing',
      },
      { name: 'Data Validator', description: 'Validate JSON, XML, email, and custom schemas' },
      { name: 'Link Shortener', description: 'Create short URLs for sharing' },
    ],
  },
  {
    name: 'Security & Specialized',
    color: 'cyan',
    icon: 'security',
    tools: [
      { name: 'Crypto Toolkit', description: 'Encrypt, decrypt, hash, and generate JWT tokens' },
      { name: 'Password Analyzer', description: 'Check password strength and security' },
      { name: 'Phone Validator', description: 'Validate and format international phone numbers' },
      { name: 'Accessibility Check', description: 'Audit content for WCAG compliance' },
      {
        name: 'Color Tools',
        description: 'Convert color spaces, generate palettes, check contrast',
      },
      { name: 'Cron Explain', description: 'Parse and explain cron schedule expressions' },
    ],
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
  const totalTools = toolCategories.reduce((sum, cat) => sum + cat.tools.length, 0);

  return (
    <Section id="tools" padding="lg">
      <SectionHeader
        badge={`${totalTools}+ Real Tools`}
        badgeColor="fuchsia"
        title="Every tool works. No stubs."
        description="Unlike platforms with hundreds of placeholder tools, every JCIL tool is fully implemented, tested, and production-ready. Here's what your AI can actually do."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 max-w-6xl mx-auto">
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
              <div className="space-y-3">
                {category.tools.map((tool) => (
                  <div key={tool.name} className="flex items-start gap-2">
                    <div className={`w-1.5 h-1.5 rounded-full ${colors.dot} mt-1.5 shrink-0`} />
                    <div>
                      <span className="text-sm font-medium text-slate-300">{tool.name}</span>
                      <p className="text-xs text-slate-500 leading-relaxed">{tool.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-8 text-center space-y-2">
        <p className="text-sm text-slate-500">
          Plus 67+ additional integrations via Composio (GitHub, Slack, Notion, Google Drive, and
          more)
        </p>
        <p className="text-xs text-slate-600">
          All tools are powered by Claude Sonnet 4.6 with secure sandboxed execution
        </p>
      </div>
    </Section>
  );
}

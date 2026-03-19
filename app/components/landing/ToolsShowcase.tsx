/**
 * TOOLS SHOWCASE SECTION
 *
 * Displays the 91 real tools organized by category.
 * Composio-inspired clean grid with unified styling.
 */

import Section, { SectionHeader } from './Section';

interface Tool {
  name: string;
  description: string;
}

interface ToolCategory {
  name: string;
  tools: Tool[];
}

const toolCategories: ToolCategory[] = [
  {
    name: 'Web & Research',
    tools: [
      {
        name: 'Web Search',
        description: 'Real-time search powered by Anthropic native integration',
      },
      { name: 'URL Fetch', description: 'Extract and parse content from any webpage' },
      { name: 'Browser Visit', description: 'Full Puppeteer browser for JavaScript-heavy sites' },
      { name: 'Screenshot', description: 'Capture full-page screenshots of any website' },
      { name: 'Web Capture', description: 'Advanced page capture with metadata extraction' },
      {
        name: 'Parallel Research',
        description:
          'Launch multiple agents with real web search to research complex topics simultaneously',
      },
      {
        name: 'YouTube Transcript',
        description: 'Extract and analyze transcripts from YouTube videos',
      },
    ],
  },
  {
    name: 'Code & Development',
    tools: [
      { name: 'Code Execution', description: 'Run Python and JavaScript in a secure E2B sandbox' },
      { name: 'GitHub Integration', description: 'Read repos, issues, PRs, and commit history' },
      { name: 'Error Fixer', description: 'Analyze stack traces and suggest targeted fixes' },
      { name: 'Code Refactor', description: 'Restructure code for readability and performance' },
      { name: 'Format Code', description: 'Auto-format with Prettier across 20+ languages' },
      { name: 'Diff Compare', description: 'Side-by-side comparison of code or text changes' },
      { name: 'SQL Query', description: 'Build, explain, and optimize SQL queries' },
      { name: 'HTTP Request', description: 'Make API calls and inspect responses' },
      { name: 'Dynamic Tool', description: 'Create and run custom tools on the fly' },
    ],
  },
  {
    name: 'Documents',
    tools: [
      {
        name: 'Document Generator',
        description: 'Create Word, PDF, and PowerPoint files with professional formatting',
      },
      {
        name: 'Spreadsheet Builder',
        description: 'Generate spreadsheets with formulas, charts, and data validation',
      },
      {
        name: 'Excel Advanced',
        description: 'Pivot tables, conditional formatting, and complex workbooks',
      },
      { name: 'PDF Extractor', description: 'Pull text and data from uploaded PDF documents' },
      { name: 'PDF Tools', description: 'Rotate, encrypt, merge, add watermarks and form fields' },
      {
        name: 'Table Extractor',
        description: 'Extract structured data from images and screenshots',
      },
      { name: 'File Converter', description: 'Convert between document formats seamlessly' },
    ],
  },
  {
    name: 'Media & Creative',
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
      { name: 'QR Generator', description: 'Create QR codes for URLs, text, and data' },
      { name: 'Barcode Generator', description: 'Generate barcodes in multiple standard formats' },
      { name: 'Image Metadata', description: 'Read and edit EXIF data from photos' },
      { name: '3D Graphics', description: 'Generate and render 3D scenes and objects' },
      { name: 'Hough Vision', description: 'Detect lines, circles, and shapes in images' },
      { name: 'Ray Tracing', description: 'Photorealistic rendering with light simulation' },
    ],
  },
  {
    name: 'Data & Analytics',
    tools: [
      {
        name: 'NLP Analysis',
        description: 'Sentiment analysis, entity extraction, and text processing',
      },
      { name: 'Data Validator', description: 'Validate JSON, XML, email, and custom schemas' },
      { name: 'Link Shortener', description: 'Create short URLs for sharing' },
      { name: 'Fake Data Generator', description: 'Generate realistic test data for development' },
      { name: 'Geospatial', description: 'Distance calculations, geocoding, and map analysis' },
      { name: 'Search Index', description: 'Full-text search indexing and querying' },
      { name: 'Zip Files', description: 'Compress and extract file archives' },
      { name: 'Signal Processing', description: 'FFT, filtering, and waveform analysis' },
      {
        name: 'Sequence Analysis',
        description: 'Analyze patterns in sequential and time-series data',
      },
    ],
  },
  {
    name: 'Security & Science',
    tools: [
      { name: 'Crypto Toolkit', description: 'Encrypt, decrypt, hash, and generate JWT tokens' },
      { name: 'Phone Validator', description: 'Validate and format international phone numbers' },
      { name: 'Accessibility Check', description: 'Audit content for WCAG compliance' },
      {
        name: 'Constraint Solver',
        description: 'Solve optimization and constraint satisfaction problems',
      },
      { name: 'Grammar Parser', description: 'Parse structured text with custom grammar rules' },
      { name: 'DNA Sequencer', description: 'Analyze and compare biological sequences' },
      { name: 'Medical Calculator', description: 'Clinical calculations and health metric tools' },
    ],
  },
];

export default function ToolsShowcase() {
  const totalTools = toolCategories.reduce((sum, cat) => sum + cat.tools.length, 0);

  return (
    <Section id="tools">
      <SectionHeader
        badge={`${totalTools}+ Orchestrated Tools`}
        title="Every tool works. They work together."
        description="Every tool listed below has a real implementation. Research feeds into charts, charts embed into presentations, images flow into documents. Not stubs — production code with artifact tracking."
      />

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {toolCategories.map((category) => (
          <div
            key={category.name}
            className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6"
          >
            <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-400 mb-4">
              {category.name}
            </h3>
            <div className="space-y-3">
              {category.tools.map((tool) => (
                <div key={tool.name} className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-violet-400/60 mt-1.5 shrink-0" />
                  <div>
                    <span className="text-sm font-medium text-zinc-300">{tool.name}</span>
                    <p className="text-xs text-zinc-500 leading-relaxed">{tool.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-10 text-center space-y-2">
        <p className="text-sm text-zinc-500">
          Plus 67+ additional integrations via Composio — and FLUX.2 AI image generation by Black
          Forest Labs
        </p>
        <p className="text-xs text-zinc-500">
          All tools chain together via artifact tracking. Powered by Claude Sonnet 4.6 with parallel
          execution.
        </p>
      </div>
    </Section>
  );
}

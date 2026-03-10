import Link from 'next/link';

export const metadata = {
  title: 'Capabilities | JCIL.AI',
  description: '51 real tools, 6 AI agents, multi-model support. Every tool listed here works in production.',
};

const TOOL_CATEGORIES = [
  {
    title: 'Code Execution & Development',
    tag: 'DEV',
    description: 'Full IDE capabilities powered by E2B sandboxed containers. Write, run, debug, and deploy — all in the browser.',
    tools: [
      { name: 'run_code', desc: 'Execute Python, JavaScript, TypeScript, and shell commands in isolated E2B sandboxes' },
      { name: 'error_fixer', desc: 'AI-powered error detection — automatically diagnoses and fixes code issues' },
      { name: 'refactor', desc: 'Intelligent code refactoring with pattern recognition' },
      { name: 'prettier', desc: 'Auto-format code to consistent style standards' },
      { name: 'github', desc: 'Full GitHub integration — search repos, browse files, manage issues and PRs' },
      { name: 'mini_agent', desc: 'Multi-step orchestrator for complex development workflows' },
    ],
  },
  {
    title: 'Document Generation',
    tag: 'DOCS',
    description: 'Generate real documents from natural language. Word, Excel, PDF, PowerPoint — with formulas, formatting, and templates.',
    tools: [
      { name: 'generate_document', desc: 'Create Word documents, contracts, reports, and proposals' },
      { name: 'spreadsheet', desc: 'Excel files with formulas, charts, and multiple sheets' },
      { name: 'excel', desc: 'Advanced Excel operations — pivot tables, conditional formatting, macros' },
      { name: 'presentation', desc: 'PowerPoint slide decks with layouts, themes, and speaker notes' },
      { name: 'pdf', desc: 'PDF creation, manipulation, and form filling' },
      { name: 'pdf_extract', desc: 'Extract text, tables, and data from existing PDFs' },
      { name: 'extract_table', desc: 'Pull structured table data from any document format' },
      { name: 'mail_merge', desc: 'Batch document generation from templates + data sources' },
      { name: 'document_templates', desc: 'Pre-built business document templates (invoices, contracts, NDAs)' },
      { name: 'email_templates', desc: 'HTML email templates with responsive layouts' },
    ],
  },
  {
    title: 'Web & Research',
    tag: 'WEB',
    description: 'Real-time web search, URL fetching, and interactive browsing. Powered by Anthropic native search.',
    tools: [
      { name: 'web_search', desc: 'Anthropic native web search with dynamic result filtering' },
      { name: 'fetch_url', desc: 'Fetch and extract content from any URL' },
      { name: 'browser_visit', desc: 'Puppeteer-powered interactive web browsing and scraping' },
    ],
  },
  {
    title: 'Image & Vision',
    tag: 'VISION',
    description: 'Analyze images with Claude Vision, capture screenshots, extract text, and process visual data.',
    tools: [
      { name: 'analyze_image', desc: 'Claude Vision — describe, analyze, and extract information from images' },
      { name: 'screenshot', desc: 'Capture screenshots of any webpage via Puppeteer' },
      { name: 'web_capture', desc: 'Full-page webpage capture with scroll stitching' },
      { name: 'ocr', desc: 'Extract text from images using Tesseract.js OCR engine' },
      { name: 'hough_vision', desc: 'Computer vision — edge detection, line detection, shape analysis' },
      { name: 'ray_tracing', desc: '3D scene rendering with ray tracing algorithms' },
    ],
  },
  {
    title: 'Media & Files',
    tag: 'MEDIA',
    description: 'Process audio, video, and files. Transcribe, convert, compress, and manipulate any format.',
    tools: [
      { name: 'media', desc: 'Audio and video processing with FFmpeg.js — trim, convert, compress' },
      { name: 'audio_transcribe', desc: 'Transcribe audio files to text using Whisper' },
      { name: 'youtube_transcript', desc: 'Extract transcripts from YouTube videos' },
      { name: 'file_convert', desc: 'Convert between file formats — CSV, JSON, XML, YAML, and more' },
      { name: 'zip', desc: 'Create, extract, and manipulate ZIP archives' },
      { name: 'exif', desc: 'Read and extract image metadata (EXIF, IPTC, XMP)' },
      { name: 'barcode', desc: 'Generate barcodes in multiple formats (Code128, EAN, UPC)' },
    ],
  },
  {
    title: 'Data & Text Processing',
    tag: 'DATA',
    description: 'Transform, validate, visualize, and analyze structured and unstructured data.',
    tools: [
      { name: 'qr_code', desc: 'Generate QR codes with custom styling and embedded logos' },
      { name: 'link_shorten', desc: 'Shorten URLs for sharing and tracking' },
      { name: 'diff', desc: 'Compare text and code with side-by-side diff output' },
      { name: 'nlp', desc: 'Natural language processing — sentiment, entities, summarization' },
      { name: 'search_index', desc: 'Build full-text search indexes with Lunr.js' },
      { name: 'parser', desc: 'Grammar-based parsing for structured text extraction' },
      { name: 'sequence_analyze', desc: 'Sequence analysis — patterns, statistics, string operations' },
      { name: 'http_request', desc: 'Make HTTP API calls, webhooks, and REST requests' },
      { name: 'chart', desc: 'Generate data visualizations — bar, line, pie, scatter charts' },
    ],
  },
  {
    title: 'Graphics & Imaging',
    tag: 'GFX',
    description: 'Manipulate images, generate 3D graphics, and create visual content programmatically.',
    tools: [
      { name: 'image_transform', desc: 'Resize, compress, convert, crop, and watermark images' },
      { name: 'graphics_3d', desc: '3D graphics and modeling operations' },
      { name: 'dynamic_tool', desc: 'Create custom tools on-the-fly for specialized operations' },
    ],
  },
  {
    title: 'Database & Security',
    tag: 'DB',
    description: 'Query databases, validate data, handle cryptography, and generate test data.',
    tools: [
      { name: 'sql', desc: 'Execute SQL queries with SQL.js — in-memory relational database' },
      { name: 'validator', desc: 'Validate emails, URLs, phone numbers, credit cards, and more' },
      { name: 'crypto', desc: 'JWT signing, encryption, hashing, and key generation' },
      { name: 'fake_data', desc: 'Generate realistic test data — names, addresses, companies, dates' },
    ],
  },
  {
    title: 'Scientific & Specialized',
    tag: 'SCI',
    description: 'Domain-specific tools for geography, biology, signal processing, accessibility, and healthcare.',
    tools: [
      { name: 'geospatial', desc: 'Geographic calculations — distances, areas, intersections with Turf.js' },
      { name: 'phone', desc: 'Phone number validation, formatting, and carrier lookup' },
      { name: 'dna_bio', desc: 'DNA/RNA sequence analysis — transcription, translation, GC content' },
      { name: 'signal', desc: 'Signal processing — FFT, filtering, spectral analysis' },
      { name: 'accessibility', desc: 'Web accessibility auditing with axe-core (WCAG compliance)' },
      { name: 'medical_calc', desc: 'Medical calculators — BMI, dosage, lab value interpretation' },
    ],
  },
];

export default function CapabilitiesPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="grid-bg fixed inset-0 opacity-30" aria-hidden="true" />

      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-sm bg-background/80 border-b border-border/30">
        <div className="max-w-6xl mx-auto px-6 md:px-12 py-4">
          <nav className="flex items-center justify-between">
            <Link href="/" className="font-bebas text-2xl tracking-tight">
              <span className="text-accent">JCIL</span>
              <span className="text-muted-foreground">.AI</span>
            </Link>
            <div className="flex items-center gap-6">
              <Link href="/docs" className="font-mono text-xs text-muted-foreground hover:text-foreground transition-colors uppercase tracking-widest">
                Docs
              </Link>
              <Link href="/chat" className="border border-accent bg-accent/10 px-4 py-2 font-mono text-xs uppercase tracking-widest text-accent hover:bg-accent/20 transition-all">
                Try Free
              </Link>
            </div>
          </nav>
        </div>
      </header>

      <main className="relative z-10 max-w-6xl mx-auto px-6 md:px-12 py-16">
        {/* Hero */}
        <div className="mb-20">
          <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-accent">Platform</span>
          <h1 className="mt-4 font-bebas text-5xl md:text-8xl tracking-tight">51 REAL TOOLS</h1>
          <p className="mt-6 max-w-2xl font-mono text-sm text-muted-foreground leading-relaxed">
            Every tool listed here has a real implementation. No stubs. No demos. No vaporware.
            These are production tools that execute real operations — from generating Excel files with formulas
            to running Python in sandboxed containers.
          </p>

          {/* Stats */}
          <div className="mt-10 flex flex-wrap gap-8 md:gap-16">
            <div>
              <span className="font-bebas text-4xl md:text-5xl text-accent">51</span>
              <span className="block font-mono text-[10px] uppercase tracking-widest text-muted-foreground mt-1">Real Tools</span>
            </div>
            <div>
              <span className="font-bebas text-4xl md:text-5xl text-accent">6</span>
              <span className="block font-mono text-[10px] uppercase tracking-widest text-muted-foreground mt-1">AI Agents</span>
            </div>
            <div>
              <span className="font-bebas text-4xl md:text-5xl text-accent">5</span>
              <span className="block font-mono text-[10px] uppercase tracking-widest text-muted-foreground mt-1">LLM Providers</span>
            </div>
            <div>
              <span className="font-bebas text-4xl md:text-5xl text-accent">67+</span>
              <span className="block font-mono text-[10px] uppercase tracking-widest text-muted-foreground mt-1">App Integrations</span>
            </div>
          </div>
        </div>

        {/* LLM Providers */}
        <div className="mb-20 border border-border/40 bg-card/50 backdrop-blur-sm p-8 md:p-12">
          <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-accent">Multi-Model</span>
          <h2 className="mt-4 font-bebas text-3xl md:text-5xl tracking-tight">CHOOSE YOUR MODEL</h2>
          <p className="mt-4 max-w-xl font-mono text-xs text-muted-foreground leading-relaxed">
            Default: Anthropic Claude Sonnet 4.6. Switch between providers with BYOK (Bring Your Own Key).
          </p>
          <div className="mt-8 grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { name: 'Claude', provider: 'Anthropic', note: 'Default' },
              { name: 'GPT', provider: 'OpenAI', note: 'BYOK' },
              { name: 'Gemini', provider: 'Google', note: 'BYOK' },
              { name: 'Grok', provider: 'xAI', note: 'BYOK' },
              { name: 'DeepSeek', provider: 'DeepSeek', note: 'BYOK' },
            ].map((model) => (
              <div key={model.name} className="border border-border/30 p-4">
                <span className="font-bebas text-2xl tracking-tight text-foreground">{model.name}</span>
                <span className="block font-mono text-[10px] text-muted-foreground mt-1">{model.provider}</span>
                <span className={`inline-block mt-2 font-mono text-[9px] uppercase tracking-widest px-2 py-0.5 ${model.note === 'Default' ? 'text-accent border border-accent/30' : 'text-muted-foreground border border-border/30'}`}>
                  {model.note}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Tool Categories */}
        {TOOL_CATEGORIES.map((category, catIdx) => (
          <div key={category.tag} className="mb-16">
            <div className="flex items-baseline gap-4 mb-6">
              <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-accent">
                {String(catIdx + 1).padStart(2, '0')} / {category.tag}
              </span>
            </div>
            <h2 className="font-bebas text-3xl md:text-4xl tracking-tight mb-3">{category.title.toUpperCase()}</h2>
            <p className="font-mono text-xs text-muted-foreground leading-relaxed max-w-2xl mb-8">
              {category.description}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-border/20">
              {category.tools.map((tool) => (
                <div key={tool.name} className="bg-background p-5 border border-border/10">
                  <code className="font-mono text-xs text-accent">{tool.name}</code>
                  <p className="mt-2 font-mono text-xs text-muted-foreground leading-relaxed">{tool.desc}</p>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Integrations */}
        <div className="mb-20 border border-border/40 bg-card/50 backdrop-blur-sm p-8 md:p-12">
          <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-accent">Composio (SOC 2 Certified)</span>
          <h2 className="mt-4 font-bebas text-3xl md:text-5xl tracking-tight">67+ APP INTEGRATIONS</h2>
          <p className="mt-4 max-w-xl font-mono text-xs text-muted-foreground leading-relaxed">
            Connect JCIL to the tools you already use. Powered by Composio — a SOC 2 certified integration platform.
            These are real, production connections — not stubs.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            {['GitHub', 'Slack', 'Google Drive', 'Gmail', 'Google Sheets', 'Google Calendar', 'Notion', 'Trello', 'Jira', 'Linear', 'Salesforce', 'HubSpot', 'Stripe', 'Twilio', 'Discord', 'Asana', 'Airtable', 'Figma', 'Dropbox', 'OneDrive'].map((app) => (
              <span key={app} className="border border-border/30 px-3 py-1.5 font-mono text-[10px] text-foreground/70 uppercase tracking-wider">
                {app}
              </span>
            ))}
            <span className="border border-accent/30 px-3 py-1.5 font-mono text-[10px] text-accent uppercase tracking-wider">
              + 47 More
            </span>
          </div>
        </div>

        {/* API Coming Soon */}
        <div className="mb-20 border border-accent/30 bg-accent/5 p-8 md:p-12">
          <div className="flex items-center gap-3 mb-4">
            <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-accent">Coming Soon</span>
            <span className="border border-accent/30 px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest text-accent">API</span>
          </div>
          <h2 className="font-bebas text-3xl md:text-5xl tracking-tight">JCIL.AI FOR YOUR ORGANIZATION</h2>
          <p className="mt-4 max-w-2xl font-mono text-xs text-muted-foreground leading-relaxed">
            Embed JCIL.AI directly into your church website, school portal, or business platform.
            Provide your community with safe, values-aligned AI — customized to your denomination,
            your organization&apos;s voice, and your specific needs. Full API access with your own branding.
          </p>
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="border border-border/30 p-5">
              <span className="font-bebas text-xl tracking-tight text-foreground">Churches</span>
              <p className="mt-2 font-mono text-[10px] text-muted-foreground leading-relaxed">
                Denomination-specific AI for your congregation. Scripture-grounded, theologically sound, safe for all ages.
              </p>
            </div>
            <div className="border border-border/30 p-5">
              <span className="font-bebas text-xl tracking-tight text-foreground">Schools</span>
              <p className="mt-2 font-mono text-[10px] text-muted-foreground leading-relaxed">
                AI tutoring that aligns with your institution&apos;s values. Content-filtered, age-appropriate, curriculum-aware.
              </p>
            </div>
            <div className="border border-border/30 p-5">
              <span className="font-bebas text-xl tracking-tight text-foreground">Businesses</span>
              <p className="mt-2 font-mono text-[10px] text-muted-foreground leading-relaxed">
                White-label AI assistant for your platform. Your brand, your voice, powered by enterprise-grade tooling.
              </p>
            </div>
          </div>
          <div className="mt-8">
            <Link href="/contact" className="inline-block border border-accent bg-accent/10 px-8 py-4 font-mono text-sm uppercase tracking-widest text-accent hover:bg-accent/20 transition-all">
              Get Early Access
            </Link>
          </div>
        </div>

        {/* CTA */}
        <div className="pt-16 border-t border-border/30">
          <h2 className="font-bebas text-3xl md:text-5xl tracking-tight mb-4">READY TO START?</h2>
          <p className="font-mono text-xs text-muted-foreground mb-8">No credit card required. Full capabilities from day one.</p>
          <div className="flex flex-wrap gap-4">
            <Link href="/chat" className="inline-block border border-accent bg-accent/10 px-8 py-4 font-mono text-sm uppercase tracking-widest text-accent hover:bg-accent/20 transition-all">
              Start Free
            </Link>
            <Link href="/code-lab" className="inline-block border border-foreground/20 px-8 py-4 font-mono text-sm uppercase tracking-widest text-foreground hover:border-foreground/40 transition-all">
              Open Code Lab
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border/30 py-8 mt-16">
        <div className="max-w-6xl mx-auto px-6 md:px-12 text-center">
          <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
            &copy; {new Date().getFullYear()} JCIL.AI. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}

import Link from 'next/link';

export const metadata = {
  title: 'Capabilities | JCIL.AI',
  description: '91 real tools, multi-model support. Every tool listed here works in production.',
};

const TOOL_CATEGORIES = [
  {
    title: 'Web & Browsing',
    tag: 'WEB',
    description: 'Real-time web search, URL fetching, interactive browsing, and API integrations. Powered by Anthropic native search and Puppeteer.',
    tools: [
      { name: 'web_search', desc: 'Anthropic native web search with dynamic result filtering' },
      { name: 'fetch_url', desc: 'Fetch and extract content from any URL' },
      { name: 'browser_visit', desc: 'Puppeteer-powered interactive web browsing and scraping' },
      { name: 'desktop_sandbox', desc: 'Full desktop sandbox environment for browser automation' },
      { name: 'youtube_transcript', desc: 'Extract transcripts and metadata from YouTube videos' },
      { name: 'github', desc: 'Full GitHub integration — search repos, browse files, manage issues and PRs' },
      { name: 'http_request', desc: 'Make HTTP API calls, webhooks, and REST requests' },
      { name: 'shorten_link', desc: 'Shorten URLs for sharing and tracking' },
    ],
  },
  {
    title: 'Code & Execution',
    tag: 'DEV',
    description: 'Full IDE capabilities powered by E2B sandboxed containers. Write, run, debug, refactor, and test — all in the browser.',
    tools: [
      { name: 'run_code', desc: 'Execute Python, JavaScript, TypeScript, and shell commands in isolated E2B sandboxes' },
      { name: 'create_and_run_tool', desc: 'Dynamically create and execute custom tools on-the-fly' },
      { name: 'fix_error', desc: 'AI-powered error detection — automatically diagnoses and fixes code issues' },
      { name: 'refactor_code', desc: 'Intelligent code refactoring with pattern recognition' },
      { name: 'format_code', desc: 'Auto-format code to consistent style standards' },
      { name: 'diff_compare', desc: 'Compare text and code with side-by-side diff output' },
      { name: 'query_data_sql', desc: 'Execute SQL queries with SQL.js — in-memory relational database' },
      { name: 'sandbox_files', desc: 'Read, write, and manage files within the sandbox environment' },
      { name: 'sandbox_test_runner', desc: 'Run test suites inside sandboxed containers with full output' },
      { name: 'sandbox_template', desc: 'Bootstrap projects from pre-built sandbox templates' },
    ],
  },
  {
    title: 'Documents & Office',
    tag: 'DOCS',
    description: 'Generate real documents from natural language. Word, Excel, PDF, PowerPoint — with formulas, formatting, and templates.',
    tools: [
      { name: 'create_document', desc: 'Create Word documents, contracts, reports, and proposals' },
      { name: 'create_presentation', desc: 'PowerPoint slide decks with layouts, themes, and speaker notes' },
      { name: 'excel_advanced', desc: 'Advanced Excel operations — pivot tables, conditional formatting, macros' },
      { name: 'pdf_manipulate', desc: 'PDF creation, manipulation, merging, splitting, and form filling' },
      { name: 'extract_pdf', desc: 'Extract text, tables, and structured data from existing PDFs' },
      { name: 'extract_table', desc: 'Pull structured table data from any document format' },
      { name: 'create_email_template', desc: 'HTML email templates with responsive layouts' },
      { name: 'document_template', desc: 'Pre-built business document templates (invoices, contracts, NDAs)' },
      { name: 'mail_merge', desc: 'Batch document generation from templates + data sources' },
      { name: 'calendar_event', desc: 'Generate calendar events and ICS files' },
      { name: 'draft_email', desc: 'Draft professional emails from natural language prompts' },
      { name: 'build_resume', desc: 'Generate polished resumes and CVs from structured input' },
      { name: 'generate_invoice', desc: 'Create itemized invoices with tax calculations and branding' },
      { name: 'create_flashcards', desc: 'Generate study flashcard decks from any topic or content' },
    ],
  },
  {
    title: 'Business & Strategy',
    tag: 'BIZ',
    description: 'Strategic planning, operational frameworks, and business analysis tools. From SWOT to SOPs — all generated from natural language.',
    tools: [
      { name: 'create_swot_analysis', desc: 'Generate SWOT analysis with strengths, weaknesses, opportunities, and threats' },
      { name: 'create_business_canvas', desc: 'Build a Business Model Canvas with all nine components' },
      { name: 'create_okr_plan', desc: 'Create OKR plans with objectives, key results, and milestones' },
      { name: 'create_meeting_minutes', desc: 'Generate structured meeting minutes with action items' },
      { name: 'create_sop', desc: 'Write standard operating procedures with step-by-step instructions' },
      { name: 'create_raci_matrix', desc: 'Build RACI matrices for project role assignment and accountability' },
      { name: 'create_risk_assessment', desc: 'Assess project risks with likelihood, impact, and mitigation plans' },
      { name: 'create_proposal', desc: 'Draft business proposals with scope, timeline, and pricing' },
      { name: 'decision_matrix', desc: 'Weighted decision matrix for comparing options objectively' },
      { name: 'project_timeline', desc: 'Generate project timelines and Gantt-style schedules' },
      { name: 'plan_event', desc: 'Plan events with checklists, timelines, and vendor coordination' },
      { name: 'content_calendar', desc: 'Build content calendars with topics, dates, and channels' },
    ],
  },
  {
    title: 'Education & Teaching',
    tag: 'EDU',
    description: 'Curriculum design and teaching tools. Create lesson plans, rubrics, quizzes, and training materials aligned to standards.',
    tools: [
      { name: 'create_lesson_plan', desc: 'Generate lesson plans with objectives, activities, and assessments' },
      { name: 'create_rubric', desc: 'Build grading rubrics with criteria, levels, and point values' },
      { name: 'create_quiz', desc: 'Create quizzes with multiple choice, short answer, and essay questions' },
      { name: 'create_training_manual', desc: 'Write training manuals with modules, exercises, and evaluations' },
    ],
  },
  {
    title: 'Legal & Compliance',
    tag: 'LEGAL',
    description: 'Generate legal documents and compliance frameworks. Contracts, policies, and regulatory templates.',
    tools: [
      { name: 'create_contract', desc: 'Draft contracts with clauses, terms, and signature blocks' },
      { name: 'create_policy_document', desc: 'Create organizational policies with scope, procedures, and enforcement' },
    ],
  },
  {
    title: 'HR & Management',
    tag: 'HR',
    description: 'Human resources document generation. Performance reviews, job postings, and workforce management tools.',
    tools: [
      { name: 'create_performance_review', desc: 'Generate performance reviews with ratings, feedback, and goals' },
      { name: 'create_job_description', desc: 'Write job descriptions with requirements, responsibilities, and qualifications' },
    ],
  },
  {
    title: 'Marketing & Communications',
    tag: 'MKTG',
    description: 'Marketing collateral and communications. Press releases, case studies, and brand messaging.',
    tools: [
      { name: 'create_press_release', desc: 'Draft press releases with headline, quotes, and boilerplate' },
      { name: 'create_case_study', desc: 'Build case studies with challenge, solution, and measurable results' },
    ],
  },
  {
    title: 'Nonprofit & Grants',
    tag: 'GRANT',
    description: 'Grant writing and nonprofit documentation. Proposals formatted to funder requirements.',
    tools: [
      { name: 'create_grant_proposal', desc: 'Write grant proposals with needs statement, budget, and evaluation plan' },
    ],
  },
  {
    title: 'Real Estate',
    tag: 'REALTY',
    description: 'Real estate document generation. Property listings with descriptions, features, and comparables.',
    tools: [
      { name: 'create_property_listing', desc: 'Generate property listings with descriptions, photos, and pricing details' },
    ],
  },
  {
    title: 'Healthcare',
    tag: 'HEALTH',
    description: 'Healthcare documentation tools. Care plans, patient resources, and clinical templates.',
    tools: [
      { name: 'create_care_plan', desc: 'Create patient care plans with goals, interventions, and outcomes' },
    ],
  },
  {
    title: 'Personal Planning',
    tag: 'PLAN',
    description: 'Personal productivity and life planning tools. Travel, nutrition, and financial planning from natural language.',
    tools: [
      { name: 'plan_trip', desc: 'Plan trips with itineraries, accommodations, and cost estimates' },
      { name: 'meal_planner', desc: 'Generate meal plans with recipes, nutrition info, and grocery lists' },
      { name: 'budget_calculator', desc: 'Build personal or project budgets with income, expenses, and projections' },
    ],
  },
  {
    title: 'Scripture & Ministry',
    tag: 'FAITH',
    description: 'Faith-based tools for churches, pastors, and ministry leaders. Scripture-grounded, theologically sound.',
    tools: [
      { name: 'scripture_reference', desc: 'Look up Bible verses, passages, and cross-references across translations' },
      { name: 'sermon_outline', desc: 'Generate sermon outlines with Scripture, illustrations, and application points' },
      { name: 'prayer_journal', desc: 'Create structured prayer journal entries with prompts and reflection' },
      { name: 'daily_devotional', desc: 'Generate daily devotionals with Scripture, commentary, and prayer' },
      { name: 'small_group_guide', desc: 'Build small group study guides with discussion questions and activities' },
      { name: 'create_church_budget', desc: 'Create church budgets with ministry allocations and giving projections' },
    ],
  },
  {
    title: 'Media & Vision',
    tag: 'MEDIA',
    description: 'Image analysis, media processing, data visualization, and computer vision. From OCR to 3D rendering.',
    tools: [
      { name: 'analyze_image', desc: 'Claude Vision — describe, analyze, and extract information from images' },
      { name: 'transform_image', desc: 'Resize, compress, convert, crop, and watermark images' },
      { name: 'create_chart', desc: 'Generate data visualizations — bar, line, pie, scatter charts' },
      { name: 'e2b_visualize', desc: 'Run data visualizations in sandboxed Python with matplotlib and plotly' },
      { name: 'ocr_extract_text', desc: 'Extract text from images using Tesseract.js OCR engine' },
      { name: 'transcribe_audio', desc: 'Transcribe audio files to text with timestamps' },
      { name: 'media_process', desc: 'Audio and video processing with FFmpeg — trim, convert, compress' },
      { name: 'image_metadata', desc: 'Read and extract image metadata (EXIF, IPTC, XMP)' },
      { name: 'generate_qr_code', desc: 'Generate QR codes with custom styling and embedded logos' },
      { name: 'generate_barcode', desc: 'Generate barcodes in multiple formats (Code128, EAN, UPC)' },
      { name: 'graphics_3d', desc: '3D graphics and scene rendering with ray tracing algorithms' },
    ],
  },
  {
    title: 'Data & Utilities',
    tag: 'DATA',
    description: 'Data generation, validation, transformation, and indexing. Utilities for everyday data operations.',
    tools: [
      { name: 'generate_fake_data', desc: 'Generate realistic test data — names, addresses, companies, dates' },
      { name: 'validate_data', desc: 'Validate emails, URLs, phone numbers, credit cards, and schemas' },
      { name: 'convert_file', desc: 'Convert between file formats — CSV, JSON, XML, YAML, and more' },
      { name: 'zip_files', desc: 'Create, extract, and manipulate ZIP archives' },
      { name: 'search_index', desc: 'Build full-text search indexes with Lunr.js' },
      { name: 'analyze_text_nlp', desc: 'Natural language processing — sentiment, entities, summarization' },
    ],
  },
  {
    title: 'Scientific & Math',
    tag: 'SCI',
    description: 'Domain-specific tools for geography, biology, signal processing, sequence analysis, and medical calculations.',
    tools: [
      { name: 'geo_calculate', desc: 'Geographic calculations — distances, areas, intersections with Turf.js' },
      { name: 'analyze_sequence', desc: 'DNA/RNA sequence analysis — transcription, translation, GC content' },
      { name: 'signal_process', desc: 'Signal processing — FFT, filtering, spectral analysis' },
      { name: 'sequence_analyze', desc: 'Sequence pattern detection, statistics, and string operations' },
      { name: 'medical_calc', desc: 'Medical calculators — BMI, dosage, lab value interpretation' },
      { name: 'solve_constraints', desc: 'Constraint satisfaction solver for optimization problems' },
      { name: 'parse_grammar', desc: 'Grammar-based parsing for structured text extraction' },
    ],
  },
  {
    title: 'Security',
    tag: 'SEC',
    description: 'Cryptography, validation, and accessibility auditing. Enterprise-grade security utilities.',
    tools: [
      { name: 'crypto_toolkit', desc: 'JWT signing, encryption, hashing, and key generation' },
      { name: 'phone_validate', desc: 'Phone number validation, formatting, and carrier lookup' },
      { name: 'check_accessibility', desc: 'Web accessibility auditing with axe-core (WCAG compliance)' },
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
          <h1 className="mt-4 font-bebas text-5xl md:text-8xl tracking-tight">91 REAL TOOLS</h1>
          <p className="mt-6 max-w-2xl font-mono text-sm text-muted-foreground leading-relaxed">
            Every tool listed here has a real implementation. No stubs. No demos. No vaporware.
            These are production tools that execute real operations — from generating Excel files with formulas
            to running Python in sandboxed containers to drafting sermon outlines grounded in Scripture.
          </p>

          {/* Stats */}
          <div className="mt-10 flex flex-wrap gap-8 md:gap-16">
            <div>
              <span className="font-bebas text-4xl md:text-5xl text-accent">91</span>
              <span className="block font-mono text-[10px] uppercase tracking-widest text-muted-foreground mt-1">Real Tools</span>
            </div>
            <div>
              <span className="font-bebas text-4xl md:text-5xl text-accent">17</span>
              <span className="block font-mono text-[10px] uppercase tracking-widest text-muted-foreground mt-1">Categories</span>
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
            Default: Anthropic Claude Opus 4.6. Switch between providers with BYOK (Bring Your Own Key).
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

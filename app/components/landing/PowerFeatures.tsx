/**
 * POWER FEATURES SECTION
 *
 * Highlights the 6 most compelling individual capabilities.
 * Composio-inspired glass cards with unified styling.
 */

import Section, { SectionHeader } from './Section';

interface PowerFeature {
  icon: React.ReactNode;
  title: string;
  tagline: string;
  description: string;
  badge?: string;
}

const features: PowerFeature[] = [
  {
    icon: <SearchIcon />,
    title: 'Native Web Search',
    tagline: 'Real-time answers, not stale training data',
    description:
      'Powered by Anthropic\'s native web_search tool — no third-party APIs, no rate limits. Your AI researches the live web, cites sources, and stays current. $0.01 per search.',
    badge: 'Native',
  },
  {
    icon: <MicIcon />,
    title: 'Audio Transcription',
    tagline: 'Upload a sermon, get a transcript in seconds',
    description:
      'Whisper-powered transcription for MP3, WAV, M4A, WEBM, and more. Auto-language detection, optional word-level timestamps. Upload files or paste URLs — up to 25MB.',
  },
  {
    icon: <PlayIcon />,
    title: 'YouTube Analysis',
    tagline: 'Analyze any video without watching it',
    description:
      'Extract full transcripts with timestamps from any public YouTube video. Summarize sermons, lectures, tutorials, or podcasts. Multi-language caption support.',
  },
  {
    icon: <ChartIcon />,
    title: 'Data Visualization',
    tagline: 'From raw numbers to beautiful charts',
    description:
      'Line, bar, pie, doughnut, radar, scatter — 7+ chart types generated from your data. Custom colors, titles, legends. Ask for a chart and get one instantly.',
  },
  {
    icon: <DatabaseIcon />,
    title: 'SQL Data Querying',
    tagline: 'Query your spreadsheets like a database',
    description:
      'Upload CSV or JSON data, then query it with SQL directly in chat. Joins, aggregates, filters — powered by SQLite in WebAssembly. No setup, no database needed.',
    badge: 'Zero Setup',
  },
  {
    icon: <ScanIcon />,
    title: 'OCR & PDF Analysis',
    tagline: 'Read anything — scans, screenshots, documents',
    description:
      'Extract text from images with Tesseract.js OCR. Analyze PDFs up to 50MB with page-range selection. Turn unstructured documents into structured, searchable data.',
  },
];

export default function PowerFeatures() {
  return (
    <Section id="power-features">
      <SectionHeader
        badge="Built Different"
        title="Features your current AI doesn't have"
        description="Every capability below is production-ready and included in your plan. No add-ons, no waitlists, no &quot;coming soon&quot; disclaimers."
      />

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((feature) => (
          <div
            key={feature.title}
            className="group relative rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 lg:p-8 transition-all hover:border-white/[0.12] hover:bg-white/[0.04]"
          >
            {feature.badge && (
              <span className="absolute top-4 right-4 text-[10px] font-bold uppercase tracking-widest text-violet-400 bg-violet-500/10 border border-violet-500/20 rounded-full px-2.5 py-0.5">
                {feature.badge}
              </span>
            )}

            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.03] text-zinc-400 transition-colors group-hover:border-violet-500/20 group-hover:text-violet-400">
              {feature.icon}
            </div>

            <h3 className="text-base font-semibold text-white">{feature.title}</h3>
            <p className="mt-1 text-sm font-medium text-violet-400/80">{feature.tagline}</p>
            <p className="mt-3 text-sm leading-relaxed text-zinc-500">{feature.description}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

/* --- Icons --- */

function SearchIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
    </svg>
  );
}

function MicIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.91 11.672a.375.375 0 010 .656l-5.603 3.113a.375.375 0 01-.557-.328V8.887c0-.286.307-.466.557-.327l5.603 3.112z" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  );
}

function DatabaseIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
    </svg>
  );
}

function ScanIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 3.75H6A2.25 2.25 0 003.75 6v1.5M16.5 3.75H18A2.25 2.25 0 0120.25 6v1.5m0 9V18A2.25 2.25 0 0118 20.25h-1.5m-9 0H6A2.25 2.25 0 013.75 18v-1.5M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

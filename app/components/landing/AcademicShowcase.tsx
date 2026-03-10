/**
 * ACADEMIC & SCIENCE SHOWCASE
 *
 * Highlights JCIL's scientific, mathematical, and academic tools.
 * Composio-inspired unified glass card design.
 */

import Section, { SectionHeader } from './Section';

interface AcademicDomain {
  icon: React.ReactNode;
  name: string;
  tagline: string;
  tools: string[];
  audience: string;
}

const domains: AcademicDomain[] = [
  {
    icon: <DNAIcon />,
    name: 'Biology & Life Sciences',
    tagline: 'From DNA to discovery',
    tools: [
      'DNA sequence analysis & codon mapping',
      'Protein pattern matching',
      'Medical calculator (clinical metrics)',
      'Biological data visualization',
    ],
    audience: 'Pre-med students, biology majors, nursing programs',
  },
  {
    icon: <MathIcon />,
    name: 'Mathematics & Engineering',
    tagline: 'Compute, solve, visualize',
    tools: [
      'Constraint solver (optimization problems)',
      'Signal processing (FFT, filtering, waveforms)',
      'Data visualization (7+ chart types)',
      'Statistical analysis via SQL queries',
    ],
    audience: 'Engineering students, math majors, data science',
  },
  {
    icon: <GlobeIcon />,
    name: 'Geography & Earth Sciences',
    tagline: 'Map the world with data',
    tools: [
      'Geospatial calculations (distance, coordinates)',
      'Geocoding & reverse geocoding',
      'Geofencing logic',
      'Map data visualization',
    ],
    audience: 'Geography students, environmental science, urban planning',
  },
  {
    icon: <CodeIcon />,
    name: 'Computer Science',
    tagline: 'Code it, run it, ship it',
    tools: [
      'E2B sandboxed code execution (Python, JS)',
      'GitHub integration (repos, issues, PRs)',
      'Full IDE with file browser & terminal',
      '51 orchestrated dev tools',
    ],
    audience: 'CS students, bootcamp learners, Christian developers',
  },
  {
    icon: <BookIcon />,
    name: 'Theology & Seminary',
    tagline: 'Scripture-grounded scholarship',
    tools: [
      'Cross-reference search across Biblical texts',
      'Deep Research agent for theological papers',
      'Document generation (papers, theses, outlines)',
      'Parallel research with 100 scout agents',
    ],
    audience: 'Seminary students, theology majors, pastoral studies',
  },
  {
    icon: <BeakerIcon />,
    name: 'Physics & Chemistry',
    tagline: 'Simulate and analyze',
    tools: [
      'Ray tracing & light simulation',
      '3D graphics rendering',
      'Signal processing & waveform analysis',
      'Unit conversion & formula calculation',
    ],
    audience: 'Physics majors, chemistry students, lab researchers',
  },
];

export default function AcademicShowcase() {
  return (
    <Section id="academics">
      <SectionHeader
        badge="Built for Scholars"
        title="University-grade tools, faith-based values"
        description="Whether you're in a seminary lecture hall or a biochemistry lab, JCIL gives you real scientific tools — not toy demos. Every tool runs real computations with real libraries."
      />

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {domains.map((domain) => (
          <div
            key={domain.name}
            className="group rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 lg:p-8 transition-all hover:border-white/[0.12] hover:bg-white/[0.04]"
          >
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.03] text-zinc-400 transition-colors group-hover:text-violet-400">
              {domain.icon}
            </div>
            <h3 className="text-base font-semibold text-white">{domain.name}</h3>
            <p className="mt-1 text-sm font-medium text-violet-400/70">{domain.tagline}</p>

            <ul className="mt-4 space-y-2">
              {domain.tools.map((tool) => (
                <li key={tool} className="flex items-start gap-2 text-sm text-zinc-500">
                  <svg
                    className="mt-0.5 h-4 w-4 shrink-0 text-violet-400/50"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <span>{tool}</span>
                </li>
              ))}
            </ul>

            <p className="mt-4 text-xs text-zinc-500 italic">{domain.audience}</p>
          </div>
        ))}
      </div>

      <div className="mt-10 text-center">
        <p className="text-sm text-zinc-500 max-w-2xl mx-auto">
          All tools run real computations — SQLite via WebAssembly, Tesseract.js for OCR, turf.js
          for geospatial, FFmpeg for media processing, Puppeteer for web automation. No stubs, no
          simulations.
        </p>
      </div>
    </Section>
  );
}

/* --- Icons --- */

function DNAIcon() {
  return (
    <svg
      className="h-6 w-6"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5"
      />
    </svg>
  );
}

function MathIcon() {
  return (
    <svg
      className="h-6 w-6"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.75 15.75V18m-7.5-6.75h.008v.008H8.25v-.008zm0 2.25h.008v.008H8.25v-.008zm0 2.25h.008v.008H8.25v-.008zm0 2.25h.008v.008H8.25v-.008zm2.25-4.5h.008v.008H10.5v-.008zm0 2.25h.008v.008H10.5v-.008zm0 2.25h.008v.008H10.5v-.008zm2.25-4.5h.008v.008H12.75v-.008zm0 2.25h.008v.008H12.75v-.008zM12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z"
      />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg
      className="h-6 w-6"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418"
      />
    </svg>
  );
}

function CodeIcon() {
  return (
    <svg
      className="h-6 w-6"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5"
      />
    </svg>
  );
}

function BookIcon() {
  return (
    <svg
      className="h-6 w-6"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"
      />
    </svg>
  );
}

function BeakerIcon() {
  return (
    <svg
      className="h-6 w-6"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5"
      />
    </svg>
  );
}

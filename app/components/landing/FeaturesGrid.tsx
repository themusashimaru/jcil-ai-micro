/**
 * FEATURES GRID — Bento-style layout
 *
 * Combines the best capabilities into a visually varied grid.
 * Mix of large and small cards creates visual rhythm and hierarchy.
 * Replaces: CapabilitiesHighlight, PowerFeatures, ToolsShowcase, AgentsSection
 */

import Section, { SectionHeader } from './Section';

export default function FeaturesGrid() {
  return (
    <Section id="features">
      <SectionHeader
        badge="What You Get"
        title="Everything you need, nothing you don't"
        description='Every capability listed here is production-ready. No stubs, no waitlists, no "coming soon."'
      />

      {/* Bento grid — varied card sizes for visual interest */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Large card — AI Agents (spans 2 cols) */}
        <div className="group relative overflow-hidden rounded-2xl border border-white/[0.06] bg-gradient-to-br from-violet-500/[0.08] to-transparent p-8 transition-all hover:border-violet-500/20 sm:col-span-2 lg:p-10">
          <div className="absolute right-0 top-0 h-64 w-64 translate-x-1/3 -translate-y-1/3 rounded-full bg-violet-500/[0.06] blur-[80px]" />
          <div className="relative">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/10 px-3 py-1">
              <BoltIcon className="h-3.5 w-3.5 text-violet-400" />
              <span className="text-xs font-medium text-violet-400">6 AI Agents</span>
            </div>
            <h3 className="text-2xl font-bold text-white">Autonomous agents that do the work</h3>
            <p className="mt-3 max-w-lg text-base leading-relaxed text-zinc-400">
              Deep Strategy deploys up to 100 parallel research scouts. Deep Research and Deep
              Writer handle investigation and publishing. Three Quick agents deliver fast results in
              minutes.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <AgentPill name="Deep Strategy" time="2-5 min" />
              <AgentPill name="Deep Research" time="2-5 min" />
              <AgentPill name="Deep Writer" time="5-15 min" />
              <AgentPill name="Quick Research" time="1-2 min" />
              <AgentPill name="Quick Strategy" time="1-2 min" />
              <AgentPill name="Quick Writer" time="2-3 min" />
            </div>
          </div>
        </div>

        {/* Tall card — Memory */}
        <div className="group rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 transition-all hover:border-amber-500/20 hover:bg-white/[0.04] lg:row-span-2">
          <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/10">
            <DatabaseIcon className="h-6 w-6 text-amber-400" />
          </div>
          <h3 className="text-lg font-bold text-white">Persistent Memory</h3>
          <p className="mt-3 text-sm leading-relaxed text-zinc-400">
            JCIL remembers you across sessions. Preferences, project details, conversation history —
            stored securely in PostgreSQL with GDPR-compliant deletion.
          </p>
          <div className="mt-6 space-y-3">
            <MemoryFeature label="Vector storage" detail="Semantic search across history" />
            <MemoryFeature label="Auto-summarization" detail="Key insights extracted" />
            <MemoryFeature label="Cross-session" detail="Context that survives restarts" />
            <MemoryFeature label="GDPR compliant" detail="6-month hard deletion" />
          </div>
        </div>

        {/* Standard card — IDE */}
        <div className="group rounded-2xl border border-white/[0.06] bg-white/[0.02] p-7 transition-all hover:border-white/[0.12] hover:bg-white/[0.04]">
          <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.03] text-zinc-400 transition-colors group-hover:text-violet-400">
            <IDEIcon className="h-5 w-5" />
          </div>
          <h3 className="text-base font-semibold text-white">Full IDE in Your Browser</h3>
          <p className="mt-2 text-sm leading-relaxed text-zinc-500">
            File browser, git, terminal, visual debugging. Switch between Claude, GPT, Gemini, Grok,
            and DeepSeek with a keystroke. Zero installation.
          </p>
        </div>

        {/* Standard card — Documents */}
        <div className="group rounded-2xl border border-white/[0.06] bg-white/[0.02] p-7 transition-all hover:border-white/[0.12] hover:bg-white/[0.04]">
          <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.03] text-zinc-400 transition-colors group-hover:text-violet-400">
            <DocIcon className="h-5 w-5" />
          </div>
          <h3 className="text-base font-semibold text-white">Enterprise Documents</h3>
          <p className="mt-2 text-sm leading-relaxed text-zinc-500">
            Word docs, Excel with working formulas, PDFs, and presentations. Invoices, contracts,
            reports, resumes — from a single prompt.
          </p>
        </div>

        {/* Wide card — Web Search + Integrations (spans 2 cols) */}
        <div className="group rounded-2xl border border-white/[0.06] bg-white/[0.02] p-7 transition-all hover:border-white/[0.12] hover:bg-white/[0.04] sm:col-span-2">
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10">
                <SearchIcon className="h-5 w-5 text-emerald-400" />
              </div>
              <h3 className="text-base font-semibold text-white">Native Web Search</h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-500">
                Anthropic&apos;s native web_search tool — real-time answers, cited sources, no stale
                training data. $0.01 per search.
              </p>
            </div>
            <div>
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10">
                <ConnectorIcon className="h-5 w-5 text-emerald-400" />
              </div>
              <h3 className="text-base font-semibold text-white">67+ Integrations (SOC 2)</h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-500">
                Slack, Gmail, GitHub, Jira, and 60+ more via Composio. Enterprise-safe connectivity
                with full audit trails.
              </p>
            </div>
          </div>
        </div>

        {/* Standard card — Image Gen */}
        <div className="group rounded-2xl border border-white/[0.06] bg-white/[0.02] p-7 transition-all hover:border-white/[0.12] hover:bg-white/[0.04]">
          <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.03] text-zinc-400 transition-colors group-hover:text-fuchsia-400">
            <ImageIcon className="h-5 w-5" />
          </div>
          <h3 className="text-base font-semibold text-white">FLUX.2 Image Generation</h3>
          <p className="mt-2 text-sm leading-relaxed text-zinc-500">
            Create images from natural language. 5 model options for different styles and needs.
          </p>
        </div>

        {/* Standard card — Code Execution */}
        <div className="group rounded-2xl border border-white/[0.06] bg-white/[0.02] p-7 transition-all hover:border-white/[0.12] hover:bg-white/[0.04]">
          <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.03] text-zinc-400 transition-colors group-hover:text-amber-400">
            <CodeIcon className="h-5 w-5" />
          </div>
          <h3 className="text-base font-semibold text-white">Sandboxed Execution</h3>
          <p className="mt-2 text-sm leading-relaxed text-zinc-500">
            Run Python, JavaScript, and terminal commands in isolated E2B containers. Safe, fast,
            production-ready.
          </p>
        </div>

        {/* Standard card — Security */}
        <div className="group rounded-2xl border border-white/[0.06] bg-white/[0.02] p-7 transition-all hover:border-white/[0.12] hover:bg-white/[0.04]">
          <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.03] text-zinc-400 transition-colors group-hover:text-emerald-400">
            <ShieldIcon className="h-5 w-5" />
          </div>
          <h3 className="text-base font-semibold text-white">Enterprise Security</h3>
          <p className="mt-2 text-sm leading-relaxed text-zinc-500">
            AES-256 encryption at rest, row-level security, Redis rate limiting, CSRF protection,
            full audit trails.
          </p>
        </div>
      </div>
    </Section>
  );
}

/* --- Helper components --- */

function AgentPill({ name, time }: { name: string; time: string }) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.02] px-3 py-1.5">
      <span className="text-xs font-medium text-zinc-300">{name}</span>
      <span className="text-[10px] text-zinc-500">{time}</span>
    </div>
  );
}

function MemoryFeature({ label, detail }: { label: string; detail: string }) {
  return (
    <div className="rounded-xl border border-white/[0.04] bg-white/[0.02] p-3">
      <div className="text-xs font-medium text-amber-400">{label}</div>
      <div className="text-xs text-zinc-500">{detail}</div>
    </div>
  );
}

/* --- Icons --- */

function BoltIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"
      />
    </svg>
  );
}

function DatabaseIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125"
      />
    </svg>
  );
}

function IDEIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6.75 7.5l3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0021 18V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v12a2.25 2.25 0 002.25 2.25z"
      />
    </svg>
  );
}

function DocIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
      />
    </svg>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
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

function ConnectorIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-9.86a4.5 4.5 0 00-6.364 6.364L12 10.5"
      />
    </svg>
  );
}

function ImageIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M6.75 7.5a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM18 7.5a.75.75 0 11-1.5 0 .75.75 0 011.5 0z"
      />
    </svg>
  );
}

function CodeIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
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

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
      />
    </svg>
  );
}

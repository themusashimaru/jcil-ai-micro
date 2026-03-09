/**
 * CAPABILITIES HIGHLIGHT
 *
 * 9 standout capabilities in a 3x3 grid.
 * Covers: IDE, agents, computer use, integrations, memory, images, docs, sandbox, security.
 */

export default function CapabilitiesHighlight() {
  return (
    <section className="border-y border-white/5 bg-white/[0.01] py-24 lg:py-32">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto mb-16 max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            What sets JCIL apart
          </h2>
          <p className="mt-4 text-lg text-slate-400">
            Everything listed here is production-ready. No demos, no stubs, no vaporware.
          </p>
        </div>

        <div className="grid gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/5 sm:grid-cols-2 lg:grid-cols-3">
          <Capability
            icon={<IDEIcon />}
            title="Full-Service IDE, Any Model"
            description="Like Claude Code — but for every model. Switch between Claude, GPT, Gemini, Grok, and DeepSeek with a keystroke. File browser, git, terminal, debugging — in your browser."
          />
          <Capability
            icon={<AgentIcon />}
            title="6 AI Agents, 100 Parallel Scouts"
            description="Deep Strategy deploys an Opus architect with up to 100 parallel scouts. Deep Research and Deep Writer run real web searches at scale. Like Manus — but with model choice."
          />
          <Capability
            icon={<MemoryIcon />}
            title="Persistent Memory"
            description="JCIL remembers you across sessions. Preferences, facts, relationships, interests — stored securely in PostgreSQL with GDPR-compliant deletion. Your AI actually knows you."
          />
          <Capability
            icon={<ImageIcon />}
            title="FLUX.2 Image Generation"
            description="Create images from natural language with FLUX.2. Not just chat — actual image creation, editing, and analysis powered by state-of-the-art models."
          />
          <Capability
            icon={<DocIcon />}
            title="Enterprise Document Generation"
            description="Create Word docs, Excel spreadsheets with working formulas, PDFs, and presentations. Invoices, contracts, reports, resumes — from a single prompt."
          />
          <Capability
            icon={<ConnectorIcon />}
            title="67+ App Integrations (SOC 2)"
            description="Connect to Slack, Gmail, GitHub, Jira, and 60+ more via Composio. SOC 2 compliant — chosen specifically for enterprise-safe connectivity."
          />
          <Capability
            icon={<ComputerIcon />}
            title="IT Assistance & Computer Use"
            description="Anthropic's native computer use tools. Interact with desktops, troubleshoot systems, provide real IT support — actual computer control, not just chat."
          />
          <Capability
            icon={<SandboxIcon />}
            title="Sandboxed Code Execution"
            description="Run Python, JavaScript, and terminal commands in isolated E2B sandboxes. Fully containerized — your code executes safely without touching production."
          />
          <Capability
            icon={<ShieldIcon />}
            title="Enterprise Security"
            description="End-to-end encryption, API keys encrypted at rest, row-level security, Redis rate limiting, CSRF protection, and full audit trails on every request."
          />
        </div>
      </div>
    </section>
  );
}

function Capability({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="bg-black p-8">
      <div className="mb-4 text-slate-400">{icon}</div>
      <h3 className="text-base font-semibold text-white">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-slate-400">{description}</p>
    </div>
  );
}

function IDEIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 7.5l3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0021 18V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v12a2.25 2.25 0 002.25 2.25z" />
    </svg>
  );
}

function AgentIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
    </svg>
  );
}

function MemoryIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
    </svg>
  );
}

function ImageIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M6.75 7.5a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM18 7.5a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
    </svg>
  );
}

function DocIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  );
}

function ConnectorIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-9.86a4.5 4.5 0 00-6.364 6.364L12 10.5" />
    </svg>
  );
}

function ComputerIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25A2.25 2.25 0 015.25 3h13.5A2.25 2.25 0 0121 5.25z" />
    </svg>
  );
}

function SandboxIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
    </svg>
  );
}

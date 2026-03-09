/**
 * CAPABILITIES HIGHLIGHT
 *
 * Showcases standout platform capabilities — the "cool stuff."
 * Clean grid of capabilities with brief descriptions.
 */

export default function CapabilitiesHighlight() {
  return (
    <section className="border-y border-white/5 bg-white/[0.01] py-24 lg:py-32">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto mb-16 max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            What you can actually do
          </h2>
          <p className="mt-4 text-lg text-slate-400">
            Real capabilities. No demos, no stubs — everything listed here works.
          </p>
        </div>

        <div className="grid gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/5 sm:grid-cols-2 lg:grid-cols-3">
          <Capability
            icon={<ComputerIcon />}
            title="IT Assistance & Computer Use"
            description="Anthropic's native computer use tools. Interact with desktops, troubleshoot systems, and provide real IT support remotely."
          />
          <Capability
            icon={<ConnectorIcon />}
            title="67+ App Integrations"
            description="Connect to Slack, Gmail, GitHub, Jira, and more via Composio — SOC 2 compliant for enterprise-safe connectivity."
          />
          <Capability
            icon={<SandboxIcon />}
            title="Sandboxed Code Execution"
            description="Run Python, JavaScript, and terminal commands in isolated E2B sandboxes. Safe, fast, and fully containerized."
          />
          <Capability
            icon={<DocIcon />}
            title="Document Generation"
            description="Create Word docs, Excel spreadsheets with formulas, PDFs, and presentations — all from natural language."
          />
          <Capability
            icon={<BrainIcon />}
            title="Multi-Model Intelligence"
            description="Switch between Claude, GPT, Gemini, Grok, and DeepSeek. Bring your own API keys for any provider."
          />
          <Capability
            icon={<ShieldIcon />}
            title="Enterprise Security"
            description="End-to-end encryption, API keys encrypted at rest, row-level security, rate limiting, and full audit trails."
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

function ComputerIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25A2.25 2.25 0 015.25 3h13.5A2.25 2.25 0 0121 5.25z" />
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

function SandboxIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 7.5l3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0021 18V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v12a2.25 2.25 0 002.25 2.25z" />
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

function BrainIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
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

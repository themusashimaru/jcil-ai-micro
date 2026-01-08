/**
 * CODE LAB PUBLIC LANDING PAGE
 *
 * Professional marketing page for Code Lab
 * Full technical breakdown for developers
 * Uses shared landing components
 */

import Link from 'next/link';
import LandingHeader from '../../components/landing/LandingHeader';
import LandingFooter from '../../components/landing/LandingFooter';
import Section, { SectionHeader } from '../../components/landing/Section';
import FeatureCard, { StatCard } from '../../components/landing/FeatureCard';

export const metadata = {
  title: 'Code Lab - AI Development Environment | JCIL.AI',
  description:
    'A full Claude Code-like experience in your browser. Sandboxed execution, persistent workspaces, 30+ tools, GitHub integration, and more.',
};

const TOOL_CATEGORIES = [
  {
    title: 'File Operations',
    icon: '📁',
    color: 'blue' as const,
    tools: [
      { name: 'read_file', desc: 'Read any file with syntax highlighting' },
      { name: 'write_file', desc: 'Create or overwrite files' },
      { name: 'edit_file', desc: 'Precise text replacements' },
      { name: 'multi_edit', desc: 'Multiple edits in one operation' },
      { name: 'list_files', desc: 'Recursive directory listing' },
    ],
  },
  {
    title: 'Code Search',
    icon: '🔍',
    color: 'purple' as const,
    tools: [
      { name: 'search_files', desc: 'Find files by pattern (glob)' },
      { name: 'search_code', desc: 'Grep with regex across codebase' },
    ],
  },
  {
    title: 'Shell & Execution',
    icon: '⚡',
    color: 'amber' as const,
    tools: [
      { name: 'execute_shell', desc: 'Run any shell command' },
      { name: 'run_build', desc: 'Execute npm run build' },
      { name: 'run_tests', desc: 'Execute test suites' },
      { name: 'install_packages', desc: 'Install npm dependencies' },
    ],
  },
  {
    title: 'Git Operations',
    icon: '📦',
    color: 'green' as const,
    tools: [
      { name: 'git_status', desc: 'View repository status' },
      { name: 'git_diff', desc: 'See staged and unstaged changes' },
      { name: 'git_commit', desc: 'Stage and commit changes' },
      { name: 'git_push', desc: 'Push to remote repository' },
    ],
  },
  {
    title: 'Planning Mode',
    icon: '📋',
    color: 'cyan' as const,
    tools: [
      { name: 'enter_plan_mode', desc: 'Start structured planning session' },
      { name: 'write_plan', desc: 'Document implementation approach' },
      { name: 'exit_plan_mode', desc: 'Request user approval' },
    ],
  },
  {
    title: 'Advanced Features',
    icon: '🔌',
    color: 'fuchsia' as const,
    tools: [
      { name: 'mcp_servers', desc: 'Model Context Protocol integration' },
      { name: 'hooks_system', desc: 'Pre/post tool execution hooks' },
      { name: 'project_memory', desc: 'CODELAB.md persistent context' },
      { name: 'bg_tasks', desc: 'Background task management' },
    ],
  },
];

const TECH_STACK = [
  {
    name: 'Claude Opus 4.5',
    category: 'AI Model',
    desc: 'Latest Anthropic model with extended thinking for complex reasoning',
    icon: '🧠',
  },
  {
    name: 'E2B Sandbox',
    category: 'Execution',
    desc: 'Isolated cloud containers with full Linux environment',
    icon: '📦',
  },
  {
    name: 'Model Context Protocol',
    category: 'Integration',
    desc: 'Open standard for AI-tool communication',
    icon: '🔌',
  },
  {
    name: 'WebSocket Streaming',
    category: 'Real-time',
    desc: 'Sub-100ms latency for tool execution feedback',
    icon: '⚡',
  },
  {
    name: 'Encrypted PAT Storage',
    category: 'Security',
    desc: 'AES-256 encryption for GitHub tokens',
    icon: '🔐',
  },
  {
    name: 'Session Persistence',
    category: 'State',
    desc: 'Workspace snapshots with instant restore',
    icon: '💾',
  },
];

export default function CodeLabAboutPage() {
  return (
    <main className="min-h-screen bg-black text-white">
      <LandingHeader ctaText="Launch Code Lab" ctaHref="/code-lab" />

      {/* Hero Section */}
      <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden pt-20">
        {/* Background Effects */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 -right-32 w-[500px] h-[500px] bg-fuchsia-600/15 rounded-full blur-[120px] animate-pulse" />
          <div
            className="absolute bottom-1/4 -left-32 w-[500px] h-[500px] bg-purple-600/15 rounded-full blur-[120px] animate-pulse"
            style={{ animationDelay: '1s' }}
          />
        </div>

        {/* Grid Pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_50%_50%_at_50%_50%,black_40%,transparent_100%)]" />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-fuchsia-500/10 backdrop-blur-sm border border-fuchsia-500/30 mb-8">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-fuchsia-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-fuchsia-500"></span>
              </span>
              <span className="text-sm font-medium text-fuchsia-300">Claude Code Alternative</span>
            </div>

            {/* Main Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-7xl font-bold tracking-tight leading-[1.1] mb-6">
              <span className="text-white">Code Lab</span>
              <br />
              <span className="bg-gradient-to-r from-fuchsia-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                AI Development Environment
              </span>
            </h1>

            {/* Subheadline */}
            <p className="mx-auto max-w-3xl text-lg sm:text-xl text-slate-400 leading-relaxed mb-8">
              A full{' '}
              <span className="text-fuchsia-400 font-semibold">Claude Code-like experience</span> in
              your browser. Sandboxed execution, persistent workspaces, and 30+ tools at your
              command.
            </p>

            {/* Feature Pills */}
            <div className="flex flex-wrap items-center justify-center gap-3 mb-10">
              {[
                'E2B Sandbox',
                '30+ Tools',
                'GitHub Integration',
                'Planning Mode',
                'MCP Support',
                'Hooks System',
              ].map((feature, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-sm text-slate-300"
                >
                  <svg
                    className="w-4 h-4 text-fuchsia-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  {feature}
                </div>
              ))}
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
              <Link
                href="/code-lab"
                className="w-full sm:w-auto rounded-lg bg-fuchsia-600 hover:bg-fuchsia-500 px-8 py-4 text-base font-semibold text-white transition-all shadow-lg shadow-fuchsia-500/20"
              >
                Launch Code Lab
              </Link>
              <Link
                href="/docs/code-lab"
                className="w-full sm:w-auto rounded-lg border border-white/20 bg-white/5 backdrop-blur-sm px-8 py-4 text-base font-semibold text-white hover:bg-white/10 transition-all"
              >
                Read Documentation
              </Link>
            </div>

            {/* Stats */}
            <div className="flex flex-wrap items-center justify-center gap-8 lg:gap-12">
              <StatCard value="30+" label="Dev Tools" color="fuchsia" />
              <StatCard value="E2B" label="Cloud Sandbox" color="fuchsia" />
              <StatCard value="Git" label="Integration" color="fuchsia" />
              <StatCard value="∞" label="Persistence" color="fuchsia" />
            </div>
          </div>
        </div>
      </section>

      {/* Technical Architecture Section */}
      <Section background="gradient" padding="lg" className="border-t border-white/5">
        <SectionHeader
          badge="Architecture"
          badgeColor="fuchsia"
          title="Technical Architecture"
          description="Enterprise-grade infrastructure built on cutting-edge AI technology."
        />

        {/* Tech Stack Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 max-w-5xl mx-auto mb-16">
          {TECH_STACK.map((tech, i) => (
            <div
              key={i}
              className="bg-slate-900/50 rounded-xl p-6 border border-slate-800 hover:border-fuchsia-500/30 transition-all"
            >
              <div className="flex items-start gap-4">
                <div className="text-3xl">{tech.icon}</div>
                <div>
                  <div className="text-xs text-fuchsia-400 font-medium mb-1">{tech.category}</div>
                  <h3 className="text-lg font-bold text-white mb-1">{tech.name}</h3>
                  <p className="text-sm text-slate-400">{tech.desc}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Architecture Diagram */}
        <div className="max-w-4xl mx-auto">
          <div className="bg-slate-900/80 rounded-2xl p-6 lg:p-8 border border-slate-800">
            <h3 className="text-xl font-bold text-white mb-6 text-center">Request Flow</h3>
            <div className="flex flex-col lg:flex-row items-center justify-between gap-4 text-sm">
              {[
                { emoji: '👤', title: 'User Request', desc: 'Natural Language', color: 'blue' },
                { emoji: '🧠', title: 'Claude Opus 4.5', desc: 'Tool Selection', color: 'purple' },
                { emoji: '⚡', title: 'E2B Sandbox', desc: 'Isolated Execution', color: 'amber' },
                { emoji: '✅', title: 'Result', desc: 'Streamed Response', color: 'green' },
              ].map((step, i) => (
                <div key={i} className="flex items-center gap-4 lg:flex-col lg:gap-2">
                  <div
                    className={`flex flex-col items-center gap-2 p-4 bg-${step.color}-500/10 rounded-xl border border-${step.color}-500/30 w-full lg:w-auto`}
                  >
                    <span className="text-2xl">{step.emoji}</span>
                    <span className={`text-${step.color}-300 font-medium text-center`}>
                      {step.title}
                    </span>
                    <span className="text-slate-500 text-xs">{step.desc}</span>
                  </div>
                  {i < 3 && <span className="text-fuchsia-400 text-xl hidden lg:block">→</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      </Section>

      {/* Code Examples Section */}
      <Section padding="lg">
        <SectionHeader
          badge="Examples"
          badgeColor="purple"
          title="See it in action"
          description="Real examples of how natural language translates to powerful tool execution."
        />

        <div className="grid gap-6 lg:grid-cols-2 max-w-6xl mx-auto">
          {/* Example 1 */}
          <div className="bg-slate-900/50 rounded-2xl overflow-hidden border border-slate-800">
            <div className="px-6 py-4 bg-slate-800/50 border-b border-slate-700">
              <span className="text-sm font-medium text-fuchsia-400">
                Creating a React Component
              </span>
            </div>
            <div className="p-6">
              <div className="mb-4">
                <div className="text-xs text-slate-500 mb-2">USER REQUEST</div>
                <div className="bg-blue-500/10 rounded-lg p-3 text-blue-200 text-sm">
                  &quot;Create a Button component with primary and secondary variants&quot;
                </div>
              </div>
              <div className="mb-4">
                <div className="text-xs text-slate-500 mb-2">TOOL EXECUTED</div>
                <code className="block bg-slate-800 rounded-lg p-3 text-fuchsia-300 text-sm font-mono">
                  write_file(path: &quot;src/components/Button.tsx&quot;)
                </code>
              </div>
              <div>
                <div className="text-xs text-slate-500 mb-2">RESULT</div>
                <pre className="bg-slate-950 rounded-lg p-3 text-sm font-mono overflow-x-auto text-slate-300">
                  {`export function Button({
  variant = 'primary',
  children
}) {
  const styles = variant === 'primary'
    ? 'bg-blue-600 hover:bg-blue-500'
    : 'bg-slate-600 hover:bg-slate-500';

  return (
    <button className={styles}>
      {children}
    </button>
  );
}`}
                </pre>
              </div>
            </div>
          </div>

          {/* Example 2 */}
          <div className="bg-slate-900/50 rounded-2xl overflow-hidden border border-slate-800">
            <div className="px-6 py-4 bg-slate-800/50 border-b border-slate-700">
              <span className="text-sm font-medium text-fuchsia-400">Git Workflow</span>
            </div>
            <div className="p-6">
              <div className="mb-4">
                <div className="text-xs text-slate-500 mb-2">USER REQUEST</div>
                <div className="bg-blue-500/10 rounded-lg p-3 text-blue-200 text-sm">
                  &quot;Commit the changes and push to the feature branch&quot;
                </div>
              </div>
              <div className="mb-4">
                <div className="text-xs text-slate-500 mb-2">TOOLS EXECUTED</div>
                <div className="space-y-2">
                  <code className="block bg-slate-800 rounded-lg p-2 text-fuchsia-300 text-xs font-mono">
                    1. git_status()
                  </code>
                  <code className="block bg-slate-800 rounded-lg p-2 text-fuchsia-300 text-xs font-mono">
                    2. git_diff(staged: false)
                  </code>
                  <code className="block bg-slate-800 rounded-lg p-2 text-fuchsia-300 text-xs font-mono">
                    3. git_commit(message: &quot;feat: add button&quot;)
                  </code>
                  <code className="block bg-slate-800 rounded-lg p-2 text-fuchsia-300 text-xs font-mono">
                    4. git_push(branch: &quot;feature/ui&quot;)
                  </code>
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500 mb-2">RESULT</div>
                <pre className="bg-slate-950 rounded-lg p-3 text-sm font-mono text-green-400">
                  {`[feature/ui 7a3b2c1] feat: add button
 3 files changed, 42 insertions(+)

Pushed to origin/feature/ui ✓`}
                </pre>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* Features Grid */}
      <Section background="muted" padding="lg" className="border-y border-white/5">
        <SectionHeader
          badge="Features"
          badgeColor="blue"
          title="Enterprise Features"
          description="Everything you need for serious development work, built for the modern AI era."
        />

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 max-w-6xl mx-auto">
          <FeatureCard
            emoji="🔒"
            title="Sandboxed Execution"
            description="Every session runs in an isolated E2B sandbox with full Linux environment. No risk to your local machine."
            variant="gradient"
            color="blue"
          />
          <FeatureCard
            emoji="💾"
            title="Persistent Workspaces"
            description="Your workspace state is preserved across sessions. Pick up exactly where you left off."
            variant="gradient"
            color="purple"
          />
          <FeatureCard
            emoji="🐙"
            title="GitHub Integration"
            description="Clone repos, push changes, create branches, and manage PRs—all through natural language."
            variant="gradient"
            color="green"
          />
          <FeatureCard
            emoji="📋"
            title="Planning Mode"
            description="Complex tasks get structured planning. Explore, design, and get approval before implementing."
            variant="gradient"
            color="amber"
          />
          <FeatureCard
            emoji="🧠"
            title="Project Memory"
            description="CODELAB.md stores project-specific context and instructions that persist across sessions."
            variant="gradient"
            color="fuchsia"
          />
          <FeatureCard
            emoji="🔌"
            title="MCP Servers"
            description="Extend capabilities with Model Context Protocol servers—databases, browsers, and more."
            variant="gradient"
            color="cyan"
          />
        </div>
      </Section>

      {/* Tools Section */}
      <Section padding="lg">
        <SectionHeader
          badge="30+ Tools"
          badgeColor="fuchsia"
          title="Complete Development Toolkit"
          description="A comprehensive toolkit for every development task. All accessible through natural language."
        />

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 max-w-7xl mx-auto">
          {TOOL_CATEGORIES.map((category, i) => (
            <div
              key={i}
              className="bg-slate-900/50 rounded-2xl p-6 border border-slate-800 hover:border-fuchsia-500/20 transition-all"
            >
              <div className="flex items-center gap-3 mb-4">
                <span className="text-2xl">{category.icon}</span>
                <h3 className="text-lg font-bold text-white">{category.title}</h3>
              </div>
              <div className="space-y-3">
                {category.tools.map((tool, j) => (
                  <div key={j} className="flex items-start gap-2">
                    <code className="text-xs px-2 py-1 rounded bg-fuchsia-500/20 text-fuchsia-300 font-mono shrink-0">
                      {tool.name}
                    </code>
                    <span className="text-sm text-slate-400">{tool.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Comparison Section */}
      <Section background="gradient" padding="lg" className="border-t border-white/5">
        <SectionHeader
          badge="Features"
          badgeColor="green"
          title="Full-Featured Development"
          description="Everything you need for serious development work, plus unique advantages for the browser."
        />

        <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-8">
          <div className="bg-slate-900/50 rounded-2xl p-8 border border-slate-800">
            <h3 className="text-xl font-semibold text-slate-300 mb-6">Feature Comparison</h3>
            <div className="space-y-3">
              {[
                'File Operations',
                'Code Search (Glob/Grep)',
                'Shell Execution',
                'Git Operations',
                'Planning Mode',
                'MCP Server Integration',
                'Hooks System',
                'Project Memory',
                'Background Tasks',
                'Web Search',
              ].map((feature, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-slate-300">{feature}</span>
                  <svg
                    className="w-5 h-5 text-green-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-gradient-to-br from-fuchsia-900/30 to-purple-900/30 rounded-2xl p-8 border border-fuchsia-500/30">
            <h3 className="text-xl font-semibold text-fuchsia-300 mb-6">Code Lab Advantages</h3>
            <div className="space-y-4">
              {[
                'Sandboxed cloud execution (safe & isolated)',
                'Persistent workspace snapshots',
                'Native GitHub PAT encryption',
                'Code statistics tracking',
                'Works on any device with a browser',
                'Voice input support',
                'Dedicated Git tools built for reliability',
              ].map((advantage, i) => (
                <div key={i} className="flex items-start gap-2">
                  <svg
                    className="w-5 h-5 text-fuchsia-400 mt-0.5 shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  <span className="text-slate-200">{advantage}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Section>

      {/* CTA Section */}
      <Section padding="xl">
        <div className="relative mx-auto max-w-4xl">
          <div className="absolute inset-0 bg-gradient-to-r from-fuchsia-600/20 via-purple-600/20 to-pink-600/20 rounded-3xl blur-xl" />

          <div className="relative bg-gradient-to-br from-slate-900 to-slate-950 rounded-3xl p-8 lg:p-16 border border-white/10 text-center">
            <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">
              Ready to try Code Lab?
            </h2>
            <p className="text-lg text-slate-400 mb-8 max-w-xl mx-auto">
              Experience the future of AI-assisted development. No local setup required.
            </p>
            <Link
              href="/code-lab"
              className="inline-block rounded-xl bg-fuchsia-600 hover:bg-fuchsia-500 px-10 py-4 text-base font-semibold text-white transition-all shadow-lg shadow-fuchsia-500/20"
            >
              Launch Code Lab
            </Link>
            <p className="mt-6 text-sm text-slate-500">
              Free tier available. GitHub account required.
            </p>
          </div>
        </div>
      </Section>

      <LandingFooter />
    </main>
  );
}

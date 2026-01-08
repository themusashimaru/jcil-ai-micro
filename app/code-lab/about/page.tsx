/**
 * CODE LAB ABOUT PAGE
 *
 * Public marketing page showcasing Code Lab capabilities
 * Full technical breakdown of features, tools, and architecture
 */

import Link from 'next/link';
import LandingLogo from '../../components/LandingLogo';
import MobileMenu from '../../components/MobileMenu';

export const metadata = {
  title: 'Code Lab - AI Development Environment | JCIL.AI',
  description: 'A full Claude Code-like experience in your browser. Sandboxed execution, persistent workspaces, 30+ tools, GitHub integration, and more.',
};

const TOOL_CATEGORIES = [
  {
    title: 'File Operations',
    icon: '📁',
    color: 'blue',
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
    color: 'purple',
    tools: [
      { name: 'search_files', desc: 'Find files by pattern (glob)' },
      { name: 'search_code', desc: 'Grep with regex across codebase' },
    ],
  },
  {
    title: 'Shell & Execution',
    icon: '⚡',
    color: 'amber',
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
    color: 'green',
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
    color: 'cyan',
    tools: [
      { name: 'enter_plan_mode', desc: 'Start structured planning session' },
      { name: 'write_plan', desc: 'Document implementation approach' },
      { name: 'exit_plan_mode', desc: 'Request user approval' },
    ],
  },
  {
    title: 'Advanced Features',
    icon: '🔌',
    color: 'fuchsia',
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

const FEATURES = [
  {
    title: 'Sandboxed Execution',
    icon: '🔒',
    desc: 'Every session runs in an isolated E2B sandbox with full Linux environment. No risk to your local machine.',
    gradient: 'from-blue-500 to-cyan-500',
  },
  {
    title: 'Persistent Workspaces',
    icon: '💾',
    desc: 'Your workspace state is preserved across sessions. Pick up exactly where you left off.',
    gradient: 'from-purple-500 to-pink-500',
  },
  {
    title: 'GitHub Integration',
    icon: '🐙',
    desc: 'Clone repos, push changes, create branches, and manage PRs - all through natural language.',
    gradient: 'from-green-500 to-emerald-500',
  },
  {
    title: 'Planning Mode',
    icon: '📋',
    desc: 'Complex tasks get structured planning. Explore, design, and get approval before implementing.',
    gradient: 'from-amber-500 to-orange-500',
  },
  {
    title: 'Project Memory',
    icon: '🧠',
    desc: 'CODELAB.md stores project-specific context and instructions that persist across sessions.',
    gradient: 'from-fuchsia-500 to-purple-500',
  },
  {
    title: 'MCP Servers',
    icon: '🔌',
    desc: 'Extend capabilities with Model Context Protocol servers - databases, browsers, and more.',
    gradient: 'from-cyan-500 to-blue-500',
  },
];

export default function CodeLabAboutPage() {
  return (
    <main className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-black/80 border-b border-white/10">
        <div className="container mx-auto px-4 py-4">
          <nav className="flex items-center justify-between">
            <Link href="/">
              <LandingLogo />
            </Link>

            <div className="hidden md:flex items-center space-x-6">
              <Link href="/" className="text-slate-400 hover:text-white font-medium transition">
                Home
              </Link>
              <Link href="/code-lab/about" className="text-fuchsia-400 font-medium">
                Code Lab
              </Link>
              <Link href="/docs" className="text-slate-400 hover:text-white font-medium transition">
                Docs
              </Link>
              <Link href="/#pricing" className="text-slate-400 hover:text-white font-medium transition">
                Pricing
              </Link>
            </div>

            <div className="hidden md:flex items-center space-x-4">
              <Link href="/login" className="px-4 py-2 text-slate-400 hover:text-white font-medium transition">
                Log In
              </Link>
              <Link
                href="/code-lab"
                className="rounded-xl bg-gradient-to-r from-fuchsia-600 to-purple-600 px-6 py-2 text-white font-semibold hover:shadow-lg hover:shadow-fuchsia-500/25 transition-all duration-300"
              >
                Open Code Lab
              </Link>
            </div>

            <MobileMenu />
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden py-20 sm:py-32">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-[500px] h-[500px] bg-fuchsia-600/20 rounded-full blur-[100px] animate-pulse" />
          <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] bg-purple-600/20 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '1s' }} />
        </div>

        <div className="container mx-auto px-4 text-center relative">
          <div className="mx-auto max-w-5xl">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-fuchsia-500/10 backdrop-blur-sm border border-fuchsia-500/30 mb-8">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-fuchsia-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-fuchsia-500"></span>
              </span>
              <span className="text-sm font-medium text-fuchsia-300">Claude Code Competitor</span>
            </div>

            <h1 className="mb-6 text-5xl sm:text-6xl md:text-7xl font-bold leading-tight tracking-tight">
              <span className="text-white">Code Lab</span>
              <br />
              <span className="bg-gradient-to-r from-fuchsia-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                AI Development Environment
              </span>
            </h1>

            <p className="mx-auto mb-10 max-w-3xl text-xl sm:text-2xl text-slate-400 leading-relaxed">
              A full <span className="text-fuchsia-400 font-semibold">Claude Code-like experience</span> in your browser.
              Sandboxed execution, persistent workspaces, and 30+ tools at your command.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3 mb-10">
              {['E2B Sandbox', '30+ Tools', 'GitHub Integration', 'Planning Mode', 'MCP Support', 'Hooks System'].map((feature, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-sm text-slate-300"
                >
                  <span className="text-fuchsia-400">✓</span>
                  <span>{feature}</span>
                </div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/code-lab"
                className="w-full sm:w-auto rounded-xl bg-gradient-to-r from-fuchsia-600 to-purple-600 px-10 py-4 text-lg font-semibold text-white hover:shadow-xl hover:shadow-fuchsia-500/25 transition-all duration-300 hover:-translate-y-0.5"
              >
                Launch Code Lab
              </Link>
              <Link
                href="/docs/code-lab"
                className="w-full sm:w-auto rounded-xl border-2 border-white/20 bg-white/5 backdrop-blur-sm px-10 py-4 text-lg font-semibold text-white hover:bg-white/10 hover:border-white/30 transition-all duration-300"
              >
                Read Documentation
              </Link>
            </div>

            {/* Stats */}
            <div className="mt-12 flex flex-wrap items-center justify-center gap-8 text-sm">
              <div className="text-center">
                <div className="text-3xl font-bold text-fuchsia-400">30+</div>
                <div className="text-slate-500">Tools</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-fuchsia-400">90%</div>
                <div className="text-slate-500">Claude Code Parity</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-fuchsia-400">E2B</div>
                <div className="text-slate-500">Sandboxed</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-fuchsia-400">∞</div>
                <div className="text-slate-500">Persistence</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Technical Architecture Section */}
      <section className="py-24 border-t border-white/10 bg-gradient-to-b from-black to-slate-900/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-4">Technical Architecture</h2>
            <p className="text-xl text-slate-400 max-w-2xl mx-auto">
              Enterprise-grade infrastructure built on cutting-edge AI technology.
            </p>
          </div>

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
            <div className="bg-slate-900/80 rounded-2xl p-8 border border-slate-800">
              <h3 className="text-xl font-bold text-white mb-6 text-center">Request Flow Architecture</h3>
              <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm">
                <div className="flex flex-col items-center gap-2 p-4 bg-blue-500/10 rounded-xl border border-blue-500/30 w-full md:w-auto">
                  <span className="text-2xl">👤</span>
                  <span className="text-blue-300 font-medium">User Request</span>
                  <span className="text-slate-500 text-xs">Natural Language</span>
                </div>
                <div className="text-fuchsia-400 text-2xl">→</div>
                <div className="flex flex-col items-center gap-2 p-4 bg-purple-500/10 rounded-xl border border-purple-500/30 w-full md:w-auto">
                  <span className="text-2xl">🧠</span>
                  <span className="text-purple-300 font-medium">Claude Opus 4.5</span>
                  <span className="text-slate-500 text-xs">Tool Selection</span>
                </div>
                <div className="text-fuchsia-400 text-2xl">→</div>
                <div className="flex flex-col items-center gap-2 p-4 bg-amber-500/10 rounded-xl border border-amber-500/30 w-full md:w-auto">
                  <span className="text-2xl">⚡</span>
                  <span className="text-amber-300 font-medium">E2B Sandbox</span>
                  <span className="text-slate-500 text-xs">Isolated Execution</span>
                </div>
                <div className="text-fuchsia-400 text-2xl">→</div>
                <div className="flex flex-col items-center gap-2 p-4 bg-green-500/10 rounded-xl border border-green-500/30 w-full md:w-auto">
                  <span className="text-2xl">✅</span>
                  <span className="text-green-300 font-medium">Result</span>
                  <span className="text-slate-500 text-xs">Streamed Response</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Code Examples Section */}
      <section className="py-24 border-t border-white/10">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-4">Real Tool Examples</h2>
            <p className="text-xl text-slate-400 max-w-2xl mx-auto">
              See how natural language translates to powerful tool execution.
            </p>
          </div>

          <div className="grid gap-8 lg:grid-cols-2 max-w-6xl mx-auto">
            {/* Example 1: File Creation */}
            <div className="bg-slate-900/50 rounded-2xl overflow-hidden border border-slate-800">
              <div className="px-6 py-4 bg-slate-800/50 border-b border-slate-700">
                <span className="text-sm font-medium text-fuchsia-400">Example: Creating a React Component</span>
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
                    write_file(path: &quot;src/components/Button.tsx&quot;, content: ...)
                  </code>
                </div>
                <div>
                  <div className="text-xs text-slate-500 mb-2">GENERATED CODE</div>
                  <pre className="bg-slate-950 rounded-lg p-3 text-sm font-mono overflow-x-auto text-slate-300">
{`interface ButtonProps {
  variant?: 'primary' | 'secondary';
  children: React.ReactNode;
  onClick?: () => void;
}

export function Button({
  variant = 'primary',
  children,
  onClick
}: ButtonProps) {
  const styles = variant === 'primary'
    ? 'bg-blue-600 hover:bg-blue-500'
    : 'bg-slate-600 hover:bg-slate-500';

  return (
    <button
      className={\`px-4 py-2 rounded \${styles}\`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}`}
                  </pre>
                </div>
              </div>
            </div>

            {/* Example 2: Git Operations */}
            <div className="bg-slate-900/50 rounded-2xl overflow-hidden border border-slate-800">
              <div className="px-6 py-4 bg-slate-800/50 border-b border-slate-700">
                <span className="text-sm font-medium text-fuchsia-400">Example: Git Workflow</span>
              </div>
              <div className="p-6">
                <div className="mb-4">
                  <div className="text-xs text-slate-500 mb-2">USER REQUEST</div>
                  <div className="bg-blue-500/10 rounded-lg p-3 text-blue-200 text-sm">
                    &quot;Commit the auth changes and push to the feature branch&quot;
                  </div>
                </div>
                <div className="mb-4">
                  <div className="text-xs text-slate-500 mb-2">TOOLS EXECUTED (Sequence)</div>
                  <div className="space-y-2">
                    <code className="block bg-slate-800 rounded-lg p-3 text-fuchsia-300 text-sm font-mono">
                      1. git_status()
                    </code>
                    <code className="block bg-slate-800 rounded-lg p-3 text-fuchsia-300 text-sm font-mono">
                      2. git_diff(staged: false)
                    </code>
                    <code className="block bg-slate-800 rounded-lg p-3 text-fuchsia-300 text-sm font-mono">
                      3. git_commit(message: &quot;feat: add user auth&quot;)
                    </code>
                    <code className="block bg-slate-800 rounded-lg p-3 text-fuchsia-300 text-sm font-mono">
                      4. execute_shell(&quot;git push origin feature/auth&quot;)
                    </code>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 mb-2">RESULT</div>
                  <pre className="bg-slate-950 rounded-lg p-3 text-sm font-mono text-green-400">
{`[feature/auth 7a3b2c1] feat: add user auth
 3 files changed, 142 insertions(+)

To github.com:user/repo.git
   abc1234..7a3b2c1  feature/auth -> feature/auth`}
                  </pre>
                </div>
              </div>
            </div>

            {/* Example 3: Search & Refactor */}
            <div className="bg-slate-900/50 rounded-2xl overflow-hidden border border-slate-800">
              <div className="px-6 py-4 bg-slate-800/50 border-b border-slate-700">
                <span className="text-sm font-medium text-fuchsia-400">Example: Codebase Search</span>
              </div>
              <div className="p-6">
                <div className="mb-4">
                  <div className="text-xs text-slate-500 mb-2">USER REQUEST</div>
                  <div className="bg-blue-500/10 rounded-lg p-3 text-blue-200 text-sm">
                    &quot;Find all API endpoints that handle authentication&quot;
                  </div>
                </div>
                <div className="mb-4">
                  <div className="text-xs text-slate-500 mb-2">TOOL EXECUTED</div>
                  <code className="block bg-slate-800 rounded-lg p-3 text-fuchsia-300 text-sm font-mono">
                    search_code(pattern: &quot;auth|login|session&quot;, file_pattern: &quot;**/api/**/*.ts&quot;)
                  </code>
                </div>
                <div>
                  <div className="text-xs text-slate-500 mb-2">RESULT</div>
                  <pre className="bg-slate-950 rounded-lg p-3 text-sm font-mono text-slate-300 overflow-x-auto">
{`Found 12 matches in 5 files:

app/api/auth/login/route.ts:15
  export async function POST(req: Request)

app/api/auth/logout/route.ts:8
  export async function POST(req: Request)

app/api/auth/session/route.ts:12
  export async function GET(req: Request)

...and 9 more matches`}
                  </pre>
                </div>
              </div>
            </div>

            {/* Example 4: Planning Mode */}
            <div className="bg-slate-900/50 rounded-2xl overflow-hidden border border-slate-800">
              <div className="px-6 py-4 bg-slate-800/50 border-b border-slate-700">
                <span className="text-sm font-medium text-fuchsia-400">Example: Planning Mode</span>
              </div>
              <div className="p-6">
                <div className="mb-4">
                  <div className="text-xs text-slate-500 mb-2">USER REQUEST</div>
                  <div className="bg-blue-500/10 rounded-lg p-3 text-blue-200 text-sm">
                    &quot;Add a payment integration with Stripe&quot;
                  </div>
                </div>
                <div className="mb-4">
                  <div className="text-xs text-slate-500 mb-2">AI ENTERS PLANNING MODE</div>
                  <div className="bg-amber-500/10 rounded-lg p-3 text-amber-200 text-sm">
                    Complex task detected. Entering planning mode to explore architecture options...
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 mb-2">GENERATED PLAN</div>
                  <pre className="bg-slate-950 rounded-lg p-3 text-sm font-mono text-slate-300 overflow-x-auto">
{`## Implementation Plan: Stripe Integration

### Tasks:
1. Install @stripe/stripe-js (client)
2. Install stripe (server SDK)
3. Create /api/stripe/checkout route
4. Create /api/stripe/webhook route
5. Add pricing components
6. Configure environment variables

### Architecture Decision:
- Using Stripe Checkout (hosted)
- Webhook for subscription events
- Database sync via webhook

Awaiting approval to proceed...`}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-24 border-t border-white/10">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-4">Enterprise Features</h2>
            <p className="text-xl text-slate-400 max-w-2xl mx-auto">
              Everything you need for serious development work, built for the modern AI era.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 max-w-6xl mx-auto">
            {FEATURES.map((feature, i) => (
              <div
                key={i}
                className="group relative bg-slate-900/50 rounded-2xl p-8 border border-slate-800 hover:border-fuchsia-500/30 transition-all duration-300"
              >
                <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${feature.gradient} opacity-10 rounded-full blur-2xl group-hover:opacity-20 transition-opacity`} />
                <div className="relative">
                  <div className="text-4xl mb-4">{feature.icon}</div>
                  <h3 className="text-xl font-bold text-white mb-2">{feature.title}</h3>
                  <p className="text-slate-400">{feature.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tools Section */}
      <section className="py-24 bg-slate-900/50 border-y border-white/10">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-4">30+ Workspace Tools</h2>
            <p className="text-xl text-slate-400 max-w-2xl mx-auto">
              A comprehensive toolkit for every development task. All accessible through natural language.
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3 max-w-7xl mx-auto">
            {TOOL_CATEGORIES.map((category, i) => (
              <div
                key={i}
                className="bg-black/50 rounded-2xl p-6 border border-slate-800"
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
        </div>
      </section>

      {/* Architecture Section */}
      <section className="py-24">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold text-white mb-4">How It Works</h2>
              <p className="text-xl text-slate-400">
                Enterprise-grade architecture for reliable, secure development.
              </p>
            </div>

            <div className="space-y-8">
              {[
                {
                  step: '1',
                  title: 'Start a Session',
                  desc: 'Launch Code Lab and get an isolated E2B sandbox with full Linux environment, Node.js, Python, and common dev tools pre-installed.',
                },
                {
                  step: '2',
                  title: 'Connect Your Repository',
                  desc: 'Clone your GitHub repo securely with encrypted PAT storage. Your code is isolated per-session with no cross-contamination.',
                },
                {
                  step: '3',
                  title: 'Work with AI',
                  desc: 'Ask the AI to read files, write code, run tests, commit changes. It executes tools automatically in an agentic loop.',
                },
                {
                  step: '4',
                  title: 'Push & Deploy',
                  desc: 'When ready, push changes back to GitHub. Your workspace state is preserved for next time.',
                },
              ].map((item, i) => (
                <div key={i} className="flex gap-6">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-fuchsia-600 to-purple-600 flex items-center justify-center text-white font-bold text-lg shrink-0">
                    {item.step}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white mb-2">{item.title}</h3>
                    <p className="text-slate-400">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Comparison Section */}
      <section className="py-24 bg-gradient-to-b from-slate-900/50 to-black border-t border-white/10">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-4">Claude Code Parity</h2>
            <p className="text-xl text-slate-400 max-w-2xl mx-auto">
              We&apos;ve implemented most of Claude Code&apos;s features, plus some unique advantages.
            </p>
          </div>

          <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-8">
            <div className="bg-slate-800/30 rounded-2xl p-8 border border-slate-700/50">
              <h3 className="text-xl font-semibold text-slate-300 mb-6">Feature Comparison</h3>
              <div className="space-y-3">
                {[
                  ['File Operations', true],
                  ['Code Search (Glob/Grep)', true],
                  ['Shell Execution', true],
                  ['Git Operations', true],
                  ['Planning Mode', true],
                  ['MCP Server Integration', true],
                  ['Hooks System', true],
                  ['Project Memory', true],
                  ['Background Tasks', true],
                  ['Web Search', true],
                ].map(([feature, available], i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-slate-300">{feature as string}</span>
                    <span className={available ? 'text-green-400' : 'text-slate-500'}>
                      {available ? '✓' : '—'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-gradient-to-br from-fuchsia-900/30 to-purple-900/30 rounded-2xl p-8 border border-fuchsia-500/30">
              <h3 className="text-xl font-semibold text-fuchsia-300 mb-6">Code Lab Advantages</h3>
              <div className="space-y-4">
                {[
                  'Sandboxed cloud execution (safer than local)',
                  'Persistent workspace snapshots',
                  'Native GitHub PAT encryption',
                  'Code statistics tracking',
                  'Web-based (any device)',
                  'Voice input support',
                  'Dedicated Git tools (not shell wrappers)',
                ].map((advantage, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-fuchsia-400 mt-0.5">✓</span>
                    <span className="text-slate-200">{advantage}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24">
        <div className="container mx-auto px-4 text-center">
          <div className="mx-auto max-w-3xl bg-gradient-to-br from-fuchsia-900/50 to-purple-900/50 rounded-3xl p-8 sm:p-12 border border-fuchsia-500/30">
            <h2 className="mb-4 text-3xl sm:text-4xl font-bold text-white">Ready to Try Code Lab?</h2>
            <p className="mb-8 text-lg text-slate-300">
              Experience the future of AI-assisted development. No local setup required.
            </p>
            <Link
              href="/code-lab"
              className="inline-block rounded-xl bg-gradient-to-r from-fuchsia-600 to-purple-600 px-10 py-4 text-lg font-semibold text-white hover:shadow-xl hover:shadow-fuchsia-500/25 transition-all duration-300"
            >
              Launch Code Lab
            </Link>
            <p className="mt-4 text-sm text-slate-500">Free tier available. GitHub account required.</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-black text-white py-12 border-t border-white/10">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="text-slate-500 text-sm">
              &copy; {new Date().getFullYear()} JCIL.AI. All rights reserved.
            </div>
            <div className="flex gap-6 text-sm">
              <Link href="/docs" className="text-slate-500 hover:text-white transition">Docs</Link>
              <Link href="/terms" className="text-slate-500 hover:text-white transition">Terms</Link>
              <Link href="/privacy" className="text-slate-500 hover:text-white transition">Privacy</Link>
              <Link href="/contact" className="text-slate-500 hover:text-white transition">Contact</Link>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}

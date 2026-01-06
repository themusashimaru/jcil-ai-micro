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

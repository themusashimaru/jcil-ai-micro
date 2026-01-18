/**
 * CODE LAB PUBLIC LANDING PAGE
 *
 * Professional marketing page for Code Lab
 * Full technical breakdown for developers
 * Beyond Claude Code - The Ultimate AI-Powered IDE
 */

import Link from 'next/link';
import LandingHeader from '../../components/landing/LandingHeader';
import LandingFooter from '../../components/landing/LandingFooter';
import Section, { SectionHeader } from '../../components/landing/Section';
import FeatureCard, { StatCard } from '../../components/landing/FeatureCard';

export const metadata = {
  title: 'Code Lab - Beyond Claude Code | JCIL.AI',
  description:
    'Go beyond Claude Code with AI pair programming, visual debugging, real-time collaboration, and 55+ tools. The only AI IDE that goes beyond the CLI.',
};

const BEYOND_CLAUDE_FEATURES = [
  {
    title: 'AI Pair Programming',
    icon: '🤖',
    color: 'fuchsia' as const,
    description:
      'Proactive AI suggestions as you type. Bug detection, refactoring hints, and ghost text completions.',
    highlight: 'Only in Code Lab',
  },
  {
    title: 'Visual Debugging',
    icon: '🐛',
    color: 'purple' as const,
    description:
      'Set breakpoints, inspect variables, step through code. Full debugging UI in your browser.',
    highlight: 'Only in Code Lab',
  },
  {
    title: 'Real-Time Collaboration',
    icon: '👥',
    color: 'blue' as const,
    description:
      'See collaborator cursors, share code sessions, annotate together. True multi-user coding.',
    highlight: 'Only in Code Lab',
  },
  {
    title: 'Extended Thinking UI',
    icon: '🧠',
    color: 'amber' as const,
    description: 'Watch Claude think in real-time. Stream, tree, and timeline views of reasoning.',
    highlight: 'Only in Code Lab',
  },
  {
    title: 'Monaco-Style Editor',
    icon: '📝',
    color: 'green' as const,
    description:
      'Professional code editor with tabs, diff view, inline edits, and syntax highlighting.',
    highlight: 'Only in Code Lab',
  },
  {
    title: 'Permission Dialogs',
    icon: '🔐',
    color: 'red' as const,
    description:
      'Explicit approval for dangerous operations. Risk levels, affected files, always-allow option.',
    highlight: 'Only in Code Lab',
  },
];

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
      { name: 'run_build', desc: 'Execute build with auto-detection' },
      { name: 'run_tests', desc: 'Execute test suites' },
      { name: 'install_packages', desc: 'Install dependencies' },
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
      { name: 'git_branch', desc: 'Branch management' },
      { name: 'git_log', desc: 'Commit history' },
      { name: 'create_pr', desc: 'Open pull requests' },
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
      { name: 'todo_write', desc: 'Track task progress' },
    ],
  },
  {
    title: 'MCP Servers',
    icon: '🔌',
    color: 'fuchsia' as const,
    tools: [
      { name: 'puppeteer', desc: 'Browser automation & screenshots' },
      { name: 'github', desc: 'Full GitHub API access' },
      { name: 'postgres', desc: 'Database queries' },
      { name: 'memory', desc: 'Persistent key-value store' },
      { name: 'filesystem', desc: 'Enhanced file operations' },
    ],
  },
  {
    title: 'Advanced Features',
    icon: '🚀',
    color: 'purple' as const,
    tools: [
      { name: 'hooks_system', desc: 'Pre/post tool execution hooks' },
      { name: 'bg_tasks', desc: 'Background task management' },
      { name: 'project_memory', desc: 'CODELAB.md persistent context' },
      { name: 'deploy', desc: 'Multi-platform deployment' },
      { name: 'web_fetch', desc: 'Fetch and parse URLs' },
    ],
  },
];

const TECH_STACK = [
  {
    name: 'Claude Opus 4.5',
    category: 'AI Model',
    desc: 'The most capable Claude model with extended thinking for complex reasoning',
    icon: '🧠',
  },
  {
    name: 'E2B Sandbox',
    category: 'Execution',
    desc: 'Isolated cloud containers with full Linux environment',
    icon: '📦',
  },
  {
    name: '5 MCP Servers',
    category: 'Integration',
    desc: 'Real implementations: Puppeteer, GitHub, PostgreSQL, Memory, Filesystem',
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
    name: 'Multi-Platform Deploy',
    category: 'Deployment',
    desc: 'One-click deploy to Vercel, Netlify, Railway, Cloudflare',
    icon: '🚀',
  },
];

const COMPARISON_DATA = [
  { feature: 'File Operations', claudeCode: true, codeLab: true },
  { feature: 'Git Integration', claudeCode: true, codeLab: true },
  { feature: 'Shell Execution', claudeCode: true, codeLab: true },
  { feature: 'Planning Mode', claudeCode: true, codeLab: true },
  { feature: 'MCP Servers', claudeCode: true, codeLab: true },
  { feature: 'Project Memory', claudeCode: true, codeLab: true },
  { feature: 'Zero Install (Browser)', claudeCode: false, codeLab: true },
  { feature: 'Cloud Sandbox', claudeCode: false, codeLab: true },
  { feature: 'AI Pair Programming', claudeCode: false, codeLab: true },
  { feature: 'Visual Debugging', claudeCode: false, codeLab: true },
  { feature: 'Real-Time Collaboration', claudeCode: false, codeLab: true },
  { feature: 'Extended Thinking UI', claudeCode: false, codeLab: true },
  { feature: 'Multi-Platform Deploy', claudeCode: false, codeLab: true },
  { feature: 'Browser Automation (Puppeteer)', claudeCode: false, codeLab: true },
  { feature: 'Database Queries (PostgreSQL)', claudeCode: false, codeLab: true },
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
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-fuchsia-500/20 to-purple-500/20 backdrop-blur-sm border border-fuchsia-500/30 mb-8">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-fuchsia-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-fuchsia-500"></span>
              </span>
              <span className="text-sm font-bold text-fuchsia-300">Beyond Claude Code</span>
            </div>

            {/* Main Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-7xl font-bold tracking-tight leading-[1.1] mb-6">
              <span className="text-white">Code Lab</span>
              <br />
              <span className="bg-gradient-to-r from-fuchsia-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                The Ultimate AI-Powered IDE
              </span>
            </h1>

            {/* Subheadline */}
            <p className="mx-auto max-w-3xl text-lg sm:text-xl text-slate-400 leading-relaxed mb-8">
              Go <span className="text-fuchsia-400 font-bold">beyond Claude Code</span> with AI pair
              programming, visual debugging, real-time collaboration, and{' '}
              <span className="text-fuchsia-400 font-bold">55+ tools</span>. The only AI IDE that{' '}
              <span className="text-white font-semibold">goes beyond the CLI</span>.
            </p>

            {/* Feature Pills */}
            <div className="flex flex-wrap items-center justify-center gap-3 mb-10">
              {[
                { label: 'AI Pair Programming', exclusive: true },
                { label: 'Visual Debugging', exclusive: true },
                { label: 'Real-Time Collab', exclusive: true },
                { label: '55+ Tools', exclusive: false },
                { label: '5 MCP Servers', exclusive: false },
                { label: 'Cloud Sandbox', exclusive: true },
              ].map((feature, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm ${
                    feature.exclusive
                      ? 'bg-gradient-to-r from-fuchsia-500/20 to-purple-500/20 border border-fuchsia-500/30 text-fuchsia-300'
                      : 'bg-white/5 border border-white/10 text-slate-300'
                  }`}
                >
                  {feature.exclusive && (
                    <span className="text-xs font-bold text-fuchsia-400">★</span>
                  )}
                  {feature.label}
                </div>
              ))}
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
              <Link
                href="/code-lab"
                className="w-full sm:w-auto rounded-lg bg-gradient-to-r from-fuchsia-600 to-purple-600 hover:from-fuchsia-500 hover:to-purple-500 px-8 py-4 text-base font-semibold text-white transition-all shadow-lg shadow-fuchsia-500/20"
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
              <StatCard value="55+" label="Dev Tools" color="fuchsia" />
              <StatCard value="5" label="MCP Servers" color="purple" />
              <StatCard value="4" label="Deploy Targets" color="blue" />
              <StatCard value="∞" label="Collaboration" color="green" />
            </div>
          </div>
        </div>
      </section>

      {/* Beyond Claude Code Section */}
      <Section background="gradient" padding="lg" className="border-t border-white/5">
        <SectionHeader
          badge="Exclusive Features"
          badgeColor="fuchsia"
          title="Beyond Claude Code"
          description="Features you won't find in Claude Code CLI. Code Lab is the only AI IDE that goes beyond."
        />

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 max-w-6xl mx-auto">
          {BEYOND_CLAUDE_FEATURES.map((feature, i) => (
            <div
              key={i}
              className="relative bg-slate-900/50 rounded-2xl p-6 border border-slate-800 hover:border-fuchsia-500/30 transition-all group"
            >
              {/* Exclusive Badge */}
              <div className="absolute -top-3 right-4 px-3 py-1 bg-gradient-to-r from-fuchsia-600 to-purple-600 rounded-full text-xs font-bold text-white">
                {feature.highlight}
              </div>

              <div className="flex items-start gap-4 mt-2">
                <div className="text-4xl">{feature.icon}</div>
                <div>
                  <h3 className="text-lg font-bold text-white mb-2">{feature.title}</h3>
                  <p className="text-sm text-slate-400">{feature.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Comparison Section */}
      <Section padding="lg" className="border-t border-white/5">
        <SectionHeader
          badge="Comparison"
          badgeColor="green"
          title="Code Lab vs Claude Code CLI"
          description="See exactly what makes Code Lab the superior choice for AI-powered development."
        />

        <div className="max-w-4xl mx-auto">
          <div className="bg-slate-900/80 rounded-2xl overflow-hidden border border-slate-800">
            <div className="grid grid-cols-3 bg-slate-800/50 border-b border-slate-700">
              <div className="p-4 font-semibold text-slate-300">Feature</div>
              <div className="p-4 font-semibold text-slate-400 text-center">Claude Code CLI</div>
              <div className="p-4 font-semibold text-fuchsia-400 text-center">Code Lab</div>
            </div>
            <div className="divide-y divide-slate-800/50">
              {COMPARISON_DATA.map((row, i) => (
                <div
                  key={i}
                  className={`grid grid-cols-3 ${!row.claudeCode && row.codeLab ? 'bg-fuchsia-500/5' : ''}`}
                >
                  <div className="p-4 text-slate-300 text-sm">{row.feature}</div>
                  <div className="p-4 text-center">
                    {row.claudeCode ? (
                      <svg
                        className="w-5 h-5 text-green-400 mx-auto"
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
                    ) : (
                      <svg
                        className="w-5 h-5 text-slate-600 mx-auto"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    )}
                  </div>
                  <div className="p-4 text-center">
                    {row.codeLab ? (
                      <svg
                        className="w-5 h-5 text-fuchsia-400 mx-auto"
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
                    ) : (
                      <svg
                        className="w-5 h-5 text-slate-600 mx-auto"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Summary Box */}
          <div className="mt-8 p-6 bg-gradient-to-r from-fuchsia-900/30 to-purple-900/30 rounded-2xl border border-fuchsia-500/30 text-center">
            <p className="text-xl font-bold text-white mb-2">
              Code Lab has <span className="text-fuchsia-400">9 exclusive features</span> not
              available in Claude Code CLI
            </p>
            <p className="text-slate-400">
              Everything Claude Code can do, plus AI pair programming, visual debugging, real-time
              collaboration, and more.
            </p>
          </div>
        </div>
      </Section>

      {/* Technical Architecture Section */}
      <Section background="muted" padding="lg" className="border-y border-white/5">
        <SectionHeader
          badge="Architecture"
          badgeColor="purple"
          title="Enterprise-Grade Infrastructure"
          description="Built on cutting-edge technology for maximum capability and security."
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

      {/* Tools Section */}
      <Section padding="lg">
        <SectionHeader
          badge="55+ Tools"
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

      {/* Code Examples Section */}
      <Section background="gradient" padding="lg" className="border-t border-white/5">
        <SectionHeader
          badge="Examples"
          badgeColor="blue"
          title="See it in action"
          description="Real examples of how natural language translates to powerful tool execution."
        />

        <div className="grid gap-6 lg:grid-cols-2 max-w-6xl mx-auto">
          {/* Example 1 */}
          <div className="bg-slate-900/50 rounded-2xl overflow-hidden border border-slate-800">
            <div className="px-6 py-4 bg-slate-800/50 border-b border-slate-700">
              <span className="text-sm font-medium text-fuchsia-400">
                AI Pair Programming in Action
              </span>
            </div>
            <div className="p-6">
              <div className="mb-4">
                <div className="text-xs text-slate-500 mb-2">YOU TYPE</div>
                <div className="bg-slate-800 rounded-lg p-3 text-slate-300 text-sm font-mono">
                  function validateEm
                  <span className="bg-fuchsia-500/30 text-fuchsia-300">ail(email) {'{'}</span>
                </div>
              </div>
              <div className="mb-4">
                <div className="text-xs text-slate-500 mb-2">CLAUDE SUGGESTS (GHOST TEXT)</div>
                <div className="bg-fuchsia-500/10 rounded-lg p-3 text-fuchsia-300/70 text-sm font-mono border border-fuchsia-500/20">
                  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                  <br />
                  return regex.test(email);
                  <br />
                  {'}'}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500 mb-2">INLINE SUGGESTION</div>
                <div className="flex items-center gap-2 p-3 bg-amber-500/10 rounded-lg border border-amber-500/20">
                  <span className="text-amber-400">💡</span>
                  <span className="text-amber-300 text-sm">
                    Consider adding TypeScript types for better safety
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Example 2 */}
          <div className="bg-slate-900/50 rounded-2xl overflow-hidden border border-slate-800">
            <div className="px-6 py-4 bg-slate-800/50 border-b border-slate-700">
              <span className="text-sm font-medium text-fuchsia-400">Visual Debugging</span>
            </div>
            <div className="p-6">
              <div className="mb-4">
                <div className="text-xs text-slate-500 mb-2">BREAKPOINT HIT AT LINE 42</div>
                <div className="bg-slate-800 rounded-lg p-3 text-sm font-mono">
                  <div className="flex items-center gap-2">
                    <span className="text-red-400">●</span>
                    <span className="text-slate-500">42</span>
                    <span className="text-blue-300">const</span>
                    <span className="text-white">result</span>
                    <span className="text-slate-400">=</span>
                    <span className="text-green-300">calculateTotal</span>
                    <span className="text-slate-400">(items);</span>
                  </div>
                </div>
              </div>
              <div className="mb-4">
                <div className="text-xs text-slate-500 mb-2">VARIABLES</div>
                <div className="bg-slate-800 rounded-lg p-3 text-sm font-mono space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-purple-400">items</span>
                    <span className="text-slate-400">:</span>
                    <span className="text-green-300">Array(3)</span>
                    <span className="text-yellow-400 text-xs">changed</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-purple-400">total</span>
                    <span className="text-slate-400">:</span>
                    <span className="text-blue-300">0</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <button className="px-3 py-1.5 bg-blue-500/20 text-blue-300 rounded text-xs font-medium">
                  ▶ Continue
                </button>
                <button className="px-3 py-1.5 bg-slate-700 text-slate-300 rounded text-xs font-medium">
                  ↓ Step Over
                </button>
                <button className="px-3 py-1.5 bg-slate-700 text-slate-300 rounded text-xs font-medium">
                  ↘ Step Into
                </button>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* Features Grid */}
      <Section padding="lg" className="border-t border-white/5">
        <SectionHeader
          badge="Features"
          badgeColor="green"
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
            emoji="🚀"
            title="Multi-Platform Deploy"
            description="One-click deployment to Vercel, Netlify, Railway, or Cloudflare. Ship faster than ever."
            variant="gradient"
            color="cyan"
          />
        </div>
      </Section>

      {/* CTA Section */}
      <Section padding="xl">
        <div className="relative mx-auto max-w-4xl">
          <div className="absolute inset-0 bg-gradient-to-r from-fuchsia-600/20 via-purple-600/20 to-pink-600/20 rounded-3xl blur-xl" />

          <div className="relative bg-gradient-to-br from-slate-900 to-slate-950 rounded-3xl p-8 lg:p-16 border border-white/10 text-center">
            <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">Ready to go beyond?</h2>
            <p className="text-lg text-slate-400 mb-8 max-w-xl mx-auto">
              Experience the future of AI-assisted development. No local setup required. AI pair
              programming, visual debugging, and real-time collaboration await.
            </p>
            <Link
              href="/code-lab"
              className="inline-block rounded-xl bg-gradient-to-r from-fuchsia-600 to-purple-600 hover:from-fuchsia-500 hover:to-purple-500 px-10 py-4 text-base font-semibold text-white transition-all shadow-lg shadow-fuchsia-500/20"
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

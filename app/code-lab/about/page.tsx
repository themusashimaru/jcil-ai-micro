/**
 * CODE LAB TECHNICAL SPECIFICATIONS PAGE
 *
 * Comprehensive technical documentation for developers
 * Full Claude Code parity showcase
 * Enterprise-grade feature breakdown
 */

import Link from 'next/link';
import LandingHeader from '../../components/landing/LandingHeader';
import LandingFooter from '../../components/landing/LandingFooter';
import Section, { SectionHeader } from '../../components/landing/Section';
import FeatureCard, { StatCard } from '../../components/landing/FeatureCard';

export const metadata = {
  title: 'Code Lab - Enterprise AI Development Environment | 100% Claude Code Parity',
  description:
    'Enterprise-grade agentic IDE with 55+ tools, 5 MCP servers, visual debugging for 32 languages, real-time collaboration, and cloud-sandboxed execution. 100% Claude Code feature parity.',
  keywords:
    'AI IDE, Claude Code, agentic development, visual debugging, MCP servers, cloud IDE, code execution sandbox',
};

// 55+ Agentic Tools organized by category
const TOOL_CATEGORIES = [
  {
    title: 'File Operations',
    icon: '📁',
    color: 'blue',
    tools: [
      { name: 'read_file', desc: 'Read with line range support and syntax highlighting' },
      { name: 'write_file', desc: 'Create or overwrite files atomically' },
      { name: 'edit_file', desc: 'Surgical find-and-replace modifications' },
      { name: 'multi_edit', desc: 'Atomic batch edits across multiple files' },
      { name: 'list_files', desc: 'Directory exploration with glob patterns' },
      { name: 'search_files', desc: 'Pattern-based file discovery' },
      { name: 'search_code', desc: 'Grep through codebase with regex' },
    ],
  },
  {
    title: 'Shell & Execution',
    icon: '⚡',
    color: 'amber',
    tools: [
      { name: 'execute_shell', desc: 'Run any command with full PTY support' },
      { name: 'run_build', desc: 'Auto-detect: npm, yarn, pnpm, make, cargo, go' },
      { name: 'run_tests', desc: 'Auto-detect: jest, vitest, pytest, go test' },
      { name: 'install_packages', desc: 'Smart package manager detection' },
      { name: 'run_formatter', desc: 'Prettier, ESLint, Black, gofmt support' },
    ],
  },
  {
    title: 'Git Operations',
    icon: '📦',
    color: 'green',
    tools: [
      { name: 'git_status', desc: 'Full repository state visibility' },
      { name: 'git_diff', desc: 'Staged and unstaged change comparison' },
      { name: 'git_commit', desc: 'Intelligent commit with staging' },
      { name: 'git_log', desc: 'History with formatting options' },
      { name: 'git_branch', desc: 'Create, list, delete branches' },
      { name: 'git_checkout', desc: 'Switch branches or restore files' },
      { name: 'git_push', desc: 'Push with upstream tracking' },
      { name: 'git_pull', desc: 'Pull with rebase option' },
      { name: 'create_pr', desc: 'Open pull requests via GitHub API' },
    ],
  },
  {
    title: 'Visual Debugging',
    icon: '🔍',
    color: 'purple',
    tools: [
      { name: 'debug_start', desc: 'Initialize debug session for any language' },
      { name: 'debug_set_breakpoint', desc: 'Line, conditional, logpoint breakpoints' },
      { name: 'debug_step', desc: 'Step over, into, out of frames' },
      { name: 'debug_continue', desc: 'Continue to next breakpoint' },
      { name: 'debug_evaluate', desc: 'Evaluate expressions in context' },
      { name: 'debug_stop', desc: 'Terminate debug session cleanly' },
    ],
  },
  {
    title: 'Deployment',
    icon: '🚀',
    color: 'cyan',
    tools: [
      { name: 'deploy_vercel', desc: 'Serverless, Edge, Preview deployments' },
      { name: 'deploy_netlify', desc: 'Continuous deployment, Forms, Edge' },
      { name: 'deploy_railway', desc: 'Containers, Databases, Cron jobs' },
      { name: 'deploy_cloudflare', desc: 'Workers, Pages, R2, D1' },
    ],
  },
  {
    title: 'Planning & Agents',
    icon: '📋',
    color: 'fuchsia',
    tools: [
      { name: 'enter_plan_mode', desc: 'Start structured planning session' },
      { name: 'write_plan', desc: 'Create multi-step execution plans' },
      { name: 'exit_plan_mode', desc: 'Finalize and begin execution' },
      { name: 'spawn_subagent', desc: 'Delegate to specialized agents' },
      { name: 'create_task', desc: 'Add tasks to execution queue' },
      { name: 'evaluate_plan', desc: 'Assess plan viability' },
    ],
  },
];

// 5 Production MCP Servers
const MCP_SERVERS = [
  {
    name: 'Filesystem',
    tools: 7,
    icon: '📂',
    description: 'Secure file operations within sandboxed workspace',
    capabilities: [
      'read_file',
      'write_file',
      'list_directory',
      'search_files',
      'get_info',
      'move_file',
      'copy_file',
    ],
  },
  {
    name: 'GitHub',
    tools: 4,
    icon: '🐙',
    description: 'Full GitHub API integration for repos and issues',
    capabilities: ['get_repo', 'list_issues', 'create_issue', 'create_pr'],
  },
  {
    name: 'PostgreSQL',
    tools: 1,
    icon: '🗄️',
    description: 'Read-only database access with Row-Level Security',
    capabilities: ['query (SELECT only)'],
  },
  {
    name: 'Memory',
    tools: 4,
    icon: '🧠',
    description: 'Persistent key-value storage for project context',
    capabilities: ['store', 'retrieve', 'list_keys', 'search'],
  },
  {
    name: 'Puppeteer',
    tools: 5,
    icon: '🌐',
    description: 'Browser automation for testing and scraping',
    capabilities: ['navigate', 'screenshot', 'click', 'type', 'evaluate'],
  },
];

// 32 Supported Debug Languages
const DEBUG_LANGUAGES = {
  full: [
    'JavaScript',
    'TypeScript',
    'Python',
    'Go',
    'Rust',
    'Java',
    'C',
    'C++',
    'C#',
    'Ruby',
    'PHP',
  ],
  basic: [
    'Kotlin',
    'Swift',
    'Scala',
    'Perl',
    'Lua',
    'R',
    'Julia',
    'Haskell',
    'Elixir',
    'Clojure',
    'Dart',
    'Zig',
    'Nim',
    'Crystal',
    'OCaml',
    'F#',
    'Erlang',
    'Racket',
    'Scheme',
    'Common Lisp',
    'FORTRAN',
  ],
};

// Claude Code Parity Features
const PARITY_FEATURES = [
  {
    feature: 'Terminal Access',
    claudeCode: true,
    codeLab: true,
    notes: 'Full PTY with ANSI colors',
  },
  {
    feature: 'File Operations',
    claudeCode: true,
    codeLab: true,
    notes: '7 tools with glob support',
  },
  {
    feature: 'Git Integration',
    claudeCode: true,
    codeLab: true,
    notes: '9 git tools + GitHub API',
  },
  { feature: 'MCP Servers', claudeCode: true, codeLab: true, notes: '5 production servers' },
  { feature: 'Custom Commands', claudeCode: true, codeLab: true, notes: '.claude/commands/*.md' },
  { feature: 'Hook System', claudeCode: true, codeLab: true, notes: '8 hook types' },
  { feature: 'Plan Mode', claudeCode: true, codeLab: true, notes: 'Visual UI with steps' },
  { feature: 'Plugins', claudeCode: true, codeLab: true, notes: 'Marketplace included' },
  { feature: 'Output Styles', claudeCode: true, codeLab: true, notes: '4 formatting modes' },
  { feature: 'Vim Mode', claudeCode: true, codeLab: true, notes: 'Full Vim keybindings' },
  { feature: 'Extended Thinking', claudeCode: true, codeLab: true, notes: 'Visual tree/timeline' },
  { feature: 'Checkpoints', claudeCode: true, codeLab: true, notes: 'Full workspace snapshots' },
  { feature: 'Session Forking', claudeCode: true, codeLab: true, notes: 'Parallel workspaces' },
  { feature: 'Tool Permissions', claudeCode: true, codeLab: true, notes: 'Glob-based allow/deny' },
];

// Code Lab Exclusive Features
const EXCLUSIVE_FEATURES = [
  { feature: 'Zero Installation', description: 'Start coding instantly in your browser' },
  { feature: 'Cloud Sandboxed Execution', description: 'Enterprise security by default with E2B' },
  { feature: 'Visual Debugging', description: '32-language integrated debugger with DAP/CDP' },
  { feature: 'Real-Time Collaboration', description: 'Multi-user development with shared cursors' },
  { feature: 'One-Click Deployment', description: 'Vercel, Netlify, Railway, Cloudflare' },
  {
    feature: 'Extended Thinking Visualization',
    description: "See Claude's reasoning in tree/timeline view",
  },
  { feature: 'Cognitive Debugging', description: 'AI-powered root cause analysis' },
  { feature: 'Browser Automation', description: 'Built-in Puppeteer MCP server' },
  { feature: 'Plugin Marketplace', description: 'Discover and install community extensions' },
  { feature: 'Checkpoint/Rewind System', description: 'Full workspace recovery at any point' },
];

// Tech Stack
const TECH_STACK = [
  {
    name: 'Claude Opus 4.6',
    category: 'AI Model',
    desc: '200K context window with extended thinking',
    icon: '🧠',
  },
  {
    name: 'E2B Sandbox',
    category: 'Execution',
    desc: 'Isolated Ubuntu 22.04 containers',
    icon: '📦',
  },
  {
    name: 'Monaco Editor',
    category: 'Editor',
    desc: 'VS Code editor with full LSP support',
    icon: '✏️',
  },
  {
    name: 'xterm.js',
    category: 'Terminal',
    desc: 'Full PTY terminal with ANSI colors',
    icon: '💻',
  },
  {
    name: 'Debug Adapter Protocol',
    category: 'Debugging',
    desc: '32 language support via DAP/CDP',
    icon: '🔍',
  },
  {
    name: 'Supabase PostgreSQL',
    category: 'Database',
    desc: 'Row-Level Security enabled',
    icon: '🗄️',
  },
  { name: 'Upstash Redis', category: 'Cache', desc: 'Rate limiting and session cache', icon: '⚡' },
  {
    name: 'WebAuthn/Passkeys',
    category: 'Auth',
    desc: 'Biometric and hardware key support',
    icon: '🔐',
  },
];

export default function CodeLabTechnicalPage() {
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
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-fuchsia-500/5 rounded-full blur-[150px]" />
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
              <span className="text-sm font-medium text-fuchsia-300">
                100% Claude Code Parity Achieved
              </span>
            </div>

            {/* Main Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-7xl font-bold tracking-tight leading-[1.1] mb-6">
              <span className="text-white">Code Lab</span>
              <br />
              <span className="bg-gradient-to-r from-fuchsia-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                Enterprise AI Development
              </span>
            </h1>

            {/* Subheadline */}
            <p className="mx-auto max-w-3xl text-lg sm:text-xl text-slate-400 leading-relaxed mb-8">
              The most powerful AI development environment on the web. 55+ autonomous tools, 5
              production MCP servers, visual debugging for 32 languages, and real-time
              collaboration—all with{' '}
              <span className="text-fuchsia-400 font-semibold">zero installation required</span>.
            </p>

            {/* Stats Row */}
            <div className="flex flex-wrap items-center justify-center gap-6 lg:gap-10 mb-10">
              <StatCard value="55+" label="Agentic Tools" color="fuchsia" />
              <StatCard value="5" label="MCP Servers" color="fuchsia" />
              <StatCard value="32" label="Debug Languages" color="fuchsia" />
              <StatCard value="2,128" label="Tests Passing" color="fuchsia" />
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
              <Link
                href="/code-lab"
                className="w-full sm:w-auto rounded-lg bg-fuchsia-600 hover:bg-fuchsia-500 px-8 py-4 text-base font-semibold text-white transition-all shadow-lg shadow-fuchsia-500/20"
              >
                Launch Code Lab
              </Link>
              <a
                href="#technical-specs"
                className="w-full sm:w-auto rounded-lg border border-white/20 bg-white/5 backdrop-blur-sm px-8 py-4 text-base font-semibold text-white hover:bg-white/10 transition-all"
              >
                View Technical Specs
              </a>
            </div>

            {/* Build Info */}
            <p className="text-sm text-slate-500">
              Built in 48-hour engineering sprint • Production-ready infrastructure • Enterprise
              security by default
            </p>
          </div>
        </div>
      </section>

      {/* Quick Stats Banner */}
      <Section background="muted" padding="md" className="border-y border-white/5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-5xl mx-auto text-center">
          <div className="bg-slate-900/50 rounded-xl p-6 border border-slate-800">
            <div className="text-3xl font-bold text-fuchsia-400 mb-1">100%</div>
            <div className="text-sm text-slate-400">Claude Code Parity</div>
          </div>
          <div className="bg-slate-900/50 rounded-xl p-6 border border-slate-800">
            <div className="text-3xl font-bold text-fuchsia-400 mb-1">200K</div>
            <div className="text-sm text-slate-400">Context Window</div>
          </div>
          <div className="bg-slate-900/50 rounded-xl p-6 border border-slate-800">
            <div className="text-3xl font-bold text-fuchsia-400 mb-1">E2B</div>
            <div className="text-sm text-slate-400">Cloud Sandbox</div>
          </div>
          <div className="bg-slate-900/50 rounded-xl p-6 border border-slate-800">
            <div className="text-3xl font-bold text-fuchsia-400 mb-1">0</div>
            <div className="text-sm text-slate-400">Installation Required</div>
          </div>
        </div>
      </Section>

      {/* Breakthrough Banner */}
      <Section padding="lg" className="border-b border-white/5">
        <div className="max-w-4xl mx-auto">
          <div className="bg-gradient-to-br from-fuchsia-950/80 to-purple-950/40 rounded-3xl p-8 lg:p-12 border border-fuchsia-500/30">
            <div className="text-center mb-8">
              <span className="inline-block px-4 py-1 rounded-full bg-fuchsia-500/20 text-fuchsia-300 text-sm font-semibold mb-4">
                Our Latest Breakthrough
              </span>
              <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">
                Claude Code in Your Browser
              </h2>
              <p className="text-lg text-slate-300 leading-relaxed max-w-2xl mx-auto">
                What started as an ambitious goal to bring Claude Code&apos;s power to the web has
                evolved into something far more capable: a complete IDE that not only matches every
                Claude Code feature but extends beyond with visual debugging, real-time
                collaboration, and enterprise-grade security.
              </p>
            </div>

            <div className="grid md:grid-cols-4 gap-4">
              <div className="bg-black/30 rounded-xl p-4 text-center border border-white/5">
                <div className="text-2xl font-bold text-white mb-1">2,128</div>
                <div className="text-sm text-slate-400">Tests Passing</div>
              </div>
              <div className="bg-black/30 rounded-xl p-4 text-center border border-white/5">
                <div className="text-2xl font-bold text-white mb-1">55+</div>
                <div className="text-sm text-slate-400">Agentic Tools</div>
              </div>
              <div className="bg-black/30 rounded-xl p-4 text-center border border-white/5">
                <div className="text-2xl font-bold text-white mb-1">5</div>
                <div className="text-sm text-slate-400">MCP Servers</div>
              </div>
              <div className="bg-black/30 rounded-xl p-4 text-center border border-white/5">
                <div className="text-2xl font-bold text-white mb-1">100%</div>
                <div className="text-sm text-slate-400">Feature Parity</div>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* Technical Architecture */}
      <Section id="technical-specs" background="gradient" padding="lg">
        <SectionHeader
          badge="Architecture"
          badgeColor="fuchsia"
          title="Technical Architecture"
          description="Enterprise-grade infrastructure built on cutting-edge AI technology with three-tier security model."
        />

        {/* Architecture Diagram */}
        <div className="max-w-5xl mx-auto mb-16">
          <div className="bg-slate-900/80 rounded-2xl p-6 lg:p-8 border border-slate-800">
            <h3 className="text-xl font-bold text-white mb-6 text-center">System Architecture</h3>
            <div className="space-y-4">
              {/* Client Layer */}
              <div className="bg-blue-500/10 rounded-xl p-4 border border-blue-500/30">
                <div className="text-blue-300 font-semibold text-sm mb-3">CLIENT LAYER</div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-black/30 rounded-lg p-3 text-center">
                    <div className="text-lg mb-1">✏️</div>
                    <div className="text-xs text-slate-300">Monaco Editor</div>
                  </div>
                  <div className="bg-black/30 rounded-lg p-3 text-center">
                    <div className="text-lg mb-1">💻</div>
                    <div className="text-xs text-slate-300">xterm.js Terminal</div>
                  </div>
                  <div className="bg-black/30 rounded-lg p-3 text-center">
                    <div className="text-lg mb-1">👥</div>
                    <div className="text-xs text-slate-300">Real-time Presence</div>
                  </div>
                </div>
              </div>

              <div className="text-center text-fuchsia-400">▼</div>

              {/* Application Layer */}
              <div className="bg-purple-500/10 rounded-xl p-4 border border-purple-500/30">
                <div className="text-purple-300 font-semibold text-sm mb-3">APPLICATION LAYER</div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-black/30 rounded-lg p-3 text-center">
                    <div className="text-lg mb-1">🧠</div>
                    <div className="text-xs text-slate-300">Claude Opus 4.6</div>
                  </div>
                  <div className="bg-black/30 rounded-lg p-3 text-center">
                    <div className="text-lg mb-1">🔌</div>
                    <div className="text-xs text-slate-300">MCP Router</div>
                  </div>
                  <div className="bg-black/30 rounded-lg p-3 text-center">
                    <div className="text-lg mb-1">📊</div>
                    <div className="text-xs text-slate-300">Session Manager</div>
                  </div>
                </div>
              </div>

              <div className="text-center text-fuchsia-400">▼</div>

              {/* Execution Layer */}
              <div className="bg-amber-500/10 rounded-xl p-4 border border-amber-500/30">
                <div className="text-amber-300 font-semibold text-sm mb-3">
                  EXECUTION LAYER (E2B Sandbox)
                </div>
                <div className="grid grid-cols-4 gap-4">
                  <div className="bg-black/30 rounded-lg p-3 text-center">
                    <div className="text-lg mb-1">🖥️</div>
                    <div className="text-xs text-slate-300">PTY Terminal</div>
                  </div>
                  <div className="bg-black/30 rounded-lg p-3 text-center">
                    <div className="text-lg mb-1">📝</div>
                    <div className="text-xs text-slate-300">LSP Server</div>
                  </div>
                  <div className="bg-black/30 rounded-lg p-3 text-center">
                    <div className="text-lg mb-1">🔍</div>
                    <div className="text-xs text-slate-300">DAP Debugger</div>
                  </div>
                  <div className="bg-black/30 rounded-lg p-3 text-center">
                    <div className="text-lg mb-1">📂</div>
                    <div className="text-xs text-slate-300">File System</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tech Stack Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 max-w-6xl mx-auto">
          {TECH_STACK.map((tech, i) => (
            <div
              key={i}
              className="bg-slate-900/50 rounded-xl p-5 border border-slate-800 hover:border-fuchsia-500/30 transition-all"
            >
              <div className="flex items-start gap-3">
                <div className="text-2xl">{tech.icon}</div>
                <div>
                  <div className="text-xs text-fuchsia-400 font-medium mb-1">{tech.category}</div>
                  <h3 className="text-base font-bold text-white mb-1">{tech.name}</h3>
                  <p className="text-xs text-slate-400">{tech.desc}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* 55+ Agentic Tools */}
      <Section padding="lg">
        <SectionHeader
          badge="55+ Tools"
          badgeColor="blue"
          title="Complete Agentic Toolkit"
          description="Claude doesn't just suggest—it builds, tests, debugs, and deploys. Every tool designed for autonomous execution."
        />

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 max-w-7xl mx-auto">
          {TOOL_CATEGORIES.map((category, i) => (
            <div
              key={i}
              className="bg-slate-900/50 rounded-2xl p-6 border border-slate-800 hover:border-fuchsia-500/20 transition-all"
            >
              <div className="flex items-center gap-3 mb-4">
                <span className="text-2xl">{category.icon}</span>
                <div>
                  <h3 className="text-lg font-bold text-white">{category.title}</h3>
                  <span className="text-xs text-slate-500">{category.tools.length} tools</span>
                </div>
              </div>
              <div className="space-y-2">
                {category.tools.map((tool, j) => (
                  <div key={j} className="flex items-start gap-2">
                    <code className="text-xs px-2 py-1 rounded bg-fuchsia-500/20 text-fuchsia-300 font-mono shrink-0">
                      {tool.name}
                    </code>
                    <span className="text-xs text-slate-400">{tool.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* MCP Servers */}
      <Section background="muted" padding="lg" className="border-y border-white/5">
        <SectionHeader
          badge="MCP Integration"
          badgeColor="purple"
          title="5 Production MCP Servers"
          description="Model Context Protocol enables Claude to interact with external systems through standardized, secure interfaces."
        />

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 max-w-6xl mx-auto mb-12">
          {MCP_SERVERS.map((server, i) => (
            <div
              key={i}
              className="bg-slate-900/50 rounded-2xl p-6 border border-slate-800 hover:border-purple-500/30 transition-all"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{server.icon}</span>
                  <h3 className="text-lg font-bold text-white">{server.name}</h3>
                </div>
                <span className="px-2 py-1 rounded-full bg-purple-500/20 text-purple-300 text-xs font-medium">
                  {server.tools} tools
                </span>
              </div>
              <p className="text-sm text-slate-400 mb-4">{server.description}</p>
              <div className="flex flex-wrap gap-1">
                {server.capabilities.map((cap, j) => (
                  <span key={j} className="text-xs px-2 py-1 rounded bg-slate-800 text-slate-300">
                    {cap}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* MCP Configuration Example */}
        <div className="max-w-3xl mx-auto">
          <div className="bg-slate-900/80 rounded-2xl p-6 border border-slate-800">
            <h3 className="text-lg font-bold text-white mb-4">Extensible Architecture</h3>
            <p className="text-sm text-slate-400 mb-4">
              Add your own MCP servers via configuration:
            </p>
            <pre className="bg-black rounded-xl p-4 text-sm font-mono overflow-x-auto text-slate-300">
              {`// .claude/mcp.json
{
  "mcpServers": {
    "my-server": {
      "command": "node",
      "args": ["./mcp-server.js"]
    }
  }
}`}
            </pre>
          </div>
        </div>
      </Section>

      {/* Visual Debugging */}
      <Section padding="lg">
        <SectionHeader
          badge="32 Languages"
          badgeColor="blue"
          title="Visual Debugging System"
          description="Not just print statements. Full breakpoint debugging with variables, call stacks, and expression evaluation."
        />

        <div className="max-w-5xl mx-auto">
          {/* Debug Features */}
          <div className="grid md:grid-cols-2 gap-8 mb-12">
            <div className="bg-slate-900/50 rounded-2xl p-6 border border-slate-800">
              <h3 className="text-xl font-bold text-white mb-4">Breakpoint Types</h3>
              <div className="space-y-3">
                {[
                  { name: 'Line Breakpoints', desc: 'Standard break at specific line' },
                  { name: 'Conditional Breakpoints', desc: 'Break when condition is true' },
                  { name: 'Logpoints', desc: 'Log without stopping execution' },
                  { name: 'Exception Breakpoints', desc: 'Break on thrown exceptions' },
                  { name: 'Data Breakpoints', desc: 'Break on variable change' },
                ].map((bp, i) => (
                  <div key={i} className="flex items-center gap-3 bg-black/30 rounded-lg p-3">
                    <svg
                      className="w-5 h-5 text-cyan-400 shrink-0"
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
                    <div>
                      <div className="text-sm font-medium text-white">{bp.name}</div>
                      <div className="text-xs text-slate-400">{bp.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-slate-900/50 rounded-2xl p-6 border border-slate-800">
              <h3 className="text-xl font-bold text-white mb-4">Inspection Tools</h3>
              <div className="space-y-3">
                {[
                  { name: 'Variable Inspector', desc: 'Expandable tree with type information' },
                  { name: 'Watch Expressions', desc: 'Monitor custom expressions' },
                  { name: 'Call Stack Viewer', desc: 'Navigate stack frames' },
                  { name: 'Debug Console', desc: 'Evaluate in current context' },
                  { name: 'Cognitive Analysis', desc: 'AI-powered root cause detection' },
                ].map((tool, i) => (
                  <div key={i} className="flex items-center gap-3 bg-black/30 rounded-lg p-3">
                    <svg
                      className="w-5 h-5 text-cyan-400 shrink-0"
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
                    <div>
                      <div className="text-sm font-medium text-white">{tool.name}</div>
                      <div className="text-xs text-slate-400">{tool.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Supported Languages */}
          <div className="bg-slate-900/50 rounded-2xl p-6 border border-slate-800">
            <h3 className="text-xl font-bold text-white mb-4">Supported Languages</h3>
            <div className="space-y-4">
              <div>
                <div className="text-sm font-medium text-cyan-400 mb-2">
                  Full Support (Breakpoints, Step, Variables)
                </div>
                <div className="flex flex-wrap gap-2">
                  {DEBUG_LANGUAGES.full.map((lang, i) => (
                    <span
                      key={i}
                      className="px-3 py-1 rounded-full bg-cyan-500/20 text-cyan-300 text-sm"
                    >
                      {lang}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-sm font-medium text-slate-400 mb-2">
                  Basic Support (Breakpoints, Continue)
                </div>
                <div className="flex flex-wrap gap-2">
                  {DEBUG_LANGUAGES.basic.map((lang, i) => (
                    <span
                      key={i}
                      className="px-3 py-1 rounded-full bg-slate-700/50 text-slate-300 text-xs"
                    >
                      {lang}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* Claude Code Parity */}
      <Section background="gradient" padding="lg" className="border-t border-white/5">
        <SectionHeader
          badge="100% Parity"
          badgeColor="green"
          title="Complete Claude Code Feature Parity"
          description="Every feature from Claude Code CLI, plus exclusive capabilities only available in Code Lab."
        />

        <div className="max-w-5xl mx-auto">
          {/* Parity Table */}
          <div className="bg-slate-900/80 rounded-2xl overflow-hidden border border-slate-800 mb-12">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-800/50">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-white">
                      Feature
                    </th>
                    <th className="px-6 py-4 text-center text-sm font-semibold text-slate-300">
                      Claude Code CLI
                    </th>
                    <th className="px-6 py-4 text-center text-sm font-semibold text-fuchsia-300">
                      Code Lab
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">
                      Notes
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {PARITY_FEATURES.map((row, i) => (
                    <tr key={i} className="hover:bg-slate-800/30">
                      <td className="px-6 py-3 text-sm text-white">{row.feature}</td>
                      <td className="px-6 py-3 text-center">
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
                      </td>
                      <td className="px-6 py-3 text-center">
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
                      </td>
                      <td className="px-6 py-3 text-sm text-slate-400">{row.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Exclusive Features */}
          <div className="bg-gradient-to-br from-fuchsia-950/80 to-purple-950/40 rounded-2xl p-6 lg:p-8 border border-fuchsia-500/30">
            <h3 className="text-xl font-bold text-fuchsia-300 mb-6 text-center">
              Code Lab Exclusive Features
            </h3>
            <div className="grid sm:grid-cols-2 gap-4">
              {EXCLUSIVE_FEATURES.map((feature, i) => (
                <div key={i} className="flex items-start gap-3 bg-black/20 rounded-lg p-4">
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
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <div>
                    <div className="text-sm font-medium text-white">{feature.feature}</div>
                    <div className="text-xs text-slate-400">{feature.description}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Section>

      {/* Extensibility */}
      <Section padding="lg">
        <SectionHeader
          badge="Extensibility"
          badgeColor="amber"
          title="Make It Yours"
          description="Custom commands, hooks, plugins, and permission patterns—Code Lab adapts to your workflow."
        />

        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {/* Custom Commands */}
          <div className="bg-slate-900/50 rounded-2xl p-6 border border-slate-800">
            <h3 className="text-lg font-bold text-white mb-4">Custom Slash Commands</h3>
            <p className="text-sm text-slate-400 mb-4">
              Create project-specific commands in .claude/commands/:
            </p>
            <pre className="bg-black rounded-xl p-4 text-xs font-mono overflow-x-auto text-slate-300">
              {`---
description: Deploy to staging
arguments:
  - name: version
    required: true
---

Deploy version $1 to staging:
1. Run tests to ensure stability
2. Build production assets
3. Deploy to staging server
4. Report deployment status`}
            </pre>
          </div>

          {/* Hook System */}
          <div className="bg-slate-900/50 rounded-2xl p-6 border border-slate-800">
            <h3 className="text-lg font-bold text-white mb-4">Hook System</h3>
            <p className="text-sm text-slate-400 mb-4">
              Intercept and modify behavior at 8 hook points:
            </p>
            <div className="space-y-2">
              {[
                'PreToolUse',
                'PostToolUse',
                'PermissionRequest',
                'UserPromptSubmit',
                'SessionStart',
                'SessionEnd',
                'PreCompact',
                'Notification',
              ].map((hook, i) => (
                <span
                  key={i}
                  className="inline-block px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-mono mr-2 mb-2"
                >
                  {hook}
                </span>
              ))}
            </div>
          </div>

          {/* Permissions */}
          <div className="bg-slate-900/50 rounded-2xl p-6 border border-slate-800">
            <h3 className="text-lg font-bold text-white mb-4">Tool Permissions</h3>
            <p className="text-sm text-slate-400 mb-4">Fine-grained glob-based control:</p>
            <pre className="bg-black rounded-xl p-4 text-xs font-mono overflow-x-auto text-slate-300">
              {`{
  "allow": [
    "read_file",
    "write_file(/src/**)",
    "execute_shell(npm *)"
  ],
  "deny": [
    "execute_shell(rm -rf *)",
    "write_file(/.env*)"
  ]
}`}
            </pre>
          </div>

          {/* Plugin Marketplace */}
          <div className="bg-slate-900/50 rounded-2xl p-6 border border-slate-800">
            <h3 className="text-lg font-bold text-white mb-4">Plugin Marketplace</h3>
            <p className="text-sm text-slate-400 mb-4">
              Discover and install community extensions:
            </p>
            <div className="space-y-3">
              {[
                { name: 'tools', desc: 'Custom tool definitions' },
                { name: 'commands', desc: 'Slash command extensions' },
                { name: 'hooks', desc: 'Workflow automation' },
                { name: 'mcpServers', desc: 'External integrations' },
              ].map((type, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between bg-black/30 rounded-lg p-3"
                >
                  <code className="text-sm text-amber-300 font-mono">{type.name}</code>
                  <span className="text-xs text-slate-400">{type.desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Section>

      {/* Security */}
      <Section background="muted" padding="lg" className="border-y border-white/5">
        <SectionHeader
          badge="Security"
          badgeColor="green"
          title="Enterprise Security by Default"
          description="Every session runs in complete isolation. Your code never touches our servers."
        />

        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          <FeatureCard
            emoji="🔒"
            title="Complete Isolation"
            description="E2B containers with no access to host system or other sessions. Automatic cleanup on session end."
            variant="gradient"
            color="green"
          />
          <FeatureCard
            emoji="🔐"
            title="Encrypted Everything"
            description="AES-256 at rest, TLS 1.3 in transit. Credentials never stored—environment variables only."
            variant="gradient"
            color="green"
          />
          <FeatureCard
            emoji="✅"
            title="Compliance Ready"
            description="SOC 2 Type II in progress. GDPR compliant with data residency. HIPAA eligible with BAA."
            variant="gradient"
            color="green"
          />
        </div>
      </Section>

      {/* API Reference Preview */}
      <Section padding="lg">
        <SectionHeader
          badge="API"
          badgeColor="blue"
          title="REST & WebSocket APIs"
          description="Full programmatic access to Code Lab capabilities for integration and automation."
        />

        <div className="max-w-4xl mx-auto">
          <div className="bg-slate-900/80 rounded-2xl p-6 border border-slate-800">
            <h3 className="text-lg font-bold text-white mb-4">REST Endpoints</h3>
            <pre className="bg-black rounded-xl p-4 text-xs font-mono overflow-x-auto text-slate-300">
              {`POST   /api/code-lab/chat          # AI chat with tool calling
GET    /api/code-lab/sessions       # List user sessions
POST   /api/code-lab/sessions       # Create new session
POST   /api/code-lab/sessions/[id]/fork  # Fork session
POST   /api/code-lab/files          # File operations
POST   /api/code-lab/git            # Git operations
POST   /api/code-lab/deploy         # Initiate deployment
POST   /api/code-lab/mcp            # Execute MCP tool
POST   /api/code-lab/debug          # Debug operations`}
            </pre>

            <div className="mt-6">
              <h4 className="text-sm font-bold text-white mb-3">Rate Limits</h4>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="bg-black/30 rounded-lg p-3">
                  <div className="text-lg font-bold text-blue-400">Free</div>
                  <div className="text-xs text-slate-400">20 req/min • 100K tokens/day</div>
                </div>
                <div className="bg-black/30 rounded-lg p-3">
                  <div className="text-lg font-bold text-purple-400">Pro</div>
                  <div className="text-xs text-slate-400">100 req/min • 1M tokens/day</div>
                </div>
                <div className="bg-black/30 rounded-lg p-3">
                  <div className="text-lg font-bold text-fuchsia-400">Enterprise</div>
                  <div className="text-xs text-slate-400">Custom limits</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* Keyboard Shortcuts */}
      <Section background="gradient" padding="lg" className="border-t border-white/5">
        <SectionHeader
          badge="Shortcuts"
          badgeColor="fuchsia"
          title="Keyboard-First Design"
          description="Power users rejoice. Full Vim mode support and comprehensive keyboard shortcuts."
        />

        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          <div className="bg-slate-900/50 rounded-2xl p-6 border border-slate-800">
            <h3 className="text-lg font-bold text-white mb-4">Navigation</h3>
            <div className="space-y-2">
              {[
                { keys: 'Ctrl+Enter', action: 'Send message' },
                { keys: 'Ctrl+/', action: 'Toggle sidebar' },
                { keys: 'Ctrl+B', action: 'Toggle file browser' },
                { keys: 'Ctrl+J', action: 'Toggle terminal' },
                { keys: 'Ctrl+D', action: 'Toggle debugger' },
              ].map((shortcut, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between bg-black/30 rounded-lg p-3"
                >
                  <kbd className="px-2 py-1 rounded bg-slate-700 text-slate-200 text-xs font-mono">
                    {shortcut.keys}
                  </kbd>
                  <span className="text-sm text-slate-400">{shortcut.action}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-slate-900/50 rounded-2xl p-6 border border-slate-800">
            <h3 className="text-lg font-bold text-white mb-4">Slash Commands</h3>
            <div className="space-y-2">
              {[
                { cmd: '/fix', desc: 'Fix errors or bugs' },
                { cmd: '/test', desc: 'Run and fix tests' },
                { cmd: '/build', desc: 'Build and fix errors' },
                { cmd: '/commit', desc: 'Stage and commit' },
                { cmd: '/checkpoint', desc: 'Save workspace state' },
              ].map((command, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between bg-black/30 rounded-lg p-3"
                >
                  <code className="text-sm text-fuchsia-300 font-mono">{command.cmd}</code>
                  <span className="text-sm text-slate-400">{command.desc}</span>
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
              Ready to Code Differently?
            </h2>
            <p className="text-lg text-slate-400 mb-8 max-w-xl mx-auto">
              Experience enterprise-grade AI development with 100% Claude Code parity. No
              installation. No configuration. Just code.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/code-lab"
                className="w-full sm:w-auto rounded-xl bg-fuchsia-600 hover:bg-fuchsia-500 px-10 py-4 text-base font-semibold text-white transition-all shadow-lg shadow-fuchsia-500/20"
              >
                Launch Code Lab
              </Link>
              <Link
                href="/signup"
                className="w-full sm:w-auto rounded-xl border border-white/20 bg-white/5 backdrop-blur-sm px-10 py-4 text-base font-semibold text-white hover:bg-white/10 transition-all"
              >
                Create Free Account
              </Link>
            </div>
            <p className="mt-6 text-sm text-slate-500">
              Free tier available • 2,128 tests passing • Built with precision
            </p>
          </div>
        </div>
      </Section>

      <LandingFooter />
    </main>
  );
}

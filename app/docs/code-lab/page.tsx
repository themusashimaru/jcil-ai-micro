'use client';

/**
 * CODE LAB DOCUMENTATION PAGE
 *
 * Comprehensive documentation for Code Lab with:
 * - Jump-to sections
 * - Copy page functionality
 * - Full tool reference (55+ tools)
 * - Beyond Claude Code features
 */

import Link from 'next/link';
import { useState } from 'react';
import LandingLogo from '../../components/LandingLogo';

const SECTIONS = [
  { id: 'getting-started', title: 'Getting Started' },
  { id: 'beyond-claude-code', title: 'Beyond Claude Code' },
  { id: 'tools', title: 'Tool Reference (55+)' },
  { id: 'file-operations', title: 'File Operations' },
  { id: 'git', title: 'Git Integration' },
  { id: 'planning-mode', title: 'Planning Mode' },
  { id: 'mcp', title: 'MCP Servers (5)' },
  { id: 'ai-pair-programming', title: 'AI Pair Programming' },
  { id: 'visual-debugging', title: 'Visual Debugging' },
  { id: 'collaboration', title: 'Real-Time Collaboration' },
  { id: 'hooks', title: 'Hooks System' },
  { id: 'memory', title: 'Project Memory' },
  { id: 'deployment', title: 'Multi-Platform Deploy' },
  { id: 'best-practices', title: 'Best Practices' },
];

const BEYOND_CLAUDE_FEATURES = [
  {
    name: 'AI Pair Programming',
    desc: 'Proactive suggestions, ghost text, bug detection as you type',
    exclusive: true,
  },
  {
    name: 'Visual Debugging',
    desc: 'Breakpoints, step controls, variable inspection, call stack',
    exclusive: true,
  },
  {
    name: 'Real-Time Collaboration',
    desc: 'Live cursors, presence, annotations, shared sessions',
    exclusive: true,
  },
  {
    name: 'Extended Thinking UI',
    desc: "Stream, tree, and timeline views of Claude's reasoning",
    exclusive: true,
  },
  {
    name: 'Monaco-Style Editor',
    desc: 'Tabs, diff view, inline edits, syntax highlighting',
    exclusive: true,
  },
  {
    name: 'Permission Dialogs',
    desc: 'Risk levels, affected files, always-allow option',
    exclusive: true,
  },
  { name: 'Zero Install', desc: 'Works in browser, no local setup required', exclusive: true },
  {
    name: 'Cloud Sandbox',
    desc: 'E2B isolated execution, safe from local machine',
    exclusive: true,
  },
  {
    name: 'Multi-Platform Deploy',
    desc: 'One-click to Vercel, Netlify, Railway, Cloudflare',
    exclusive: true,
  },
];

const TOOLS_DATA = {
  fileOps: [
    { name: 'read_file', desc: 'Read the contents of a file', params: 'path: string' },
    {
      name: 'write_file',
      desc: 'Create or overwrite a file',
      params: 'path: string, content: string',
    },
    {
      name: 'edit_file',
      desc: 'Make precise edits to a file',
      params: 'path: string, old_string: string, new_string: string',
    },
    {
      name: 'multi_edit',
      desc: 'Make multiple edits in one operation',
      params: 'path: string, edits: Array<{old: string, new: string}>',
    },
    {
      name: 'list_files',
      desc: 'List files in a directory',
      params: 'path?: string (defaults to /workspace)',
    },
    { name: 'search_files', desc: 'Find files by glob pattern', params: 'pattern: string' },
    {
      name: 'search_code',
      desc: 'Search file contents with regex',
      params: 'pattern: string, path?: string, file_pattern?: string',
    },
  ],
  shell: [
    {
      name: 'execute_shell',
      desc: 'Run a shell command',
      params: 'command: string, timeout?: number',
    },
    { name: 'run_build', desc: 'Execute npm run build', params: 'none' },
    { name: 'run_tests', desc: 'Execute npm test', params: 'none' },
    {
      name: 'install_packages',
      desc: 'Run npm install',
      params: 'packages?: string[] (optional specific packages)',
    },
  ],
  git: [
    { name: 'git_status', desc: 'View repository status', params: 'none' },
    { name: 'git_diff', desc: 'View changes', params: 'staged?: boolean, file?: string' },
    {
      name: 'git_commit',
      desc: 'Stage and commit changes',
      params: 'message: string, files?: string[]',
    },
    { name: 'git_push', desc: 'Push to remote', params: 'branch?: string, force?: boolean' },
    { name: 'git_pull', desc: 'Pull from remote', params: 'branch?: string' },
    {
      name: 'git_branch',
      desc: 'Branch management',
      params: 'action: create|delete|list, name?: string',
    },
    { name: 'git_log', desc: 'View commit history', params: 'count?: number' },
    { name: 'git_checkout', desc: 'Switch branches', params: 'branch: string' },
    {
      name: 'create_pr',
      desc: 'Open a pull request',
      params: 'title: string, body: string, base?: string',
    },
  ],
  planning: [
    {
      name: 'enter_plan_mode',
      desc: 'Start a planning session',
      params: 'reason: string, initial_questions?: string[]',
    },
    {
      name: 'write_plan',
      desc: 'Document implementation plan',
      params: 'title: string, summary: string, tasks: Task[], notes?: string',
    },
    {
      name: 'exit_plan_mode',
      desc: 'Request approval',
      params: 'ready_for_approval: boolean, questions_for_user?: string[]',
    },
    {
      name: 'todo_write',
      desc: 'Track task progress',
      params: 'todos: Array<{content: string, status: string}>',
    },
  ],
  mcp: [
    { name: 'mcp_list_servers', desc: 'List configured MCP servers', params: 'none' },
    { name: 'mcp_enable_server', desc: 'Enable an MCP server', params: 'server_id: string' },
    { name: 'mcp_disable_server', desc: 'Disable an MCP server', params: 'server_id: string' },
    { name: 'mcp__puppeteer__navigate', desc: 'Navigate browser to URL', params: 'url: string' },
    { name: 'mcp__puppeteer__screenshot', desc: 'Take page screenshot', params: 'path: string' },
    { name: 'mcp__puppeteer__click', desc: 'Click element', params: 'selector: string' },
    {
      name: 'mcp__github__list_issues',
      desc: 'List GitHub issues',
      params: 'owner: string, repo: string',
    },
    {
      name: 'mcp__github__create_pr',
      desc: 'Create pull request',
      params: 'owner: string, repo: string, ...',
    },
    {
      name: 'mcp__postgres__query',
      desc: 'Execute SQL query',
      params: 'sql: string (SELECT only)',
    },
    { name: 'mcp__memory__store', desc: 'Store key-value', params: 'key: string, value: any' },
    { name: 'mcp__memory__retrieve', desc: 'Retrieve value', params: 'key: string' },
  ],
  hooks: [
    { name: 'hooks_list', desc: 'List all hooks', params: 'none' },
    { name: 'hooks_enable', desc: 'Enable a hook', params: 'hook_id: string' },
    { name: 'hooks_disable', desc: 'Disable a hook', params: 'hook_id: string' },
    {
      name: 'hooks_create',
      desc: 'Create a custom hook',
      params: 'id: string, name: string, event: string, command: string, ...',
    },
  ],
  memory: [
    { name: 'memory_read', desc: 'Read project memory', params: 'none' },
    { name: 'memory_create', desc: 'Create CODELAB.md', params: 'none' },
    { name: 'memory_update', desc: 'Update memory content', params: 'content: string' },
    {
      name: 'memory_add_section',
      desc: 'Add a section',
      params: 'title: string, content: string, type?: string',
    },
  ],
  background: [
    { name: 'bg_run', desc: 'Run command in background', params: 'command: string' },
    { name: 'bg_output', desc: 'Get task output', params: 'task_id: string' },
    { name: 'bg_kill', desc: 'Kill a background task', params: 'task_id: string' },
    {
      name: 'bg_list',
      desc: 'List background tasks',
      params: 'filter?: "running" | "completed" | "all"',
    },
  ],
  deploy: [
    { name: 'deploy_vercel', desc: 'Deploy to Vercel', params: 'project?: string' },
    { name: 'deploy_netlify', desc: 'Deploy to Netlify', params: 'site_id?: string' },
    { name: 'deploy_railway', desc: 'Deploy to Railway', params: 'project?: string' },
    { name: 'deploy_cloudflare', desc: 'Deploy to Cloudflare Pages', params: 'project?: string' },
    {
      name: 'check_deploy_status',
      desc: 'Check deployment status',
      params: 'deployment_id: string, platform: string',
    },
  ],
};

const FULL_DOC_TEXT = `# Code Lab Documentation v3.0 — Beyond Claude Code

## Overview

Code Lab is the ultimate AI-powered IDE that goes BEYOND Claude Code with:
- **55+ Tools** for complete development workflow
- **5 Real MCP Servers** (not stubs): Puppeteer, GitHub, PostgreSQL, Memory, Filesystem
- **AI Pair Programming** - Proactive suggestions as you type
- **Visual Debugging** - Breakpoints, variables, call stack in the browser
- **Real-Time Collaboration** - Multi-user cursors, annotations, shared sessions
- **Extended Thinking UI** - Watch Claude reason in stream, tree, or timeline view
- **Multi-Platform Deploy** - One-click to Vercel, Netlify, Railway, Cloudflare

## Beyond Claude Code Features

| Feature | Claude Code CLI | Code Lab |
|---------|-----------------|----------|
| File Operations | ✓ | ✓ |
| Git Integration | ✓ | ✓ |
| Shell Execution | ✓ | ✓ |
| Zero Install (Browser) | ✗ | ✓ |
| Cloud Sandbox | ✗ | ✓ |
| AI Pair Programming | ✗ | ✓ |
| Visual Debugging | ✗ | ✓ |
| Real-Time Collaboration | ✗ | ✓ |
| Multi-Platform Deploy | ✗ | ✓ |

## AI Pair Programming

Revolutionary AI-assisted coding where Claude proactively helps as you type.

**Features:**
- Ghost text completions (like Copilot but context-aware)
- Real-time bug detection
- Refactoring suggestions
- Security vulnerability detection
- Inline annotations and hints

**Modes:**
- Active: Claude proactively suggests as you type
- Passive: Claude waits for you to ask
- Off: Pair programming disabled

## Visual Debugging

Full debugging experience in the browser.

**Features:**
- Set breakpoints (line, conditional, logpoint)
- Step controls: Over, Into, Out, Continue
- Variable inspection with expandable tree view
- Watch expressions
- Call stack visualization
- AI-powered debug analysis

## Real-Time Collaboration

True multi-user presence and shared coding experience.

**Features:**
- Real-time cursor presence (see where others are)
- Live code sharing with conflict resolution
- User avatars and activity indicators
- Follow mode (follow another user's view)
- Code annotations and comments
- Shared Claude AI interactions

## Complete Tool Reference (55+ Tools)

### File Operations (7 tools)
- read_file, write_file, edit_file, multi_edit
- list_files, search_files, search_code

### Shell Execution (4 tools)
- execute_shell, run_build, run_tests, install_packages

### Git Operations (9 tools)
- git_status, git_diff, git_commit, git_push, git_pull
- git_branch, git_log, git_checkout, create_pr

### Planning Mode (4 tools)
- enter_plan_mode, write_plan, exit_plan_mode, todo_write

### MCP Servers (21 tools across 5 servers)
- Puppeteer: navigate, screenshot, click, type, evaluate
- GitHub: get_repo, list_issues, create_issue, create_pr
- PostgreSQL: query (SELECT only for security)
- Memory: store, retrieve, list_keys, search
- Filesystem: Enhanced file operations

### Deployment (5 tools)
- deploy_vercel, deploy_netlify, deploy_railway, deploy_cloudflare
- check_deploy_status

### Advanced (5+ tools)
- hooks_list, hooks_enable, hooks_disable, hooks_create
- bg_run, bg_output, bg_kill, bg_list
- memory_read, memory_create, memory_update, memory_add_section

## Best Practices

1. **Use Planning Mode for Complex Tasks** - Plan first, get approval
2. **Enable AI Pair Programming** - Let Claude catch bugs as you type
3. **Use Project Memory** - Store context in CODELAB.md
4. **Enable Relevant Hooks** - Catch issues before commit
5. **Leverage Collaboration** - Share sessions for pair programming

---
*JCIL.AI Code Lab v3.0 — Beyond Claude Code*
`;

export default function CodeLabDocsPage() {
  const [copied, setCopied] = useState(false);

  const copyPageContent = () => {
    navigator.clipboard.writeText(FULL_DOC_TEXT);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-slate-950/80 border-b border-slate-800">
        <div className="container mx-auto px-4 py-4">
          <nav className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3">
              <LandingLogo />
              <span className="text-slate-500">/</span>
              <Link href="/docs" className="text-slate-400 hover:text-white transition">
                Docs
              </Link>
              <span className="text-slate-500">/</span>
              <span className="text-fuchsia-400 font-medium">Code Lab</span>
            </Link>

            <div className="flex items-center gap-4">
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-1 bg-fuchsia-500/20 rounded text-xs text-fuchsia-300 font-bold">
                v3.0 — Beyond Claude Code
              </span>
              <button
                onClick={copyPageContent}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${
                  copied
                    ? 'bg-green-600 text-white'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {copied ? (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    Copied!
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                      />
                    </svg>
                    Copy Page
                  </>
                )}
              </button>
            </div>
          </nav>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="flex gap-8">
          {/* Sidebar */}
          <aside className="hidden lg:block w-64 shrink-0">
            <div className="sticky top-24">
              <h3 className="text-sm font-semibold text-slate-400 mb-4">ON THIS PAGE</h3>
              <nav className="space-y-2">
                {SECTIONS.map((section) => (
                  <a
                    key={section.id}
                    href={`#${section.id}`}
                    className="block text-sm text-slate-400 hover:text-fuchsia-400 transition py-1"
                  >
                    {section.title}
                  </a>
                ))}
              </nav>
            </div>
          </aside>

          {/* Main Content */}
          <div className="flex-1 max-w-4xl">
            <div className="flex items-center gap-4 mb-8">
              <h1 className="text-4xl font-bold">Code Lab Documentation</h1>
              <span className="px-3 py-1 bg-gradient-to-r from-fuchsia-600 to-purple-600 rounded-full text-sm font-bold">
                v3.0
              </span>
            </div>

            {/* Getting Started */}
            <section id="getting-started" className="mb-16 scroll-mt-24">
              <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                <span className="text-fuchsia-400">#</span> Getting Started
              </h2>
              <div className="prose prose-invert max-w-none">
                <p className="text-slate-300 mb-4">
                  Code Lab is the ultimate AI development environment that goes{' '}
                  <strong className="text-fuchsia-400">beyond Claude Code</strong>. It provides:
                </p>
                <ul className="space-y-2 text-slate-300 mb-6">
                  <li className="flex items-start gap-2">
                    <span className="text-fuchsia-400 mt-1">•</span>
                    <span>
                      <strong>55+ Tools</strong>: Complete development workflow in one place
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-fuchsia-400 mt-1">•</span>
                    <span>
                      <strong>5 Real MCP Servers</strong>: Puppeteer, GitHub, PostgreSQL, Memory,
                      Filesystem
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-fuchsia-400 mt-1">•</span>
                    <span>
                      <strong>AI Pair Programming</strong>: Proactive suggestions as you type
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-fuchsia-400 mt-1">•</span>
                    <span>
                      <strong>Visual Debugging</strong>: Breakpoints, variables, call stack
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-fuchsia-400 mt-1">•</span>
                    <span>
                      <strong>Real-Time Collaboration</strong>: Multi-user cursors and annotations
                    </span>
                  </li>
                </ul>

                <h3 className="text-lg font-semibold text-white mb-3">Quick Start</h3>
                <ol className="list-decimal list-inside space-y-2 text-slate-300 mb-6">
                  <li>Sign up or log in to JCIL.AI</li>
                  <li>Navigate to Code Lab</li>
                  <li>Connect your GitHub account (optional)</li>
                  <li>Clone a repository or start from scratch</li>
                  <li>Start chatting with Claude to write code</li>
                </ol>
              </div>
            </section>

            {/* Beyond Claude Code */}
            <section id="beyond-claude-code" className="mb-16 scroll-mt-24">
              <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                <span className="text-fuchsia-400">#</span> Beyond Claude Code
              </h2>
              <p className="text-slate-300 mb-6">
                Code Lab has <strong className="text-fuchsia-400">9 exclusive features</strong> not
                available in Claude Code CLI:
              </p>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 mb-6">
                {BEYOND_CLAUDE_FEATURES.map((feature, i) => (
                  <div
                    key={i}
                    className="relative p-4 bg-slate-900/50 rounded-xl border border-fuchsia-500/20"
                  >
                    <div className="absolute -top-2 right-2 px-2 py-0.5 bg-fuchsia-600 rounded text-[10px] font-bold">
                      EXCLUSIVE
                    </div>
                    <h4 className="font-semibold text-white mb-1">{feature.name}</h4>
                    <p className="text-slate-400 text-sm">{feature.desc}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* AI Pair Programming */}
            <section id="ai-pair-programming" className="mb-16 scroll-mt-24">
              <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                <span className="text-fuchsia-400">#</span> AI Pair Programming
                <span className="px-2 py-0.5 bg-fuchsia-600 rounded text-xs font-bold">
                  EXCLUSIVE
                </span>
              </h2>
              <p className="text-slate-300 mb-4">
                Revolutionary AI-assisted coding where Claude proactively helps as you type.
              </p>

              <div className="bg-slate-900 rounded-xl p-6 border border-slate-800 mb-6">
                <h4 className="text-white font-semibold mb-4">How it works:</h4>
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">👻</span>
                    <div>
                      <span className="text-white font-medium">Ghost Text Completions</span>
                      <p className="text-slate-400 text-sm">
                        See suggestions inline as you type, press Tab to accept
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">🐛</span>
                    <div>
                      <span className="text-white font-medium">Real-Time Bug Detection</span>
                      <p className="text-slate-400 text-sm">
                        Claude spots bugs before you finish typing
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">💡</span>
                    <div>
                      <span className="text-white font-medium">Inline Suggestions</span>
                      <p className="text-slate-400 text-sm">
                        Refactoring hints, security warnings, and more
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-slate-900/50 rounded-lg p-4 border border-fuchsia-500/20">
                <p className="text-fuchsia-300 text-sm">
                  <strong>Modes:</strong> Active (proactive suggestions) | Passive (wait for
                  request) | Off
                </p>
              </div>
            </section>

            {/* Visual Debugging */}
            <section id="visual-debugging" className="mb-16 scroll-mt-24">
              <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                <span className="text-fuchsia-400">#</span> Visual Debugging
                <span className="px-2 py-0.5 bg-fuchsia-600 rounded text-xs font-bold">
                  EXCLUSIVE
                </span>
              </h2>
              <p className="text-slate-300 mb-4">
                Full debugging experience in the browser — no IDE required.
              </p>

              <div className="grid gap-4 sm:grid-cols-2 mb-6">
                {[
                  {
                    icon: '🔴',
                    title: 'Breakpoints',
                    desc: 'Line, conditional, logpoint, exception',
                  },
                  { icon: '⏭️', title: 'Step Controls', desc: 'Over, Into, Out, Continue' },
                  {
                    icon: '📊',
                    title: 'Variable Inspection',
                    desc: 'Expandable tree view with change detection',
                  },
                  { icon: '👁️', title: 'Watch Expressions', desc: 'Monitor any expression value' },
                  { icon: '📚', title: 'Call Stack', desc: 'Navigate the execution context' },
                  { icon: '🤖', title: 'AI Analysis', desc: 'Ask Claude to explain the bug' },
                ].map((item, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 p-4 bg-slate-900/50 rounded-lg border border-slate-800"
                  >
                    <span className="text-xl">{item.icon}</span>
                    <div>
                      <span className="text-white font-medium">{item.title}</span>
                      <p className="text-slate-400 text-sm">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Real-Time Collaboration */}
            <section id="collaboration" className="mb-16 scroll-mt-24">
              <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                <span className="text-fuchsia-400">#</span> Real-Time Collaboration
                <span className="px-2 py-0.5 bg-fuchsia-600 rounded text-xs font-bold">
                  EXCLUSIVE
                </span>
              </h2>
              <p className="text-slate-300 mb-4">
                True multi-user presence and shared coding experience.
              </p>

              <div className="grid gap-4 sm:grid-cols-2 mb-6">
                {[
                  {
                    icon: '👆',
                    title: 'Live Cursors',
                    desc: 'See where others are typing in real-time',
                  },
                  {
                    icon: '💬',
                    title: 'Code Annotations',
                    desc: 'Leave comments on specific lines',
                  },
                  { icon: '👀', title: 'Follow Mode', desc: "Follow another user's view" },
                  { icon: '🤝', title: 'Shared Claude', desc: 'Collaborate with AI together' },
                ].map((item, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 p-4 bg-slate-900/50 rounded-lg border border-slate-800"
                  >
                    <span className="text-xl">{item.icon}</span>
                    <div>
                      <span className="text-white font-medium">{item.title}</span>
                      <p className="text-slate-400 text-sm">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Tools Reference */}
            <section id="tools" className="mb-16 scroll-mt-24">
              <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                <span className="text-fuchsia-400">#</span> Tool Reference (55+ Tools)
              </h2>
              <p className="text-slate-300 mb-6">
                Code Lab provides 55+ tools for development tasks. All tools are called
                automatically based on your natural language requests.
              </p>
            </section>

            {/* File Operations */}
            <section id="file-operations" className="mb-16 scroll-mt-24">
              <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                <span className="text-fuchsia-400">#</span> File Operations
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-800">
                      <th className="text-left py-3 px-4 text-slate-400 font-medium">Tool</th>
                      <th className="text-left py-3 px-4 text-slate-400 font-medium">
                        Description
                      </th>
                      <th className="text-left py-3 px-4 text-slate-400 font-medium">Parameters</th>
                    </tr>
                  </thead>
                  <tbody>
                    {TOOLS_DATA.fileOps.map((tool, i) => (
                      <tr key={i} className="border-b border-slate-800/50">
                        <td className="py-3 px-4">
                          <code className="text-fuchsia-400">{tool.name}</code>
                        </td>
                        <td className="py-3 px-4 text-slate-300">{tool.desc}</td>
                        <td className="py-3 px-4 text-slate-500 font-mono text-xs">
                          {tool.params}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Git */}
            <section id="git" className="mb-16 scroll-mt-24">
              <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                <span className="text-fuchsia-400">#</span> Git Integration (9 tools)
              </h2>
              <div className="overflow-x-auto mb-6">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-800">
                      <th className="text-left py-3 px-4 text-slate-400 font-medium">Tool</th>
                      <th className="text-left py-3 px-4 text-slate-400 font-medium">
                        Description
                      </th>
                      <th className="text-left py-3 px-4 text-slate-400 font-medium">Parameters</th>
                    </tr>
                  </thead>
                  <tbody>
                    {TOOLS_DATA.git.map((tool, i) => (
                      <tr key={i} className="border-b border-slate-800/50">
                        <td className="py-3 px-4">
                          <code className="text-fuchsia-400">{tool.name}</code>
                        </td>
                        <td className="py-3 px-4 text-slate-300">{tool.desc}</td>
                        <td className="py-3 px-4 text-slate-500 font-mono text-xs">
                          {tool.params}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Planning Mode */}
            <section id="planning-mode" className="mb-16 scroll-mt-24">
              <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                <span className="text-fuchsia-400">#</span> Planning Mode
              </h2>
              <p className="text-slate-300 mb-4">
                Use planning mode for complex tasks that need careful design before implementation.
              </p>

              <h3 className="text-lg font-semibold text-white mb-3">When to Use</h3>
              <ul className="space-y-2 text-slate-300 mb-6">
                {[
                  'Multiple valid approaches exist',
                  'Significant architectural decisions needed',
                  'Changes touch many files',
                  'Requirements are unclear',
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-fuchsia-400">•</span>
                    {item}
                  </li>
                ))}
              </ul>

              <h3 className="text-lg font-semibold text-white mb-3">Workflow</h3>
              <div className="space-y-3">
                {[
                  { step: '1', text: 'enter_plan_mode - Start planning with a reason' },
                  { step: '2', text: 'Explore codebase with file/search tools' },
                  { step: '3', text: 'write_plan - Document your approach' },
                  { step: '4', text: 'exit_plan_mode - Request user approval' },
                  { step: '5', text: 'User approves → Implementation begins' },
                ].map((item) => (
                  <div key={item.step} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-fuchsia-500/20 text-fuchsia-400 flex items-center justify-center text-sm font-bold">
                      {item.step}
                    </div>
                    <span className="text-slate-300">{item.text}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* MCP */}
            <section id="mcp" className="mb-16 scroll-mt-24">
              <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                <span className="text-fuchsia-400">#</span> MCP Servers (5 Real Implementations)
              </h2>
              <p className="text-slate-300 mb-4">
                Model Context Protocol servers extend Code Lab&apos;s capabilities.{' '}
                <strong className="text-fuchsia-400">All servers are real implementations</strong>,
                not stubs.
              </p>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 mb-6">
                {[
                  {
                    name: 'Puppeteer',
                    icon: '🌐',
                    desc: 'Browser automation, screenshots, web scraping',
                  },
                  { name: 'GitHub', icon: '🐙', desc: 'Issues, PRs, repo management via Octokit' },
                  {
                    name: 'PostgreSQL',
                    icon: '🗄️',
                    desc: 'Database queries (SELECT only for security)',
                  },
                  {
                    name: 'Memory',
                    icon: '🧠',
                    desc: 'Persistent key-value store across sessions',
                  },
                  {
                    name: 'Filesystem',
                    icon: '📁',
                    desc: 'Enhanced file operations in E2B sandbox',
                  },
                ].map((server) => (
                  <div
                    key={server.name}
                    className="p-4 bg-slate-900/50 rounded-xl border border-slate-800"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xl">{server.icon}</span>
                      <code className="text-fuchsia-400 font-bold">{server.name}</code>
                    </div>
                    <p className="text-slate-400 text-sm">{server.desc}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Deployment */}
            <section id="deployment" className="mb-16 scroll-mt-24">
              <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                <span className="text-fuchsia-400">#</span> Multi-Platform Deploy
                <span className="px-2 py-0.5 bg-fuchsia-600 rounded text-xs font-bold">
                  EXCLUSIVE
                </span>
              </h2>
              <p className="text-slate-300 mb-4">One-click deployment to multiple platforms.</p>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-6">
                {[
                  { name: 'Vercel', icon: '▲', color: 'bg-white/10' },
                  { name: 'Netlify', icon: '◆', color: 'bg-teal-500/20' },
                  { name: 'Railway', icon: '🚂', color: 'bg-purple-500/20' },
                  { name: 'Cloudflare', icon: '☁️', color: 'bg-orange-500/20' },
                ].map((platform) => (
                  <div
                    key={platform.name}
                    className={`p-4 rounded-xl border border-slate-800 ${platform.color} text-center`}
                  >
                    <span className="text-2xl block mb-2">{platform.icon}</span>
                    <span className="text-white font-medium">{platform.name}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* Hooks */}
            <section id="hooks" className="mb-16 scroll-mt-24">
              <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                <span className="text-fuchsia-400">#</span> Hooks System
              </h2>
              <p className="text-slate-300 mb-4">
                Hooks run commands in response to events like tool execution.
              </p>

              <h3 className="text-lg font-semibold text-white mb-3">Event Types</h3>
              <div className="grid gap-2 mb-6">
                {[
                  { event: 'pre_tool', desc: 'Before a tool executes' },
                  { event: 'post_tool', desc: 'After a tool executes' },
                  { event: 'session_start', desc: 'When session begins' },
                  { event: 'session_end', desc: 'When session ends' },
                ].map((item) => (
                  <div key={item.event} className="flex items-center gap-3">
                    <code className="text-fuchsia-400 bg-slate-900 px-2 py-1 rounded">
                      {item.event}
                    </code>
                    <span className="text-slate-400">{item.desc}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* Memory */}
            <section id="memory" className="mb-16 scroll-mt-24">
              <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                <span className="text-fuchsia-400">#</span> Project Memory
              </h2>
              <p className="text-slate-300 mb-4">
                CODELAB.md stores project-specific context that persists across sessions.
              </p>

              <h3 className="text-lg font-semibold text-white mb-3">What to Include</h3>
              <ul className="space-y-2 text-slate-300 mb-6">
                {[
                  'Project overview and architecture',
                  'Code style conventions',
                  'Common tasks and preferences',
                  'Things to avoid',
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-fuchsia-400">•</span>
                    {item}
                  </li>
                ))}
              </ul>
            </section>

            {/* Best Practices */}
            <section id="best-practices" className="mb-16 scroll-mt-24">
              <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                <span className="text-fuchsia-400">#</span> Best Practices
              </h2>

              <div className="space-y-6">
                {[
                  {
                    title: 'Enable AI Pair Programming',
                    desc: 'Let Claude catch bugs and suggest improvements as you type.',
                  },
                  {
                    title: 'Use Planning Mode for Complex Tasks',
                    desc: "Don't dive into implementation. Plan first, get approval.",
                  },
                  {
                    title: 'Leverage Collaboration',
                    desc: 'Share sessions for pair programming with colleagues.',
                  },
                  {
                    title: 'Use Visual Debugging',
                    desc: 'Set breakpoints and inspect variables instead of console.log.',
                  },
                  {
                    title: 'Enable Relevant Hooks',
                    desc: 'Use pre-commit hooks to catch issues early.',
                  },
                ].map((item, i) => (
                  <div key={i} className="flex gap-4">
                    <div className="w-8 h-8 rounded-full bg-fuchsia-500/20 text-fuchsia-400 flex items-center justify-center text-sm font-bold shrink-0">
                      {i + 1}
                    </div>
                    <div>
                      <h3 className="font-semibold text-white mb-1">{item.title}</h3>
                      <p className="text-slate-400">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* CTA */}
            <section className="py-12 border-t border-slate-800">
              <div className="text-center">
                <h2 className="text-2xl font-bold text-white mb-4">Ready to go beyond?</h2>
                <p className="text-slate-400 mb-6">
                  Launch Code Lab and experience AI-assisted development like never before.
                </p>
                <Link
                  href="/code-lab"
                  className="inline-block rounded-xl bg-gradient-to-r from-fuchsia-600 to-purple-600 px-8 py-3 text-lg font-semibold text-white hover:shadow-xl hover:shadow-fuchsia-500/25 transition-all duration-300"
                >
                  Launch Code Lab
                </Link>
              </div>
            </section>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-slate-950 py-8 border-t border-slate-800">
        <div className="container mx-auto px-4">
          <div className="text-center text-slate-500 text-sm">
            &copy; {new Date().getFullYear()} JCIL.AI. All rights reserved. | Code Lab v3.0 — Beyond
            Claude Code
          </div>
        </div>
      </footer>
    </main>
  );
}

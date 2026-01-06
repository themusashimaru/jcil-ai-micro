'use client';

/**
 * CODE LAB DOCUMENTATION PAGE
 *
 * Comprehensive documentation for Code Lab with:
 * - Jump-to sections
 * - Copy page functionality
 * - Full tool reference
 */

import Link from 'next/link';
import { useState } from 'react';
import LandingLogo from '../../components/LandingLogo';

const SECTIONS = [
  { id: 'getting-started', title: 'Getting Started' },
  { id: 'tools', title: 'Tool Reference' },
  { id: 'file-operations', title: 'File Operations' },
  { id: 'git', title: 'Git Integration' },
  { id: 'planning-mode', title: 'Planning Mode' },
  { id: 'mcp', title: 'MCP Servers' },
  { id: 'hooks', title: 'Hooks System' },
  { id: 'memory', title: 'Project Memory' },
  { id: 'background-tasks', title: 'Background Tasks' },
  { id: 'best-practices', title: 'Best Practices' },
];

const TOOLS_DATA = {
  fileOps: [
    { name: 'read_file', desc: 'Read the contents of a file', params: 'path: string' },
    { name: 'write_file', desc: 'Create or overwrite a file', params: 'path: string, content: string' },
    { name: 'edit_file', desc: 'Make precise edits to a file', params: 'path: string, old_string: string, new_string: string' },
    { name: 'multi_edit', desc: 'Make multiple edits in one operation', params: 'path: string, edits: Array<{old: string, new: string}>' },
    { name: 'list_files', desc: 'List files in a directory', params: 'path?: string (defaults to /workspace)' },
    { name: 'search_files', desc: 'Find files by glob pattern', params: 'pattern: string' },
    { name: 'search_code', desc: 'Search file contents with regex', params: 'pattern: string, path?: string, file_pattern?: string' },
  ],
  shell: [
    { name: 'execute_shell', desc: 'Run a shell command', params: 'command: string, timeout?: number' },
    { name: 'run_build', desc: 'Execute npm run build', params: 'none' },
    { name: 'run_tests', desc: 'Execute npm test', params: 'none' },
    { name: 'install_packages', desc: 'Run npm install', params: 'packages?: string[] (optional specific packages)' },
  ],
  git: [
    { name: 'git_status', desc: 'View repository status', params: 'none' },
    { name: 'git_diff', desc: 'View changes', params: 'staged?: boolean, file?: string' },
    { name: 'git_commit', desc: 'Stage and commit changes', params: 'message: string, files?: string[]' },
  ],
  planning: [
    { name: 'enter_plan_mode', desc: 'Start a planning session', params: 'reason: string, initial_questions?: string[]' },
    { name: 'write_plan', desc: 'Document implementation plan', params: 'title: string, summary: string, tasks: Task[], notes?: string' },
    { name: 'exit_plan_mode', desc: 'Request approval', params: 'ready_for_approval: boolean, questions_for_user?: string[]' },
  ],
  mcp: [
    { name: 'mcp_list_servers', desc: 'List configured MCP servers', params: 'none' },
    { name: 'mcp_enable_server', desc: 'Enable an MCP server', params: 'server_id: string' },
    { name: 'mcp_disable_server', desc: 'Disable an MCP server', params: 'server_id: string' },
  ],
  hooks: [
    { name: 'hooks_list', desc: 'List all hooks', params: 'none' },
    { name: 'hooks_enable', desc: 'Enable a hook', params: 'hook_id: string' },
    { name: 'hooks_disable', desc: 'Disable a hook', params: 'hook_id: string' },
    { name: 'hooks_create', desc: 'Create a custom hook', params: 'id: string, name: string, event: string, command: string, ...' },
  ],
  memory: [
    { name: 'memory_read', desc: 'Read project memory', params: 'none' },
    { name: 'memory_create', desc: 'Create CODELAB.md', params: 'none' },
    { name: 'memory_update', desc: 'Update memory content', params: 'content: string' },
    { name: 'memory_add_section', desc: 'Add a section', params: 'title: string, content: string, type?: string' },
  ],
  background: [
    { name: 'bg_run', desc: 'Run command in background', params: 'command: string' },
    { name: 'bg_output', desc: 'Get task output', params: 'task_id: string' },
    { name: 'bg_kill', desc: 'Kill a background task', params: 'task_id: string' },
    { name: 'bg_list', desc: 'List background tasks', params: 'filter?: "running" | "completed" | "all"' },
  ],
};

const FULL_DOC_TEXT = `# Code Lab Documentation

## Getting Started

Code Lab is a full AI development environment that runs in your browser. It provides:

- **Isolated E2B Sandbox**: Each session runs in a secure Linux container
- **30+ Tools**: File operations, Git, shell execution, and more
- **Persistent Workspaces**: Your work is saved between sessions
- **GitHub Integration**: Clone repos, push changes, create PRs

### Quick Start

1. Sign up or log in to JCIL.AI
2. Navigate to Code Lab
3. Connect your GitHub account (optional)
4. Clone a repository or start from scratch
5. Start chatting with the AI to write code

### Basic Commands

- "Create a new file at src/index.ts"
- "Read the package.json file"
- "Run npm install"
- "Show me the git status"
- "Commit these changes with message 'feat: add auth'"

## Tool Reference

### File Operations

| Tool | Description | Parameters |
|------|-------------|------------|
| read_file | Read file contents | path: string |
| write_file | Create/overwrite file | path, content: string |
| edit_file | Precise text replacement | path, old_string, new_string |
| multi_edit | Multiple edits at once | path, edits: Array |
| list_files | List directory contents | path?: string |
| search_files | Find files by pattern | pattern: string |
| search_code | Search code with regex | pattern, path?, file_pattern? |

### Shell Execution

| Tool | Description |
|------|-------------|
| execute_shell | Run any shell command |
| run_build | Execute npm run build |
| run_tests | Execute npm test |
| install_packages | Run npm install |

### Git Operations

| Tool | Description | Parameters |
|------|-------------|------------|
| git_status | View repo status | none |
| git_diff | View changes | staged?, file? |
| git_commit | Commit changes | message, files? |

## Planning Mode

Use planning mode for complex tasks that need careful design.

### When to Use

- Multiple valid approaches exist
- Significant architectural decisions needed
- Changes touch many files
- Requirements are unclear

### How It Works

1. enter_plan_mode - Start planning with a reason
2. Explore codebase with file/search tools
3. write_plan - Document your approach
4. exit_plan_mode - Request user approval
5. User approves → Implementation begins

### Example

User: "Add user authentication to the app"
AI: Uses enter_plan_mode because this requires architectural decisions
AI: Explores existing code, identifies patterns
AI: Uses write_plan to document:
- Task 1: Create User model
- Task 2: Add JWT middleware
- Task 3: Create login/signup routes
AI: Uses exit_plan_mode to request approval

## MCP Servers

Model Context Protocol servers extend Code Lab's capabilities.

### Available Servers

- **filesystem**: Enhanced file access
- **github**: GitHub API integration
- **puppeteer**: Browser automation
- **postgres**: Database queries
- **memory**: Persistent memory store

### Usage

1. Use mcp_list_servers to see available servers
2. Use mcp_enable_server to enable one
3. New tools become available from that server

## Hooks System

Hooks run commands in response to events.

### Event Types

- **pre_tool**: Before a tool executes
- **post_tool**: After a tool executes
- **session_start**: When session begins
- **session_end**: When session ends

### Default Hooks

- pre-commit-lint: Run linter before commits
- pre-commit-test: Run tests before commits
- post-write-format: Format files after writing

### Creating Hooks

\`\`\`
hooks_create({
  id: "my-hook",
  name: "My Custom Hook",
  event: "pre_tool",
  tool_pattern: "git_commit",
  command: "npm run lint",
  action: "block"
})
\`\`\`

## Project Memory

CODELAB.md stores project-specific context.

### What to Include

- Project overview
- Code style conventions
- Architecture notes
- Common tasks
- Preferences (run tests after changes, etc.)
- Things to avoid

### Usage

- memory_read: View current memory
- memory_create: Create default template
- memory_update: Replace content
- memory_add_section: Add a new section

## Background Tasks

Run long-running commands without blocking.

### Usage

1. bg_run "npm run dev" - Start a dev server
2. bg_list - See running tasks
3. bg_output task-id - Check output
4. bg_kill task-id - Stop the task

## Best Practices

### 1. Use Planning Mode for Complex Tasks
Don't dive into implementation. Plan first, get approval.

### 2. Commit Early and Often
Make small, focused commits with clear messages.

### 3. Use Project Memory
Document project-specific context in CODELAB.md.

### 4. Enable Relevant Hooks
Use pre-commit hooks to catch issues early.

### 5. Keep Sessions Organized
Use clear session names. Clean up when done.

---
*JCIL.AI Code Lab Documentation*
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
              <Link href="/docs" className="text-slate-400 hover:text-white transition">Docs</Link>
              <span className="text-slate-500">/</span>
              <span className="text-fuchsia-400 font-medium">Code Lab</span>
            </Link>

            <button
              onClick={copyPageContent}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${
                copied ? 'bg-green-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {copied ? (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Copied!
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Copy Page
                </>
              )}
            </button>
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
                {SECTIONS.map(section => (
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
            <h1 className="text-4xl font-bold mb-8">Code Lab Documentation</h1>

            {/* Getting Started */}
            <section id="getting-started" className="mb-16 scroll-mt-24">
              <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                <span className="text-fuchsia-400">#</span> Getting Started
              </h2>
              <div className="prose prose-invert max-w-none">
                <p className="text-slate-300 mb-4">
                  Code Lab is a full AI development environment that runs in your browser. It provides:
                </p>
                <ul className="space-y-2 text-slate-300 mb-6">
                  <li className="flex items-start gap-2">
                    <span className="text-fuchsia-400 mt-1">•</span>
                    <span><strong>Isolated E2B Sandbox</strong>: Each session runs in a secure Linux container</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-fuchsia-400 mt-1">•</span>
                    <span><strong>30+ Tools</strong>: File operations, Git, shell execution, and more</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-fuchsia-400 mt-1">•</span>
                    <span><strong>Persistent Workspaces</strong>: Your work is saved between sessions</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-fuchsia-400 mt-1">•</span>
                    <span><strong>GitHub Integration</strong>: Clone repos, push changes, create PRs</span>
                  </li>
                </ul>

                <h3 className="text-lg font-semibold text-white mb-3">Quick Start</h3>
                <ol className="list-decimal list-inside space-y-2 text-slate-300 mb-6">
                  <li>Sign up or log in to JCIL.AI</li>
                  <li>Navigate to Code Lab</li>
                  <li>Connect your GitHub account (optional)</li>
                  <li>Clone a repository or start from scratch</li>
                  <li>Start chatting with the AI to write code</li>
                </ol>

                <h3 className="text-lg font-semibold text-white mb-3">Basic Commands</h3>
                <div className="bg-slate-900 rounded-lg p-4 font-mono text-sm space-y-2">
                  <p className="text-slate-400"># File operations</p>
                  <p className="text-fuchsia-300">&quot;Create a new file at src/index.ts&quot;</p>
                  <p className="text-fuchsia-300">&quot;Read the package.json file&quot;</p>
                  <p className="text-slate-400"># Shell commands</p>
                  <p className="text-fuchsia-300">&quot;Run npm install&quot;</p>
                  <p className="text-slate-400"># Git operations</p>
                  <p className="text-fuchsia-300">&quot;Show me the git status&quot;</p>
                  <p className="text-fuchsia-300">&quot;Commit these changes with message &apos;feat: add auth&apos;&quot;</p>
                </div>
              </div>
            </section>

            {/* Tools Reference */}
            <section id="tools" className="mb-16 scroll-mt-24">
              <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                <span className="text-fuchsia-400">#</span> Tool Reference
              </h2>
              <p className="text-slate-300 mb-6">
                Code Lab provides 30+ tools for development tasks. All tools are called automatically based on your natural language requests.
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
                      <th className="text-left py-3 px-4 text-slate-400 font-medium">Description</th>
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
                        <td className="py-3 px-4 text-slate-500 font-mono text-xs">{tool.params}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Git */}
            <section id="git" className="mb-16 scroll-mt-24">
              <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                <span className="text-fuchsia-400">#</span> Git Integration
              </h2>
              <div className="overflow-x-auto mb-6">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-800">
                      <th className="text-left py-3 px-4 text-slate-400 font-medium">Tool</th>
                      <th className="text-left py-3 px-4 text-slate-400 font-medium">Description</th>
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
                        <td className="py-3 px-4 text-slate-500 font-mono text-xs">{tool.params}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-800">
                <p className="text-slate-400 text-sm">
                  <strong>Note:</strong> Git operations require a cloned repository. Use the GitHub integration to clone repos securely with your PAT.
                </p>
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
                <li className="flex items-start gap-2">
                  <span className="text-fuchsia-400">•</span>
                  Multiple valid approaches exist
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-fuchsia-400">•</span>
                  Significant architectural decisions needed
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-fuchsia-400">•</span>
                  Changes touch many files
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-fuchsia-400">•</span>
                  Requirements are unclear
                </li>
              </ul>

              <h3 className="text-lg font-semibold text-white mb-3">Workflow</h3>
              <div className="space-y-3">
                {[
                  { step: '1', text: 'enter_plan_mode - Start planning with a reason' },
                  { step: '2', text: 'Explore codebase with file/search tools' },
                  { step: '3', text: 'write_plan - Document your approach' },
                  { step: '4', text: 'exit_plan_mode - Request user approval' },
                  { step: '5', text: 'User approves → Implementation begins' },
                ].map(item => (
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
                <span className="text-fuchsia-400">#</span> MCP Servers
              </h2>
              <p className="text-slate-300 mb-4">
                Model Context Protocol servers extend Code Lab&apos;s capabilities with additional tools.
              </p>

              <h3 className="text-lg font-semibold text-white mb-3">Available Servers</h3>
              <div className="grid gap-3 sm:grid-cols-2 mb-6">
                {[
                  { name: 'filesystem', desc: 'Enhanced file access' },
                  { name: 'github', desc: 'GitHub API integration' },
                  { name: 'puppeteer', desc: 'Browser automation' },
                  { name: 'postgres', desc: 'Database queries' },
                  { name: 'memory', desc: 'Persistent memory store' },
                ].map(server => (
                  <div key={server.name} className="p-3 bg-slate-900/50 rounded-lg border border-slate-800">
                    <code className="text-fuchsia-400">{server.name}</code>
                    <p className="text-slate-500 text-sm mt-1">{server.desc}</p>
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
                ].map(item => (
                  <div key={item.event} className="flex items-center gap-3">
                    <code className="text-fuchsia-400 bg-slate-900 px-2 py-1 rounded">{item.event}</code>
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
                  'Project overview',
                  'Code style conventions',
                  'Architecture notes',
                  'Common tasks',
                  'Preferences (run tests after changes, etc.)',
                  'Things to avoid',
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-fuchsia-400">•</span>
                    {item}
                  </li>
                ))}
              </ul>
            </section>

            {/* Background Tasks */}
            <section id="background-tasks" className="mb-16 scroll-mt-24">
              <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                <span className="text-fuchsia-400">#</span> Background Tasks
              </h2>
              <p className="text-slate-300 mb-4">
                Run long-running commands without blocking the conversation.
              </p>

              <div className="bg-slate-900 rounded-lg p-4 font-mono text-sm space-y-2">
                <p className="text-slate-400"># Start a dev server</p>
                <p className="text-fuchsia-300">bg_run &quot;npm run dev&quot;</p>
                <p className="text-slate-400"># Check running tasks</p>
                <p className="text-fuchsia-300">bg_list</p>
                <p className="text-slate-400"># Check output</p>
                <p className="text-fuchsia-300">bg_output task-id</p>
                <p className="text-slate-400"># Stop the task</p>
                <p className="text-fuchsia-300">bg_kill task-id</p>
              </div>
            </section>

            {/* Best Practices */}
            <section id="best-practices" className="mb-16 scroll-mt-24">
              <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                <span className="text-fuchsia-400">#</span> Best Practices
              </h2>

              <div className="space-y-6">
                {[
                  { title: 'Use Planning Mode for Complex Tasks', desc: "Don't dive into implementation. Plan first, get approval." },
                  { title: 'Commit Early and Often', desc: 'Make small, focused commits with clear messages.' },
                  { title: 'Use Project Memory', desc: 'Document project-specific context in CODELAB.md.' },
                  { title: 'Enable Relevant Hooks', desc: 'Use pre-commit hooks to catch issues early.' },
                  { title: 'Keep Sessions Organized', desc: 'Use clear session names. Clean up when done.' },
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
                <h2 className="text-2xl font-bold text-white mb-4">Ready to Start?</h2>
                <p className="text-slate-400 mb-6">Launch Code Lab and experience AI-assisted development.</p>
                <Link
                  href="/code-lab"
                  className="inline-block rounded-xl bg-gradient-to-r from-fuchsia-600 to-purple-600 px-8 py-3 text-lg font-semibold text-white hover:shadow-xl hover:shadow-fuchsia-500/25 transition-all duration-300"
                >
                  Open Code Lab
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
            &copy; {new Date().getFullYear()} JCIL.AI. All rights reserved.
          </div>
        </div>
      </footer>
    </main>
  );
}

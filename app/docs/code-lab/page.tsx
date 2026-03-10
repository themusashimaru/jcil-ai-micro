'use client';

import Link from 'next/link';
import { useState } from 'react';

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

---
*JCIL.AI Code Lab Documentation*
`;

function ToolTable({ tools }: { tools: { name: string; desc: string; params: string }[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full font-mono text-xs">
        <thead>
          <tr className="border-b border-border/30">
            <th className="text-left py-3 px-4 text-muted-foreground/60 uppercase tracking-widest text-[9px]">Tool</th>
            <th className="text-left py-3 px-4 text-muted-foreground/60 uppercase tracking-widest text-[9px]">Description</th>
            <th className="text-left py-3 px-4 text-muted-foreground/60 uppercase tracking-widest text-[9px]">Parameters</th>
          </tr>
        </thead>
        <tbody>
          {tools.map((tool) => (
            <tr key={tool.name} className="border-b border-border/10">
              <td className="py-3 px-4"><code className="text-accent">{tool.name}</code></td>
              <td className="py-3 px-4 text-muted-foreground">{tool.desc}</td>
              <td className="py-3 px-4 text-muted-foreground/60 text-[10px]">{tool.params}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function CodeLabDocsPage() {
  const [copied, setCopied] = useState(false);

  const copyPageContent = () => {
    navigator.clipboard.writeText(FULL_DOC_TEXT);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="grid-bg fixed inset-0 opacity-30" aria-hidden="true" />

      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-sm bg-background/80 border-b border-border/30">
        <div className="max-w-5xl mx-auto px-6 md:px-12 py-4">
          <nav className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/" className="font-bebas text-2xl tracking-tight">
                <span className="text-accent">JCIL</span>
                <span className="text-muted-foreground">.AI</span>
              </Link>
              <span className="text-border/60">/</span>
              <Link href="/docs" className="font-mono text-xs text-muted-foreground hover:text-foreground transition-colors uppercase tracking-widest">Docs</Link>
              <span className="text-border/60">/</span>
              <span className="font-mono text-xs text-accent uppercase tracking-widest">Code Lab</span>
            </div>

            <button
              onClick={copyPageContent}
              className={`flex items-center gap-2 border px-4 py-2 font-mono text-xs uppercase tracking-widest transition-all ${
                copied ? 'border-accent text-accent' : 'border-border/40 text-muted-foreground hover:text-foreground hover:border-foreground/40'
              }`}
            >
              {copied ? 'Copied!' : 'Copy Page'}
            </button>
          </nav>
        </div>
      </header>

      <div className="relative z-10 max-w-5xl mx-auto px-6 md:px-12 py-8">
        <div className="flex gap-8">
          {/* Sidebar */}
          <aside className="hidden lg:block w-56 shrink-0">
            <div className="sticky top-24">
              <span className="font-mono text-[9px] uppercase tracking-[0.3em] text-muted-foreground/60">On this page</span>
              <nav className="mt-4 space-y-1">
                {SECTIONS.map(section => (
                  <a
                    key={section.id}
                    href={`#${section.id}`}
                    className="block font-mono text-xs text-muted-foreground hover:text-accent transition-colors py-1.5"
                  >
                    {section.title}
                  </a>
                ))}
              </nav>
            </div>
          </aside>

          {/* Main Content */}
          <div className="flex-1 min-w-0">
            <div className="mb-12">
              <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-accent">Reference</span>
              <h1 className="mt-4 font-bebas text-4xl md:text-6xl tracking-tight">CODE LAB</h1>
            </div>

            {/* Getting Started */}
            <section id="getting-started" className="mb-16 scroll-mt-24">
              <h2 className="font-bebas text-2xl tracking-tight text-foreground mb-4 flex items-center gap-3">
                <span className="text-accent">#</span> GETTING STARTED
              </h2>
              <p className="font-mono text-xs text-muted-foreground leading-relaxed mb-4">
                Code Lab is a full AI development environment that runs in your browser. It provides:
              </p>
              <ul className="space-y-2 mb-6">
                {[
                  ['Isolated E2B Sandbox', 'Each session runs in a secure Linux container'],
                  ['30+ Tools', 'File operations, Git, shell execution, and more'],
                  ['Persistent Workspaces', 'Your work is saved between sessions'],
                  ['GitHub Integration', 'Clone repos, push changes, create PRs'],
                ].map(([title, desc]) => (
                  <li key={title} className="flex items-start gap-3 font-mono text-xs">
                    <span className="text-accent mt-0.5">+</span>
                    <span><span className="text-foreground">{title}:</span> <span className="text-muted-foreground">{desc}</span></span>
                  </li>
                ))}
              </ul>

              <h3 className="font-bebas text-lg tracking-tight text-foreground mb-3">QUICK START</h3>
              <ol className="space-y-2 font-mono text-xs text-muted-foreground mb-6">
                {['Sign up or log in to JCIL.AI', 'Navigate to Code Lab', 'Connect your GitHub account (optional)', 'Clone a repository or start from scratch', 'Start chatting with the AI to write code'].map((step, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="text-accent">{i + 1}.</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>

              <h3 className="font-bebas text-lg tracking-tight text-foreground mb-3">BASIC COMMANDS</h3>
              <div className="border border-border/30 bg-card/50 p-4 font-mono text-xs space-y-2">
                <p className="text-muted-foreground/60"># File operations</p>
                <p className="text-accent">&quot;Create a new file at src/index.ts&quot;</p>
                <p className="text-accent">&quot;Read the package.json file&quot;</p>
                <p className="text-muted-foreground/60"># Shell commands</p>
                <p className="text-accent">&quot;Run npm install&quot;</p>
                <p className="text-muted-foreground/60"># Git operations</p>
                <p className="text-accent">&quot;Show me the git status&quot;</p>
                <p className="text-accent">&quot;Commit these changes with message &apos;feat: add auth&apos;&quot;</p>
              </div>
            </section>

            {/* Tool Reference */}
            <section id="tools" className="mb-16 scroll-mt-24">
              <h2 className="font-bebas text-2xl tracking-tight text-foreground mb-4 flex items-center gap-3">
                <span className="text-accent">#</span> TOOL REFERENCE
              </h2>
              <p className="font-mono text-xs text-muted-foreground leading-relaxed mb-6">
                Code Lab provides 30+ tools for development tasks. All tools are called automatically based on your natural language requests.
              </p>
            </section>

            {/* File Operations */}
            <section id="file-operations" className="mb-16 scroll-mt-24">
              <h2 className="font-bebas text-2xl tracking-tight text-foreground mb-4 flex items-center gap-3">
                <span className="text-accent">#</span> FILE OPERATIONS
              </h2>
              <ToolTable tools={TOOLS_DATA.fileOps} />
            </section>

            {/* Shell */}
            <section className="mb-16 scroll-mt-24">
              <h2 className="font-bebas text-2xl tracking-tight text-foreground mb-4 flex items-center gap-3">
                <span className="text-accent">#</span> SHELL EXECUTION
              </h2>
              <ToolTable tools={TOOLS_DATA.shell} />
            </section>

            {/* Git */}
            <section id="git" className="mb-16 scroll-mt-24">
              <h2 className="font-bebas text-2xl tracking-tight text-foreground mb-4 flex items-center gap-3">
                <span className="text-accent">#</span> GIT INTEGRATION
              </h2>
              <ToolTable tools={TOOLS_DATA.git} />
              <div className="mt-4 border border-border/30 bg-card/50 p-4">
                <p className="font-mono text-[10px] text-muted-foreground">
                  <span className="text-foreground">Note:</span> Git operations require a cloned repository. Use the GitHub integration to clone repos securely with your PAT.
                </p>
              </div>
            </section>

            {/* Planning Mode */}
            <section id="planning-mode" className="mb-16 scroll-mt-24">
              <h2 className="font-bebas text-2xl tracking-tight text-foreground mb-4 flex items-center gap-3">
                <span className="text-accent">#</span> PLANNING MODE
              </h2>
              <p className="font-mono text-xs text-muted-foreground leading-relaxed mb-4">
                Use planning mode for complex tasks that need careful design before implementation.
              </p>

              <h3 className="font-bebas text-lg tracking-tight text-foreground mb-3">WHEN TO USE</h3>
              <ul className="space-y-2 mb-6">
                {['Multiple valid approaches exist', 'Significant architectural decisions needed', 'Changes touch many files', 'Requirements are unclear'].map((item) => (
                  <li key={item} className="flex items-start gap-3 font-mono text-xs text-muted-foreground">
                    <span className="text-accent">+</span>
                    {item}
                  </li>
                ))}
              </ul>

              <h3 className="font-bebas text-lg tracking-tight text-foreground mb-3">WORKFLOW</h3>
              <div className="space-y-3">
                {[
                  'enter_plan_mode — Start planning with a reason',
                  'Explore codebase with file/search tools',
                  'write_plan — Document your approach',
                  'exit_plan_mode — Request user approval',
                  'User approves → Implementation begins',
                ].map((step, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="w-6 h-6 border border-accent/30 flex items-center justify-center font-mono text-[10px] text-accent">{i + 1}</span>
                    <span className="font-mono text-xs text-muted-foreground">{step}</span>
                  </div>
                ))}
              </div>

              <div className="mt-6">
                <ToolTable tools={TOOLS_DATA.planning} />
              </div>
            </section>

            {/* MCP */}
            <section id="mcp" className="mb-16 scroll-mt-24">
              <h2 className="font-bebas text-2xl tracking-tight text-foreground mb-4 flex items-center gap-3">
                <span className="text-accent">#</span> MCP SERVERS
              </h2>
              <p className="font-mono text-xs text-muted-foreground leading-relaxed mb-4">
                Model Context Protocol servers extend Code Lab&apos;s capabilities with additional tools.
              </p>

              <h3 className="font-bebas text-lg tracking-tight text-foreground mb-3">AVAILABLE SERVERS</h3>
              <div className="grid gap-3 sm:grid-cols-2 mb-6">
                {[
                  { name: 'filesystem', desc: 'Enhanced file access' },
                  { name: 'github', desc: 'GitHub API integration' },
                  { name: 'puppeteer', desc: 'Browser automation' },
                  { name: 'postgres', desc: 'Database queries' },
                  { name: 'memory', desc: 'Persistent memory store' },
                ].map(server => (
                  <div key={server.name} className="border border-border/30 p-3">
                    <code className="font-mono text-xs text-accent">{server.name}</code>
                    <p className="font-mono text-[10px] text-muted-foreground mt-1">{server.desc}</p>
                  </div>
                ))}
              </div>

              <ToolTable tools={TOOLS_DATA.mcp} />
            </section>

            {/* Hooks */}
            <section id="hooks" className="mb-16 scroll-mt-24">
              <h2 className="font-bebas text-2xl tracking-tight text-foreground mb-4 flex items-center gap-3">
                <span className="text-accent">#</span> HOOKS SYSTEM
              </h2>
              <p className="font-mono text-xs text-muted-foreground leading-relaxed mb-4">
                Hooks run commands in response to events like tool execution.
              </p>

              <h3 className="font-bebas text-lg tracking-tight text-foreground mb-3">EVENT TYPES</h3>
              <div className="grid gap-2 mb-6">
                {[
                  { event: 'pre_tool', desc: 'Before a tool executes' },
                  { event: 'post_tool', desc: 'After a tool executes' },
                  { event: 'session_start', desc: 'When session begins' },
                  { event: 'session_end', desc: 'When session ends' },
                ].map(item => (
                  <div key={item.event} className="flex items-center gap-3">
                    <code className="font-mono text-xs text-accent border border-border/30 px-2 py-1">{item.event}</code>
                    <span className="font-mono text-xs text-muted-foreground">{item.desc}</span>
                  </div>
                ))}
              </div>

              <ToolTable tools={TOOLS_DATA.hooks} />
            </section>

            {/* Memory */}
            <section id="memory" className="mb-16 scroll-mt-24">
              <h2 className="font-bebas text-2xl tracking-tight text-foreground mb-4 flex items-center gap-3">
                <span className="text-accent">#</span> PROJECT MEMORY
              </h2>
              <p className="font-mono text-xs text-muted-foreground leading-relaxed mb-4">
                CODELAB.md stores project-specific context that persists across sessions.
              </p>

              <h3 className="font-bebas text-lg tracking-tight text-foreground mb-3">WHAT TO INCLUDE</h3>
              <ul className="space-y-2 mb-6">
                {['Project overview', 'Code style conventions', 'Architecture notes', 'Common tasks', 'Preferences (run tests after changes, etc.)', 'Things to avoid'].map((item) => (
                  <li key={item} className="flex items-start gap-3 font-mono text-xs text-muted-foreground">
                    <span className="text-accent">+</span>
                    {item}
                  </li>
                ))}
              </ul>

              <ToolTable tools={TOOLS_DATA.memory} />
            </section>

            {/* Background Tasks */}
            <section id="background-tasks" className="mb-16 scroll-mt-24">
              <h2 className="font-bebas text-2xl tracking-tight text-foreground mb-4 flex items-center gap-3">
                <span className="text-accent">#</span> BACKGROUND TASKS
              </h2>
              <p className="font-mono text-xs text-muted-foreground leading-relaxed mb-4">
                Run long-running commands without blocking the conversation.
              </p>

              <div className="border border-border/30 bg-card/50 p-4 font-mono text-xs space-y-2 mb-6">
                <p className="text-muted-foreground/60"># Start a dev server</p>
                <p className="text-accent">bg_run &quot;npm run dev&quot;</p>
                <p className="text-muted-foreground/60"># Check running tasks</p>
                <p className="text-accent">bg_list</p>
                <p className="text-muted-foreground/60"># Check output</p>
                <p className="text-accent">bg_output task-id</p>
                <p className="text-muted-foreground/60"># Stop the task</p>
                <p className="text-accent">bg_kill task-id</p>
              </div>

              <ToolTable tools={TOOLS_DATA.background} />
            </section>

            {/* Best Practices */}
            <section id="best-practices" className="mb-16 scroll-mt-24">
              <h2 className="font-bebas text-2xl tracking-tight text-foreground mb-4 flex items-center gap-3">
                <span className="text-accent">#</span> BEST PRACTICES
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
                    <span className="w-6 h-6 border border-accent/30 flex items-center justify-center font-mono text-[10px] text-accent shrink-0">{i + 1}</span>
                    <div>
                      <h3 className="font-mono text-sm text-foreground mb-1">{item.title}</h3>
                      <p className="font-mono text-xs text-muted-foreground">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* CTA */}
            <section className="pt-12 border-t border-border/30">
              <h2 className="font-bebas text-2xl tracking-tight text-foreground mb-4">READY TO START?</h2>
              <p className="font-mono text-xs text-muted-foreground mb-6">Launch Code Lab and experience AI-assisted development.</p>
              <Link href="/code-lab" className="inline-block border border-accent bg-accent/10 px-8 py-4 font-mono text-sm uppercase tracking-widest text-accent hover:bg-accent/20 transition-all">
                Open Code Lab
              </Link>
            </section>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border/30 py-8 mt-16">
        <div className="max-w-5xl mx-auto px-6 md:px-12 text-center">
          <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
            &copy; {new Date().getFullYear()} JCIL.AI. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}

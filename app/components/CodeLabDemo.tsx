'use client';

/**
 * CODE LAB DEMO COMPONENT
 *
 * Showcases the Code Lab IDE capabilities on the landing page
 * with an animated terminal-style preview
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';

const TOOLS = [
  { name: 'execute_shell', icon: '⚡', desc: 'Shell execution' },
  { name: 'read_file', icon: '📄', desc: 'File reading' },
  { name: 'write_file', icon: '✏️', desc: 'File writing' },
  { name: 'edit_file', icon: '🔧', desc: 'Code editing' },
  { name: 'search_code', icon: '🔍', desc: 'Code search' },
  { name: 'git_commit', icon: '📦', desc: 'Git operations' },
  { name: 'run_tests', icon: '🧪', desc: 'Test execution' },
  { name: 'run_build', icon: '🏗️', desc: 'Build runner' },
  { name: 'enter_plan_mode', icon: '📋', desc: 'Planning mode' },
  { name: 'mcp_servers', icon: '🔌', desc: 'MCP integration' },
  { name: 'hooks', icon: '🪝', desc: 'Hooks system' },
  { name: 'bg_tasks', icon: '⏳', desc: 'Background tasks' },
];

const TERMINAL_LINES = [
  { type: 'tool', text: '▶ Running command', detail: '`npm install`' },
  { type: 'output', text: 'added 127 packages in 4.2s' },
  { type: 'tool', text: '▶ Reading file', detail: '`src/app.ts`' },
  { type: 'output', text: '// TypeScript application entry point' },
  { type: 'tool', text: '▶ Editing file', detail: '`src/routes/api.ts`' },
  { type: 'output', text: 'Successfully edited src/routes/api.ts' },
  { type: 'tool', text: '▶ Running tests', detail: '' },
  { type: 'output', text: '✓ 12 tests passed (0.8s)' },
  { type: 'tool', text: '▶ Git commit', detail: '"feat: Add user authentication"' },
  { type: 'output', text: '[main 5c5405a] feat: Add user authentication' },
  { type: 'complete', text: '✅ Task completed successfully' },
];

export default function CodeLabDemo() {
  const [visibleLines, setVisibleLines] = useState(0);
  const [activeToolIndex, setActiveToolIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setVisibleLines(prev => (prev < TERMINAL_LINES.length ? prev + 1 : 0));
    }, 800);

    const toolInterval = setInterval(() => {
      setActiveToolIndex(prev => (prev + 1) % TOOLS.length);
    }, 2000);

    return () => {
      clearInterval(interval);
      clearInterval(toolInterval);
    };
  }, []);

  return (
    <div className="max-w-7xl mx-auto">
      <div className="text-center mb-12">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-fuchsia-500/10 border border-fuchsia-500/30 mb-4">
          <span className="text-fuchsia-400">🔬</span>
          <span className="text-sm font-medium text-fuchsia-300">Claude Code Competitor</span>
        </div>
        <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
          Code Lab: Your AI Development Environment
        </h2>
        <p className="text-lg text-slate-400 max-w-2xl mx-auto">
          A full Claude Code-like experience in your browser. Sandboxed execution, persistent workspaces, and 30+ tools at your command.
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-8 items-center">
        {/* Terminal Preview */}
        <div className="relative">
          <div className="bg-slate-900 rounded-2xl border border-fuchsia-500/20 overflow-hidden shadow-2xl shadow-fuchsia-500/10">
            {/* Terminal Header */}
            <div className="flex items-center gap-2 px-4 py-3 bg-slate-800 border-b border-slate-700">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
                <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
              </div>
              <span className="text-xs text-slate-400 ml-2 font-mono">code-lab-workspace</span>
              <div className="ml-auto flex items-center gap-2">
                <span className="text-xs px-2 py-0.5 rounded bg-fuchsia-500/20 text-fuchsia-300">E2B Sandbox</span>
              </div>
            </div>

            {/* Terminal Content */}
            <div className="p-4 font-mono text-sm min-h-[320px] bg-black/50">
              <div className="space-y-2">
                {TERMINAL_LINES.slice(0, visibleLines).map((line, i) => (
                  <div key={i} className={`animate-fadeIn ${line.type === 'complete' ? 'mt-4' : ''}`}>
                    {line.type === 'tool' && (
                      <div className="text-fuchsia-400">
                        {line.text} <span className="text-slate-400">{line.detail}</span>
                      </div>
                    )}
                    {line.type === 'output' && (
                      <div className="text-slate-300 pl-4">{line.text}</div>
                    )}
                    {line.type === 'complete' && (
                      <div className="text-green-400 font-semibold">{line.text}</div>
                    )}
                  </div>
                ))}
                {visibleLines < TERMINAL_LINES.length && (
                  <div className="inline-block w-2 h-4 bg-fuchsia-400 animate-pulse"></div>
                )}
              </div>
            </div>

            {/* Status Bar */}
            <div className="flex items-center justify-between px-4 py-2 bg-slate-800 border-t border-slate-700 text-xs text-slate-400">
              <div className="flex items-center gap-4">
                <span>🟢 Connected</span>
                <span>Node.js v20.10</span>
              </div>
              <div className="flex items-center gap-2">
                <span>workspace: /project</span>
              </div>
            </div>
          </div>

          {/* Floating Badge */}
          <div className="absolute -top-4 -right-4 px-4 py-2 rounded-full bg-gradient-to-r from-fuchsia-600 to-purple-600 text-white text-sm font-semibold shadow-lg shadow-fuchsia-500/25">
            ✨ NEW
          </div>
        </div>

        {/* Features */}
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {TOOLS.map((tool, i) => (
              <div
                key={tool.name}
                className={`p-3 rounded-xl border transition-all duration-300 ${
                  i === activeToolIndex
                    ? 'bg-fuchsia-500/20 border-fuchsia-500/50 scale-105'
                    : 'bg-slate-800/50 border-slate-700/50 hover:border-fuchsia-500/30'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">{tool.icon}</span>
                  <span className="text-xs text-slate-300">{tool.desc}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Key Features */}
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-fuchsia-500/20 flex items-center justify-center shrink-0">
                <span className="text-fuchsia-400">🔒</span>
              </div>
              <div>
                <h4 className="text-white font-semibold">Isolated Sandbox</h4>
                <p className="text-sm text-slate-400">Each session runs in a secure E2B sandbox with full Linux environment.</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-fuchsia-500/20 flex items-center justify-center shrink-0">
                <span className="text-fuchsia-400">💾</span>
              </div>
              <div>
                <h4 className="text-white font-semibold">Persistent Workspaces</h4>
                <p className="text-sm text-slate-400">Pick up where you left off with saved workspace snapshots.</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-fuchsia-500/20 flex items-center justify-center shrink-0">
                <span className="text-fuchsia-400">🔌</span>
              </div>
              <div>
                <h4 className="text-white font-semibold">GitHub Integration</h4>
                <p className="text-sm text-slate-400">Clone repos, push changes, create PRs - all from natural language.</p>
              </div>
            </div>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <Link
              href="/code-lab"
              className="flex-1 text-center rounded-xl bg-gradient-to-r from-fuchsia-600 to-purple-600 px-6 py-3 text-white font-semibold hover:shadow-lg hover:shadow-fuchsia-500/25 transition-all duration-300"
            >
              Try Code Lab
            </Link>
            <Link
              href="/docs/code-lab"
              className="flex-1 text-center rounded-xl border border-fuchsia-500/30 bg-fuchsia-500/10 px-6 py-3 text-fuchsia-300 font-semibold hover:bg-fuchsia-500/20 transition-all duration-300"
            >
              Read Documentation
            </Link>
          </div>
        </div>
      </div>

      {/* Comparison Note */}
      <div className="mt-12 text-center">
        <p className="text-sm text-slate-500">
          <span className="text-fuchsia-400 font-semibold">90% Claude Code Parity</span> — Planning mode, MCP servers, hooks, project memory, background tasks, and 30+ tools
        </p>
      </div>
    </div>
  );
}

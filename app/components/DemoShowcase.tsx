'use client';

/**
 * DEMO SHOWCASE COMPONENT
 *
 * Consolidated demo section with tabs instead of endless scroll.
 * Mobile-first design with clear product separation.
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';

type DemoTab = 'code-lab' | 'chat' | 'scaffold' | 'deploy';

const TERMINAL_LINES = [
  { type: 'tool', text: '> Reading file', detail: 'src/app.ts' },
  { type: 'output', text: '  // TypeScript application entry' },
  { type: 'tool', text: '> Editing file', detail: 'src/routes/api.ts' },
  { type: 'output', text: '  Successfully edited src/routes/api.ts' },
  { type: 'tool', text: '> Running tests', detail: '' },
  { type: 'output', text: '  12 tests passed (0.8s)' },
  { type: 'tool', text: '> Git commit', detail: '"feat: Add auth"' },
  { type: 'output', text: '  [main 5c5405a] feat: Add auth' },
  { type: 'complete', text: 'Task completed successfully' },
];

const CHAT_MESSAGES = [
  { role: 'user', text: 'What does Romans 8:28 mean for my situation?' },
  { role: 'ai', text: 'Romans 8:28 teaches us that God works all things together for good for those who love Him. Even in difficult circumstances, God has a purpose. This doesn\'t mean every situation feels good, but that God can bring redemption and growth from any trial.' },
];

const SCAFFOLD_LINES = [
  { text: '$ jcil scaffold next-app --db supabase', type: 'command' },
  { text: 'Analyzing requirements...', type: 'info' },
  { text: 'Created src/app/page.tsx', type: 'success' },
  { text: 'Created src/lib/db/client.ts', type: 'success' },
  { text: 'Installing 24 packages...', type: 'info' },
  { text: 'Pushing to GitHub...', type: 'info' },
  { text: 'Project ready!', type: 'complete' },
];

export default function DemoShowcase() {
  const [activeTab, setActiveTab] = useState<DemoTab>('code-lab');
  const [terminalLine, setTerminalLine] = useState(0);
  const [scaffoldLine, setScaffoldLine] = useState(0);
  const [chatVisible, setChatVisible] = useState(false);

  // Animate terminal for code-lab
  useEffect(() => {
    if (activeTab !== 'code-lab') return;
    setTerminalLine(0);
    const interval = setInterval(() => {
      setTerminalLine(prev => prev < TERMINAL_LINES.length ? prev + 1 : 0);
    }, 600);
    return () => clearInterval(interval);
  }, [activeTab]);

  // Animate scaffold
  useEffect(() => {
    if (activeTab !== 'scaffold') return;
    setScaffoldLine(0);
    const interval = setInterval(() => {
      setScaffoldLine(prev => prev < SCAFFOLD_LINES.length ? prev + 1 : 0);
    }, 400);
    return () => clearInterval(interval);
  }, [activeTab]);

  // Animate chat
  useEffect(() => {
    if (activeTab !== 'chat') return;
    setChatVisible(false);
    const timer = setTimeout(() => setChatVisible(true), 500);
    return () => clearTimeout(timer);
  }, [activeTab]);

  const tabs: { id: DemoTab; label: string; icon: string }[] = [
    { id: 'code-lab', label: 'Code Lab', icon: '💻' },
    { id: 'chat', label: 'Chat', icon: '💬' },
    { id: 'scaffold', label: 'Scaffold', icon: '🚀' },
    { id: 'deploy', label: 'Deploy', icon: '☁️' },
  ];

  return (
    <section id="products" className="relative bg-gradient-to-b from-black via-slate-900/50 to-black py-16 sm:py-24">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <div className="text-center mb-10 sm:mb-14">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            See it in action
          </h2>
          <p className="text-slate-400 max-w-xl mx-auto">
            Real capabilities. Real demonstrations. Pick what interests you.
          </p>
        </div>

        {/* Tab Navigation - Horizontal Scroll on Mobile */}
        <div className="flex gap-2 sm:gap-3 overflow-x-auto pb-4 mb-6 -mx-4 px-4 sm:mx-0 sm:px-0 sm:justify-center scrollbar-hide">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`shrink-0 flex items-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl font-medium transition-all duration-300 ${
                activeTab === tab.id
                  ? 'bg-white text-black'
                  : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white border border-white/10'
              }`}
            >
              <span>{tab.icon}</span>
              <span className="text-sm sm:text-base">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Demo Content */}
        <div className="max-w-4xl mx-auto">
          {/* Code Lab Demo */}
          {activeTab === 'code-lab' && (
            <div className="animate-fadeIn">
              <div className="bg-slate-900 rounded-2xl border border-fuchsia-500/30 overflow-hidden shadow-2xl shadow-fuchsia-500/10">
                {/* Terminal Header */}
                <div className="flex items-center gap-2 px-4 py-3 bg-slate-800 border-b border-slate-700">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-500/80" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                    <div className="w-3 h-3 rounded-full bg-green-500/80" />
                  </div>
                  <span className="text-xs text-slate-400 ml-2 font-mono">code-lab-workspace</span>
                  <span className="ml-auto text-xs px-2 py-0.5 rounded bg-fuchsia-500/20 text-fuchsia-300">E2B Sandbox</span>
                </div>

                {/* Terminal Content */}
                <div className="p-4 font-mono text-sm min-h-[280px] bg-black/50">
                  {TERMINAL_LINES.slice(0, terminalLine).map((line, i) => (
                    <div key={i} className={`mb-1 ${line.type === 'complete' ? 'text-green-400 font-semibold mt-3' : line.type === 'tool' ? 'text-fuchsia-400' : 'text-slate-400 pl-2'}`}>
                      {line.type === 'tool' ? `${line.text} ${line.detail}` : line.text}
                    </div>
                  ))}
                  {terminalLine < TERMINAL_LINES.length && (
                    <span className="inline-block w-2 h-4 bg-fuchsia-400 animate-pulse" />
                  )}
                </div>

                {/* Status Bar */}
                <div className="flex items-center justify-between px-4 py-2 bg-slate-800 border-t border-slate-700 text-xs text-slate-500">
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-400" />
                    Connected
                  </span>
                  <span>Node.js v20</span>
                </div>
              </div>

              {/* Features */}
              <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { icon: '🧠', label: 'Claude Opus 4.5' },
                  { icon: '🔒', label: 'E2B Sandbox' },
                  { icon: '📦', label: 'GitHub' },
                  { icon: '🔌', label: 'MCP' },
                ].map(f => (
                  <div key={f.label} className="text-center p-3 rounded-xl bg-white/5 border border-white/10">
                    <span className="text-xl">{f.icon}</span>
                    <p className="text-xs text-slate-400 mt-1">{f.label}</p>
                  </div>
                ))}
              </div>

              <div className="mt-6 text-center">
                <Link
                  href="/code-lab"
                  className="inline-block rounded-xl bg-fuchsia-600 hover:bg-fuchsia-500 px-8 py-3 text-white font-semibold transition-all duration-300"
                >
                  Try Code Lab
                </Link>
              </div>
            </div>
          )}

          {/* Chat Demo */}
          {activeTab === 'chat' && (
            <div className="animate-fadeIn">
              <div className="bg-slate-900 rounded-2xl border border-blue-500/30 overflow-hidden shadow-2xl shadow-blue-500/10">
                {/* Chat Header */}
                <div className="flex items-center gap-3 px-4 py-3 bg-slate-800 border-b border-slate-700">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-white font-medium text-sm">JCIL.AI Chat</p>
                    <p className="text-slate-400 text-xs">Faith-aligned AI</p>
                  </div>
                </div>

                {/* Chat Messages */}
                <div className="p-4 min-h-[280px] bg-gradient-to-b from-slate-900 to-slate-800 space-y-4">
                  {/* User Message */}
                  <div className="flex justify-end">
                    <div className="bg-blue-600 text-white px-4 py-2.5 rounded-2xl rounded-br-md max-w-[85%]">
                      <p className="text-sm">{CHAT_MESSAGES[0].text}</p>
                    </div>
                  </div>

                  {/* AI Response */}
                  {chatVisible && (
                    <div className="flex justify-start animate-fadeIn">
                      <div className="flex items-start gap-3 max-w-[90%]">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex-shrink-0 flex items-center justify-center">
                          <span className="text-white text-xs font-bold">AI</span>
                        </div>
                        <div className="bg-slate-700/50 text-slate-200 px-4 py-3 rounded-2xl rounded-tl-md">
                          <p className="text-sm leading-relaxed">{CHAT_MESSAGES[1].text}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {!chatVisible && (
                    <div className="flex justify-start">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center">
                          <span className="text-white text-xs font-bold">AI</span>
                        </div>
                        <div className="bg-slate-700/50 px-4 py-3 rounded-2xl rounded-tl-md">
                          <div className="flex items-center gap-1">
                            <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                            <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                            <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Input Bar */}
                <div className="px-4 py-3 bg-slate-800 border-t border-slate-700">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 bg-slate-700/50 rounded-xl px-4 py-2.5 text-slate-400 text-sm">
                      Ask anything...
                    </div>
                    <button className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>

              {/* Features */}
              <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { icon: '📖', label: 'Biblical Truth' },
                  { icon: '🧠', label: 'Claude Sonnet 4.5' },
                  { icon: '🔍', label: 'Perplexity' },
                  { icon: '🎨', label: 'Image Gen' },
                ].map(f => (
                  <div key={f.label} className="text-center p-3 rounded-xl bg-white/5 border border-white/10">
                    <span className="text-xl">{f.icon}</span>
                    <p className="text-xs text-slate-400 mt-1">{f.label}</p>
                  </div>
                ))}
              </div>

              <div className="mt-6 text-center">
                <Link
                  href="/chat"
                  className="inline-block rounded-xl bg-blue-600 hover:bg-blue-500 px-8 py-3 text-white font-semibold transition-all duration-300"
                >
                  Start Chatting
                </Link>
              </div>
            </div>
          )}

          {/* Scaffold Demo */}
          {activeTab === 'scaffold' && (
            <div className="animate-fadeIn">
              <div className="bg-slate-900 rounded-2xl border border-green-500/30 overflow-hidden shadow-2xl shadow-green-500/10">
                {/* Terminal Header */}
                <div className="flex items-center gap-2 px-4 py-3 bg-slate-800 border-b border-slate-700">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-500/80" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                    <div className="w-3 h-3 rounded-full bg-green-500/80" />
                  </div>
                  <span className="text-xs text-slate-400 ml-2 font-mono">project-scaffolder</span>
                </div>

                {/* Terminal Content */}
                <div className="p-4 font-mono text-sm min-h-[280px] bg-black/50">
                  {SCAFFOLD_LINES.slice(0, scaffoldLine).map((line, i) => (
                    <div key={i} className={`mb-1 ${
                      line.type === 'command' ? 'text-cyan-400' :
                      line.type === 'success' ? 'text-green-400' :
                      line.type === 'complete' ? 'text-yellow-400 font-bold mt-2' :
                      'text-blue-400'
                    }`}>
                      {line.text}
                    </div>
                  ))}
                  {scaffoldLine < SCAFFOLD_LINES.length && (
                    <span className="inline-block w-2 h-4 bg-green-400 animate-pulse" />
                  )}
                </div>
              </div>

              <p className="mt-4 text-center text-slate-400 text-sm">
                Describe your app. We build it. Full stack. Ready to deploy.
              </p>

              <div className="mt-6 text-center">
                <Link
                  href="/signup"
                  className="inline-block rounded-xl bg-green-600 hover:bg-green-500 px-8 py-3 text-white font-semibold transition-all duration-300"
                >
                  Start Building
                </Link>
              </div>
            </div>
          )}

          {/* Deploy Demo */}
          {activeTab === 'deploy' && (
            <div className="animate-fadeIn">
              <div className="bg-slate-900 rounded-2xl border border-teal-500/30 overflow-hidden shadow-2xl shadow-teal-500/10 p-6 sm:p-8 min-h-[320px] flex flex-col items-center justify-center">
                <div className="text-6xl mb-4 animate-bounce">☁️</div>
                <h3 className="text-2xl font-bold text-white mb-2">One-Click Deploy</h3>
                <p className="text-slate-400 text-center max-w-md mb-6">
                  Push to Vercel, Netlify, or your own infrastructure. No config files. No CLI commands.
                </p>
                <div className="flex flex-wrap justify-center gap-3">
                  <span className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-slate-300">Vercel</span>
                  <span className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-slate-300">Netlify</span>
                  <span className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-slate-300">Railway</span>
                  <span className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-slate-300">GitHub Pages</span>
                </div>
              </div>

              <div className="mt-6 text-center">
                <Link
                  href="/signup"
                  className="inline-block rounded-xl bg-teal-600 hover:bg-teal-500 px-8 py-3 text-white font-semibold transition-all duration-300"
                >
                  Deploy Now
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

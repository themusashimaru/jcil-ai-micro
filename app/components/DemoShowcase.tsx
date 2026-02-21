'use client';

/**
 * DEMO SHOWCASE COMPONENT
 *
 * Professional demo section with realistic streaming animations.
 * Ocean blue color scheme. Mobile-first design.
 */

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

type DemoTab = 'code-lab' | 'chat';

// Code Lab demo content
const CODE_LAB_CONVERSATION = [
  {
    type: 'user',
    text: 'Create an authentication system with JWT tokens',
  },
  {
    type: 'thinking',
    text: 'Analyzing requirements... Planning implementation...',
  },
  {
    type: 'tool',
    name: 'write_file',
    path: 'src/lib/auth.ts',
  },
  {
    type: 'code',
    text: `import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export function generateToken(userId: string) {
  return jwt.sign({ userId }, process.env.JWT_SECRET!, {
    expiresIn: '7d'
  });
}

export function verifyToken(token: string) {
  return jwt.verify(token, process.env.JWT_SECRET!);
}`,
  },
  {
    type: 'tool',
    name: 'execute_shell',
    path: 'npm install jsonwebtoken bcryptjs',
  },
  {
    type: 'output',
    text: 'added 2 packages in 1.2s',
  },
  {
    type: 'tool',
    name: 'run_tests',
    path: '',
  },
  {
    type: 'output',
    text: '✓ 8 tests passed (0.9s)',
  },
  {
    type: 'complete',
    text: 'Authentication system created successfully. Files written: 3, Tests passing: 8',
  },
];

// Chat demo content
const CHAT_CONVERSATION = [
  {
    type: 'user',
    text: 'What does it mean to have faith during difficult times?',
  },
  {
    type: 'ai',
    text: `Faith during trials is beautifully addressed in Scripture. James 1:2-4 tells us to "consider it pure joy... whenever you face trials of many kinds, because you know that the testing of your faith produces perseverance."

This doesn't mean we pretend difficulties aren't hard. Rather, we trust that God is working even when we can't see it. Romans 8:28 reminds us that "in all things God works for the good of those who love him."

Three practical ways to strengthen your faith during hard times:

1. **Stay in the Word** - Scripture anchors us to truth
2. **Pray honestly** - God can handle our doubts
3. **Lean on community** - We weren't meant to walk alone

Would you like me to share more specific verses for your situation?`,
  },
];

// Streaming text hook
function useStreamingText(text: string, isActive: boolean, speed: number = 15) {
  const [displayedText, setDisplayedText] = useState('');
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    if (!isActive) {
      setDisplayedText('');
      setIsComplete(false);
      return;
    }

    let index = 0;
    setDisplayedText('');
    setIsComplete(false);

    const interval = setInterval(() => {
      if (index < text.length) {
        setDisplayedText(text.slice(0, index + 1));
        index++;
      } else {
        setIsComplete(true);
        clearInterval(interval);
      }
    }, speed);

    return () => clearInterval(interval);
  }, [text, isActive, speed]);

  return { displayedText, isComplete };
}

// Code Lab Demo Component
function CodeLabDemo() {
  const [step, setStep] = useState(0);
  const [codeVisible, setCodeVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setStep((prev) => {
        if (prev >= CODE_LAB_CONVERSATION.length - 1) {
          return 0;
        }
        return prev + 1;
      });
    }, 2500);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (CODE_LAB_CONVERSATION[step]?.type === 'code') {
      setCodeVisible(false);
      const timer = setTimeout(() => setCodeVisible(true), 100);
      return () => clearTimeout(timer);
    }
  }, [step]);

  // Auto-scroll
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [step]);

  return (
    <div className="bg-gradient-to-br from-slate-900 to-slate-950 rounded-2xl border border-cyan-500/30 overflow-hidden shadow-2xl shadow-cyan-500/10">
      {/* Window Header */}
      <div className="flex items-center gap-2 px-4 py-3 bg-slate-800/80 border-b border-slate-700/50">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500/80" />
          <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
          <div className="w-3 h-3 rounded-full bg-green-500/80" />
        </div>
        <span className="text-xs text-slate-400 ml-2 font-mono">Code Lab</span>
        <div className="ml-auto flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            E2B Connected
          </span>
        </div>
      </div>

      {/* Content */}
      <div
        ref={containerRef}
        className="p-4 min-h-[320px] max-h-[320px] overflow-y-auto space-y-3 bg-gradient-to-b from-slate-900/50 to-slate-950/80"
      >
        {CODE_LAB_CONVERSATION.slice(0, step + 1).map((item, i) => {
          if (item.type === 'user') {
            return (
              <div key={i} className="flex justify-end animate-fadeIn">
                <div className="bg-gradient-to-r from-cyan-600 to-blue-600 text-white px-4 py-2.5 rounded-2xl rounded-br-sm max-w-[85%] shadow-lg">
                  <p className="text-sm">{item.text}</p>
                </div>
              </div>
            );
          }

          if (item.type === 'thinking') {
            return (
              <div
                key={i}
                className="flex items-center gap-2 text-cyan-400/70 text-xs animate-fadeIn"
              >
                <div className="flex gap-1">
                  <div
                    className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce"
                    style={{ animationDelay: '0ms' }}
                  />
                  <div
                    className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce"
                    style={{ animationDelay: '150ms' }}
                  />
                  <div
                    className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce"
                    style={{ animationDelay: '300ms' }}
                  />
                </div>
                <span className="font-mono">{item.text}</span>
              </div>
            );
          }

          if (item.type === 'tool') {
            return (
              <div key={i} className="animate-fadeIn">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30">
                  <span className="text-cyan-400 text-xs font-mono font-semibold">{item.name}</span>
                  {item.path && (
                    <span className="text-slate-400 text-xs font-mono">{item.path}</span>
                  )}
                </div>
              </div>
            );
          }

          if (item.type === 'code' && codeVisible) {
            return (
              <div key={i} className="animate-fadeIn">
                <div className="bg-slate-950 rounded-lg border border-slate-700/50 overflow-hidden">
                  <div className="px-3 py-1.5 bg-slate-800/50 border-b border-slate-700/50 flex items-center justify-between">
                    <span className="text-xs text-slate-400 font-mono">src/lib/auth.ts</span>
                    <span className="text-xs text-emerald-400">TypeScript</span>
                  </div>
                  <pre className="p-3 text-xs font-mono text-slate-300 overflow-x-auto leading-relaxed">
                    <code>{item.text}</code>
                  </pre>
                </div>
              </div>
            );
          }

          if (item.type === 'output') {
            return (
              <div key={i} className="animate-fadeIn">
                <div className="font-mono text-xs text-emerald-400 pl-2 border-l-2 border-emerald-500/30">
                  {item.text}
                </div>
              </div>
            );
          }

          if (item.type === 'complete') {
            return (
              <div key={i} className="animate-fadeIn">
                <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 border border-emerald-500/30">
                  <svg
                    className="w-5 h-5 text-emerald-400"
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
                  <span className="text-sm text-emerald-300">{item.text}</span>
                </div>
              </div>
            );
          }

          return null;
        })}

        {/* Typing indicator when between steps */}
        {step < CODE_LAB_CONVERSATION.length - 1 && (
          <div className="flex items-center gap-2 text-slate-500 text-xs">
            <span className="inline-block w-2 h-4 bg-cyan-400/50 animate-pulse rounded-sm" />
          </div>
        )}
      </div>

      {/* Status Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-800/80 border-t border-slate-700/50 text-xs">
        <span className="flex items-center gap-2 text-slate-400">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          Workspace Active
        </span>
        <span className="text-slate-500 font-mono">Claude Opus 4.6</span>
      </div>
    </div>
  );
}

// Chat Demo Component
function ChatDemo() {
  const [showResponse, setShowResponse] = useState(false);
  const { displayedText, isComplete } = useStreamingText(
    CHAT_CONVERSATION[1].text,
    showResponse,
    8
  );

  useEffect(() => {
    const timer = setTimeout(() => setShowResponse(true), 1000);
    return () => clearTimeout(timer);
  }, []);

  // Reset animation periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setShowResponse(false);
      setTimeout(() => setShowResponse(true), 1000);
    }, 20000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-gradient-to-br from-slate-900 to-slate-950 rounded-2xl border border-blue-500/30 overflow-hidden shadow-2xl shadow-blue-500/10">
      {/* Chat Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-blue-900/50 to-cyan-900/50 border-b border-blue-500/20">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/30">
          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
            />
          </svg>
        </div>
        <div>
          <p className="text-white font-semibold">JCIL.AI</p>
          <p className="text-blue-300/70 text-xs">Faith-aligned AI assistant</p>
        </div>
        <div className="ml-auto">
          <span className="px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs border border-blue-500/30">
            Claude Sonnet 4
          </span>
        </div>
      </div>

      {/* Messages */}
      <div className="p-4 min-h-[320px] max-h-[320px] overflow-y-auto space-y-4 bg-gradient-to-b from-slate-900/30 to-slate-950/50">
        {/* User Message */}
        <div className="flex justify-end animate-fadeIn">
          <div className="bg-gradient-to-r from-blue-600 to-blue-500 text-white px-4 py-3 rounded-2xl rounded-br-sm max-w-[85%] shadow-lg shadow-blue-500/20">
            <p className="text-sm">{CHAT_CONVERSATION[0].text}</p>
          </div>
        </div>

        {/* AI Response */}
        <div className="flex gap-3 animate-fadeIn">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex-shrink-0 flex items-center justify-center shadow-md">
            <span className="text-white text-xs font-bold">AI</span>
          </div>
          <div className="bg-slate-800/50 backdrop-blur-sm text-slate-200 px-4 py-3 rounded-2xl rounded-tl-sm max-w-[85%] border border-slate-700/50">
            {showResponse ? (
              <div className="text-sm leading-relaxed whitespace-pre-wrap">
                {displayedText}
                {!isComplete && (
                  <span className="inline-block w-0.5 h-4 bg-blue-400 ml-0.5 animate-pulse" />
                )}
              </div>
            ) : (
              <div className="flex items-center gap-1.5 py-2">
                <div
                  className="w-2 h-2 rounded-full bg-blue-400 animate-bounce"
                  style={{ animationDelay: '0ms' }}
                />
                <div
                  className="w-2 h-2 rounded-full bg-blue-400 animate-bounce"
                  style={{ animationDelay: '150ms' }}
                />
                <div
                  className="w-2 h-2 rounded-full bg-blue-400 animate-bounce"
                  style={{ animationDelay: '300ms' }}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Input Bar */}
      <div className="px-4 py-3 bg-slate-800/50 border-t border-slate-700/50">
        <div className="flex items-center gap-3">
          <div className="flex-1 bg-slate-900/50 rounded-xl px-4 py-3 text-slate-500 text-sm border border-slate-700/50 focus-within:border-blue-500/50 transition-colors">
            Ask anything...
          </div>
          <button className="w-11 h-11 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 flex items-center justify-center text-white shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 transition-shadow">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DemoShowcase() {
  const [activeTab, setActiveTab] = useState<DemoTab>('chat');

  const tabs: { id: DemoTab; label: string; icon: string; color: string }[] = [
    { id: 'chat', label: 'Chat', icon: '💬', color: 'blue' },
    { id: 'code-lab', label: 'Code Lab', icon: '💻', color: 'cyan' },
  ];

  return (
    <section
      id="products"
      className="relative bg-gradient-to-b from-black via-slate-900/30 to-black py-16 sm:py-24 overflow-hidden"
    >
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-600/5 rounded-full blur-[100px]" />
      </div>

      <div className="container mx-auto px-4 relative">
        {/* Section Header */}
        <div className="text-center mb-10 sm:mb-14">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">See it in action</h2>
          <p className="text-slate-400 max-w-xl mx-auto">
            Real-time streaming. Real capabilities. Experience the difference.
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-3 justify-center mb-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all duration-300 ${
                activeTab === tab.id
                  ? tab.color === 'blue'
                    ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/30'
                    : 'bg-gradient-to-r from-cyan-600 to-cyan-500 text-white shadow-lg shadow-cyan-500/30'
                  : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white border border-white/10'
              }`}
            >
              <span className="text-lg">{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Demo Content */}
        <div className="max-w-3xl mx-auto">
          {activeTab === 'chat' && (
            <div className="animate-fadeIn">
              <ChatDemo />

              {/* Features */}
              <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { icon: '📖', label: 'Biblical Truth' },
                  { icon: '🧠', label: 'Claude Sonnet 4' },
                  { icon: '🔍', label: 'Web Search' },
                  { icon: '🎨', label: 'Image Gen' },
                ].map((f) => (
                  <div
                    key={f.label}
                    className="text-center p-3 rounded-xl bg-blue-500/5 border border-blue-500/20 hover:border-blue-500/40 transition-colors"
                  >
                    <span className="text-xl">{f.icon}</span>
                    <p className="text-xs text-blue-300/70 mt-1">{f.label}</p>
                  </div>
                ))}
              </div>

              <div className="mt-6 text-center">
                <Link
                  href="/chat"
                  className="inline-block rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 px-8 py-3 text-white font-semibold shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 transition-all duration-300"
                >
                  Start Chatting
                </Link>
              </div>
            </div>
          )}

          {activeTab === 'code-lab' && (
            <div className="animate-fadeIn">
              <CodeLabDemo />

              {/* Features */}
              <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { icon: '🧠', label: 'Claude Opus 4.6' },
                  { icon: '🔒', label: 'E2B Sandbox' },
                  { icon: '📦', label: 'GitHub' },
                  { icon: '🔌', label: 'MCP Protocol' },
                ].map((f) => (
                  <div
                    key={f.label}
                    className="text-center p-3 rounded-xl bg-cyan-500/5 border border-cyan-500/20 hover:border-cyan-500/40 transition-colors"
                  >
                    <span className="text-xl">{f.icon}</span>
                    <p className="text-xs text-cyan-300/70 mt-1">{f.label}</p>
                  </div>
                ))}
              </div>

              <div className="mt-6 text-center">
                <Link
                  href="/code-lab"
                  className="inline-block rounded-xl bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 px-8 py-3 text-white font-semibold shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50 transition-all duration-300"
                >
                  Try Code Lab
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

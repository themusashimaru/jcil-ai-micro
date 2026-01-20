/**
 * LIVE PREVIEW DEMO COMPONENT
 *
 * PURPOSE:
 * - Landing page showcase for Live Code Preview
 * - Animated demo showing code → live preview
 * - Visual "wow factor" for developers
 */

'use client';

import { useState, useEffect } from 'react';
import { sanitizeHtml } from '@/lib/sanitize';

// Demo code that builds progressively
const DEMO_STAGES = [
  {
    html: `<div class="card">
  <h1>Welcome!</h1>
</div>`,
    css: `.card {
  padding: 20px;
  background: #1e293b;
  color: white;
}`,
    preview: `<div style="padding:20px;background:#1e293b;color:white;font-family:sans-serif"><h1>Welcome!</h1></div>`,
  },
  {
    html: `<div class="card">
  <h1>Welcome!</h1>
  <p>AI-generated UI</p>
</div>`,
    css: `.card {
  padding: 20px;
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
  border-radius: 16px;
}`,
    preview: `<div style="padding:20px;background:linear-gradient(135deg,#667eea,#764ba2);color:white;border-radius:16px;font-family:sans-serif"><h1 style="margin:0 0 8px 0">Welcome!</h1><p style="margin:0;opacity:0.9">AI-generated UI</p></div>`,
  },
  {
    html: `<div class="card">
  <h1>Welcome!</h1>
  <p>AI-generated UI</p>
  <button>Get Started</button>
</div>`,
    css: `.card {
  padding: 24px;
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
  border-radius: 16px;
  box-shadow: 0 20px 40px rgba(0,0,0,0.3);
}

button {
  margin-top: 16px;
  padding: 12px 24px;
  background: white;
  color: #764ba2;
  border: none;
  border-radius: 8px;
  font-weight: bold;
  cursor: pointer;
}`,
    preview: `<div style="padding:24px;background:linear-gradient(135deg,#667eea,#764ba2);color:white;border-radius:16px;box-shadow:0 20px 40px rgba(0,0,0,0.3);font-family:sans-serif"><h1 style="margin:0 0 8px 0">Welcome!</h1><p style="margin:0 0 16px 0;opacity:0.9">AI-generated UI</p><button style="padding:12px 24px;background:white;color:#764ba2;border:none;border-radius:8px;font-weight:bold;cursor:pointer">Get Started</button></div>`,
  },
  {
    html: `<div class="card">
  <div class="icon">✨</div>
  <h1>Welcome!</h1>
  <p>AI-generated UI components,
live preview in real-time</p>
  <button>Get Started</button>
</div>`,
    css: `.card {
  padding: 32px;
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
  border-radius: 20px;
  box-shadow: 0 25px 50px rgba(102,126,234,0.4);
  text-align: center;
}

.icon {
  font-size: 48px;
  margin-bottom: 16px;
}

h1 {
  margin: 0 0 8px 0;
  font-size: 28px;
}

p {
  margin: 0 0 20px 0;
  opacity: 0.9;
}

button {
  padding: 14px 32px;
  background: white;
  color: #764ba2;
  border: none;
  border-radius: 10px;
  font-weight: bold;
  font-size: 16px;
  cursor: pointer;
  transition: transform 0.2s;
}

button:hover {
  transform: scale(1.05);
}`,
    preview: `<div style="padding:32px;background:linear-gradient(135deg,#667eea,#764ba2);color:white;border-radius:20px;box-shadow:0 25px 50px rgba(102,126,234,0.4);text-align:center;font-family:sans-serif"><div style="font-size:48px;margin-bottom:16px">✨</div><h1 style="margin:0 0 8px 0;font-size:28px">Welcome!</h1><p style="margin:0 0 20px 0;opacity:0.9">AI-generated UI components, live preview in real-time</p><button style="padding:14px 32px;background:white;color:#764ba2;border:none;border-radius:10px;font-weight:bold;font-size:16px;cursor:pointer">Get Started</button></div>`,
  },
];

export default function LivePreviewDemo() {
  const [stage, setStage] = useState(0);
  const [activeTab, setActiveTab] = useState<'html' | 'css'>('html');
  const [typingHtml, setTypingHtml] = useState('');
  const [typingCss, setTypingCss] = useState('');
  const [isTyping, setIsTyping] = useState(true);

  // Progress through stages
  useEffect(() => {
    const currentStage = DEMO_STAGES[stage];
    if (!currentStage) return;

    setIsTyping(true);
    let htmlIndex = 0;
    let cssIndex = 0;

    // Type HTML first
    const htmlInterval = setInterval(() => {
      if (htmlIndex <= currentStage.html.length) {
        setTypingHtml(currentStage.html.slice(0, htmlIndex));
        htmlIndex += 2;
      } else {
        clearInterval(htmlInterval);

        // Then type CSS
        const cssInterval = setInterval(() => {
          if (cssIndex <= currentStage.css.length) {
            setTypingCss(currentStage.css.slice(0, cssIndex));
            cssIndex += 3;
          } else {
            clearInterval(cssInterval);
            setIsTyping(false);

            // Move to next stage after a pause
            setTimeout(() => {
              if (stage < DEMO_STAGES.length - 1) {
                setStage(s => s + 1);
              } else {
                // Loop back
                setTimeout(() => {
                  setStage(0);
                  setTypingHtml('');
                  setTypingCss('');
                }, 3000);
              }
            }, 1500);
          }
        }, 15);
      }
    }, 20);

    return () => {
      clearInterval(htmlInterval);
    };
  }, [stage]);

  const currentStage = DEMO_STAGES[stage];

  return (
    <div className="w-full max-w-5xl mx-auto">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/10 border border-purple-500/30 mb-4">
          <span className="text-purple-400">👁️</span>
          <span className="text-sm font-medium text-purple-300">Live Code Preview</span>
        </div>
        <h3 className="text-2xl sm:text-3xl font-bold text-white mb-3">
          See Your Code Come to Life
        </h3>
        <p className="text-slate-400 max-w-2xl mx-auto">
          Watch the AI generate code and see it render instantly in a sandboxed preview.
          No refresh needed - changes appear in real-time.
        </p>
      </div>

      {/* Demo Window */}
      <div className="rounded-2xl overflow-hidden shadow-2xl shadow-purple-500/10 border border-slate-700/50">
        {/* Window Chrome */}
        <div className="bg-slate-800 px-4 py-2 flex items-center justify-between border-b border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <div className="w-3 h-3 rounded-full bg-yellow-500" />
              <div className="w-3 h-3 rounded-full bg-green-500" />
            </div>
            <span className="text-sm font-medium text-white">Live Preview</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-lg bg-slate-700/50 p-0.5">
              <span className="px-2 py-1 rounded text-xs font-medium bg-slate-600 text-white">Split</span>
            </div>
            <div className="flex items-center gap-1 text-xs text-slate-400">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span>Auto-refresh</span>
            </div>
          </div>
        </div>

        {/* Split View */}
        <div className="flex h-[400px]">
          {/* Code Panel */}
          <div className="w-1/2 flex flex-col border-r border-slate-700/50">
            {/* File Tabs */}
            <div className="flex items-center gap-1 px-2 py-1.5 bg-slate-800/50 border-b border-slate-700/50">
              <button
                onClick={() => setActiveTab('html')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition ${
                  activeTab === 'html'
                    ? 'bg-slate-700 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>🌐</span>
                <span>index.html</span>
              </button>
              <button
                onClick={() => setActiveTab('css')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition ${
                  activeTab === 'css'
                    ? 'bg-slate-700 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>🎨</span>
                <span>styles.css</span>
              </button>
            </div>

            {/* Code Content */}
            <div className="flex-1 overflow-auto p-4 bg-slate-900">
              <pre className="font-mono text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
                {activeTab === 'html' ? (
                  <>
                    {typingHtml}
                    {isTyping && activeTab === 'html' && (
                      <span className="inline-block w-2 h-4 bg-orange-400 animate-pulse" />
                    )}
                  </>
                ) : (
                  <>
                    {typingCss}
                    {isTyping && typingHtml === currentStage?.html && (
                      <span className="inline-block w-2 h-4 bg-cyan-400 animate-pulse" />
                    )}
                  </>
                )}
              </pre>
            </div>
          </div>

          {/* Preview Panel */}
          <div className="w-1/2 flex flex-col">
            {/* Preview Header */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/50 border-b border-slate-700/50">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-xs text-slate-400">Live Preview</span>
              <span className="ml-auto text-xs text-slate-500">Sandboxed</span>
            </div>

            {/* Preview Content */}
            {/* SECURITY FIX: Sanitize HTML to prevent XSS */}
            <div className="flex-1 bg-slate-950 flex items-center justify-center p-6">
              <div
                className="transition-all duration-300"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(currentStage?.preview || '') }}
              />
            </div>
          </div>
        </div>

        {/* Status Bar */}
        <div className="flex items-center justify-between px-4 py-1.5 bg-slate-800 border-t border-slate-700/50 text-xs text-slate-500">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-400" />
              Synced
            </span>
            <span>Stage {stage + 1} of {DEMO_STAGES.length}</span>
          </div>
          <div className="flex items-center gap-4">
            <span>2 files</span>
            <span>UTF-8</span>
          </div>
        </div>
      </div>

      {/* Feature Highlights */}
      <div className="mt-8 grid grid-cols-3 gap-4">
        <div className="text-center p-4">
          <div className="text-2xl mb-2">👁️</div>
          <div className="text-white font-medium text-sm">Instant Preview</div>
          <div className="text-slate-500 text-xs">See changes immediately</div>
        </div>
        <div className="text-center p-4">
          <div className="text-2xl mb-2">🔒</div>
          <div className="text-white font-medium text-sm">Sandboxed</div>
          <div className="text-slate-500 text-xs">Secure isolated execution</div>
        </div>
        <div className="text-center p-4">
          <div className="text-2xl mb-2">🎨</div>
          <div className="text-white font-medium text-sm">Multi-File</div>
          <div className="text-slate-500 text-xs">HTML, CSS, JS together</div>
        </div>
      </div>
    </div>
  );
}

/**
 * DEPLOY DEMO COMPONENT
 *
 * PURPOSE:
 * - Landing page showcase for One-Click Deploy
 * - Animated demo showing deployment flow
 * - Visual demonstration of Vercel/Netlify integration
 */

'use client';

import { useState, useEffect } from 'react';

const DEPLOY_STAGES = [
  { label: 'Connecting to Vercel...', icon: '🔌', duration: 800 },
  { label: 'Uploading 18 files...', icon: '📤', duration: 1200 },
  { label: 'Building project...', icon: '🔨', duration: 1500 },
  { label: 'Optimizing assets...', icon: '⚡', duration: 800 },
  { label: 'Deploying to edge...', icon: '🌐', duration: 1000 },
  { label: 'Live!', icon: '✅', duration: 0 },
];

export default function DeployDemo() {
  const [stage, setStage] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<'vercel' | 'netlify'>('vercel');

  // Progress through stages
  useEffect(() => {
    if (stage >= DEPLOY_STAGES.length) {
      setIsComplete(true);
      // Reset after a pause
      setTimeout(() => {
        setStage(0);
        setProgress(0);
        setIsComplete(false);
      }, 3000);
      return;
    }

    const currentStage = DEPLOY_STAGES[stage];
    if (!currentStage.duration) {
      setProgress(100);
      return;
    }

    // Animate progress within stage
    const startProgress = (stage / DEPLOY_STAGES.length) * 100;
    const endProgress = ((stage + 1) / DEPLOY_STAGES.length) * 100;
    const increment = (endProgress - startProgress) / (currentStage.duration / 50);

    let current = startProgress;
    const progressInterval = setInterval(() => {
      current += increment;
      if (current >= endProgress) {
        clearInterval(progressInterval);
        setProgress(endProgress);
        setTimeout(() => setStage((s) => s + 1), 200);
      } else {
        setProgress(current);
      }
    }, 50);

    return () => clearInterval(progressInterval);
  }, [stage]);

  const currentStage = DEPLOY_STAGES[Math.min(stage, DEPLOY_STAGES.length - 1)];

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/10 border border-green-500/30 mb-4">
          <span className="text-green-400">🚀</span>
          <span className="text-sm font-medium text-green-300">One-Click Deploy</span>
        </div>
        <h3 className="text-2xl sm:text-3xl font-bold text-white mb-3">
          Build It. Deploy It. Done.
        </h3>
        <p className="text-slate-400 max-w-2xl mx-auto">
          After scaffolding your project, deploy to Vercel or Netlify with a single click.
          No manual configuration, no CLI commands, no friction.
        </p>
      </div>

      {/* Demo Window */}
      <div className="rounded-2xl overflow-hidden shadow-2xl shadow-green-500/10 border border-slate-700/50">
        {/* Window Chrome */}
        <div className="bg-slate-800 px-4 py-2 flex items-center justify-between border-b border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <div className="w-3 h-3 rounded-full bg-yellow-500" />
              <div className="w-3 h-3 rounded-full bg-green-500" />
            </div>
            <span className="text-sm font-medium text-white">Deploy to Cloud</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span>Connected</span>
          </div>
        </div>

        {/* Content */}
        <div className="bg-slate-900 p-8">
          {/* Platform Selection */}
          <div className="flex justify-center gap-4 mb-8">
            <button
              onClick={() => {
                setSelectedPlatform('vercel');
                setStage(0);
                setProgress(0);
                setIsComplete(false);
              }}
              className={`flex items-center gap-3 px-6 py-3 rounded-xl border transition-all ${
                selectedPlatform === 'vercel'
                  ? 'bg-black border-white/30 shadow-lg'
                  : 'bg-slate-800/50 border-slate-700/50 hover:border-slate-600'
              }`}
            >
              <div className="w-8 h-8 rounded-full bg-black border border-white/20 flex items-center justify-center">
                <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M24 22.525H0l12-21.05 12 21.05z" />
                </svg>
              </div>
              <span className="font-medium text-white">Vercel</span>
            </button>

            <button
              onClick={() => {
                setSelectedPlatform('netlify');
                setStage(0);
                setProgress(0);
                setIsComplete(false);
              }}
              className={`flex items-center gap-3 px-6 py-3 rounded-xl border transition-all ${
                selectedPlatform === 'netlify'
                  ? 'bg-teal-900/50 border-teal-500/50 shadow-lg shadow-teal-500/10'
                  : 'bg-slate-800/50 border-slate-700/50 hover:border-slate-600'
              }`}
            >
              <div className="w-8 h-8 rounded-full bg-teal-600 flex items-center justify-center">
                <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.3877.0715c-.1675-.1011-.3855-.0506-.4866.117L6.9879 18.1756l-1.7324-3.0098c-.09-.1562-.2905-.2099-.4479-.1199L.8313 17.5845c-.1574.09-.2118.2905-.1218.4478l3.3736 5.8439c.09.1562.2905.2099.4479.1199l6.4694-3.7354 8.5035-14.7281-1.9697-3.4124c-.0506-.0876-.1303-.1539-.2265-.1839l-1.3054-.4649z" />
                </svg>
              </div>
              <span className="font-medium text-white">Netlify</span>
            </button>
          </div>

          {/* Deployment Progress */}
          <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700/50">
            {/* Current Stage */}
            <div className="flex items-center gap-4 mb-6">
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl ${
                  isComplete
                    ? 'bg-green-500/20'
                    : selectedPlatform === 'vercel'
                    ? 'bg-white/10'
                    : 'bg-teal-500/20'
                }`}
              >
                {currentStage.icon}
              </div>
              <div>
                <p className="font-semibold text-white text-lg">{currentStage.label}</p>
                <p className="text-sm text-slate-400">
                  {isComplete
                    ? 'ai-chat-app.vercel.app'
                    : `Deploying to ${selectedPlatform === 'vercel' ? 'Vercel' : 'Netlify'}...`}
                </p>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="relative h-3 bg-slate-700 rounded-full overflow-hidden mb-4">
              <div
                className={`absolute inset-y-0 left-0 rounded-full transition-all duration-300 ${
                  isComplete
                    ? 'bg-green-500'
                    : selectedPlatform === 'vercel'
                    ? 'bg-white'
                    : 'bg-teal-500'
                }`}
                style={{ width: `${progress}%` }}
              />
            </div>

            {/* Stage Indicators */}
            <div className="flex justify-between">
              {DEPLOY_STAGES.slice(0, -1).map((s, i) => (
                <div
                  key={i}
                  className={`flex flex-col items-center ${
                    i <= stage ? 'text-white' : 'text-slate-500'
                  }`}
                >
                  <span className="text-lg">{s.icon}</span>
                  <span className="text-xs mt-1 hidden sm:block">
                    {s.label.replace('...', '')}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Success State */}
          {isComplete && (
            <div className="mt-6 text-center">
              <a
                href="#"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-green-600 text-white font-semibold hover:bg-green-500 transition"
              >
                <span>View Live Site</span>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
              </a>
            </div>
          )}
        </div>

        {/* Status Bar */}
        <div className="flex items-center justify-between px-4 py-1.5 bg-slate-800 border-t border-slate-700/50 text-xs text-slate-500">
          <div className="flex items-center gap-4">
            <span>{Math.round(progress)}%</span>
            <span>18 files</span>
          </div>
          <div className="flex items-center gap-4">
            <span>{selectedPlatform === 'vercel' ? 'Edge Network' : 'Global CDN'}</span>
            <span>Automatic HTTPS</span>
          </div>
        </div>
      </div>

      {/* Feature Highlights */}
      <div className="mt-8 grid grid-cols-3 gap-4">
        <div className="text-center p-4">
          <div className="text-2xl mb-2">⚡</div>
          <div className="text-white font-medium text-sm">Zero Config</div>
          <div className="text-slate-500 text-xs">Auto-detects framework</div>
        </div>
        <div className="text-center p-4">
          <div className="text-2xl mb-2">🌐</div>
          <div className="text-white font-medium text-sm">Global CDN</div>
          <div className="text-slate-500 text-xs">Edge deployment</div>
        </div>
        <div className="text-center p-4">
          <div className="text-2xl mb-2">🔒</div>
          <div className="text-white font-medium text-sm">Free SSL</div>
          <div className="text-slate-500 text-xs">Automatic HTTPS</div>
        </div>
      </div>
    </div>
  );
}

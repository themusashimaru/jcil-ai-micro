/**
 * ONE-CLICK DEPLOY BUTTON COMPONENT
 *
 * PURPOSE:
 * - Deploy scaffolded projects to Vercel or Netlify
 * - Show deployment status and progress
 * - Provide deployment URL when complete
 */

'use client';

import { useState } from 'react';

interface DeployButtonProps {
  projectName: string;
  repoUrl?: string;
  files?: { path: string; content: string }[];
  framework?: 'nextjs' | 'react' | 'vue' | 'static';
  onDeployComplete?: (url: string, platform: string) => void;
}

type DeployStatus = 'idle' | 'selecting' | 'deploying' | 'success' | 'error';

interface DeployResult {
  url: string;
  platform: string;
  projectId: string;
}

export default function DeployButton({
  projectName,
  repoUrl,
  files,
  framework = 'nextjs',
  onDeployComplete,
}: DeployButtonProps) {
  const [status, setStatus] = useState<DeployStatus>('idle');
  const [selectedPlatform, setSelectedPlatform] = useState<'vercel' | 'netlify' | null>(null);
  const [deployResult, setDeployResult] = useState<DeployResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  const handleDeploy = async (platform: 'vercel' | 'netlify') => {
    setSelectedPlatform(platform);
    setStatus('deploying');
    setError(null);
    setProgress(0);

    try {
      // Simulate deployment progress
      const progressInterval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + Math.random() * 15;
        });
      }, 500);

      const response = await fetch('/api/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform,
          projectName,
          repoUrl,
          files,
          framework,
        }),
      });

      clearInterval(progressInterval);

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Deployment failed');
      }

      const result = await response.json();
      setProgress(100);
      setDeployResult(result);
      setStatus('success');
      onDeployComplete?.(result.url, platform);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Deployment failed');
      setStatus('error');
    }
  };

  const resetDeploy = () => {
    setStatus('idle');
    setSelectedPlatform(null);
    setDeployResult(null);
    setError(null);
    setProgress(0);
  };

  // Idle state - show deploy button
  if (status === 'idle') {
    return (
      <button
        onClick={() => setStatus('selecting')}
        className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold hover:shadow-lg hover:shadow-purple-500/25 transition-all duration-300 hover:-translate-y-0.5"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
        Deploy to Cloud
      </button>
    );
  }

  // Platform selection
  if (status === 'selecting') {
    return (
      <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700/50">
        <h3 className="text-lg font-semibold text-white mb-4">Choose Deployment Platform</h3>
        <div className="grid grid-cols-2 gap-4">
          {/* Vercel Option */}
          <button
            onClick={() => handleDeploy('vercel')}
            className="flex flex-col items-center gap-3 p-4 rounded-xl bg-slate-700/50 border border-slate-600/50 hover:border-white/30 hover:bg-slate-700 transition-all"
          >
            <div className="w-12 h-12 rounded-full bg-black flex items-center justify-center">
              <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M24 22.525H0l12-21.05 12 21.05z" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-white">Vercel</p>
              <p className="text-xs text-slate-400">Best for Next.js</p>
            </div>
          </button>

          {/* Netlify Option */}
          <button
            onClick={() => handleDeploy('netlify')}
            className="flex flex-col items-center gap-3 p-4 rounded-xl bg-slate-700/50 border border-slate-600/50 hover:border-teal-500/30 hover:bg-slate-700 transition-all"
          >
            <div className="w-12 h-12 rounded-full bg-teal-600 flex items-center justify-center">
              <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.3877.0715c-.1675-.1011-.3855-.0506-.4866.117L6.9879 18.1756l-1.7324-3.0098c-.09-.1562-.2905-.2099-.4479-.1199L.8313 17.5845c-.1574.09-.2118.2905-.1218.4478l3.3736 5.8439c.09.1562.2905.2099.4479.1199l6.4694-3.7354 8.5035-14.7281-1.9697-3.4124c-.0506-.0876-.1303-.1539-.2265-.1839l-1.3054-.4649z" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-white">Netlify</p>
              <p className="text-xs text-slate-400">Great for static sites</p>
            </div>
          </button>
        </div>
        <button
          onClick={resetDeploy}
          className="mt-4 text-sm text-slate-400 hover:text-white transition"
        >
          Cancel
        </button>
      </div>
    );
  }

  // Deploying state
  if (status === 'deploying') {
    return (
      <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700/50">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center animate-pulse">
            <svg className="w-5 h-5 text-purple-400 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
          <div>
            <p className="font-semibold text-white">
              Deploying to {selectedPlatform === 'vercel' ? 'Vercel' : 'Netlify'}...
            </p>
            <p className="text-sm text-slate-400">{projectName}</p>
          </div>
        </div>
        <div className="relative h-2 bg-slate-700 rounded-full overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-xs text-slate-500 mt-2">{Math.round(progress)}% complete</p>
      </div>
    );
  }

  // Success state
  if (status === 'success' && deployResult) {
    return (
      <div className="bg-gradient-to-br from-green-900/30 to-green-900/10 rounded-2xl p-6 border border-green-500/30">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
            <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <p className="font-semibold text-white">Deployed Successfully!</p>
            <p className="text-sm text-green-400">{deployResult.platform}</p>
          </div>
        </div>
        <a
          href={deployResult.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full px-4 py-3 rounded-xl bg-green-600 text-white text-center font-semibold hover:bg-green-500 transition mb-3"
        >
          View Live Site →
        </a>
        <p className="text-xs text-slate-400 text-center break-all">{deployResult.url}</p>
        <button
          onClick={resetDeploy}
          className="mt-4 w-full text-sm text-slate-400 hover:text-white transition"
        >
          Deploy Again
        </button>
      </div>
    );
  }

  // Error state
  if (status === 'error') {
    return (
      <div className="bg-gradient-to-br from-red-900/30 to-red-900/10 rounded-2xl p-6 border border-red-500/30">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
            <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <div>
            <p className="font-semibold text-white">Deployment Failed</p>
            <p className="text-sm text-red-400">{error}</p>
          </div>
        </div>
        <button
          onClick={resetDeploy}
          className="w-full px-4 py-3 rounded-xl bg-slate-700 text-white font-semibold hover:bg-slate-600 transition"
        >
          Try Again
        </button>
      </div>
    );
  }

  return null;
}

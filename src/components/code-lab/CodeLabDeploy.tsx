'use client';

/**
 * CODE LAB DEPLOY
 *
 * One-click deployment to Vercel or Netlify.
 * Features:
 * - Platform selection (Vercel/Netlify)
 * - Token management with secure storage
 * - Deployment progress tracking
 * - Live deployment URL
 */

import { useState, useCallback, useEffect } from 'react';

interface GeneratedFile {
  path: string;
  content: string;
}

interface CodeLabDeployProps {
  files: GeneratedFile[];
  projectName: string;
  repoUrl?: string;
  framework?: string;
  onDeployComplete?: (url: string) => void;
}

interface VercelStatus {
  connected: boolean;
  username?: string;
  email?: string;
  error?: string;
}

type Platform = 'vercel' | 'netlify';
type DeployState = 'idle' | 'checking' | 'deploying' | 'success' | 'error';

export function CodeLabDeploy({
  files,
  projectName,
  repoUrl,
  framework,
  onDeployComplete,
}: CodeLabDeployProps) {
  const [platform, setPlatform] = useState<Platform>('vercel');
  const [deployState, setDeployState] = useState<DeployState>('idle');
  const [deployUrl, setDeployUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [vercelStatus, setVercelStatus] = useState<VercelStatus | null>(null);
  const [showTokenInput, setShowTokenInput] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const [isSavingToken, setIsSavingToken] = useState(false);

  // Check Vercel connection status
  useEffect(() => {
    checkVercelConnection();
  }, []);

  const checkVercelConnection = async () => {
    try {
      const response = await fetch('/api/user/vercel-token');
      if (response.ok) {
        const data = await response.json();
        setVercelStatus(data);
      }
    } catch (err) {
      console.error('[Deploy] Error checking Vercel status:', err);
    }
  };

  // Save Vercel token
  const saveVercelToken = useCallback(async () => {
    if (!tokenInput.trim()) return;

    setIsSavingToken(true);
    try {
      const response = await fetch('/api/user/vercel-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: tokenInput.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save token');
      }

      setVercelStatus({ connected: true, username: data.username, email: data.email });
      setShowTokenInput(false);
      setTokenInput('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save token');
    } finally {
      setIsSavingToken(false);
    }
  }, [tokenInput]);

  // Disconnect Vercel
  const disconnectVercel = useCallback(async () => {
    try {
      await fetch('/api/user/vercel-token', { method: 'DELETE' });
      setVercelStatus({ connected: false });
    } catch (err) {
      console.error('[Deploy] Error disconnecting:', err);
    }
  }, []);

  // Deploy project
  const deploy = useCallback(async () => {
    if (files.length === 0) {
      setError('No files to deploy');
      return;
    }

    setDeployState('deploying');
    setError(null);
    setDeployUrl(null);

    try {
      const response = await fetch('/api/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform,
          projectName: projectName || 'code-lab-project',
          files,
          repoUrl,
          framework: framework || detectFramework(files),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Deployment failed');
      }

      setDeployUrl(data.url);
      setDeployState('success');
      onDeployComplete?.(data.url);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Deployment failed');
      setDeployState('error');
    }
  }, [files, platform, projectName, repoUrl, framework, onDeployComplete]);

  return (
    <div className="deploy-panel">
      {/* Platform selector */}
      <div className="platform-selector">
        <button
          className={platform === 'vercel' ? 'active' : ''}
          onClick={() => setPlatform('vercel')}
          disabled={deployState === 'deploying'}
        >
          <svg viewBox="0 0 116 100" fill="currentColor">
            <path fillRule="evenodd" d="M57.5 0L115 100H0L57.5 0z" />
          </svg>
          Vercel
        </button>
        <button
          className={platform === 'netlify' ? 'active' : ''}
          onClick={() => setPlatform('netlify')}
          disabled={deployState === 'deploying'}
        >
          <svg viewBox="0 0 128 128" fill="currentColor">
            <path d="M79.2 59.2l-11.6 5.8c-.1.1-.3.1-.4.2l-1.2 1.2 4 4c2 2.1 2 5.4 0 7.5l-5.7 5.7c-2.1 2-5.4 2-7.5 0l-4-4-1.2 1.2c-.1.1-.1.3-.2.4l-5.8 11.6c-.4.9-.2 2 .6 2.7.5.5 1.2.8 1.9.8h.6l14.9-3.7c.2-.1.5-.2.7-.3.2-.2.4-.4.5-.6L90 65.7l-5.7-5.7c-.8-.8-3.3-.8-5.1-.8zm30.3-1.8L96.4 44.3c-1.9-1.9-5-1.9-6.9 0L75.2 58.6c.7.1 1.3.4 1.8.9l5.7 5.7c.5.5.8 1.1.9 1.8l14.3-14.3c1.9-1.9 1.9-5 0-6.9l5.6 5.6zm-8.1-37.6L71.5 49.7l5.7 5.7L107.1 25.5c.9-.9 2.3-.9 3.1 0l5.9 5.9c.9.9.9 2.3 0 3.1l-3.1 3.1.7.7c1.9 1.9 1.9 5 0 6.9l-5.7 5.7c-1.9 1.9-5 1.9-6.9 0l-.7-.7-18 18c-.2.2-.4.4-.6.5-.1.2-.2.5-.3.7l-3.7 14.9c-.3 1.1.5 2.2 1.6 2.5.3.1.6.1.9 0l14.9-3.7c.2-.1.5-.2.7-.3.2-.2.4-.4.5-.6l36-36.1c.9-.9.9-2.3 0-3.1l-5.9-5.9c-.8-.8-2.2-.8-3 0zM44.2 77.5l-5.7 5.7c-.5.5-.8 1.1-.9 1.8L23.3 69.7c-1.9-1.9-1.9-5 0-6.9l5.6-5.6-5.7-5.7L9.2 65.6c-.9.9-.9 2.3 0 3.1l5.9 5.9c.9.9 2.3.9 3.1 0l3.1-3.1.7.7c1.9 1.9 5 1.9 6.9 0l5.7-5.7c1.9-1.9 1.9-5 0-6.9l-.7-.7 18-18c.2-.2.4-.4.6-.5.1-.2.2-.5.3-.7L56.5 25c.3-1.1-.5-2.2-1.6-2.5-.3-.1-.6-.1-.9 0l-14.9 3.7c-.2.1-.5.2-.7.3-.2.2-.4.4-.5.6l-36 36.1c-.9.9-.9 2.3 0 3.1l5.9 5.9c.8.8 2.2.8 3 0l29.9-29.9-5.7-5.7L5.2 66.4c-1.9 1.9-1.9 5 0 6.9L18.3 86.4c1.9 1.9 5 1.9 6.9 0l14.3-14.3c-.1-.7-.4-1.3-.9-1.8l-5.7-5.7c-.5-.5-1.1-.8-1.8-.9l14.3-14.3c.9-.9.9-2.3 0-3.1l-5.9-5.9c-.8-.8-2.2-.8-3 0l-3.1 3.1-.7-.7c-1.9-1.9-5-1.9-6.9 0l-5.7 5.7c-1.9 1.9-1.9 5 0 6.9l.7.7-18 18c-.2.2-.4.4-.5.6-.2.1-.2.5-.3.7l-3.7 14.9c-.3 1.1.5 2.2 1.6 2.5.3.1.6.1.9 0l14.9-3.7c.2-.1.5-.2.7-.3.2-.2.4-.4.5-.6z"/>
          </svg>
          Netlify
        </button>
      </div>

      {/* Vercel connection status */}
      {platform === 'vercel' && (
        <div className="connection-status">
          {vercelStatus?.connected ? (
            <div className="connected">
              <span className="status-dot" />
              <span>Connected as {vercelStatus.username}</span>
              <button className="disconnect-btn" onClick={disconnectVercel}>
                Disconnect
              </button>
            </div>
          ) : showTokenInput ? (
            <div className="token-input-container">
              <input
                type="password"
                placeholder="Enter Vercel Token"
                value={tokenInput}
                onChange={e => setTokenInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && saveVercelToken()}
              />
              <button
                className="save-token-btn"
                onClick={saveVercelToken}
                disabled={isSavingToken || !tokenInput.trim()}
              >
                {isSavingToken ? 'Saving...' : 'Save'}
              </button>
              <button className="cancel-btn" onClick={() => setShowTokenInput(false)}>
                Cancel
              </button>
            </div>
          ) : (
            <div className="not-connected">
              <span className="status-dot disconnected" />
              <span>Not connected to Vercel</span>
              <button className="connect-btn" onClick={() => setShowTokenInput(true)}>
                Connect
              </button>
            </div>
          )}
          <a
            href="https://vercel.com/account/tokens"
            target="_blank"
            rel="noopener noreferrer"
            className="token-help"
          >
            Get API Token
          </a>
        </div>
      )}

      {/* Deploy button */}
      <button
        className={`deploy-btn ${deployState}`}
        onClick={deploy}
        disabled={
          deployState === 'deploying' ||
          (platform === 'vercel' && !vercelStatus?.connected) ||
          files.length === 0
        }
      >
        {deployState === 'deploying' ? (
          <>
            <svg className="spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
            Deploying...
          </>
        ) : deployState === 'success' ? (
          <>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            Deployed!
          </>
        ) : (
          <>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
            </svg>
            Deploy to {platform === 'vercel' ? 'Vercel' : 'Netlify'}
          </>
        )}
      </button>

      {/* Success URL */}
      {deployUrl && (
        <div className="deploy-success">
          <a href={deployUrl} target="_blank" rel="noopener noreferrer">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
            </svg>
            {deployUrl.replace('https://', '')}
          </a>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="deploy-error">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" />
          </svg>
          <span>{error}</span>
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      <style jsx>{`
        .deploy-panel {
          padding: 1rem;
          background: #f8fafc;
          border-radius: 8px;
          border: 1px solid #e5e7eb;
        }

        .platform-selector {
          display: flex;
          gap: 0.5rem;
          margin-bottom: 1rem;
        }

        .platform-selector button {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          padding: 0.625rem 1rem;
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          font-size: 0.875rem;
          font-weight: 500;
          color: #6b7280;
          cursor: pointer;
          transition: all 0.2s;
        }

        .platform-selector button:hover:not(:disabled) {
          border-color: #d1d5db;
          color: #374151;
        }

        .platform-selector button.active {
          background: #1a1f36;
          border-color: #1a1f36;
          color: white;
        }

        .platform-selector button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .platform-selector button svg {
          width: 16px;
          height: 16px;
        }

        .connection-status {
          margin-bottom: 1rem;
          padding: 0.75rem;
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
        }

        .connected, .not-connected {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.8125rem;
        }

        .status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #22c55e;
        }

        .status-dot.disconnected {
          background: #d1d5db;
        }

        .disconnect-btn, .connect-btn {
          margin-left: auto;
          padding: 0.25rem 0.5rem;
          background: none;
          border: 1px solid #e5e7eb;
          border-radius: 4px;
          font-size: 0.75rem;
          cursor: pointer;
        }

        .disconnect-btn:hover {
          border-color: #dc2626;
          color: #dc2626;
        }

        .connect-btn {
          background: #6366f1;
          border-color: #6366f1;
          color: white;
        }

        .connect-btn:hover {
          background: #4f46e5;
        }

        .token-input-container {
          display: flex;
          gap: 0.5rem;
        }

        .token-input-container input {
          flex: 1;
          padding: 0.5rem;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          font-size: 0.8125rem;
        }

        .token-input-container input:focus {
          outline: none;
          border-color: #6366f1;
        }

        .save-token-btn {
          padding: 0.5rem 0.75rem;
          background: #6366f1;
          border: none;
          border-radius: 6px;
          color: white;
          font-size: 0.75rem;
          cursor: pointer;
        }

        .save-token-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .cancel-btn {
          padding: 0.5rem 0.75rem;
          background: none;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          font-size: 0.75rem;
          cursor: pointer;
        }

        .token-help {
          display: block;
          margin-top: 0.5rem;
          font-size: 0.6875rem;
          color: #6366f1;
          text-decoration: none;
        }

        .token-help:hover {
          text-decoration: underline;
        }

        .deploy-btn {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          padding: 0.75rem 1rem;
          background: #1a1f36;
          border: none;
          border-radius: 8px;
          color: white;
          font-size: 0.875rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .deploy-btn:hover:not(:disabled) {
          background: #2d3348;
        }

        .deploy-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .deploy-btn.success {
          background: #16a34a;
        }

        .deploy-btn.error {
          background: #dc2626;
        }

        .deploy-btn svg {
          width: 18px;
          height: 18px;
        }

        .deploy-btn .spinner {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .deploy-success {
          margin-top: 1rem;
          padding: 0.75rem;
          background: #f0fdf4;
          border: 1px solid #bbf7d0;
          border-radius: 8px;
        }

        .deploy-success a {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          color: #16a34a;
          font-size: 0.8125rem;
          font-weight: 500;
          text-decoration: none;
        }

        .deploy-success a:hover {
          text-decoration: underline;
        }

        .deploy-success svg {
          width: 16px;
          height: 16px;
        }

        .deploy-error {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-top: 1rem;
          padding: 0.75rem;
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 8px;
          color: #dc2626;
          font-size: 0.8125rem;
        }

        .deploy-error svg {
          width: 16px;
          height: 16px;
          flex-shrink: 0;
        }

        .deploy-error span {
          flex: 1;
        }

        .deploy-error button {
          background: none;
          border: none;
          color: #dc2626;
          font-size: 1.25rem;
          cursor: pointer;
          padding: 0;
          line-height: 1;
        }

        @media (max-width: 480px) {
          .platform-selector {
            flex-direction: column;
          }

          .token-input-container {
            flex-wrap: wrap;
          }

          .token-input-container input {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}

/**
 * Detect framework from files
 */
function detectFramework(files: GeneratedFile[]): string {
  const filenames = files.map(f => f.path.toLowerCase());

  if (filenames.some(f => f.includes('next.config'))) return 'nextjs';
  if (filenames.some(f => f.includes('vite.config'))) return 'vite';
  if (filenames.some(f => f.includes('nuxt.config'))) return 'nuxtjs';
  if (filenames.some(f => f.includes('svelte.config'))) return 'sveltekit';
  if (filenames.some(f => f.includes('astro.config'))) return 'astro';
  if (filenames.some(f => f.endsWith('.tsx') || f.endsWith('.jsx'))) return 'react';

  // Check package.json for clues
  const packageJson = files.find(f => f.path === 'package.json' || f.path === '/package.json');
  if (packageJson) {
    try {
      const pkg = JSON.parse(packageJson.content);
      if (pkg.dependencies?.next) return 'nextjs';
      if (pkg.dependencies?.vue) return 'vue';
      if (pkg.dependencies?.react) return 'react';
      if (pkg.dependencies?.svelte) return 'svelte';
    } catch {
      // Ignore JSON parse errors
    }
  }

  // Default to static
  return 'static';
}

'use client';

/**
 * CODE LAB DEPLOY FLOW
 *
 * One-click deployment to Vercel, Netlify, Railway, and more.
 *
 * Features:
 * - Platform selection (Vercel, Netlify, Railway, Cloudflare)
 * - Environment variables configuration
 * - Build settings
 * - Domain configuration
 * - Deployment progress
 * - Rollback support
 */

import { useState } from 'react';

type DeployPlatform = 'vercel' | 'netlify' | 'railway' | 'cloudflare';
type DeployStatus = 'idle' | 'connecting' | 'building' | 'deploying' | 'success' | 'error';

interface DeployConfig {
  platform: DeployPlatform;
  projectName: string;
  buildCommand: string;
  outputDir: string;
  envVars: Record<string, string>;
  domain?: string;
}

interface Deployment {
  id: string;
  status: DeployStatus;
  url?: string;
  createdAt: Date;
  buildLogs: string[];
  error?: string;
}

interface CodeLabDeployFlowProps {
  onDeploy: (config: DeployConfig) => Promise<Deployment>;
  onRollback?: (deploymentId: string) => Promise<boolean>;
  recentDeployments?: Deployment[];
  className?: string;
}

const PLATFORMS: {
  id: DeployPlatform;
  name: string;
  icon: string;
  color: string;
  description: string;
}[] = [
  {
    id: 'vercel',
    name: 'Vercel',
    icon: '▲',
    color: '#000000',
    description: 'Best for Next.js, React, Vue',
  },
  {
    id: 'netlify',
    name: 'Netlify',
    icon: '◆',
    color: '#00AD9F',
    description: 'Best for static sites, JAMstack',
  },
  {
    id: 'railway',
    name: 'Railway',
    icon: '🚂',
    color: '#0B0D0E',
    description: 'Best for full-stack, databases',
  },
  {
    id: 'cloudflare',
    name: 'Cloudflare Pages',
    icon: '☁️',
    color: '#F38020',
    description: 'Best for edge, global CDN',
  },
];

const DEFAULT_CONFIGS: Record<DeployPlatform, Partial<DeployConfig>> = {
  vercel: {
    buildCommand: 'npm run build',
    outputDir: '.next',
  },
  netlify: {
    buildCommand: 'npm run build',
    outputDir: 'dist',
  },
  railway: {
    buildCommand: 'npm run build',
    outputDir: '',
  },
  cloudflare: {
    buildCommand: 'npm run build',
    outputDir: 'dist',
  },
};

export function CodeLabDeployFlow({
  onDeploy,
  onRollback,
  recentDeployments = [],
  className = '',
}: CodeLabDeployFlowProps) {
  const [step, setStep] = useState<'platform' | 'config' | 'deploy' | 'done'>('platform');
  const [platform, setPlatform] = useState<DeployPlatform>('vercel');
  const [projectName, setProjectName] = useState('');
  const [buildCommand, setBuildCommand] = useState('npm run build');
  const [outputDir, setOutputDir] = useState('.next');
  const [envVars, setEnvVars] = useState<Record<string, string>>({});
  const [newEnvKey, setNewEnvKey] = useState('');
  const [newEnvValue, setNewEnvValue] = useState('');
  const [domain, setDomain] = useState('');
  const [deployment, setDeployment] = useState<Deployment | null>(null);
  const [showLogs, setShowLogs] = useState(false);

  const handlePlatformSelect = (p: DeployPlatform) => {
    setPlatform(p);
    const defaults = DEFAULT_CONFIGS[p];
    setBuildCommand(defaults.buildCommand || '');
    setOutputDir(defaults.outputDir || '');
    setStep('config');
  };

  const addEnvVar = () => {
    if (newEnvKey.trim()) {
      setEnvVars(prev => ({ ...prev, [newEnvKey.trim()]: newEnvValue }));
      setNewEnvKey('');
      setNewEnvValue('');
    }
  };

  const removeEnvVar = (key: string) => {
    setEnvVars(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const handleDeploy = async () => {
    setStep('deploy');

    const config: DeployConfig = {
      platform,
      projectName,
      buildCommand,
      outputDir,
      envVars,
      domain: domain || undefined,
    };

    try {
      const result = await onDeploy(config);
      setDeployment(result);

      if (result.status === 'success') {
        setStep('done');
      }
    } catch (error) {
      setDeployment({
        id: 'error',
        status: 'error',
        createdAt: new Date(),
        buildLogs: [],
        error: String(error),
      });
    }
  };

  const handleRollback = async (deploymentId: string) => {
    if (onRollback) {
      await onRollback(deploymentId);
    }
  };

  const platformInfo = PLATFORMS.find(p => p.id === platform);

  return (
    <div className={`deploy-flow ${className}`}>
      {/* Header */}
      <div className="deploy-header">
        <div className="deploy-title">
          <span className="deploy-icon">🚀</span>
          <h3>Deploy</h3>
        </div>
        {step !== 'platform' && (
          <button className="back-btn" onClick={() => setStep('platform')}>
            ← Back
          </button>
        )}
      </div>

      <div className="deploy-content">
        {/* Step 1: Platform selection */}
        {step === 'platform' && (
          <div className="platform-step">
            <p className="step-description">
              Choose a deployment platform for your project
            </p>
            <div className="platform-grid">
              {PLATFORMS.map((p) => (
                <button
                  key={p.id}
                  className="platform-card"
                  onClick={() => handlePlatformSelect(p.id)}
                  style={{ '--platform-color': p.color } as React.CSSProperties}
                >
                  <span className="platform-icon">{p.icon}</span>
                  <span className="platform-name">{p.name}</span>
                  <span className="platform-desc">{p.description}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Configuration */}
        {step === 'config' && (
          <div className="config-step">
            <div className="selected-platform">
              <span style={{ color: platformInfo?.color }}>{platformInfo?.icon}</span>
              {platformInfo?.name}
            </div>

            <div className="config-form">
              <div className="form-group">
                <label>Project Name</label>
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="my-awesome-project"
                />
              </div>

              <div className="form-group">
                <label>Build Command</label>
                <input
                  type="text"
                  value={buildCommand}
                  onChange={(e) => setBuildCommand(e.target.value)}
                  placeholder="npm run build"
                />
              </div>

              <div className="form-group">
                <label>Output Directory</label>
                <input
                  type="text"
                  value={outputDir}
                  onChange={(e) => setOutputDir(e.target.value)}
                  placeholder=".next, dist, build"
                />
              </div>

              <div className="form-group">
                <label>Custom Domain (optional)</label>
                <input
                  type="text"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  placeholder="example.com"
                />
              </div>

              <div className="form-group">
                <label>Environment Variables</label>
                <div className="env-vars">
                  {Object.entries(envVars).map(([key, _value]) => (
                    <div key={key} className="env-var">
                      <span className="env-key">{key}</span>
                      <span className="env-value">••••••••</span>
                      <button onClick={() => removeEnvVar(key)}>×</button>
                    </div>
                  ))}
                  <div className="add-env">
                    <input
                      type="text"
                      value={newEnvKey}
                      onChange={(e) => setNewEnvKey(e.target.value)}
                      placeholder="KEY"
                    />
                    <input
                      type="password"
                      value={newEnvValue}
                      onChange={(e) => setNewEnvValue(e.target.value)}
                      placeholder="value"
                    />
                    <button onClick={addEnvVar}>+</button>
                  </div>
                </div>
              </div>
            </div>

            <button
              className="deploy-btn"
              onClick={handleDeploy}
              disabled={!projectName.trim()}
            >
              🚀 Deploy to {platformInfo?.name}
            </button>
          </div>
        )}

        {/* Step 3: Deploying */}
        {step === 'deploy' && deployment && (
          <div className="deploying-step">
            <div className="deploy-progress">
              <div className={`progress-step ${deployment.status !== 'idle' ? 'active' : ''}`}>
                <div className="step-dot" />
                <span>Connecting</span>
              </div>
              <div className={`progress-step ${['building', 'deploying', 'success'].includes(deployment.status) ? 'active' : ''}`}>
                <div className="step-dot" />
                <span>Building</span>
              </div>
              <div className={`progress-step ${['deploying', 'success'].includes(deployment.status) ? 'active' : ''}`}>
                <div className="step-dot" />
                <span>Deploying</span>
              </div>
              <div className={`progress-step ${deployment.status === 'success' ? 'active' : ''}`}>
                <div className="step-dot" />
                <span>Live</span>
              </div>
            </div>

            {deployment.status === 'error' && (
              <div className="deploy-error">
                <span>❌</span>
                <p>{deployment.error || 'Deployment failed'}</p>
                <button onClick={() => setStep('config')}>Try Again</button>
              </div>
            )}

            {deployment.buildLogs.length > 0 && (
              <div className="build-logs">
                <button
                  className="logs-toggle"
                  onClick={() => setShowLogs(!showLogs)}
                >
                  {showLogs ? '▼' : '▶'} Build Logs
                </button>
                {showLogs && (
                  <pre className="logs-content">
                    {deployment.buildLogs.join('\n')}
                  </pre>
                )}
              </div>
            )}
          </div>
        )}

        {/* Step 4: Success */}
        {step === 'done' && deployment?.status === 'success' && (
          <div className="success-step">
            <div className="success-icon">🎉</div>
            <h4>Deployed Successfully!</h4>
            {deployment.url && (
              <a
                href={deployment.url}
                target="_blank"
                rel="noopener noreferrer"
                className="deployment-url"
              >
                {deployment.url}
              </a>
            )}
            <div className="success-actions">
              <button onClick={() => setStep('platform')}>
                Deploy Another
              </button>
              <button onClick={() => window.open(deployment.url, '_blank')}>
                Open Site →
              </button>
            </div>
          </div>
        )}

        {/* Recent deployments */}
        {recentDeployments.length > 0 && step === 'platform' && (
          <div className="recent-deployments">
            <h4>Recent Deployments</h4>
            <div className="deployment-list">
              {recentDeployments.slice(0, 5).map((d) => (
                <div key={d.id} className="deployment-item">
                  <div className="deployment-info">
                    <span className={`status-dot ${d.status}`} />
                    <span className="deployment-url">{d.url || 'Building...'}</span>
                    <span className="deployment-time">
                      {d.createdAt.toLocaleDateString()}
                    </span>
                  </div>
                  {onRollback && d.status === 'success' && (
                    <button
                      className="rollback-btn"
                      onClick={() => handleRollback(d.id)}
                    >
                      Rollback
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .deploy-flow {
          background: var(--cl-bg-primary, white);
          border: 1px solid var(--cl-border-primary, #e5e7eb);
          border-radius: 16px;
          overflow: hidden;
        }

        .deploy-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1rem 1.5rem;
          border-bottom: 1px solid var(--cl-border-primary, #e5e7eb);
          background: linear-gradient(135deg, #f9fafb 0%, #f0fdf4 100%);
        }

        .deploy-title {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .deploy-icon {
          font-size: 1.5rem;
        }

        .deploy-title h3 {
          margin: 0;
          font-size: 1.125rem;
          font-weight: 600;
        }

        .back-btn {
          padding: 0.375rem 0.75rem;
          background: transparent;
          border: 1px solid var(--cl-border-primary, #e5e7eb);
          border-radius: 6px;
          font-size: 0.8125rem;
          cursor: pointer;
        }

        .deploy-content {
          padding: 1.5rem;
        }

        .step-description {
          margin: 0 0 1.5rem;
          color: var(--cl-text-tertiary, #6b7280);
          font-size: 0.875rem;
        }

        .platform-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 1rem;
        }

        .platform-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.5rem;
          padding: 1.5rem;
          border: 2px solid var(--cl-border-primary, #e5e7eb);
          border-radius: 12px;
          background: transparent;
          cursor: pointer;
          transition: all 0.2s;
        }

        .platform-card:hover {
          border-color: var(--platform-color);
          transform: translateY(-2px);
        }

        .platform-icon {
          font-size: 2rem;
        }

        .platform-name {
          font-size: 1rem;
          font-weight: 600;
          color: var(--cl-text-primary, #1a1f36);
        }

        .platform-desc {
          font-size: 0.75rem;
          color: var(--cl-text-tertiary, #6b7280);
          text-align: center;
        }

        .selected-platform {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 1rem;
          font-weight: 600;
          margin-bottom: 1.5rem;
        }

        .config-form {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .form-group label {
          display: block;
          font-size: 0.8125rem;
          font-weight: 500;
          margin-bottom: 0.375rem;
        }

        .form-group input {
          width: 100%;
          padding: 0.625rem 0.75rem;
          border: 1px solid var(--cl-border-primary, #e5e7eb);
          border-radius: 8px;
          font-size: 0.875rem;
        }

        .env-vars {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .env-var {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 0.75rem;
          background: var(--cl-bg-secondary, #f9fafb);
          border-radius: 6px;
        }

        .env-key {
          font-family: monospace;
          font-weight: 600;
        }

        .env-value {
          flex: 1;
          font-family: monospace;
          color: var(--cl-text-muted, #9ca3af);
        }

        .env-var button {
          background: none;
          border: none;
          font-size: 1rem;
          cursor: pointer;
          color: var(--cl-text-muted, #9ca3af);
        }

        .add-env {
          display: flex;
          gap: 0.5rem;
        }

        .add-env input:first-child {
          width: 120px;
        }

        .add-env input:nth-child(2) {
          flex: 1;
        }

        .add-env button {
          padding: 0.5rem 0.75rem;
          background: var(--cl-accent-primary, #6366f1);
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
        }

        .deploy-btn {
          width: 100%;
          margin-top: 1.5rem;
          padding: 0.875rem;
          background: #22c55e;
          color: white;
          border: none;
          border-radius: 10px;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
        }

        .deploy-btn:disabled {
          background: #9ca3af;
          cursor: not-allowed;
        }

        .deploy-progress {
          display: flex;
          justify-content: space-between;
          margin-bottom: 2rem;
        }

        .progress-step {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.5rem;
          color: var(--cl-text-muted, #9ca3af);
        }

        .progress-step.active {
          color: var(--cl-accent-primary, #6366f1);
        }

        .step-dot {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: currentColor;
        }

        .deploy-error {
          text-align: center;
          padding: 2rem;
          background: #fef2f2;
          border-radius: 12px;
        }

        .deploy-error span {
          font-size: 2rem;
        }

        .build-logs {
          margin-top: 1rem;
        }

        .logs-toggle {
          background: none;
          border: none;
          font-size: 0.8125rem;
          cursor: pointer;
          color: var(--cl-text-tertiary, #6b7280);
        }

        .logs-content {
          margin-top: 0.5rem;
          padding: 1rem;
          background: #1e1e1e;
          color: #d4d4d4;
          border-radius: 8px;
          font-size: 0.75rem;
          max-height: 200px;
          overflow-y: auto;
        }

        .success-step {
          text-align: center;
          padding: 2rem;
        }

        .success-icon {
          font-size: 4rem;
          margin-bottom: 1rem;
        }

        .success-step h4 {
          margin: 0 0 1rem;
          font-size: 1.25rem;
        }

        .deployment-url {
          display: inline-block;
          padding: 0.75rem 1.5rem;
          background: #f0fdf4;
          color: #166534;
          border-radius: 8px;
          text-decoration: none;
          font-family: monospace;
          margin-bottom: 1.5rem;
        }

        .success-actions {
          display: flex;
          gap: 1rem;
          justify-content: center;
        }

        .success-actions button {
          padding: 0.625rem 1.25rem;
          border-radius: 8px;
          font-size: 0.875rem;
          cursor: pointer;
        }

        .success-actions button:first-child {
          background: transparent;
          border: 1px solid var(--cl-border-primary, #e5e7eb);
        }

        .success-actions button:last-child {
          background: var(--cl-accent-primary, #6366f1);
          color: white;
          border: none;
        }

        .recent-deployments {
          margin-top: 2rem;
          padding-top: 1.5rem;
          border-top: 1px solid var(--cl-border-primary, #e5e7eb);
        }

        .recent-deployments h4 {
          margin: 0 0 1rem;
          font-size: 0.875rem;
          color: var(--cl-text-tertiary, #6b7280);
        }

        .deployment-list {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .deployment-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.75rem;
          background: var(--cl-bg-secondary, #f9fafb);
          border-radius: 8px;
        }

        .deployment-info {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }

        .status-dot.success { background: #22c55e; }
        .status-dot.error { background: #ef4444; }
        .status-dot.building { background: #f59e0b; }

        .rollback-btn {
          padding: 0.25rem 0.5rem;
          background: transparent;
          border: 1px solid #ef4444;
          color: #ef4444;
          border-radius: 4px;
          font-size: 0.6875rem;
          cursor: pointer;
        }
      `}</style>
    </div>
  );
}

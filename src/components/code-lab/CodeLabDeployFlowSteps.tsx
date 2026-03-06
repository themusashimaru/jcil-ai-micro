import React from 'react';

type DeployPlatform = 'vercel' | 'netlify' | 'railway' | 'cloudflare';
type DeployStatus = 'idle' | 'connecting' | 'building' | 'deploying' | 'success' | 'error';

interface Deployment {
  id: string;
  status: DeployStatus;
  url?: string;
  createdAt: Date;
  buildLogs: string[];
  error?: string;
}

export const PLATFORMS: {
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

export function PlatformStep({ onSelect }: { onSelect: (p: DeployPlatform) => void }) {
  return (
    <div className="platform-step">
      <p className="step-description">Choose a deployment platform for your project</p>
      <div className="platform-grid">
        {PLATFORMS.map((p) => (
          <button
            key={p.id}
            className="platform-card"
            onClick={() => onSelect(p.id)}
            style={{ '--platform-color': p.color } as React.CSSProperties}
          >
            <span className="platform-icon">{p.icon}</span>
            <span className="platform-name">{p.name}</span>
            <span className="platform-desc">{p.description}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function ConfigStep({
  platformInfo,
  projectName,
  setProjectName,
  buildCommand,
  setBuildCommand,
  outputDir,
  setOutputDir,
  domain,
  setDomain,
  envVars,
  newEnvKey,
  setNewEnvKey,
  newEnvValue,
  setNewEnvValue,
  addEnvVar,
  removeEnvVar,
  onDeploy,
}: {
  platformInfo: { icon: string; color: string; name: string } | undefined;
  projectName: string;
  setProjectName: (v: string) => void;
  buildCommand: string;
  setBuildCommand: (v: string) => void;
  outputDir: string;
  setOutputDir: (v: string) => void;
  domain: string;
  setDomain: (v: string) => void;
  envVars: Record<string, string>;
  newEnvKey: string;
  setNewEnvKey: (v: string) => void;
  newEnvValue: string;
  setNewEnvValue: (v: string) => void;
  addEnvVar: () => void;
  removeEnvVar: (key: string) => void;
  onDeploy: () => void;
}) {
  return (
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
                <button
                  onClick={() => removeEnvVar(key)}
                  aria-label={`Remove environment variable ${key}`}
                >
                  ×
                </button>
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
              <button onClick={addEnvVar} aria-label="Add environment variable">
                +
              </button>
            </div>
          </div>
        </div>
      </div>

      <button className="deploy-btn" onClick={onDeploy} disabled={!projectName.trim()}>
        🚀 Deploy to {platformInfo?.name}
      </button>
    </div>
  );
}

export function DeployingStep({
  deployment,
  showLogs,
  setShowLogs,
  onRetry,
}: {
  deployment: Deployment;
  showLogs: boolean;
  setShowLogs: (v: boolean) => void;
  onRetry: () => void;
}) {
  return (
    <div className="deploying-step">
      <div className="deploy-progress">
        <div className={`progress-step ${deployment.status !== 'idle' ? 'active' : ''}`}>
          <div className="step-dot" />
          <span>Connecting</span>
        </div>
        <div
          className={`progress-step ${['building', 'deploying', 'success'].includes(deployment.status) ? 'active' : ''}`}
        >
          <div className="step-dot" />
          <span>Building</span>
        </div>
        <div
          className={`progress-step ${['deploying', 'success'].includes(deployment.status) ? 'active' : ''}`}
        >
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
          <button onClick={onRetry}>Try Again</button>
        </div>
      )}

      {deployment.buildLogs.length > 0 && (
        <div className="build-logs">
          <button
            className="logs-toggle"
            onClick={() => setShowLogs(!showLogs)}
            aria-expanded={showLogs}
          >
            {showLogs ? '▼' : '▶'} Build Logs
          </button>
          {showLogs && <pre className="logs-content">{deployment.buildLogs.join('\n')}</pre>}
        </div>
      )}
    </div>
  );
}

export function SuccessStep({
  deployment,
  onDeployAnother,
}: {
  deployment: Deployment;
  onDeployAnother: () => void;
}) {
  return (
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
        <button onClick={onDeployAnother}>Deploy Another</button>
        <button onClick={() => window.open(deployment.url, '_blank')}>Open Site →</button>
      </div>
    </div>
  );
}

export function RecentDeploymentsList({
  deployments,
  onRollback,
}: {
  deployments: Deployment[];
  onRollback?: (id: string) => void;
}) {
  return (
    <div className="recent-deployments">
      <h4>Recent Deployments</h4>
      <div className="deployment-list">
        {deployments.slice(0, 5).map((d) => (
          <div key={d.id} className="deployment-item">
            <div className="deployment-info">
              <span className={`status-dot ${d.status}`} />
              <span className="deployment-url">{d.url || 'Building...'}</span>
              <span className="deployment-time">{d.createdAt.toLocaleDateString()}</span>
            </div>
            {onRollback && d.status === 'success' && (
              <button className="rollback-btn" onClick={() => onRollback(d.id)}>
                Rollback
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

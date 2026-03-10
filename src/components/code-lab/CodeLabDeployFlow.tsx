'use client';

/**
 * CODE LAB DEPLOY FLOW
 *
 * One-click deployment to Vercel, Netlify, Railway, and more.
 *
 * Features:
 * - Platform selection (Vercel, Netlify, Cloudflare)
 * - Environment variables configuration
 * - Build settings
 * - Domain configuration
 * - Deployment progress
 * - Rollback support
 */

import { useState } from 'react';
import {
  PLATFORMS,
  PlatformStep,
  ConfigStep,
  DeployingStep,
  SuccessStep,
  RecentDeploymentsList,
} from './CodeLabDeployFlowSteps';
import './code-lab-deploy-flow.css';

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
      setEnvVars((prev) => ({ ...prev, [newEnvKey.trim()]: newEnvValue }));
      setNewEnvKey('');
      setNewEnvValue('');
    }
  };

  const removeEnvVar = (key: string) => {
    setEnvVars((prev) => {
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

  const platformInfo = PLATFORMS.find((p) => p.id === platform);

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
        {step === 'platform' && <PlatformStep onSelect={handlePlatformSelect} />}

        {step === 'config' && (
          <ConfigStep
            platformInfo={platformInfo}
            projectName={projectName}
            setProjectName={setProjectName}
            buildCommand={buildCommand}
            setBuildCommand={setBuildCommand}
            outputDir={outputDir}
            setOutputDir={setOutputDir}
            domain={domain}
            setDomain={setDomain}
            envVars={envVars}
            newEnvKey={newEnvKey}
            setNewEnvKey={setNewEnvKey}
            newEnvValue={newEnvValue}
            setNewEnvValue={setNewEnvValue}
            addEnvVar={addEnvVar}
            removeEnvVar={removeEnvVar}
            onDeploy={handleDeploy}
          />
        )}

        {step === 'deploy' && deployment && (
          <DeployingStep
            deployment={deployment}
            showLogs={showLogs}
            setShowLogs={setShowLogs}
            onRetry={() => setStep('config')}
          />
        )}

        {step === 'done' && deployment?.status === 'success' && (
          <SuccessStep deployment={deployment} onDeployAnother={() => setStep('platform')} />
        )}

        {recentDeployments.length > 0 && step === 'platform' && (
          <RecentDeploymentsList
            deployments={recentDeployments}
            onRollback={onRollback ? handleRollback : undefined}
          />
        )}
      </div>
    </div>
  );
}

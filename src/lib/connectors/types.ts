/**
 * CONNECTORS SYSTEM - Types
 * =========================
 *
 * Extensible connector architecture for external services.
 * Start with GitHub, expand to Vercel, Supabase, etc.
 */

export type ConnectorType = 'github' | 'vercel' | 'supabase';

export type ConnectorStatus = 'disconnected' | 'connected' | 'expired' | 'error';

export interface Connector {
  type: ConnectorType;
  status: ConnectorStatus;
  displayName: string;
  icon: string;           // Emoji or icon name
  description: string;
  connectedAt?: string;
  expiresAt?: string;
  metadata?: Record<string, unknown>;
}

export interface GitHubConnector extends Connector {
  type: 'github';
  metadata?: {
    username?: string;
    email?: string;
    avatarUrl?: string;
    scopes?: string[];
  };
}

export interface VercelConnector extends Connector {
  type: 'vercel';
  metadata?: {
    teamId?: string;
    teamName?: string;
  };
}

export interface ConnectorConfig {
  type: ConnectorType;
  displayName: string;
  icon: string;
  description: string;
  oauthUrl?: string;
  requiredScopes?: string[];
}

// Available connectors configuration
export const CONNECTOR_CONFIGS: Record<ConnectorType, ConnectorConfig> = {
  github: {
    type: 'github',
    displayName: 'GitHub',
    icon: '🐙',
    description: 'Push code to repositories, create PRs',
    requiredScopes: ['repo', 'user:email'],
  },
  vercel: {
    type: 'vercel',
    displayName: 'Vercel Sandbox',
    icon: '▲',
    description: 'Execute & test code in isolated VMs',
  },
  supabase: {
    type: 'supabase',
    displayName: 'Supabase',
    icon: '⚡',
    description: 'Manage databases and storage (coming soon)',
  },
};

// GitHub-specific types for API operations
export interface GitHubRepo {
  name: string;
  fullName: string;
  description: string | null;
  private: boolean;
  defaultBranch: string;
  htmlUrl: string;
  owner: string;
}

export interface GitHubCreateRepoOptions {
  name: string;
  description?: string;
  private?: boolean;
  autoInit?: boolean;
}

export interface GitHubPushOptions {
  owner: string;
  repo: string;
  branch?: string;
  message: string;
  files: { path: string; content: string }[];
}

export interface GitHubPushResult {
  success: boolean;
  commitSha?: string;
  repoUrl?: string;
  error?: string;
}

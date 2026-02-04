/**
 * CONNECTORS SYSTEM - Types
 * =========================
 *
 * Extensible connector architecture for external services.
 * Start with GitHub, expand to Vercel, Supabase, etc.
 */

export type ConnectorType = 'github' | 'vercel' | 'supabase' | 'resend' | 'spotify' | 'uber';

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

export interface SpotifyConnector extends Connector {
  type: 'spotify';
  metadata?: {
    userId?: string;
    displayName?: string;
    email?: string;
    imageUrl?: string;
    product?: string; // 'premium' | 'free' | 'open'
  };
}

export interface UberConnector extends Connector {
  type: 'uber';
  metadata?: {
    userId?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
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
  resend: {
    type: 'resend',
    displayName: 'Resend',
    icon: '📧',
    description: 'Send transactional emails (magic links, password reset)',
  },
  spotify: {
    type: 'spotify',
    displayName: 'Spotify',
    icon: '🎵',
    description: 'Control music, create playlists, get recommendations',
    requiredScopes: [
      'user-read-private',
      'user-read-email',
      'playlist-read-private',
      'playlist-modify-public',
      'playlist-modify-private',
      'user-read-playback-state',
      'user-modify-playback-state',
      'user-read-recently-played',
      'user-top-read',
    ],
  },
  uber: {
    type: 'uber',
    displayName: 'Uber',
    icon: '🚗',
    description: 'Get ride estimates and request rides',
    requiredScopes: ['profile', 'request', 'request_receipt'],
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

// ============================================================================
// GitHub Read Operations - Types
// ============================================================================

export interface GitHubFileContent {
  name: string;
  path: string;
  sha: string;
  size: number;
  type: 'file' | 'dir' | 'symlink' | 'submodule';
  content?: string;        // Base64 decoded content (for files)
  encoding?: string;
  htmlUrl: string;
  downloadUrl?: string;
}

export interface GitHubTreeItem {
  path: string;
  mode: string;
  type: 'blob' | 'tree';
  sha: string;
  size?: number;
  url: string;
}

export interface GitHubRepoTree {
  sha: string;
  tree: GitHubTreeItem[];
  truncated: boolean;
}

export interface GitHubBranch {
  name: string;
  sha: string;
  protected: boolean;
}

export interface GitHubCommit {
  sha: string;
  message: string;
  author: {
    name: string;
    email: string;
    date: string;
  };
  htmlUrl: string;
}

// ============================================================================
// GitHub PR Operations - Types
// ============================================================================

export interface GitHubPROptions {
  owner: string;
  repo: string;
  title: string;
  body: string;
  head: string;          // Branch with changes
  base: string;          // Target branch (usually main)
  draft?: boolean;
}

export interface GitHubPRResult {
  success: boolean;
  prNumber?: number;
  prUrl?: string;
  error?: string;
}

export interface GitHubCompareResult {
  ahead: number;
  behind: number;
  status: 'ahead' | 'behind' | 'identical' | 'diverged';
  files: {
    filename: string;
    status: 'added' | 'removed' | 'modified' | 'renamed';
    additions: number;
    deletions: number;
    patch?: string;
  }[];
  commits: GitHubCommit[];
}

// ============================================================================
// GitHub Clone/Fetch Operations - Types
// ============================================================================

export interface GitHubCloneOptions {
  owner: string;
  repo: string;
  branch?: string;
  path?: string;          // Specific path to fetch (for partial clone)
  depth?: number;         // How deep to recurse directories
  maxFiles?: number;      // Limit number of files
  maxFileSize?: number;   // Skip files larger than this (bytes)
  includePatterns?: string[];  // Only include matching paths
  excludePatterns?: string[];  // Exclude matching paths
}

export interface GitHubCloneResult {
  success: boolean;
  files: {
    path: string;
    content: string;
    size: number;
    language?: string;
  }[];
  tree: GitHubTreeItem[];
  truncated: boolean;
  totalFiles: number;
  fetchedFiles: number;
  error?: string;
}

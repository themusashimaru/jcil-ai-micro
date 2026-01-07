/**
 * GITHUB SYNC BRIDGE
 *
 * Real-time synchronization between Code Lab workspace and GitHub.
 * Bridges sandboxed code execution with production repositories.
 *
 * Features:
 * - Clone repos into workspace
 * - Push changes back to GitHub
 * - Pull latest changes
 * - Branch management
 * - Conflict detection and resolution
 * - Real-time file watching
 */

import { Octokit } from '@octokit/rest';

export interface GitHubRepo {
  owner: string;
  name: string;
  fullName: string;
  defaultBranch: string;
  private: boolean;
  cloneUrl: string;
  sshUrl: string;
}

export interface SyncStatus {
  status: 'synced' | 'ahead' | 'behind' | 'diverged' | 'unsynced' | 'error';
  localCommits: number;
  remoteCommits: number;
  lastSyncTime: Date | null;
  conflicts: string[];
  error?: string;
}

export interface FileChange {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  additions: number;
  deletions: number;
  oldPath?: string;
}

export interface SyncResult {
  success: boolean;
  filesChanged: FileChange[];
  commitSha?: string;
  error?: string;
}

export class GitHubSyncBridge {
  private octokit: Octokit;
  private _workspaceId: string;
  private repo: GitHubRepo | null = null;
  private currentBranch: string = 'main';
  private lastSyncSha: string | null = null;

  constructor(accessToken: string, workspaceId: string) {
    this.octokit = new Octokit({ auth: accessToken });
    this._workspaceId = workspaceId;
  }

  /**
   * Connect to a GitHub repository
   */
  async connect(owner: string, repo: string): Promise<GitHubRepo> {
    try {
      const { data } = await this.octokit.repos.get({ owner, repo });

      this.repo = {
        owner: data.owner.login,
        name: data.name,
        fullName: data.full_name,
        defaultBranch: data.default_branch,
        private: data.private,
        cloneUrl: data.clone_url,
        sshUrl: data.ssh_url,
      };

      this.currentBranch = data.default_branch;
      return this.repo;
    } catch (error) {
      throw new Error(`Failed to connect to repository: ${error}`);
    }
  }

  /**
   * Clone repository into workspace
   */
  async cloneToWorkspace(
    executeShell: (cmd: string) => Promise<{ stdout: string; stderr: string; exitCode: number }>
  ): Promise<SyncResult> {
    if (!this.repo) {
      throw new Error('No repository connected. Call connect() first.');
    }

    try {
      // Clone the repository
      const cloneResult = await executeShell(
        `git clone --depth 50 ${this.repo.cloneUrl} /workspace/repo`
      );

      if (cloneResult.exitCode !== 0) {
        return {
          success: false,
          filesChanged: [],
          error: cloneResult.stderr,
        };
      }

      // Get the HEAD commit
      const headResult = await executeShell('cd /workspace/repo && git rev-parse HEAD');
      this.lastSyncSha = headResult.stdout.trim();

      // Get list of files
      const filesResult = await executeShell('cd /workspace/repo && git ls-files');
      const files = filesResult.stdout.trim().split('\n').filter(Boolean);

      return {
        success: true,
        filesChanged: files.map(path => ({
          path,
          status: 'added' as const,
          additions: 0,
          deletions: 0,
        })),
        commitSha: this.lastSyncSha,
      };
    } catch (error) {
      return {
        success: false,
        filesChanged: [],
        error: String(error),
      };
    }
  }

  /**
   * Get current sync status
   */
  async getSyncStatus(
    executeShell: (cmd: string) => Promise<{ stdout: string; stderr: string; exitCode: number }>
  ): Promise<SyncStatus> {
    if (!this.repo) {
      return {
        status: 'unsynced',
        localCommits: 0,
        remoteCommits: 0,
        lastSyncTime: null,
        conflicts: [],
      };
    }

    try {
      // Fetch from remote without merging
      await executeShell('cd /workspace/repo && git fetch origin');

      // Count commits ahead/behind
      const aheadResult = await executeShell(
        `cd /workspace/repo && git rev-list --count origin/${this.currentBranch}..HEAD`
      );
      const behindResult = await executeShell(
        `cd /workspace/repo && git rev-list --count HEAD..origin/${this.currentBranch}`
      );

      const localCommits = parseInt(aheadResult.stdout.trim()) || 0;
      const remoteCommits = parseInt(behindResult.stdout.trim()) || 0;

      let status: SyncStatus['status'];
      if (localCommits === 0 && remoteCommits === 0) {
        status = 'synced';
      } else if (localCommits > 0 && remoteCommits === 0) {
        status = 'ahead';
      } else if (localCommits === 0 && remoteCommits > 0) {
        status = 'behind';
      } else {
        status = 'diverged';
      }

      return {
        status,
        localCommits,
        remoteCommits,
        lastSyncTime: new Date(),
        conflicts: [],
      };
    } catch (error) {
      return {
        status: 'error',
        localCommits: 0,
        remoteCommits: 0,
        lastSyncTime: null,
        conflicts: [],
        error: String(error),
      };
    }
  }

  /**
   * Push local changes to GitHub
   */
  async pushChanges(
    executeShell: (cmd: string) => Promise<{ stdout: string; stderr: string; exitCode: number }>,
    commitMessage?: string
  ): Promise<SyncResult> {
    if (!this.repo) {
      throw new Error('No repository connected');
    }

    try {
      // Stage all changes
      await executeShell('cd /workspace/repo && git add -A');

      // Check if there are changes to commit
      const statusResult = await executeShell('cd /workspace/repo && git status --porcelain');
      if (!statusResult.stdout.trim()) {
        return {
          success: true,
          filesChanged: [],
          commitSha: this.lastSyncSha || undefined,
        };
      }

      // Parse changed files
      const changedFiles = this.parseGitStatus(statusResult.stdout);

      // Commit changes
      const message = commitMessage || `Code Lab: Auto-sync at ${new Date().toISOString()}`;
      const commitResult = await executeShell(
        `cd /workspace/repo && git commit -m "${message.replace(/"/g, '\\"')}"`
      );

      if (commitResult.exitCode !== 0 && !commitResult.stdout.includes('nothing to commit')) {
        return {
          success: false,
          filesChanged: changedFiles,
          error: commitResult.stderr,
        };
      }

      // Push to remote
      const pushResult = await executeShell(
        `cd /workspace/repo && git push origin ${this.currentBranch}`
      );

      if (pushResult.exitCode !== 0) {
        return {
          success: false,
          filesChanged: changedFiles,
          error: pushResult.stderr,
        };
      }

      // Get new HEAD
      const headResult = await executeShell('cd /workspace/repo && git rev-parse HEAD');
      this.lastSyncSha = headResult.stdout.trim();

      return {
        success: true,
        filesChanged: changedFiles,
        commitSha: this.lastSyncSha,
      };
    } catch (error) {
      return {
        success: false,
        filesChanged: [],
        error: String(error),
      };
    }
  }

  /**
   * Pull latest changes from GitHub
   */
  async pullChanges(
    executeShell: (cmd: string) => Promise<{ stdout: string; stderr: string; exitCode: number }>
  ): Promise<SyncResult> {
    if (!this.repo) {
      throw new Error('No repository connected');
    }

    try {
      // Stash any local changes
      await executeShell('cd /workspace/repo && git stash');

      // Pull from remote
      const pullResult = await executeShell(
        `cd /workspace/repo && git pull origin ${this.currentBranch}`
      );

      if (pullResult.exitCode !== 0) {
        // Try to restore stashed changes
        await executeShell('cd /workspace/repo && git stash pop');
        return {
          success: false,
          filesChanged: [],
          error: pullResult.stderr,
        };
      }

      // Pop stashed changes
      const stashResult = await executeShell('cd /workspace/repo && git stash pop');

      // Check for conflicts
      if (stashResult.stderr.includes('CONFLICT')) {
        const conflictResult = await executeShell(
          'cd /workspace/repo && git diff --name-only --diff-filter=U'
        );
        const conflicts = conflictResult.stdout.trim().split('\n').filter(Boolean);

        return {
          success: false,
          filesChanged: [],
          error: `Merge conflicts in: ${conflicts.join(', ')}`,
        };
      }

      // Get new HEAD
      const headResult = await executeShell('cd /workspace/repo && git rev-parse HEAD');
      this.lastSyncSha = headResult.stdout.trim();

      // Get changed files from pull
      const diffResult = await executeShell(
        `cd /workspace/repo && git diff --name-status ${this.lastSyncSha}~1..${this.lastSyncSha}`
      );
      const changedFiles = this.parseDiffNameStatus(diffResult.stdout);

      return {
        success: true,
        filesChanged: changedFiles,
        commitSha: this.lastSyncSha,
      };
    } catch (error) {
      return {
        success: false,
        filesChanged: [],
        error: String(error),
      };
    }
  }

  /**
   * Create a new branch
   */
  async createBranch(
    branchName: string,
    executeShell: (cmd: string) => Promise<{ stdout: string; stderr: string; exitCode: number }>
  ): Promise<boolean> {
    try {
      const result = await executeShell(
        `cd /workspace/repo && git checkout -b ${branchName}`
      );
      if (result.exitCode === 0) {
        this.currentBranch = branchName;
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Switch to a branch
   */
  async switchBranch(
    branchName: string,
    executeShell: (cmd: string) => Promise<{ stdout: string; stderr: string; exitCode: number }>
  ): Promise<boolean> {
    try {
      const result = await executeShell(
        `cd /workspace/repo && git checkout ${branchName}`
      );
      if (result.exitCode === 0) {
        this.currentBranch = branchName;
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Get list of branches
   */
  async getBranches(
    executeShell: (cmd: string) => Promise<{ stdout: string; stderr: string; exitCode: number }>
  ): Promise<{ name: string; current: boolean }[]> {
    try {
      const result = await executeShell('cd /workspace/repo && git branch -a');
      const lines = result.stdout.trim().split('\n');

      return lines.map(line => {
        const current = line.startsWith('*');
        const name = line.replace(/^\*?\s+/, '').replace(/^remotes\/origin\//, '').trim();
        return { name, current };
      }).filter(b => !b.name.includes('HEAD'));
    } catch {
      return [];
    }
  }

  /**
   * Create a pull request
   */
  async createPullRequest(
    title: string,
    body: string,
    baseBranch?: string
  ): Promise<{ url: string; number: number } | null> {
    if (!this.repo) {
      throw new Error('No repository connected');
    }

    try {
      const { data } = await this.octokit.pulls.create({
        owner: this.repo.owner,
        repo: this.repo.name,
        title,
        body,
        head: this.currentBranch,
        base: baseBranch || this.repo.defaultBranch,
      });

      return {
        url: data.html_url,
        number: data.number,
      };
    } catch (error) {
      console.error('Failed to create PR:', error);
      return null;
    }
  }

  /**
   * Get file content from GitHub (for comparison)
   */
  async getRemoteFileContent(path: string): Promise<string | null> {
    if (!this.repo) return null;

    try {
      const { data } = await this.octokit.repos.getContent({
        owner: this.repo.owner,
        repo: this.repo.name,
        path,
        ref: this.currentBranch,
      });

      if ('content' in data) {
        return Buffer.from(data.content, 'base64').toString('utf-8');
      }
      return null;
    } catch {
      return null;
    }
  }

  // Helper: Parse git status --porcelain output
  private parseGitStatus(output: string): FileChange[] {
    const lines = output.trim().split('\n').filter(Boolean);
    return lines.map(line => {
      const status = line.substring(0, 2).trim();
      const path = line.substring(3);

      let fileStatus: FileChange['status'] = 'modified';
      if (status === 'A' || status === '??') fileStatus = 'added';
      else if (status === 'D') fileStatus = 'deleted';
      else if (status.startsWith('R')) fileStatus = 'renamed';

      return {
        path,
        status: fileStatus,
        additions: 0,
        deletions: 0,
      };
    });
  }

  // Helper: Parse git diff --name-status output
  private parseDiffNameStatus(output: string): FileChange[] {
    const lines = output.trim().split('\n').filter(Boolean);
    return lines.map(line => {
      const [status, ...pathParts] = line.split('\t');
      const path = pathParts.join('\t');

      let fileStatus: FileChange['status'] = 'modified';
      if (status === 'A') fileStatus = 'added';
      else if (status === 'D') fileStatus = 'deleted';
      else if (status.startsWith('R')) fileStatus = 'renamed';

      return {
        path,
        status: fileStatus,
        additions: 0,
        deletions: 0,
      };
    });
  }

  // Getters
  get connectedRepo(): GitHubRepo | null {
    return this.repo;
  }

  get branch(): string {
    return this.currentBranch;
  }

  get workspaceId(): string {
    return this._workspaceId;
  }
}

/**
 * Sync status indicator component data
 */
export function getSyncStatusDisplay(status: SyncStatus): {
  icon: string;
  label: string;
  color: string;
  action?: string;
} {
  switch (status.status) {
    case 'synced':
      return { icon: '✓', label: 'Synced', color: '#22c55e' };
    case 'ahead':
      return {
        icon: '↑',
        label: `${status.localCommits} to push`,
        color: '#3b82f6',
        action: 'Push',
      };
    case 'behind':
      return {
        icon: '↓',
        label: `${status.remoteCommits} to pull`,
        color: '#f59e0b',
        action: 'Pull',
      };
    case 'diverged':
      return {
        icon: '⇅',
        label: 'Diverged',
        color: '#ef4444',
        action: 'Resolve',
      };
    case 'error':
      return { icon: '!', label: 'Error', color: '#ef4444' };
    default:
      return { icon: '○', label: 'Not synced', color: '#6b7280' };
  }
}

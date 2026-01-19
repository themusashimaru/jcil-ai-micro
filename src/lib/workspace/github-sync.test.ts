/**
 * GITHUB SYNC BRIDGE TESTS
 *
 * Tests for GitHub synchronization between Code Lab and repositories.
 * Tests clone, push, pull, branch management, and PR creation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GitHubSyncBridge, getSyncStatusDisplay } from './github-sync';

// Mock Octokit
vi.mock('@octokit/rest', () => ({
  Octokit: vi.fn().mockImplementation(() => ({
    repos: {
      get: vi.fn().mockResolvedValue({
        data: {
          owner: { login: 'testuser' },
          name: 'testrepo',
          full_name: 'testuser/testrepo',
          default_branch: 'main',
          private: false,
          clone_url: 'https://github.com/testuser/testrepo.git',
          ssh_url: 'git@github.com:testuser/testrepo.git',
        },
      }),
      getContent: vi.fn().mockResolvedValue({
        data: {
          content: Buffer.from('file content').toString('base64'),
        },
      }),
    },
    pulls: {
      create: vi.fn().mockResolvedValue({
        data: {
          html_url: 'https://github.com/testuser/testrepo/pull/1',
          number: 1,
        },
      }),
    },
  })),
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}));

describe('GitHubSyncBridge', () => {
  let syncBridge: GitHubSyncBridge;
  let mockExecuteShell: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    syncBridge = new GitHubSyncBridge('test-token', 'workspace-123');
    mockExecuteShell = vi.fn();
  });

  describe('Constructor', () => {
    it('should initialize with access token and workspace ID', () => {
      expect(syncBridge.workspaceId).toBe('workspace-123');
    });

    it('should have null repo before connection', () => {
      expect(syncBridge.connectedRepo).toBeNull();
    });

    it('should default to main branch', () => {
      expect(syncBridge.branch).toBe('main');
    });
  });

  describe('connect', () => {
    it('should connect to a repository', async () => {
      const repo = await syncBridge.connect('testuser', 'testrepo');

      expect(repo.owner).toBe('testuser');
      expect(repo.name).toBe('testrepo');
      expect(repo.fullName).toBe('testuser/testrepo');
      expect(repo.defaultBranch).toBe('main');
    });

    it('should set current branch to default branch', async () => {
      await syncBridge.connect('testuser', 'testrepo');

      expect(syncBridge.branch).toBe('main');
    });

    it('should set connected repo', async () => {
      await syncBridge.connect('testuser', 'testrepo');

      expect(syncBridge.connectedRepo).not.toBeNull();
      expect(syncBridge.connectedRepo?.owner).toBe('testuser');
    });
  });

  describe('cloneToWorkspace', () => {
    it('should throw error if no repo connected', async () => {
      await expect(syncBridge.cloneToWorkspace(mockExecuteShell)).rejects.toThrow(
        'No repository connected'
      );
    });

    it('should clone successfully', async () => {
      await syncBridge.connect('testuser', 'testrepo');

      mockExecuteShell
        .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 }) // git clone
        .mockResolvedValueOnce({ stdout: 'abc123', stderr: '', exitCode: 0 }) // git rev-parse
        .mockResolvedValueOnce({ stdout: 'file1.ts\nfile2.ts', stderr: '', exitCode: 0 }); // git ls-files

      const result = await syncBridge.cloneToWorkspace(mockExecuteShell);

      expect(result.success).toBe(true);
      expect(result.filesChanged).toHaveLength(2);
      expect(result.commitSha).toBe('abc123');
    });

    it('should handle clone failure', async () => {
      await syncBridge.connect('testuser', 'testrepo');

      mockExecuteShell.mockResolvedValueOnce({
        stdout: '',
        stderr: 'Repository not found',
        exitCode: 128,
      });

      const result = await syncBridge.cloneToWorkspace(mockExecuteShell);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Repository not found');
    });
  });

  describe('getSyncStatus', () => {
    it('should return unsynced if no repo connected', async () => {
      const status = await syncBridge.getSyncStatus(mockExecuteShell);

      expect(status.status).toBe('unsynced');
      expect(status.localCommits).toBe(0);
      expect(status.remoteCommits).toBe(0);
    });

    it('should return synced when even with remote', async () => {
      await syncBridge.connect('testuser', 'testrepo');

      mockExecuteShell
        .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 }) // git fetch
        .mockResolvedValueOnce({ stdout: '0', stderr: '', exitCode: 0 }) // ahead
        .mockResolvedValueOnce({ stdout: '0', stderr: '', exitCode: 0 }); // behind

      const status = await syncBridge.getSyncStatus(mockExecuteShell);

      expect(status.status).toBe('synced');
      expect(status.localCommits).toBe(0);
      expect(status.remoteCommits).toBe(0);
    });

    it('should return ahead when local has commits to push', async () => {
      await syncBridge.connect('testuser', 'testrepo');

      mockExecuteShell
        .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 }) // git fetch
        .mockResolvedValueOnce({ stdout: '3', stderr: '', exitCode: 0 }) // ahead
        .mockResolvedValueOnce({ stdout: '0', stderr: '', exitCode: 0 }); // behind

      const status = await syncBridge.getSyncStatus(mockExecuteShell);

      expect(status.status).toBe('ahead');
      expect(status.localCommits).toBe(3);
    });

    it('should return behind when remote has new commits', async () => {
      await syncBridge.connect('testuser', 'testrepo');

      mockExecuteShell
        .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 }) // git fetch
        .mockResolvedValueOnce({ stdout: '0', stderr: '', exitCode: 0 }) // ahead
        .mockResolvedValueOnce({ stdout: '5', stderr: '', exitCode: 0 }); // behind

      const status = await syncBridge.getSyncStatus(mockExecuteShell);

      expect(status.status).toBe('behind');
      expect(status.remoteCommits).toBe(5);
    });

    it('should return diverged when both have commits', async () => {
      await syncBridge.connect('testuser', 'testrepo');

      mockExecuteShell
        .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 }) // git fetch
        .mockResolvedValueOnce({ stdout: '2', stderr: '', exitCode: 0 }) // ahead
        .mockResolvedValueOnce({ stdout: '3', stderr: '', exitCode: 0 }); // behind

      const status = await syncBridge.getSyncStatus(mockExecuteShell);

      expect(status.status).toBe('diverged');
    });
  });

  describe('pushChanges', () => {
    it('should throw error if no repo connected', async () => {
      await expect(syncBridge.pushChanges(mockExecuteShell)).rejects.toThrow(
        'No repository connected'
      );
    });

    it('should return success with no changes to push', async () => {
      await syncBridge.connect('testuser', 'testrepo');

      mockExecuteShell
        .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 }) // git add
        .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 }); // git status --porcelain (empty)

      const result = await syncBridge.pushChanges(mockExecuteShell);

      expect(result.success).toBe(true);
      expect(result.filesChanged).toHaveLength(0);
    });

    it('should push changes successfully', async () => {
      await syncBridge.connect('testuser', 'testrepo');

      mockExecuteShell
        .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 }) // git add
        .mockResolvedValueOnce({ stdout: 'M  file1.ts', stderr: '', exitCode: 0 }) // git status
        .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 }) // git commit
        .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 }) // git push
        .mockResolvedValueOnce({ stdout: 'def456', stderr: '', exitCode: 0 }); // git rev-parse

      const result = await syncBridge.pushChanges(mockExecuteShell, 'Test commit');

      expect(result.success).toBe(true);
      expect(result.commitSha).toBe('def456');
    });
  });

  describe('pullChanges', () => {
    it('should throw error if no repo connected', async () => {
      await expect(syncBridge.pullChanges(mockExecuteShell)).rejects.toThrow(
        'No repository connected'
      );
    });

    it('should pull changes successfully', async () => {
      await syncBridge.connect('testuser', 'testrepo');

      mockExecuteShell
        .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 }) // git stash
        .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 }) // git pull
        .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 }) // git stash pop
        .mockResolvedValueOnce({ stdout: 'ghi789', stderr: '', exitCode: 0 }) // git rev-parse
        .mockResolvedValueOnce({ stdout: 'M\tfile1.ts', stderr: '', exitCode: 0 }); // git diff

      const result = await syncBridge.pullChanges(mockExecuteShell);

      expect(result.success).toBe(true);
    });

    it('should detect merge conflicts', async () => {
      await syncBridge.connect('testuser', 'testrepo');

      mockExecuteShell
        .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 }) // git stash
        .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 }) // git pull
        .mockResolvedValueOnce({ stdout: '', stderr: 'CONFLICT (content)', exitCode: 1 }) // git stash pop
        .mockResolvedValueOnce({ stdout: 'conflicted.ts', stderr: '', exitCode: 0 }); // git diff

      const result = await syncBridge.pullChanges(mockExecuteShell);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Merge conflicts');
    });
  });

  describe('createBranch', () => {
    it('should create new branch', async () => {
      await syncBridge.connect('testuser', 'testrepo');

      mockExecuteShell.mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 });

      const result = await syncBridge.createBranch('feature/new-feature', mockExecuteShell);

      expect(result).toBe(true);
      expect(syncBridge.branch).toBe('feature/new-feature');
    });

    it('should handle branch creation failure', async () => {
      await syncBridge.connect('testuser', 'testrepo');

      mockExecuteShell.mockResolvedValueOnce({
        stdout: '',
        stderr: 'Branch already exists',
        exitCode: 128,
      });

      const result = await syncBridge.createBranch('existing-branch', mockExecuteShell);

      expect(result).toBe(false);
    });
  });

  describe('switchBranch', () => {
    it('should switch to existing branch', async () => {
      await syncBridge.connect('testuser', 'testrepo');

      mockExecuteShell.mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 });

      const result = await syncBridge.switchBranch('develop', mockExecuteShell);

      expect(result).toBe(true);
      expect(syncBridge.branch).toBe('develop');
    });
  });

  describe('getBranches', () => {
    it('should return list of branches', async () => {
      await syncBridge.connect('testuser', 'testrepo');

      mockExecuteShell.mockResolvedValueOnce({
        stdout: '* main\n  develop\n  feature/test',
        stderr: '',
        exitCode: 0,
      });

      const branches = await syncBridge.getBranches(mockExecuteShell);

      expect(branches).toHaveLength(3);
      expect(branches[0].current).toBe(true);
      expect(branches[0].name).toBe('main');
    });
  });

  describe('createPullRequest', () => {
    it('should create PR successfully', async () => {
      await syncBridge.connect('testuser', 'testrepo');

      const result = await syncBridge.createPullRequest('Test PR', 'PR description');

      expect(result).not.toBeNull();
      expect(result?.url).toBe('https://github.com/testuser/testrepo/pull/1');
      expect(result?.number).toBe(1);
    });

    it('should throw error if no repo connected', async () => {
      await expect(syncBridge.createPullRequest('Test', 'Body')).rejects.toThrow(
        'No repository connected'
      );
    });
  });

  describe('getRemoteFileContent', () => {
    it('should return null if no repo connected', async () => {
      const content = await syncBridge.getRemoteFileContent('file.ts');

      expect(content).toBeNull();
    });

    it('should return decoded file content', async () => {
      await syncBridge.connect('testuser', 'testrepo');

      const content = await syncBridge.getRemoteFileContent('file.ts');

      expect(content).toBe('file content');
    });
  });
});

describe('getSyncStatusDisplay', () => {
  it('should display synced status', () => {
    const display = getSyncStatusDisplay({
      status: 'synced',
      localCommits: 0,
      remoteCommits: 0,
      lastSyncTime: new Date(),
      conflicts: [],
    });

    expect(display.icon).toBe('✓');
    expect(display.label).toBe('Synced');
    expect(display.color).toBe('#22c55e');
  });

  it('should display ahead status', () => {
    const display = getSyncStatusDisplay({
      status: 'ahead',
      localCommits: 3,
      remoteCommits: 0,
      lastSyncTime: new Date(),
      conflicts: [],
    });

    expect(display.icon).toBe('↑');
    expect(display.label).toBe('3 to push');
    expect(display.action).toBe('Push');
  });

  it('should display behind status', () => {
    const display = getSyncStatusDisplay({
      status: 'behind',
      localCommits: 0,
      remoteCommits: 5,
      lastSyncTime: new Date(),
      conflicts: [],
    });

    expect(display.icon).toBe('↓');
    expect(display.label).toBe('5 to pull');
    expect(display.action).toBe('Pull');
  });

  it('should display diverged status', () => {
    const display = getSyncStatusDisplay({
      status: 'diverged',
      localCommits: 2,
      remoteCommits: 3,
      lastSyncTime: new Date(),
      conflicts: [],
    });

    expect(display.icon).toBe('⇅');
    expect(display.label).toBe('Diverged');
    expect(display.action).toBe('Resolve');
  });

  it('should display error status', () => {
    const display = getSyncStatusDisplay({
      status: 'error',
      localCommits: 0,
      remoteCommits: 0,
      lastSyncTime: null,
      conflicts: [],
      error: 'Network error',
    });

    expect(display.icon).toBe('!');
    expect(display.label).toBe('Error');
  });

  it('should display unsynced status', () => {
    const display = getSyncStatusDisplay({
      status: 'unsynced',
      localCommits: 0,
      remoteCommits: 0,
      lastSyncTime: null,
      conflicts: [],
    });

    expect(display.icon).toBe('○');
    expect(display.label).toBe('Not synced');
  });
});

describe('FileChange interface', () => {
  it('should define correct structure', () => {
    const change = {
      path: 'src/file.ts',
      status: 'modified' as const,
      additions: 10,
      deletions: 5,
    };

    expect(change.path).toBe('src/file.ts');
    expect(change.status).toBe('modified');
  });

  it('should support renamed status', () => {
    const change = {
      path: 'src/newname.ts',
      status: 'renamed' as const,
      additions: 0,
      deletions: 0,
      oldPath: 'src/oldname.ts',
    };

    expect(change.status).toBe('renamed');
    expect(change.oldPath).toBe('src/oldname.ts');
  });
});

describe('GitHubRepo interface', () => {
  it('should define correct structure', () => {
    const repo = {
      owner: 'testuser',
      name: 'testrepo',
      fullName: 'testuser/testrepo',
      defaultBranch: 'main',
      private: false,
      cloneUrl: 'https://github.com/testuser/testrepo.git',
      sshUrl: 'git@github.com:testuser/testrepo.git',
    };

    expect(repo.fullName).toBe('testuser/testrepo');
    expect(repo.cloneUrl).toContain('github.com');
  });
});

describe('SyncResult interface', () => {
  it('should define success result', () => {
    const result = {
      success: true,
      filesChanged: [{ path: 'file.ts', status: 'modified' as const, additions: 5, deletions: 2 }],
      commitSha: 'abc123',
    };

    expect(result.success).toBe(true);
    expect(result.filesChanged).toHaveLength(1);
  });

  it('should define error result', () => {
    const result = {
      success: false,
      filesChanged: [],
      error: 'Push rejected',
    };

    expect(result.success).toBe(false);
    expect(result.error).toBe('Push rejected');
  });
});

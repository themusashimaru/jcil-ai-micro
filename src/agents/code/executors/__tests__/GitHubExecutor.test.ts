// @ts-nocheck - Test file with extensive mocking
/** @vitest-environment node */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/logger', () => ({
  logger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

const mockCreateRepository = vi.hoisted(() => vi.fn());
const mockPushFiles = vi.hoisted(() => vi.fn());
const mockGetGitHubConnectionStatus = vi.hoisted(() => vi.fn());
const mockValidateGitHubToken = vi.hoisted(() => vi.fn());
const mockListUserRepos = vi.hoisted(() => vi.fn());

vi.mock('../../../../lib/connectors/github', () => ({
  createRepository: mockCreateRepository,
  pushFiles: mockPushFiles,
  getGitHubConnectionStatus: mockGetGitHubConnectionStatus,
  validateGitHubToken: mockValidateGitHubToken,
  listUserRepos: mockListUserRepos,
}));

import { GitHubExecutor, githubExecutor } from '../GitHubExecutor';
import type { GitHubPushResult } from '../GitHubExecutor';
import type { GeneratedFile, ProjectPlan } from '../../../core/types';
import type { GitHubRepo } from '../../../../lib/connectors/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePlan(overrides: Partial<ProjectPlan> = {}): ProjectPlan {
  return {
    id: 'plan-1',
    name: 'my-project',
    description: 'A test project',
    architecture: {
      pattern: 'Modular',
      layers: [],
      rationale: 'Testing',
    },
    fileTree: [],
    dependencies: { production: {}, development: {} },
    buildSteps: [],
    testStrategy: { approach: 'unit', testFiles: [] },
    risks: [],
    taskBreakdown: [],
    ...overrides,
  };
}

function makeFile(overrides: Partial<GeneratedFile> = {}): GeneratedFile {
  return {
    path: 'index.ts',
    content: 'console.log("hello");',
    language: 'typescript',
    purpose: 'entry point',
    linesOfCode: 1,
    generatedAt: Date.now(),
    version: 1,
    ...overrides,
  };
}

function makeRepo(overrides: Partial<GitHubRepo> = {}): GitHubRepo {
  return {
    name: 'my-project',
    fullName: 'testuser/my-project',
    description: 'A test project',
    private: false,
    defaultBranch: 'main',
    htmlUrl: 'https://github.com/testuser/my-project',
    owner: 'testuser',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GitHubExecutor', () => {
  let executor: GitHubExecutor;

  beforeEach(() => {
    vi.clearAllMocks();
    executor = new GitHubExecutor();
  });

  // =========================================================================
  // Module exports
  // =========================================================================

  describe('module exports', () => {
    it('should export GitHubExecutor class', () => {
      expect(GitHubExecutor).toBeDefined();
      expect(typeof GitHubExecutor).toBe('function');
    });

    it('should export a singleton githubExecutor instance', () => {
      expect(githubExecutor).toBeDefined();
      expect(githubExecutor).toBeInstanceOf(GitHubExecutor);
    });
  });

  // =========================================================================
  // initialize()
  // =========================================================================

  describe('initialize()', () => {
    it('should return false when given an empty string token', async () => {
      const result = await executor.initialize('');
      expect(result).toBe(false);
    });

    it('should not call validateGitHubToken when token is empty', async () => {
      await executor.initialize('');
      expect(mockValidateGitHubToken).not.toHaveBeenCalled();
    });

    it('should return false when validateGitHubToken returns false', async () => {
      mockValidateGitHubToken.mockResolvedValue(false);
      const result = await executor.initialize('invalid-token');
      expect(result).toBe(false);
    });

    it('should call validateGitHubToken with the provided token', async () => {
      mockValidateGitHubToken.mockResolvedValue(false);
      await executor.initialize('test-token-123');
      expect(mockValidateGitHubToken).toHaveBeenCalledWith('test-token-123');
    });

    it('should return false when getGitHubConnectionStatus returns non-connected status', async () => {
      mockValidateGitHubToken.mockResolvedValue(true);
      mockGetGitHubConnectionStatus.mockResolvedValue({
        status: 'error',
        metadata: {},
      });
      const result = await executor.initialize('valid-token');
      expect(result).toBe(false);
    });

    it('should return false when getGitHubConnectionStatus returns no username', async () => {
      mockValidateGitHubToken.mockResolvedValue(true);
      mockGetGitHubConnectionStatus.mockResolvedValue({
        status: 'connected',
        metadata: {},
      });
      const result = await executor.initialize('valid-token');
      expect(result).toBe(false);
    });

    it('should return false when metadata is undefined', async () => {
      mockValidateGitHubToken.mockResolvedValue(true);
      mockGetGitHubConnectionStatus.mockResolvedValue({
        status: 'connected',
      });
      const result = await executor.initialize('valid-token');
      expect(result).toBe(false);
    });

    it('should return true when token is valid and user info is available', async () => {
      mockValidateGitHubToken.mockResolvedValue(true);
      mockGetGitHubConnectionStatus.mockResolvedValue({
        status: 'connected',
        metadata: { username: 'testuser' },
      });
      const result = await executor.initialize('valid-token');
      expect(result).toBe(true);
    });

    it('should set token and username internally on success', async () => {
      mockValidateGitHubToken.mockResolvedValue(true);
      mockGetGitHubConnectionStatus.mockResolvedValue({
        status: 'connected',
        metadata: { username: 'testuser' },
      });
      await executor.initialize('valid-token');
      expect(executor.isAvailable()).toBe(true);
      expect(executor.getUsername()).toBe('testuser');
    });

    it('should not set token when validation fails', async () => {
      mockValidateGitHubToken.mockResolvedValue(false);
      await executor.initialize('bad-token');
      expect(executor.isAvailable()).toBe(false);
      expect(executor.getUsername()).toBeNull();
    });

    it('should call getGitHubConnectionStatus with the token', async () => {
      mockValidateGitHubToken.mockResolvedValue(true);
      mockGetGitHubConnectionStatus.mockResolvedValue({
        status: 'connected',
        metadata: { username: 'testuser' },
      });
      await executor.initialize('my-token');
      expect(mockGetGitHubConnectionStatus).toHaveBeenCalledWith('my-token');
    });

    it('should return false when status is disconnected', async () => {
      mockValidateGitHubToken.mockResolvedValue(true);
      mockGetGitHubConnectionStatus.mockResolvedValue({
        status: 'disconnected',
        metadata: { username: 'testuser' },
      });
      const result = await executor.initialize('valid-token');
      expect(result).toBe(false);
    });

    it('should return false when status is expired', async () => {
      mockValidateGitHubToken.mockResolvedValue(true);
      mockGetGitHubConnectionStatus.mockResolvedValue({
        status: 'expired',
        metadata: { username: 'testuser' },
      });
      const result = await executor.initialize('valid-token');
      expect(result).toBe(false);
    });
  });

  // =========================================================================
  // isAvailable()
  // =========================================================================

  describe('isAvailable()', () => {
    it('should return false by default for a new instance', () => {
      expect(executor.isAvailable()).toBe(false);
    });

    it('should return true after successful initialization', async () => {
      mockValidateGitHubToken.mockResolvedValue(true);
      mockGetGitHubConnectionStatus.mockResolvedValue({
        status: 'connected',
        metadata: { username: 'testuser' },
      });
      await executor.initialize('valid-token');
      expect(executor.isAvailable()).toBe(true);
    });

    it('should return false after failed initialization', async () => {
      mockValidateGitHubToken.mockResolvedValue(false);
      await executor.initialize('invalid-token');
      expect(executor.isAvailable()).toBe(false);
    });
  });

  // =========================================================================
  // getUsername()
  // =========================================================================

  describe('getUsername()', () => {
    it('should return null by default for a new instance', () => {
      expect(executor.getUsername()).toBeNull();
    });

    it('should return the username after successful initialization', async () => {
      mockValidateGitHubToken.mockResolvedValue(true);
      mockGetGitHubConnectionStatus.mockResolvedValue({
        status: 'connected',
        metadata: { username: 'octocat' },
      });
      await executor.initialize('valid-token');
      expect(executor.getUsername()).toBe('octocat');
    });

    it('should return null after failed initialization', async () => {
      mockValidateGitHubToken.mockResolvedValue(false);
      await executor.initialize('bad-token');
      expect(executor.getUsername()).toBeNull();
    });
  });

  // =========================================================================
  // push()
  // =========================================================================

  describe('push()', () => {
    const files: GeneratedFile[] = [
      makeFile({ path: 'src/index.ts', content: 'export default {}' }),
      makeFile({ path: 'package.json', content: '{}' }),
    ];
    const plan = makePlan();

    async function initializeExecutor() {
      mockValidateGitHubToken.mockResolvedValue(true);
      mockGetGitHubConnectionStatus.mockResolvedValue({
        status: 'connected',
        metadata: { username: 'testuser' },
      });
      await executor.initialize('valid-token');
    }

    it('should return error when not initialized', async () => {
      const result = await executor.push(files, plan);
      expect(result.success).toBe(false);
      expect(result.error).toBe('GitHub not connected. Please login with GitHub first.');
    });

    it('should return error when token is null', async () => {
      const result = await executor.push(files, plan);
      expect(result.success).toBe(false);
      expect(result.error).toContain('GitHub not connected');
    });

    it('should use plan.name as default repo name', async () => {
      await initializeExecutor();
      mockCreateRepository.mockResolvedValue(makeRepo());
      mockPushFiles.mockResolvedValue({ success: true, commitSha: 'abc123' });

      await executor.push(files, plan);
      expect(mockCreateRepository).toHaveBeenCalledWith(
        'valid-token',
        expect.objectContaining({ name: 'my-project' })
      );
    });

    it('should use options.repoName when provided', async () => {
      await initializeExecutor();
      mockCreateRepository.mockResolvedValue(makeRepo({ name: 'custom-name' }));
      mockPushFiles.mockResolvedValue({ success: true, commitSha: 'abc123' });

      await executor.push(files, plan, { repoName: 'custom-name' });
      expect(mockCreateRepository).toHaveBeenCalledWith(
        'valid-token',
        expect.objectContaining({ name: 'custom-name' })
      );
    });

    it('should use main as default branch', async () => {
      await initializeExecutor();
      mockCreateRepository.mockResolvedValue(makeRepo());
      mockPushFiles.mockResolvedValue({ success: true, commitSha: 'abc123' });

      await executor.push(files, plan);
      expect(mockPushFiles).toHaveBeenCalledWith(
        'valid-token',
        expect.objectContaining({ branch: 'main' })
      );
    });

    it('should use options.branch when provided', async () => {
      await initializeExecutor();
      mockCreateRepository.mockResolvedValue(makeRepo());
      mockPushFiles.mockResolvedValue({ success: true, commitSha: 'abc123' });

      await executor.push(files, plan, { branch: 'develop' });
      expect(mockPushFiles).toHaveBeenCalledWith(
        'valid-token',
        expect.objectContaining({ branch: 'develop' })
      );
    });

    it('should call onStream callback with progress info', async () => {
      await initializeExecutor();
      mockCreateRepository.mockResolvedValue(makeRepo());
      mockPushFiles.mockResolvedValue({ success: true, commitSha: 'abc123' });

      const onStream = vi.fn();
      await executor.push(files, plan, {}, onStream);

      expect(onStream).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'synthesizing',
          phase: 'GitHub Push',
          progress: 90,
        })
      );
    });

    it('should include username in stream message', async () => {
      await initializeExecutor();
      mockCreateRepository.mockResolvedValue(makeRepo());
      mockPushFiles.mockResolvedValue({ success: true, commitSha: 'abc123' });

      const onStream = vi.fn();
      await executor.push(files, plan, {}, onStream);

      expect(onStream).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('testuser'),
        })
      );
    });

    it('should include timestamp in stream event', async () => {
      await initializeExecutor();
      mockCreateRepository.mockResolvedValue(makeRepo());
      mockPushFiles.mockResolvedValue({ success: true, commitSha: 'abc123' });

      const onStream = vi.fn();
      const before = Date.now();
      await executor.push(files, plan, {}, onStream);
      const after = Date.now();

      const event = onStream.mock.calls[0][0];
      expect(event.timestamp).toBeGreaterThanOrEqual(before);
      expect(event.timestamp).toBeLessThanOrEqual(after);
    });

    it('should create a new repository by default', async () => {
      await initializeExecutor();
      mockCreateRepository.mockResolvedValue(makeRepo());
      mockPushFiles.mockResolvedValue({ success: true, commitSha: 'abc123' });

      await executor.push(files, plan);
      expect(mockCreateRepository).toHaveBeenCalled();
    });

    it('should pass plan.description to createRepository', async () => {
      await initializeExecutor();
      mockCreateRepository.mockResolvedValue(makeRepo());
      mockPushFiles.mockResolvedValue({ success: true, commitSha: 'abc123' });

      await executor.push(files, makePlan({ description: 'My cool project' }));
      expect(mockCreateRepository).toHaveBeenCalledWith(
        'valid-token',
        expect.objectContaining({ description: 'My cool project' })
      );
    });

    it('should pass private option to createRepository', async () => {
      await initializeExecutor();
      mockCreateRepository.mockResolvedValue(makeRepo({ private: true }));
      mockPushFiles.mockResolvedValue({ success: true, commitSha: 'abc123' });

      await executor.push(files, plan, { private: true });
      expect(mockCreateRepository).toHaveBeenCalledWith(
        'valid-token',
        expect.objectContaining({ private: true })
      );
    });

    it('should default private to false', async () => {
      await initializeExecutor();
      mockCreateRepository.mockResolvedValue(makeRepo());
      mockPushFiles.mockResolvedValue({ success: true, commitSha: 'abc123' });

      await executor.push(files, plan);
      expect(mockCreateRepository).toHaveBeenCalledWith(
        'valid-token',
        expect.objectContaining({ private: false })
      );
    });

    it('should set autoInit to true', async () => {
      await initializeExecutor();
      mockCreateRepository.mockResolvedValue(makeRepo());
      mockPushFiles.mockResolvedValue({ success: true, commitSha: 'abc123' });

      await executor.push(files, plan);
      expect(mockCreateRepository).toHaveBeenCalledWith(
        'valid-token',
        expect.objectContaining({ autoInit: true })
      );
    });

    it('should fallback to listing repos when createRepository returns null', async () => {
      await initializeExecutor();
      mockCreateRepository.mockResolvedValue(null);
      mockListUserRepos.mockResolvedValue([makeRepo()]);
      mockPushFiles.mockResolvedValue({ success: true, commitSha: 'abc123' });

      const result = await executor.push(files, plan);
      expect(mockListUserRepos).toHaveBeenCalledWith('valid-token');
      expect(result.success).toBe(true);
    });

    it('should return error when createRepository returns null and repo not found in list', async () => {
      await initializeExecutor();
      mockCreateRepository.mockResolvedValue(null);
      mockListUserRepos.mockResolvedValue([makeRepo({ name: 'other-repo' })]);

      const result = await executor.push(files, plan);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to create or find repository');
    });

    it('should return error when createRepository returns null and list is empty', async () => {
      await initializeExecutor();
      mockCreateRepository.mockResolvedValue(null);
      mockListUserRepos.mockResolvedValue([]);

      const result = await executor.push(files, plan);
      expect(result.success).toBe(false);
      expect(result.error).toContain('my-project');
    });

    it('should use existing repo when createNew is false', async () => {
      await initializeExecutor();
      mockListUserRepos.mockResolvedValue([makeRepo()]);
      mockPushFiles.mockResolvedValue({ success: true, commitSha: 'abc123' });

      await executor.push(files, plan, { createNew: false });
      expect(mockCreateRepository).not.toHaveBeenCalled();
      expect(mockListUserRepos).toHaveBeenCalled();
    });

    it('should return error when createNew is false and repo is not found', async () => {
      await initializeExecutor();
      mockListUserRepos.mockResolvedValue([]);

      const result = await executor.push(files, plan, { createNew: false });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Repository not found');
    });

    it('should convert files to GitHub format with path and content', async () => {
      await initializeExecutor();
      mockCreateRepository.mockResolvedValue(makeRepo());
      mockPushFiles.mockResolvedValue({ success: true, commitSha: 'abc123' });

      await executor.push(files, plan);
      expect(mockPushFiles).toHaveBeenCalledWith(
        'valid-token',
        expect.objectContaining({
          files: [
            { path: 'src/index.ts', content: 'export default {}' },
            { path: 'package.json', content: '{}' },
          ],
        })
      );
    });

    it('should pass owner as the username', async () => {
      await initializeExecutor();
      mockCreateRepository.mockResolvedValue(makeRepo());
      mockPushFiles.mockResolvedValue({ success: true, commitSha: 'abc123' });

      await executor.push(files, plan);
      expect(mockPushFiles).toHaveBeenCalledWith(
        'valid-token',
        expect.objectContaining({ owner: 'testuser' })
      );
    });

    it('should include commit message with plan description', async () => {
      await initializeExecutor();
      mockCreateRepository.mockResolvedValue(makeRepo());
      mockPushFiles.mockResolvedValue({ success: true, commitSha: 'abc123' });

      await executor.push(files, makePlan({ description: 'Todo app' }));
      expect(mockPushFiles).toHaveBeenCalledWith(
        'valid-token',
        expect.objectContaining({
          message: expect.stringContaining('Todo app'),
        })
      );
    });

    it('should include JCIL Code Agent attribution in commit message', async () => {
      await initializeExecutor();
      mockCreateRepository.mockResolvedValue(makeRepo());
      mockPushFiles.mockResolvedValue({ success: true, commitSha: 'abc123' });

      await executor.push(files, plan);
      expect(mockPushFiles).toHaveBeenCalledWith(
        'valid-token',
        expect.objectContaining({
          message: expect.stringContaining('JCIL Code Agent'),
        })
      );
    });

    it('should return success result with repoUrl when push succeeds', async () => {
      await initializeExecutor();
      mockCreateRepository.mockResolvedValue(makeRepo());
      mockPushFiles.mockResolvedValue({ success: true, commitSha: 'sha456' });

      const result = await executor.push(files, plan);
      expect(result).toEqual({
        success: true,
        repoUrl: 'https://github.com/testuser/my-project',
        commitSha: 'sha456',
      });
    });

    it('should return error when pushFiles fails', async () => {
      await initializeExecutor();
      mockCreateRepository.mockResolvedValue(makeRepo());
      mockPushFiles.mockResolvedValue({ success: false, error: 'Permission denied' });

      const result = await executor.push(files, plan);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Permission denied');
    });

    it('should return default error message when pushFiles fails without error string', async () => {
      await initializeExecutor();
      mockCreateRepository.mockResolvedValue(makeRepo());
      mockPushFiles.mockResolvedValue({ success: false });

      const result = await executor.push(files, plan);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Push failed');
    });

    it('should handle exceptions from createRepository gracefully', async () => {
      await initializeExecutor();
      mockCreateRepository.mockRejectedValue(new Error('Network error'));

      const result = await executor.push(files, plan);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });

    it('should handle exceptions from pushFiles gracefully', async () => {
      await initializeExecutor();
      mockCreateRepository.mockResolvedValue(makeRepo());
      mockPushFiles.mockRejectedValue(new Error('Timeout'));

      const result = await executor.push(files, plan);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Timeout');
    });

    it('should handle non-Error exceptions', async () => {
      await initializeExecutor();
      mockCreateRepository.mockRejectedValue('string error');

      const result = await executor.push(files, plan);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Push failed');
    });

    it('should handle exceptions from listUserRepos in fallback path', async () => {
      await initializeExecutor();
      mockCreateRepository.mockResolvedValue(null);
      mockListUserRepos.mockRejectedValue(new Error('API rate limited'));

      const result = await executor.push(files, plan);
      expect(result.success).toBe(false);
      expect(result.error).toBe('API rate limited');
    });

    it('should work with empty files array', async () => {
      await initializeExecutor();
      mockCreateRepository.mockResolvedValue(makeRepo());
      mockPushFiles.mockResolvedValue({ success: true, commitSha: 'abc' });

      const result = await executor.push([], plan);
      expect(result.success).toBe(true);
      expect(mockPushFiles).toHaveBeenCalledWith(
        'valid-token',
        expect.objectContaining({ files: [] })
      );
    });

    it('should not call onStream when callback is undefined', async () => {
      await initializeExecutor();
      mockCreateRepository.mockResolvedValue(makeRepo());
      mockPushFiles.mockResolvedValue({ success: true, commitSha: 'abc' });

      // Should not throw
      const result = await executor.push(files, plan, {}, undefined);
      expect(result.success).toBe(true);
    });

    it('should use custom repoName in the returned URL', async () => {
      await initializeExecutor();
      mockCreateRepository.mockResolvedValue(makeRepo({ name: 'custom-repo' }));
      mockPushFiles.mockResolvedValue({ success: true, commitSha: 'abc' });

      const result = await executor.push(files, plan, { repoName: 'custom-repo' });
      expect(result.repoUrl).toBe('https://github.com/testuser/custom-repo');
    });

    it('should pass the token to pushFiles', async () => {
      await initializeExecutor();
      mockCreateRepository.mockResolvedValue(makeRepo());
      mockPushFiles.mockResolvedValue({ success: true, commitSha: 'abc' });

      await executor.push(files, plan);
      expect(mockPushFiles).toHaveBeenCalledWith('valid-token', expect.any(Object));
    });

    it('should handle default options when none provided', async () => {
      await initializeExecutor();
      mockCreateRepository.mockResolvedValue(makeRepo());
      mockPushFiles.mockResolvedValue({ success: true, commitSha: 'sha' });

      const result = await executor.push(files, plan);
      expect(result.success).toBe(true);
    });
  });

  // =========================================================================
  // isRepoNameAvailable()
  // =========================================================================

  describe('isRepoNameAvailable()', () => {
    async function initializeExecutor() {
      mockValidateGitHubToken.mockResolvedValue(true);
      mockGetGitHubConnectionStatus.mockResolvedValue({
        status: 'connected',
        metadata: { username: 'testuser' },
      });
      await executor.initialize('valid-token');
    }

    it('should return false when token is null', async () => {
      const result = await executor.isRepoNameAvailable('my-repo');
      expect(result).toBe(false);
    });

    it('should return true when no repos match', async () => {
      await initializeExecutor();
      mockListUserRepos.mockResolvedValue([
        makeRepo({ name: 'other-repo' }),
        makeRepo({ name: 'another-repo' }),
      ]);

      const result = await executor.isRepoNameAvailable('my-new-repo');
      expect(result).toBe(true);
    });

    it('should return false when repo name matches exactly', async () => {
      await initializeExecutor();
      mockListUserRepos.mockResolvedValue([makeRepo({ name: 'my-project' })]);

      const result = await executor.isRepoNameAvailable('my-project');
      expect(result).toBe(false);
    });

    it('should do case-insensitive comparison', async () => {
      await initializeExecutor();
      mockListUserRepos.mockResolvedValue([makeRepo({ name: 'My-Project' })]);

      const result = await executor.isRepoNameAvailable('my-project');
      expect(result).toBe(false);
    });

    it('should do case-insensitive comparison (reverse case)', async () => {
      await initializeExecutor();
      mockListUserRepos.mockResolvedValue([makeRepo({ name: 'my-project' })]);

      const result = await executor.isRepoNameAvailable('My-Project');
      expect(result).toBe(false);
    });

    it('should return true when repos list is empty', async () => {
      await initializeExecutor();
      mockListUserRepos.mockResolvedValue([]);

      const result = await executor.isRepoNameAvailable('my-repo');
      expect(result).toBe(true);
    });

    it('should return true when listUserRepos throws', async () => {
      await initializeExecutor();
      mockListUserRepos.mockRejectedValue(new Error('Network error'));

      const result = await executor.isRepoNameAvailable('my-repo');
      expect(result).toBe(true);
    });

    it('should pass token to listUserRepos', async () => {
      await initializeExecutor();
      mockListUserRepos.mockResolvedValue([]);

      await executor.isRepoNameAvailable('test');
      expect(mockListUserRepos).toHaveBeenCalledWith('valid-token');
    });
  });

  // =========================================================================
  // suggestRepoName()
  // =========================================================================

  describe('suggestRepoName()', () => {
    async function initializeExecutor() {
      mockValidateGitHubToken.mockResolvedValue(true);
      mockGetGitHubConnectionStatus.mockResolvedValue({
        status: 'connected',
        metadata: { username: 'testuser' },
      });
      await executor.initialize('valid-token');
    }

    it('should return baseName when token is null', async () => {
      const result = await executor.suggestRepoName('my-project');
      expect(result).toBe('my-project');
    });

    it('should return baseName when name is available', async () => {
      await initializeExecutor();
      mockListUserRepos.mockResolvedValue([]);

      const result = await executor.suggestRepoName('my-project');
      expect(result).toBe('my-project');
    });

    it('should append timestamp suffix when name is taken', async () => {
      await initializeExecutor();
      mockListUserRepos.mockResolvedValue([makeRepo({ name: 'my-project' })]);

      const result = await executor.suggestRepoName('my-project');
      expect(result).toMatch(/^my-project-[a-z0-9]+$/);
    });

    it('should produce a name different from baseName when taken', async () => {
      await initializeExecutor();
      mockListUserRepos.mockResolvedValue([makeRepo({ name: 'my-project' })]);

      const result = await executor.suggestRepoName('my-project');
      expect(result).not.toBe('my-project');
    });

    it('should start with the baseName even when suffixed', async () => {
      await initializeExecutor();
      mockListUserRepos.mockResolvedValue([makeRepo({ name: 'cool-app' })]);

      const result = await executor.suggestRepoName('cool-app');
      expect(result.startsWith('cool-app-')).toBe(true);
    });

    it('should handle empty baseName', async () => {
      await initializeExecutor();
      mockListUserRepos.mockResolvedValue([]);

      const result = await executor.suggestRepoName('');
      expect(result).toBe('');
    });
  });

  // =========================================================================
  // listRepos()
  // =========================================================================

  describe('listRepos()', () => {
    async function initializeExecutor() {
      mockValidateGitHubToken.mockResolvedValue(true);
      mockGetGitHubConnectionStatus.mockResolvedValue({
        status: 'connected',
        metadata: { username: 'testuser' },
      });
      await executor.initialize('valid-token');
    }

    it('should return empty array when token is null', async () => {
      const result = await executor.listRepos();
      expect(result).toEqual([]);
    });

    it('should return repos from listUserRepos', async () => {
      await initializeExecutor();
      const repos = [makeRepo({ name: 'repo-a' }), makeRepo({ name: 'repo-b' })];
      mockListUserRepos.mockResolvedValue(repos);

      const result = await executor.listRepos();
      expect(result).toEqual(repos);
    });

    it('should pass token to listUserRepos', async () => {
      await initializeExecutor();
      mockListUserRepos.mockResolvedValue([]);

      await executor.listRepos();
      expect(mockListUserRepos).toHaveBeenCalledWith('valid-token');
    });

    it('should return empty array when listUserRepos returns empty', async () => {
      await initializeExecutor();
      mockListUserRepos.mockResolvedValue([]);

      const result = await executor.listRepos();
      expect(result).toEqual([]);
    });
  });

  // =========================================================================
  // GitHubPushResult interface
  // =========================================================================

  describe('GitHubPushResult interface shape', () => {
    it('should allow a minimal success result', () => {
      const result: GitHubPushResult = { success: true };
      expect(result.success).toBe(true);
    });

    it('should allow a full success result', () => {
      const result: GitHubPushResult = {
        success: true,
        repoUrl: 'https://github.com/user/repo',
        commitSha: 'abc123',
      };
      expect(result.repoUrl).toBe('https://github.com/user/repo');
      expect(result.commitSha).toBe('abc123');
    });

    it('should allow a failure result with error', () => {
      const result: GitHubPushResult = {
        success: false,
        error: 'Something went wrong',
      };
      expect(result.success).toBe(false);
      expect(result.error).toBe('Something went wrong');
    });
  });

  // =========================================================================
  // Edge cases & integration-like tests
  // =========================================================================

  describe('edge cases', () => {
    async function initializeExecutor() {
      mockValidateGitHubToken.mockResolvedValue(true);
      mockGetGitHubConnectionStatus.mockResolvedValue({
        status: 'connected',
        metadata: { username: 'testuser' },
      });
      await executor.initialize('valid-token');
    }

    it('should handle push with a single file', async () => {
      await initializeExecutor();
      mockCreateRepository.mockResolvedValue(makeRepo());
      mockPushFiles.mockResolvedValue({ success: true, commitSha: 'sha1' });

      const result = await executor.push([makeFile()], plan());
      expect(result.success).toBe(true);

      function plan() {
        return makePlan();
      }
    });

    it('should handle push with many files', async () => {
      await initializeExecutor();
      mockCreateRepository.mockResolvedValue(makeRepo());
      mockPushFiles.mockResolvedValue({ success: true, commitSha: 'sha' });

      const manyFiles = Array.from({ length: 50 }, (_, i) =>
        makeFile({ path: `file-${i}.ts`, content: `// file ${i}` })
      );

      const result = await executor.push(manyFiles, makePlan());
      expect(result.success).toBe(true);
      expect(mockPushFiles).toHaveBeenCalledWith(
        'valid-token',
        expect.objectContaining({
          files: expect.arrayContaining([
            expect.objectContaining({ path: 'file-0.ts' }),
            expect.objectContaining({ path: 'file-49.ts' }),
          ]),
        })
      );
    });

    it('should handle file with empty content', async () => {
      await initializeExecutor();
      mockCreateRepository.mockResolvedValue(makeRepo());
      mockPushFiles.mockResolvedValue({ success: true, commitSha: 'abc' });

      const result = await executor.push([makeFile({ path: '.gitkeep', content: '' })], makePlan());
      expect(result.success).toBe(true);
    });

    it('should handle plan with special characters in name', async () => {
      await initializeExecutor();
      mockCreateRepository.mockResolvedValue(makeRepo({ name: 'my-cool_project.v2' }));
      mockPushFiles.mockResolvedValue({ success: true, commitSha: 'abc' });

      const result = await executor.push([makeFile()], makePlan({ name: 'my-cool_project.v2' }));
      expect(result.success).toBe(true);
    });

    it('should handle plan with empty description', async () => {
      await initializeExecutor();
      mockCreateRepository.mockResolvedValue(makeRepo());
      mockPushFiles.mockResolvedValue({ success: true, commitSha: 'abc' });

      const result = await executor.push([makeFile()], makePlan({ description: '' }));
      expect(result.success).toBe(true);
    });

    it('should handle multiple sequential pushes', async () => {
      await initializeExecutor();
      mockCreateRepository.mockResolvedValue(makeRepo());
      mockPushFiles.mockResolvedValue({ success: true, commitSha: 'sha1' });

      const result1 = await executor.push([makeFile()], makePlan());
      expect(result1.success).toBe(true);

      mockPushFiles.mockResolvedValue({ success: true, commitSha: 'sha2' });
      const result2 = await executor.push(
        [makeFile({ path: 'other.ts' })],
        makePlan({ name: 'other-project' }),
        { repoName: 'other-project' }
      );
      expect(result2.success).toBe(true);
      expect(result2.commitSha).toBe('sha2');
    });

    it('each GitHubExecutor instance has independent state', async () => {
      const exec1 = new GitHubExecutor();
      const exec2 = new GitHubExecutor();

      mockValidateGitHubToken.mockResolvedValue(true);
      mockGetGitHubConnectionStatus.mockResolvedValue({
        status: 'connected',
        metadata: { username: 'user1' },
      });
      await exec1.initialize('token1');

      expect(exec1.isAvailable()).toBe(true);
      expect(exec2.isAvailable()).toBe(false);
      expect(exec1.getUsername()).toBe('user1');
      expect(exec2.getUsername()).toBeNull();
    });

    it('should handle createNew explicitly set to true', async () => {
      await initializeExecutor();
      mockCreateRepository.mockResolvedValue(makeRepo());
      mockPushFiles.mockResolvedValue({ success: true, commitSha: 'abc' });

      await executor.push([makeFile()], makePlan(), { createNew: true });
      expect(mockCreateRepository).toHaveBeenCalled();
    });

    it('should find existing repo by name when falling back from create', async () => {
      await initializeExecutor();
      mockCreateRepository.mockResolvedValue(null);
      const targetRepo = makeRepo({ name: 'my-project' });
      mockListUserRepos.mockResolvedValue([makeRepo({ name: 'other-repo' }), targetRepo]);
      mockPushFiles.mockResolvedValue({ success: true, commitSha: 'abc' });

      const result = await executor.push([makeFile()], makePlan());
      expect(result.success).toBe(true);
    });

    it('should correctly find existing repo when createNew is false among multiple repos', async () => {
      await initializeExecutor();
      mockListUserRepos.mockResolvedValue([
        makeRepo({ name: 'alpha' }),
        makeRepo({ name: 'my-project' }),
        makeRepo({ name: 'gamma' }),
      ]);
      mockPushFiles.mockResolvedValue({ success: true, commitSha: 'abc' });

      const result = await executor.push([makeFile()], makePlan(), { createNew: false });
      expect(result.success).toBe(true);
    });
  });
});

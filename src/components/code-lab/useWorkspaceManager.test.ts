/**
 * Tests for useWorkspaceManager hook
 *
 * Covers: initial state, file operations, git operations,
 * visual-to-code, deploy, plan status, and memory file management.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWorkspaceManager } from './useWorkspaceManager';
import type { CodeLabSession } from './types';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/logger', () => ({
  logger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}));

const mockToast = {
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
};

vi.mock('@/components/ui/Toast', () => ({
  useToastActions: () => mockToast,
}));

vi.mock('./useAsyncState', () => ({
  useMountedRef: () => ({ current: true }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockFetch = vi.fn();
global.fetch = mockFetch;

function jsonResponse(body: unknown, ok = true, status = 200) {
  return Promise.resolve({
    ok,
    status,
    json: () => Promise.resolve(body),
  });
}

const mockSession: CodeLabSession = {
  id: 'session-1',
  title: 'Test Session',
  createdAt: new Date(),
  updatedAt: new Date(),
  repo: {
    owner: 'user',
    name: 'repo',
    fullName: 'user/repo',
    branch: 'main',
  },
  isActive: true,
  messageCount: 0,
  hasSummary: false,
};

function defaultOptions(overrides: Partial<Parameters<typeof useWorkspaceManager>[0]> = {}) {
  return {
    currentSessionId: 'session-1',
    currentSession: mockSession,
    setError: vi.fn(),
    requestPermission: vi.fn().mockResolvedValue(true),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useWorkspaceManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  // =========================================================================
  // 1. Initial state
  // =========================================================================
  describe('initial state', () => {
    it('returns empty / null / false defaults', () => {
      const { result } = renderHook(() => useWorkspaceManager(defaultOptions()));

      expect(result.current.workspaceFiles).toEqual([]);
      expect(result.current.selectedFile).toBeNull();
      expect(result.current.diffFiles).toEqual([]);
      expect(result.current.currentPlan).toBeNull();
      expect(result.current.memoryFile).toBeUndefined();
      expect(result.current.memoryLoading).toBe(false);
    });
  });

  // =========================================================================
  // 2. loadWorkspaceFiles
  // =========================================================================
  describe('loadWorkspaceFiles', () => {
    it('fetches files and sets workspaceFiles from response', async () => {
      const files = [
        { name: 'index.ts', path: '/index.ts', type: 'file' },
        { name: 'lib', path: '/lib', type: 'directory', children: [] },
      ];

      mockFetch.mockReturnValueOnce(jsonResponse({ files }));

      const { result } = renderHook(() => useWorkspaceManager(defaultOptions()));

      await act(async () => {
        await result.current.loadWorkspaceFiles('session-1');
      });

      expect(mockFetch).toHaveBeenCalledWith('/api/code-lab/files?sessionId=session-1');
      expect(result.current.workspaceFiles).toEqual(files);
    });

    it('defaults to empty array when response has no files property', async () => {
      mockFetch.mockReturnValueOnce(jsonResponse({}));

      const { result } = renderHook(() => useWorkspaceManager(defaultOptions()));

      await act(async () => {
        await result.current.loadWorkspaceFiles('session-1');
      });

      expect(result.current.workspaceFiles).toEqual([]);
    });

    it('does not update state when response is not ok', async () => {
      mockFetch.mockReturnValueOnce(jsonResponse({}, false, 500));

      const { result } = renderHook(() => useWorkspaceManager(defaultOptions()));

      await act(async () => {
        await result.current.loadWorkspaceFiles('session-1');
      });

      expect(result.current.workspaceFiles).toEqual([]);
    });

    it('handles fetch errors gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useWorkspaceManager(defaultOptions()));

      await act(async () => {
        await result.current.loadWorkspaceFiles('session-1');
      });

      expect(result.current.workspaceFiles).toEqual([]);
    });
  });

  // =========================================================================
  // 3. fetchPlanStatus
  // =========================================================================
  describe('fetchPlanStatus', () => {
    it('fetches /api/code-lab/plan and sets currentPlan', async () => {
      const plan = { id: 'plan-1', title: 'My plan', steps: [] };
      mockFetch.mockReturnValueOnce(jsonResponse({ plan }));

      const { result } = renderHook(() => useWorkspaceManager(defaultOptions()));

      await act(async () => {
        await result.current.fetchPlanStatus();
      });

      expect(mockFetch).toHaveBeenCalledWith('/api/code-lab/plan');
      expect(result.current.currentPlan).toEqual(plan);
    });

    it('sets currentPlan to null when response has no plan', async () => {
      mockFetch.mockReturnValueOnce(jsonResponse({}));

      const { result } = renderHook(() => useWorkspaceManager(defaultOptions()));

      await act(async () => {
        await result.current.fetchPlanStatus();
      });

      expect(result.current.currentPlan).toBeNull();
    });

    it('handles fetch errors without throwing', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useWorkspaceManager(defaultOptions()));

      await act(async () => {
        await result.current.fetchPlanStatus();
      });

      expect(result.current.currentPlan).toBeNull();
    });
  });

  // =========================================================================
  // 4. handleFileSelect
  // =========================================================================
  describe('handleFileSelect', () => {
    it('sets selectedFile to the given path', () => {
      const { result } = renderHook(() => useWorkspaceManager(defaultOptions()));

      act(() => {
        result.current.handleFileSelect('/src/app.tsx');
      });

      expect(result.current.selectedFile).toBe('/src/app.tsx');
    });

    it('updates selectedFile when called again with a different path', () => {
      const { result } = renderHook(() => useWorkspaceManager(defaultOptions()));

      act(() => {
        result.current.handleFileSelect('/src/app.tsx');
      });

      act(() => {
        result.current.handleFileSelect('/src/index.ts');
      });

      expect(result.current.selectedFile).toBe('/src/index.ts');
    });
  });

  // =========================================================================
  // 5. handleFileCreate
  // =========================================================================
  describe('handleFileCreate', () => {
    it('POSTs to /api/code-lab/files and reloads workspace files', async () => {
      const files = [{ name: 'new.ts', path: '/new.ts', type: 'file' }];
      // First call: create file. Second call: reload files.
      mockFetch
        .mockReturnValueOnce(jsonResponse({ success: true }))
        .mockReturnValueOnce(jsonResponse({ files }));

      const { result } = renderHook(() => useWorkspaceManager(defaultOptions()));

      await act(async () => {
        await result.current.handleFileCreate('/new.ts', 'console.log("hello")');
      });

      expect(mockFetch).toHaveBeenCalledWith('/api/code-lab/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: 'session-1',
          path: '/new.ts',
          content: 'console.log("hello")',
        }),
      });

      // Reload call
      expect(mockFetch).toHaveBeenCalledWith('/api/code-lab/files?sessionId=session-1');
    });

    it('uses empty string as default content when none provided', async () => {
      mockFetch
        .mockReturnValueOnce(jsonResponse({ success: true }))
        .mockReturnValueOnce(jsonResponse({ files: [] }));

      const { result } = renderHook(() => useWorkspaceManager(defaultOptions()));

      await act(async () => {
        await result.current.handleFileCreate('/empty.ts');
      });

      const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
      expect(body.content).toBe('');
    });

    it('does nothing when currentSessionId is null', async () => {
      const { result } = renderHook(() =>
        useWorkspaceManager(defaultOptions({ currentSessionId: null }))
      );

      await act(async () => {
        await result.current.handleFileCreate('/new.ts');
      });

      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 6. handleFileDelete — approved
  // =========================================================================
  describe('handleFileDelete — approved', () => {
    it('requests permission, DELETEs file, reloads files, and shows success toast', async () => {
      const requestPermission = vi.fn().mockResolvedValue(true);
      const files = [{ name: 'remaining.ts', path: '/remaining.ts', type: 'file' }];

      // DELETE response, then reload response
      mockFetch
        .mockReturnValueOnce(jsonResponse({ success: true }))
        .mockReturnValueOnce(jsonResponse({ files }));

      const { result } = renderHook(() =>
        useWorkspaceManager(defaultOptions({ requestPermission }))
      );

      await act(async () => {
        await result.current.handleFileDelete('/to-delete.ts');
      });

      // Permission was requested with correct type
      expect(requestPermission).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'file_delete',
          title: 'Delete File',
          riskLevel: 'high',
          affectedFiles: ['/to-delete.ts'],
        })
      );

      // DELETE was called
      expect(mockFetch).toHaveBeenCalledWith(
        `/api/code-lab/files?sessionId=session-1&path=${encodeURIComponent('/to-delete.ts')}`,
        { method: 'DELETE' }
      );

      // Success toast
      expect(mockToast.success).toHaveBeenCalledWith('Deleted', '/to-delete.ts has been deleted');
    });

    it('shows error toast when DELETE request fails', async () => {
      const requestPermission = vi.fn().mockResolvedValue(true);

      mockFetch.mockReturnValueOnce(jsonResponse({}, false, 500));

      const { result } = renderHook(() =>
        useWorkspaceManager(defaultOptions({ requestPermission }))
      );

      await act(async () => {
        await result.current.handleFileDelete('/fail.ts');
      });

      expect(mockToast.error).toHaveBeenCalledWith('Delete Failed', 'Failed to delete file');
    });
  });

  // =========================================================================
  // 7. handleFileDelete — denied
  // =========================================================================
  describe('handleFileDelete — denied', () => {
    it('does NOT call fetch and shows info toast when permission denied', async () => {
      const requestPermission = vi.fn().mockResolvedValue(false);

      const { result } = renderHook(() =>
        useWorkspaceManager(defaultOptions({ requestPermission }))
      );

      await act(async () => {
        await result.current.handleFileDelete('/secret.ts');
      });

      // No fetch calls should have been made (only permission requested)
      expect(mockFetch).not.toHaveBeenCalled();
      expect(mockToast.info).toHaveBeenCalledWith('Cancelled', 'File deletion cancelled');
    });
  });

  // =========================================================================
  // 8. handleGitPush — approved
  // =========================================================================
  describe('handleGitPush — approved', () => {
    it('requests permission, POSTs git push, and shows success toast', async () => {
      const requestPermission = vi.fn().mockResolvedValue(true);

      mockFetch.mockReturnValueOnce(
        jsonResponse({ success: true, diff: [{ file: 'a.ts', status: 'modified' }] })
      );

      const { result } = renderHook(() =>
        useWorkspaceManager(defaultOptions({ requestPermission }))
      );

      await act(async () => {
        await result.current.handleGitPush();
      });

      // Permission was requested for git_push
      expect(requestPermission).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'git_push',
          title: 'Push to Remote Repository',
          riskLevel: 'medium',
          allowAlways: true,
        })
      );

      // POST to git endpoint
      expect(mockFetch).toHaveBeenCalledWith('/api/code-lab/git', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: 'session-1',
          operation: 'push',
          repo: mockSession.repo,
        }),
      });

      expect(mockToast.success).toHaveBeenCalledWith(
        'Pushed',
        'Changes pushed to remote repository'
      );

      // diff is set in state
      expect(result.current.diffFiles).toEqual([{ file: 'a.ts', status: 'modified' }]);
    });

    it('does not set diffFiles when response has no diff', async () => {
      const requestPermission = vi.fn().mockResolvedValue(true);
      mockFetch.mockReturnValueOnce(jsonResponse({ success: true }));

      const { result } = renderHook(() =>
        useWorkspaceManager(defaultOptions({ requestPermission }))
      );

      await act(async () => {
        await result.current.handleGitPush();
      });

      expect(result.current.diffFiles).toEqual([]);
    });

    it('calls setError when push fetch throws', async () => {
      const requestPermission = vi.fn().mockResolvedValue(true);
      const setError = vi.fn();
      mockFetch.mockRejectedValueOnce(new Error('Network failure'));

      const { result } = renderHook(() =>
        useWorkspaceManager(defaultOptions({ requestPermission, setError }))
      );

      await act(async () => {
        await result.current.handleGitPush();
      });

      expect(setError).toHaveBeenCalledWith('Failed to push changes');
    });
  });

  // =========================================================================
  // 9. handleGitPush — denied
  // =========================================================================
  describe('handleGitPush — denied', () => {
    it('shows info toast and does not call fetch when permission denied', async () => {
      const requestPermission = vi.fn().mockResolvedValue(false);

      const { result } = renderHook(() =>
        useWorkspaceManager(defaultOptions({ requestPermission }))
      );

      await act(async () => {
        await result.current.handleGitPush();
      });

      expect(mockFetch).not.toHaveBeenCalled();
      expect(mockToast.info).toHaveBeenCalledWith('Cancelled', 'Push operation cancelled');
    });
  });

  // =========================================================================
  // 10. handleGitPull
  // =========================================================================
  describe('handleGitPull', () => {
    it('POSTs git pull and reloads workspace files', async () => {
      const files = [{ name: 'updated.ts', path: '/updated.ts', type: 'file' }];

      // Pull response, then reload response
      mockFetch
        .mockReturnValueOnce(jsonResponse({ success: true }))
        .mockReturnValueOnce(jsonResponse({ files }));

      const { result } = renderHook(() => useWorkspaceManager(defaultOptions()));

      await act(async () => {
        await result.current.handleGitPull();
      });

      expect(mockFetch).toHaveBeenCalledWith('/api/code-lab/git', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: 'session-1',
          operation: 'pull',
          repo: mockSession.repo,
        }),
      });

      // Workspace files reload call
      expect(mockFetch).toHaveBeenCalledWith('/api/code-lab/files?sessionId=session-1');
    });

    it('calls setError when pull fetch throws', async () => {
      const setError = vi.fn();
      mockFetch.mockRejectedValueOnce(new Error('Network failure'));

      const { result } = renderHook(() => useWorkspaceManager(defaultOptions({ setError })));

      await act(async () => {
        await result.current.handleGitPull();
      });

      expect(setError).toHaveBeenCalledWith('Failed to pull changes');
    });

    it('does nothing when currentSessionId is null', async () => {
      const { result } = renderHook(() =>
        useWorkspaceManager(defaultOptions({ currentSessionId: null }))
      );

      await act(async () => {
        await result.current.handleGitPull();
      });

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('does nothing when currentSession has no repo', async () => {
      const sessionNoRepo: CodeLabSession = {
        ...mockSession,
        repo: undefined,
      };

      const { result } = renderHook(() =>
        useWorkspaceManager(defaultOptions({ currentSession: sessionNoRepo }))
      );

      await act(async () => {
        await result.current.handleGitPull();
      });

      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 11. handleVisualToCode
  // =========================================================================
  describe('handleVisualToCode', () => {
    it('POSTs to /api/code-lab/visual-to-code and returns result', async () => {
      const responseBody = {
        code: '<div>Hello</div>',
        framework: 'react',
        language: 'tsx',
        preview: 'data:image/png;base64,...',
      };
      mockFetch.mockReturnValueOnce(jsonResponse(responseBody));

      const { result } = renderHook(() => useWorkspaceManager(defaultOptions()));

      let codeResult: Awaited<ReturnType<typeof result.current.handleVisualToCode>>;
      await act(async () => {
        codeResult = await result.current.handleVisualToCode(
          'base64image',
          'react',
          'Make it responsive'
        );
      });

      expect(mockFetch).toHaveBeenCalledWith('/api/code-lab/visual-to-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: 'base64image',
          framework: 'react',
          instructions: 'Make it responsive',
        }),
      });

      expect(codeResult!).toEqual(responseBody);
    });

    it('throws when response is not ok', async () => {
      mockFetch.mockReturnValueOnce(jsonResponse({}, false, 500));

      const { result } = renderHook(() => useWorkspaceManager(defaultOptions()));

      await expect(
        act(async () => {
          await result.current.handleVisualToCode('img', 'vue');
        })
      ).rejects.toThrow('Failed to generate code');
    });
  });

  // =========================================================================
  // 12. handleDeploy
  // =========================================================================
  describe('handleDeploy', () => {
    const deployConfig = {
      platform: 'vercel' as const,
      projectName: 'my-app',
      buildCommand: 'npm run build',
      outputDir: '.next',
      envVars: { NODE_ENV: 'production' },
      domain: 'my-app.vercel.app',
    };

    it('POSTs to /api/code-lab/deploy and returns deployment result', async () => {
      mockFetch.mockReturnValueOnce(
        jsonResponse({
          success: true,
          projectId: 'proj-123',
          url: 'https://my-app.vercel.app',
        })
      );

      const { result } = renderHook(() => useWorkspaceManager(defaultOptions()));

      let deployResult: Awaited<ReturnType<typeof result.current.handleDeploy>>;
      await act(async () => {
        deployResult = await result.current.handleDeploy(deployConfig);
      });

      expect(mockFetch).toHaveBeenCalledWith('/api/code-lab/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: 'session-1',
          platform: 'vercel',
          config: {
            projectName: 'my-app',
            buildCommand: 'npm run build',
            outputDir: '.next',
            envVars: { NODE_ENV: 'production' },
            domain: 'my-app.vercel.app',
          },
        }),
      });

      expect(deployResult!).toEqual(
        expect.objectContaining({
          id: 'proj-123',
          status: 'success',
          url: 'https://my-app.vercel.app',
          buildLogs: [],
        })
      );
      expect(deployResult!.createdAt).toBeInstanceOf(Date);
    });

    it('returns error status when API reports failure', async () => {
      mockFetch.mockReturnValueOnce(jsonResponse({ success: false, error: 'Build failed' }));

      const { result } = renderHook(() => useWorkspaceManager(defaultOptions()));

      let deployResult: Awaited<ReturnType<typeof result.current.handleDeploy>>;
      await act(async () => {
        deployResult = await result.current.handleDeploy(deployConfig);
      });

      expect(deployResult!.status).toBe('error');
      expect(deployResult!.error).toBe('Build failed');
    });
  });

  // =========================================================================
  // 13. handleDeploy with no session
  // =========================================================================
  describe('handleDeploy with no session', () => {
    it('returns error result immediately when currentSessionId is null', async () => {
      const { result } = renderHook(() =>
        useWorkspaceManager(defaultOptions({ currentSessionId: null }))
      );

      let deployResult: Awaited<ReturnType<typeof result.current.handleDeploy>>;
      await act(async () => {
        deployResult = await result.current.handleDeploy({
          platform: 'vercel',
          projectName: 'app',
          buildCommand: 'npm run build',
          outputDir: 'dist',
          envVars: {},
        });
      });

      expect(mockFetch).not.toHaveBeenCalled();
      expect(deployResult!).toEqual(
        expect.objectContaining({
          id: '',
          status: 'error',
          error: 'No session',
          buildLogs: [],
        })
      );
    });
  });

  // =========================================================================
  // 14. loadMemoryFile
  // =========================================================================
  describe('loadMemoryFile', () => {
    it('fetches /api/code-lab/memory and sets memoryFile', async () => {
      mockFetch.mockReturnValueOnce(
        jsonResponse({
          path: '/workspace/CLAUDE.md',
          content: '# Memory',
          exists: true,
          lastModified: '2026-02-23T00:00:00Z',
        })
      );

      const { result } = renderHook(() => useWorkspaceManager(defaultOptions()));

      await act(async () => {
        await result.current.loadMemoryFile();
      });

      expect(mockFetch).toHaveBeenCalledWith('/api/code-lab/memory?sessionId=session-1');
      expect(result.current.memoryFile).toEqual({
        path: '/workspace/CLAUDE.md',
        content: '# Memory',
        exists: true,
        lastModified: new Date('2026-02-23T00:00:00Z'),
      });
    });

    it('sets memoryLoading to true during fetch and false after', async () => {
      let resolveFetch!: (value: unknown) => void;
      mockFetch.mockReturnValueOnce(
        new Promise((resolve) => {
          resolveFetch = resolve;
        })
      );

      const { result } = renderHook(() => useWorkspaceManager(defaultOptions()));

      // Start the load — don't await yet
      let loadPromise: Promise<void>;
      act(() => {
        loadPromise = result.current.loadMemoryFile();
      });

      // memoryLoading should be true while in flight
      expect(result.current.memoryLoading).toBe(true);

      // Resolve fetch
      await act(async () => {
        resolveFetch({
          ok: true,
          json: () => Promise.resolve({ path: '/workspace/CLAUDE.md', content: '', exists: false }),
        });
        await loadPromise;
      });

      expect(result.current.memoryLoading).toBe(false);
    });

    it('sets memoryLoading to false even when fetch fails', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useWorkspaceManager(defaultOptions()));

      await act(async () => {
        await result.current.loadMemoryFile();
      });

      expect(result.current.memoryLoading).toBe(false);
    });

    it('does nothing when currentSessionId is null', async () => {
      const { result } = renderHook(() =>
        useWorkspaceManager(defaultOptions({ currentSessionId: null }))
      );

      await act(async () => {
        await result.current.loadMemoryFile();
      });

      expect(mockFetch).not.toHaveBeenCalled();
      expect(result.current.memoryFile).toBeUndefined();
    });

    it('defaults path to /workspace/CLAUDE.md when response has no path', async () => {
      mockFetch.mockReturnValueOnce(jsonResponse({ content: 'data', exists: true }));

      const { result } = renderHook(() => useWorkspaceManager(defaultOptions()));

      await act(async () => {
        await result.current.loadMemoryFile();
      });

      expect(result.current.memoryFile?.path).toBe('/workspace/CLAUDE.md');
    });
  });

  // =========================================================================
  // 15. saveMemoryFile
  // =========================================================================
  describe('saveMemoryFile', () => {
    it('POSTs memory content, updates memoryFile state, and shows success toast', async () => {
      mockFetch.mockReturnValueOnce(jsonResponse({ success: true }));

      const { result } = renderHook(() => useWorkspaceManager(defaultOptions()));

      await act(async () => {
        await result.current.saveMemoryFile('# Updated Memory');
      });

      expect(mockFetch).toHaveBeenCalledWith('/api/code-lab/memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: 'session-1', content: '# Updated Memory' }),
      });

      expect(result.current.memoryFile).toEqual(
        expect.objectContaining({
          content: '# Updated Memory',
          exists: true,
          path: '/workspace/CLAUDE.md',
        })
      );
      expect(result.current.memoryFile?.lastModified).toBeInstanceOf(Date);

      expect(mockToast.success).toHaveBeenCalledWith('Memory Saved', 'CLAUDE.md has been updated');
    });

    it('shows error toast when save response is not ok', async () => {
      mockFetch.mockReturnValueOnce(jsonResponse({}, false, 500));

      const { result } = renderHook(() => useWorkspaceManager(defaultOptions()));

      await act(async () => {
        await result.current.saveMemoryFile('content');
      });

      expect(mockToast.error).toHaveBeenCalledWith('Save Failed', 'Could not save memory file');
    });

    it('shows error toast when fetch throws', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useWorkspaceManager(defaultOptions()));

      await act(async () => {
        await result.current.saveMemoryFile('content');
      });

      expect(mockToast.error).toHaveBeenCalledWith('Save Failed', 'Could not save memory file');
    });

    it('does nothing when currentSessionId is null', async () => {
      const { result } = renderHook(() =>
        useWorkspaceManager(defaultOptions({ currentSessionId: null }))
      );

      await act(async () => {
        await result.current.saveMemoryFile('content');
      });

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('preserves existing path when updating memoryFile', async () => {
      // First, load the memory file to set an initial path
      mockFetch.mockReturnValueOnce(
        jsonResponse({
          path: '/custom/path/CLAUDE.md',
          content: 'old content',
          exists: true,
        })
      );

      const { result } = renderHook(() => useWorkspaceManager(defaultOptions()));

      await act(async () => {
        await result.current.loadMemoryFile();
      });

      // Now save — should preserve the custom path
      mockFetch.mockReturnValueOnce(jsonResponse({ success: true }));

      await act(async () => {
        await result.current.saveMemoryFile('new content');
      });

      expect(result.current.memoryFile?.path).toBe('/custom/path/CLAUDE.md');
      expect(result.current.memoryFile?.content).toBe('new content');
    });
  });

  // =========================================================================
  // 16. No operations when currentSessionId is null
  // =========================================================================
  describe('no operations when currentSessionId is null', () => {
    it('handleFileCreate does nothing', async () => {
      const { result } = renderHook(() =>
        useWorkspaceManager(defaultOptions({ currentSessionId: null }))
      );

      await act(async () => {
        await result.current.handleFileCreate('/new.ts', 'code');
      });

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('handleFileDelete does nothing', async () => {
      const requestPermission = vi.fn();
      const { result } = renderHook(() =>
        useWorkspaceManager(defaultOptions({ currentSessionId: null, requestPermission }))
      );

      await act(async () => {
        await result.current.handleFileDelete('/old.ts');
      });

      expect(requestPermission).not.toHaveBeenCalled();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('handleGitPush does nothing', async () => {
      const requestPermission = vi.fn();
      const { result } = renderHook(() =>
        useWorkspaceManager(defaultOptions({ currentSessionId: null, requestPermission }))
      );

      await act(async () => {
        await result.current.handleGitPush();
      });

      expect(requestPermission).not.toHaveBeenCalled();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('handleGitPull does nothing', async () => {
      const { result } = renderHook(() =>
        useWorkspaceManager(defaultOptions({ currentSessionId: null }))
      );

      await act(async () => {
        await result.current.handleGitPull();
      });

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('handleDeploy returns error result', async () => {
      const { result } = renderHook(() =>
        useWorkspaceManager(defaultOptions({ currentSessionId: null }))
      );

      let deployResult: Awaited<ReturnType<typeof result.current.handleDeploy>>;
      await act(async () => {
        deployResult = await result.current.handleDeploy({
          platform: 'netlify',
          projectName: 'app',
          buildCommand: 'build',
          outputDir: 'dist',
          envVars: {},
        });
      });

      expect(mockFetch).not.toHaveBeenCalled();
      expect(deployResult!.status).toBe('error');
      expect(deployResult!.error).toBe('No session');
    });

    it('loadMemoryFile does nothing', async () => {
      const { result } = renderHook(() =>
        useWorkspaceManager(defaultOptions({ currentSessionId: null }))
      );

      await act(async () => {
        await result.current.loadMemoryFile();
      });

      expect(mockFetch).not.toHaveBeenCalled();
      expect(result.current.memoryFile).toBeUndefined();
      expect(result.current.memoryLoading).toBe(false);
    });

    it('saveMemoryFile does nothing', async () => {
      const { result } = renderHook(() =>
        useWorkspaceManager(defaultOptions({ currentSessionId: null }))
      );

      await act(async () => {
        await result.current.saveMemoryFile('ignored');
      });

      expect(mockFetch).not.toHaveBeenCalled();
    });
  });
});

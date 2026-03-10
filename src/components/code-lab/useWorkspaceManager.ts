/**
 * Workspace Manager Hook for CodeLab
 *
 * Handles all workspace operations:
 * - File tree management (load, create, delete)
 * - Git operations (push, pull)
 * - Visual-to-code conversion
 * - Deployment
 * - Plan management
 * - Memory file management
 */

import { useState, useRef, useCallback } from 'react';
import { logger } from '@/lib/logger';
import { useMountedRef } from './useAsyncState';
import { useToastActions } from '@/components/ui/Toast';
import type { CodeLabSession } from './types';
import type { FileNode } from './CodeLabLiveFileTree';
import type { FileDiff } from './CodeLabDiffViewer';
import type { Plan } from '@/lib/workspace/plan-mode';
import type { PermissionRequest } from './CodeLabPermissionDialog';

const log = logger('WorkspaceManager');

interface UseWorkspaceManagerOptions {
  currentSessionId: string | null;
  currentSession: CodeLabSession | undefined;
  setError: (error: string | null) => void;
  requestPermission: (request: Omit<PermissionRequest, 'id'>) => Promise<boolean>;
}

interface UseWorkspaceManagerReturn {
  workspaceFiles: FileNode[];
  selectedFile: string | null;
  diffFiles: FileDiff[];
  currentPlan: Plan | null;
  setCurrentPlan: (plan: Plan | null) => void;
  memoryFile: { path: string; content: string; exists: boolean; lastModified?: Date } | undefined;
  memoryLoading: boolean;
  loadWorkspaceFiles: (sessionId: string) => Promise<void>;
  fetchPlanStatus: () => Promise<void>;
  handleFileSelect: (path: string) => void;
  handleFileCreate: (path: string, content?: string) => Promise<void>;
  handleFileDelete: (path: string) => Promise<void>;
  handleGitPush: () => Promise<void>;
  handleGitPull: () => Promise<void>;
  handleVisualToCode: (
    imageBase64: string,
    framework: string,
    instructions?: string
  ) => Promise<{
    code: string;
    framework: string;
    language: string;
    preview?: string;
  }>;
  handleDeploy: (config: {
    platform: 'vercel' | 'netlify' | 'railway' | 'cloudflare';
    projectName: string;
    buildCommand: string;
    outputDir: string;
    envVars: Record<string, string>;
    domain?: string;
  }) => Promise<{
    id: string;
    status: 'success' | 'error';
    url?: string;
    createdAt: Date;
    buildLogs: string[];
    error?: string;
  }>;
  loadMemoryFile: () => Promise<void>;
  saveMemoryFile: (content: string) => Promise<void>;
}

export function useWorkspaceManager({
  currentSessionId,
  currentSession,
  setError,
  requestPermission,
}: UseWorkspaceManagerOptions): UseWorkspaceManagerReturn {
  const [workspaceFiles, setWorkspaceFiles] = useState<FileNode[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [diffFiles, setDiffFiles] = useState<FileDiff[]>([]);
  const [currentPlan, setCurrentPlan] = useState<Plan | null>(null);

  // Memory file state
  const [memoryFile, setMemoryFile] = useState<
    { path: string; content: string; exists: boolean; lastModified?: Date } | undefined
  >(undefined);
  const [memoryLoading, setMemoryLoading] = useState(false);

  const toast = useToastActions();
  const mountedRef = useMountedRef();
  const loadWorkspaceFilesRequestIdRef = useRef(0);

  const loadWorkspaceFiles = async (sessionId: string) => {
    const requestId = ++loadWorkspaceFilesRequestIdRef.current;
    try {
      const response = await fetch(`/api/code-lab/files?sessionId=${sessionId}`);
      if (!mountedRef.current || loadWorkspaceFilesRequestIdRef.current !== requestId) {
        return;
      }
      if (response.ok) {
        const data = await response.json();
        setWorkspaceFiles(data.files || []);
      }
    } catch (err) {
      if (mountedRef.current && loadWorkspaceFilesRequestIdRef.current === requestId) {
        log.error('Error loading workspace files', err as Error);
      }
    }
  };

  const fetchPlanStatus = async () => {
    try {
      const response = await fetch('/api/code-lab/plan');
      if (response.ok) {
        const data = await response.json();
        setCurrentPlan(data.plan || null);
      }
    } catch (err) {
      log.debug('Error fetching plan status', { error: String(err) });
    }
  };

  const handleFileSelect = (path: string) => {
    setSelectedFile(path);
  };

  const handleFileCreate = async (path: string, content: string = '') => {
    if (!currentSessionId) return;
    try {
      await fetch('/api/code-lab/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: currentSessionId, path, content }),
      });
      loadWorkspaceFiles(currentSessionId);
    } catch (err) {
      log.error('Error creating file', err as Error);
    }
  };

  const handleFileDelete = async (path: string) => {
    if (!currentSessionId) return;

    const approved = await requestPermission({
      type: 'file_delete',
      title: 'Delete File',
      description: 'Are you sure you want to delete this file? This action cannot be undone.',
      affectedFiles: [path],
      riskLevel: 'high',
      allowAlways: false,
    });

    if (!approved) {
      toast.info('Cancelled', 'File deletion cancelled');
      return;
    }

    try {
      const response = await fetch(
        `/api/code-lab/files?sessionId=${currentSessionId}&path=${encodeURIComponent(path)}`,
        { method: 'DELETE' }
      );
      if (!response.ok) {
        throw new Error(`Failed to delete file: ${response.status}`);
      }
      loadWorkspaceFiles(currentSessionId);
      toast.success('Deleted', `${path} has been deleted`);
    } catch (err) {
      log.error('Error deleting file', err as Error);
      toast.error('Delete Failed', 'Failed to delete file');
    }
  };

  const handleGitPush = async () => {
    if (!currentSessionId || !currentSession?.repo) return;

    const approved = await requestPermission({
      type: 'git_push',
      title: 'Push to Remote Repository',
      description: `This will push your local commits to ${currentSession.repo.fullName} on branch ${currentSession.repo.branch}.`,
      details: [
        `Repository: ${currentSession.repo.fullName}`,
        `Branch: ${currentSession.repo.branch}`,
      ],
      riskLevel: 'medium',
      allowAlways: true,
    });

    if (!approved) {
      toast.info('Cancelled', 'Push operation cancelled');
      return;
    }

    try {
      const response = await fetch('/api/code-lab/git', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: currentSessionId,
          operation: 'push',
          repo: currentSession.repo,
        }),
      });
      if (response.ok) {
        const data = await response.json();
        if (data.diff) {
          setDiffFiles(data.diff);
        }
        toast.success('Pushed', 'Changes pushed to remote repository');
      }
    } catch (err) {
      log.error('Error pushing to git', err as Error);
      setError('Failed to push changes');
    }
  };

  const handleGitPull = async () => {
    if (!currentSessionId || !currentSession?.repo) return;
    try {
      await fetch('/api/code-lab/git', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: currentSessionId,
          operation: 'pull',
          repo: currentSession.repo,
        }),
      });
      loadWorkspaceFiles(currentSessionId);
    } catch (err) {
      log.error('Error pulling from git', err as Error);
      setError('Failed to pull changes');
    }
  };

  const handleVisualToCode = async (
    imageBase64: string,
    framework: string,
    instructions?: string
  ) => {
    const response = await fetch('/api/code-lab/visual-to-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: imageBase64, framework, instructions }),
    });
    if (!response.ok) throw new Error('Failed to generate code');
    return response.json();
  };

  const handleDeploy = async (config: {
    platform: 'vercel' | 'netlify' | 'railway' | 'cloudflare';
    projectName: string;
    buildCommand: string;
    outputDir: string;
    envVars: Record<string, string>;
    domain?: string;
  }) => {
    if (!currentSessionId) {
      return {
        id: '',
        status: 'error' as const,
        createdAt: new Date(),
        buildLogs: [] as string[],
        error: 'No session',
      };
    }

    const response = await fetch('/api/code-lab/deploy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: currentSessionId,
        platform: config.platform,
        config: {
          projectName: config.projectName,
          buildCommand: config.buildCommand,
          outputDir: config.outputDir,
          envVars: config.envVars,
          domain: config.domain,
        },
      }),
    });

    const result = await response.json();
    return {
      id: result.projectId || `deploy-${Date.now()}`,
      status: result.success ? ('success' as const) : ('error' as const),
      url: result.url,
      createdAt: new Date(),
      buildLogs: [] as string[],
      error: result.error,
    };
  };

  const loadMemoryFile = useCallback(async () => {
    if (!currentSessionId) return;
    setMemoryLoading(true);
    try {
      const response = await fetch(`/api/code-lab/memory?sessionId=${currentSessionId}`);
      if (response.ok) {
        const data = await response.json();
        setMemoryFile({
          path: data.path || '/workspace/CLAUDE.md',
          content: data.content || '',
          exists: data.exists || false,
          lastModified: data.lastModified ? new Date(data.lastModified) : undefined,
        });
      }
    } catch (err) {
      log.error('Failed to load memory file', err as Error);
    } finally {
      setMemoryLoading(false);
    }
  }, [currentSessionId]);

  const saveMemoryFile = useCallback(
    async (content: string) => {
      if (!currentSessionId) return;
      try {
        const response = await fetch('/api/code-lab/memory', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: currentSessionId, content }),
        });
        if (response.ok) {
          setMemoryFile((prev) => ({
            path: prev?.path || '/workspace/CLAUDE.md',
            content,
            exists: true,
            lastModified: new Date(),
          }));
          toast.success('Memory Saved', 'CLAUDE.md has been updated');
        } else {
          toast.error('Save Failed', 'Could not save memory file');
        }
      } catch (err) {
        log.error('Failed to save memory file', err as Error);
        toast.error('Save Failed', 'Could not save memory file');
      }
    },
    [currentSessionId, toast]
  );

  return {
    workspaceFiles,
    selectedFile,
    diffFiles,
    currentPlan,
    setCurrentPlan,
    memoryFile,
    memoryLoading,
    loadWorkspaceFiles,
    fetchPlanStatus,
    handleFileSelect,
    handleFileCreate,
    handleFileDelete,
    handleGitPush,
    handleGitPull,
    handleVisualToCode,
    handleDeploy,
    loadMemoryFile,
    saveMemoryFile,
  };
}

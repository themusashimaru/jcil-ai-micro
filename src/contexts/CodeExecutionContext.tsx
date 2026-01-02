/**
 * CODE EXECUTION CONTEXT
 * ======================
 *
 * Provides code execution and GitHub push functionality
 * to components throughout the app.
 *
 * Features:
 * - Sandbox code testing
 * - GitHub repository management
 * - Push code to repos
 */

'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useSandbox, SandboxTestResult } from '@/hooks/useSandbox';

// GitHub repo type
export interface GitHubRepo {
  name: string;
  fullName: string;
  description: string | null;
  private: boolean;
  defaultBranch: string;
  htmlUrl: string;
  owner: string;
}

// Context value type
interface CodeExecutionContextValue {
  // Sandbox
  sandboxAvailable: boolean;
  sandboxTesting: boolean;
  testCode: (code: string, language: string) => Promise<SandboxTestResult>;
  lastTestResult: SandboxTestResult | null;

  // GitHub
  githubConnected: boolean;
  repos: GitHubRepo[];
  selectedRepo: GitHubRepo | null;
  loadingRepos: boolean;
  selectRepo: (repo: GitHubRepo | null) => void;
  fetchRepos: () => Promise<void>;
  pushToGitHub: (code: string, filename: string, message?: string) => Promise<{ success: boolean; url?: string; error?: string }>;

  // UI State
  showRepoSelector: boolean;
  setShowRepoSelector: (show: boolean) => void;
}

const CodeExecutionContext = createContext<CodeExecutionContextValue | null>(null);

export function CodeExecutionProvider({ children }: { children: React.ReactNode }) {
  // Sandbox hook
  const sandbox = useSandbox();

  // GitHub state
  const [githubConnected, setGithubConnected] = useState(false);
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepo | null>(null);
  const [loadingRepos, setLoadingRepos] = useState(false);

  // UI state
  const [showRepoSelector, setShowRepoSelector] = useState(false);

  // Check connectors status on mount
  useEffect(() => {
    checkConnectors();
  }, []);

  const checkConnectors = async () => {
    try {
      const response = await fetch('/api/connectors');
      if (response.ok) {
        const data = await response.json();
        const github = data.connectors?.find((c: { type: string }) => c.type === 'github');
        setGithubConnected(github?.status === 'connected');
      }
    } catch (error) {
      console.error('Failed to check connectors:', error);
    }
  };

  // Fetch GitHub repos
  const fetchRepos = useCallback(async () => {
    if (!githubConnected) return;

    setLoadingRepos(true);
    try {
      const response = await fetch('/api/connectors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'listRepos' }),
      });

      if (response.ok) {
        const data = await response.json();
        setRepos(data.repos || []);
      }
    } catch (error) {
      console.error('Failed to fetch repos:', error);
    } finally {
      setLoadingRepos(false);
    }
  }, [githubConnected]);

  // Test code in sandbox
  const testCode = useCallback(async (code: string, language: string): Promise<SandboxTestResult> => {
    return sandbox.testCode(code, language);
  }, [sandbox]);

  // Push code to GitHub
  const pushToGitHub = useCallback(async (
    code: string,
    filename: string,
    message?: string
  ): Promise<{ success: boolean; url?: string; error?: string }> => {
    if (!selectedRepo) {
      return { success: false, error: 'No repository selected' };
    }

    try {
      const response = await fetch('/api/connectors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'pushFiles',
          owner: selectedRepo.owner,
          repo: selectedRepo.name,
          branch: selectedRepo.defaultBranch,
          message: message || `Add ${filename} via JCIL.ai`,
          files: [{ path: filename, content: code }],
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.error || 'Push failed' };
      }

      return {
        success: true,
        url: data.repoUrl || `https://github.com/${selectedRepo.fullName}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Push failed',
      };
    }
  }, [selectedRepo]);

  const value: CodeExecutionContextValue = {
    // Sandbox
    sandboxAvailable: true, // Will be checked via API
    sandboxTesting: sandbox.testing,
    testCode,
    lastTestResult: sandbox.result,

    // GitHub
    githubConnected,
    repos,
    selectedRepo,
    loadingRepos,
    selectRepo: setSelectedRepo,
    fetchRepos,
    pushToGitHub,

    // UI State
    showRepoSelector,
    setShowRepoSelector,
  };

  return (
    <CodeExecutionContext.Provider value={value}>
      {children}
    </CodeExecutionContext.Provider>
  );
}

// Hook to use the context
export function useCodeExecution() {
  const context = useContext(CodeExecutionContext);
  if (!context) {
    throw new Error('useCodeExecution must be used within CodeExecutionProvider');
  }
  return context;
}

// Optional hook that returns null if not in provider (for conditional use)
export function useCodeExecutionOptional() {
  return useContext(CodeExecutionContext);
}

export default CodeExecutionContext;

/**
 * USE SANDBOX HOOK
 * ================
 *
 * React hook for interacting with Vercel Sandbox
 * - Test code snippets
 * - Check sandbox status
 * - Track usage
 */

'use client';

import { useState, useCallback } from 'react';

export interface SandboxTestResult {
  success: boolean;
  outputs: Array<{
    command: string;
    exitCode: number;
    stdout: string;
    stderr: string;
    success: boolean;
  }>;
  error?: string;
  executionTime: number;
  usage?: {
    used: number;
    limit: number;
    remaining: number;
  };
}

export interface SandboxStatus {
  available: boolean;
  authenticated?: boolean;
  tier?: string;
  usage?: {
    used: number;
    limit: number;
    remaining: number;
  };
  reason?: string;
}

export function useSandbox() {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<SandboxTestResult | null>(null);
  const [status, setStatus] = useState<SandboxStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  /**
   * Check sandbox availability and usage
   */
  const checkStatus = useCallback(async (): Promise<SandboxStatus> => {
    try {
      const response = await fetch('/api/sandbox');
      const data = await response.json();
      setStatus(data);
      return data;
    } catch (err) {
      const errorStatus: SandboxStatus = {
        available: false,
        reason: err instanceof Error ? err.message : 'Failed to check status',
      };
      setStatus(errorStatus);
      return errorStatus;
    }
  }, []);

  /**
   * Test a code snippet in the sandbox
   */
  const testCode = useCallback(async (
    code: string,
    language: string = 'javascript'
  ): Promise<SandboxTestResult> => {
    console.log('[useSandbox] testCode called:', { language, codeLength: code.length });
    setTesting(true);
    setError(null);
    setResult(null);

    try {
      // Map language to sandbox format
      const langMap: Record<string, string> = {
        js: 'javascript',
        ts: 'typescript',
        py: 'python',
        jsx: 'javascript',
        tsx: 'typescript',
      };
      const normalizedLang = langMap[language.toLowerCase()] || language.toLowerCase();
      console.log('[useSandbox] Normalized language:', normalizedLang);

      console.log('[useSandbox] Calling /api/sandbox...');
      const response = await fetch('/api/sandbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'quick',
          code,
          language: normalizedLang,
        }),
      });

      console.log('[useSandbox] Response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('[useSandbox] Error response:', errorData);
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data: SandboxTestResult = await response.json();
      console.log('[useSandbox] Success result:', data);
      setResult(data);
      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Test failed';
      setError(errorMessage);
      const errorResult: SandboxTestResult = {
        success: false,
        outputs: [],
        error: errorMessage,
        executionTime: 0,
      };
      setResult(errorResult);
      return errorResult;
    } finally {
      setTesting(false);
    }
  }, []);

  /**
   * Execute a full build with multiple files
   */
  const buildProject = useCallback(async (
    files: Array<{ path: string; content: string }>,
    options?: {
      packageManager?: 'npm' | 'yarn' | 'pnpm' | 'bun';
      buildCommand?: string;
      testCommand?: string;
    }
  ): Promise<SandboxTestResult> => {
    setTesting(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/sandbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'build',
          files,
          ...options,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data: SandboxTestResult = await response.json();
      setResult(data);
      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Build failed';
      setError(errorMessage);
      const errorResult: SandboxTestResult = {
        success: false,
        outputs: [],
        error: errorMessage,
        executionTime: 0,
      };
      setResult(errorResult);
      return errorResult;
    } finally {
      setTesting(false);
    }
  }, []);

  /**
   * Execute custom commands
   */
  const execute = useCallback(async (
    files: Array<{ path: string; content: string }>,
    commands: string[],
    options?: {
      runtime?: 'node22' | 'python3.13';
      timeout?: number;
      vcpus?: number;
    }
  ): Promise<SandboxTestResult> => {
    setTesting(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/sandbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'execute',
          files,
          commands,
          ...options,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data: SandboxTestResult = await response.json();
      setResult(data);
      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Execution failed';
      setError(errorMessage);
      const errorResult: SandboxTestResult = {
        success: false,
        outputs: [],
        error: errorMessage,
        executionTime: 0,
      };
      setResult(errorResult);
      return errorResult;
    } finally {
      setTesting(false);
    }
  }, []);

  /**
   * Format result output for display
   */
  const formatOutput = useCallback((res: SandboxTestResult | null): string => {
    if (!res) return '';
    if (res.error) return `Error: ${res.error}`;

    return res.outputs
      .map(o => {
        let text = `$ ${o.command}\n`;
        if (o.stdout) text += o.stdout + '\n';
        if (o.stderr && !o.success) text += `Error: ${o.stderr}\n`;
        return text;
      })
      .join('\n');
  }, []);

  return {
    // State
    testing,
    result,
    status,
    error,
    // Actions
    testCode,
    buildProject,
    execute,
    checkStatus,
    // Helpers
    formatOutput,
  };
}

export default useSandbox;

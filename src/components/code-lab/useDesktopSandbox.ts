'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

interface DesktopState {
  status: 'idle' | 'starting' | 'running' | 'error';
  screenshot: string | null;
  lastAction: string | null;
  error: string | null;
  url: string | null;
}

interface AiStep {
  action: string;
  reasoning?: string;
}

export function useDesktopSandbox(sessionId: string) {
  const [desktop, setDesktop] = useState<DesktopState>({
    status: 'idle',
    screenshot: null,
    lastAction: null,
    error: null,
    url: null,
  });
  const [urlInput, setUrlInput] = useState('');
  const [commandInput, setCommandInput] = useState('');
  const [aiTaskInput, setAiTaskInput] = useState('');
  const [aiTaskRunning, setAiTaskRunning] = useState(false);
  const [aiSteps, setAiSteps] = useState<AiStep[]>([]);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startDesktop = useCallback(async () => {
    setDesktop((prev) => ({ ...prev, status: 'starting', error: null }));
    try {
      const res = await fetch('/api/code-lab/desktop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start', sessionId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Failed to start desktop' }));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setDesktop({
        status: 'running',
        screenshot: data.screenshot || null,
        lastAction: 'Desktop started',
        error: null,
        url: null,
      });
    } catch (err) {
      setDesktop((prev) => ({
        ...prev,
        status: 'error',
        error: err instanceof Error ? err.message : 'Failed to start desktop',
      }));
    }
  }, [sessionId]);

  const takeScreenshot = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch('/api/code-lab/desktop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'screenshot', sessionId }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setDesktop((prev) => ({
        ...prev,
        screenshot: data.screenshot || prev.screenshot,
        lastAction: 'Screenshot captured',
      }));
    } catch (err) {
      setDesktop((prev) => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Screenshot failed',
      }));
    } finally {
      setIsRefreshing(false);
    }
  }, [sessionId]);

  const openUrl = useCallback(
    async (url: string) => {
      if (!url.trim()) return;
      setDesktop((prev) => ({ ...prev, lastAction: `Opening ${url}...` }));
      try {
        const res = await fetch('/api/code-lab/desktop', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'open_url', sessionId, url }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setDesktop((prev) => ({
          ...prev,
          screenshot: data.screenshot || prev.screenshot,
          lastAction: `Opened ${url}`,
          url,
        }));
        setUrlInput('');
      } catch (err) {
        setDesktop((prev) => ({
          ...prev,
          error: err instanceof Error ? err.message : 'Failed to open URL',
        }));
      }
    },
    [sessionId]
  );

  const runCommand = useCallback(
    async (command: string) => {
      if (!command.trim()) return;
      setDesktop((prev) => ({ ...prev, lastAction: `Running: ${command}` }));
      try {
        const res = await fetch('/api/code-lab/desktop', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'run_command', sessionId, command }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setDesktop((prev) => ({
          ...prev,
          screenshot: data.screenshot || prev.screenshot,
          lastAction: data.output ? `$ ${command}\n${data.output}` : `Ran: ${command}`,
        }));
        setCommandInput('');
      } catch (err) {
        setDesktop((prev) => ({
          ...prev,
          error: err instanceof Error ? err.message : 'Command failed',
        }));
      }
    },
    [sessionId]
  );

  const runAiTask = useCallback(
    async (task: string) => {
      if (!task.trim() || aiTaskRunning) return;
      setAiTaskRunning(true);
      setAiSteps([]);
      setAiSummary(null);
      setDesktop((prev) => ({ ...prev, lastAction: `AI: ${task}`, error: null }));

      try {
        const res = await fetch('/api/code-lab/computer-use', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ task, sessionId }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({ error: 'Request failed' }));
          throw new Error(data.error || `HTTP ${res.status}`);
        }

        const reader = res.body?.getReader();
        if (!reader) throw new Error('No response stream');

        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          let currentEvent = '';
          for (const line of lines) {
            if (line.startsWith('event: ')) {
              currentEvent = line.slice(7);
            } else if (line.startsWith('data: ') && currentEvent) {
              try {
                const data = JSON.parse(line.slice(6));
                if (currentEvent === 'step') {
                  setAiSteps((prev) => [
                    ...prev,
                    { action: data.action, reasoning: data.reasoning },
                  ]);
                  if (data.screenshot) {
                    setDesktop((prev) => ({
                      ...prev,
                      screenshot: data.screenshot,
                      lastAction: `Step ${data.stepNumber}: ${data.action}`,
                    }));
                  }
                } else if (currentEvent === 'status') {
                  setDesktop((prev) => ({ ...prev, lastAction: data.message }));
                } else if (currentEvent === 'result') {
                  setAiSummary(data.summary);
                  if (data.finalScreenshot) {
                    setDesktop((prev) => ({ ...prev, screenshot: data.finalScreenshot }));
                  }
                } else if (currentEvent === 'error') {
                  setDesktop((prev) => ({ ...prev, error: data.message }));
                }
              } catch {
                // Skip malformed JSON
              }
              currentEvent = '';
            }
          }
        }

        setAiTaskInput('');
      } catch (err) {
        setDesktop((prev) => ({
          ...prev,
          error: err instanceof Error ? err.message : 'AI task failed',
        }));
      } finally {
        setAiTaskRunning(false);
      }
    },
    [sessionId, aiTaskRunning]
  );

  // Auto-poll screenshots while running
  useEffect(() => {
    if (desktop.status === 'running') {
      pollRef.current = setInterval(() => {
        takeScreenshot();
      }, 5000);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [desktop.status, takeScreenshot]);

  return {
    desktop,
    urlInput,
    setUrlInput,
    commandInput,
    setCommandInput,
    aiTaskInput,
    setAiTaskInput,
    aiTaskRunning,
    aiSteps,
    aiSummary,
    isRefreshing,
    startDesktop,
    takeScreenshot,
    openUrl,
    runCommand,
    runAiTask,
  };
}

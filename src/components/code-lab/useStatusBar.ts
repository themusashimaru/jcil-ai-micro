import { useState, useMemo, useCallback } from 'react';
import type {
  ModelType,
  ConnectionStatus,
  SandboxStatus,
  TokenUsage,
  FileInfo,
  GitInfo,
  BackgroundTask,
} from './CodeLabStatusBar';

export interface UseStatusBarOptions {
  initialModel?: ModelType;
  tokenLimit?: number;
}

function calculateCost(tokens: number, model: ModelType): number {
  // Approximate costs per 1M tokens (input + output average)
  const costs: Record<ModelType, number> = {
    opus: 75, // $75 per 1M tokens average
    sonnet: 15, // $15 per 1M tokens average
    haiku: 1.25, // $1.25 per 1M tokens average
  };

  return (tokens / 1000000) * costs[model];
}

export function useStatusBar(options: UseStatusBarOptions = {}) {
  const { initialModel = 'opus', tokenLimit = 3000000 } = options;

  const [model, setModel] = useState<ModelType>(initialModel);
  const [tokensUsed, setTokensUsed] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connected');
  const [sandboxStatus, setSandboxStatus] = useState<SandboxStatus>('active');
  const [git, setGit] = useState<GitInfo | undefined>(undefined);
  const [file, setFile] = useState<FileInfo | undefined>(undefined);
  const [backgroundTasks, setBackgroundTasks] = useState<BackgroundTask[]>([]);
  const [mcpServersActive, setMcpServersActive] = useState(0);

  const tokens = useMemo<TokenUsage>(
    () => ({
      used: tokensUsed,
      limit: tokenLimit,
      costUSD: calculateCost(tokensUsed, model),
    }),
    [tokensUsed, tokenLimit, model]
  );

  const addTokens = useCallback((count: number) => {
    setTokensUsed((prev) => prev + count);
  }, []);

  const addBackgroundTask = useCallback((task: Omit<BackgroundTask, 'id'>) => {
    const newTask: BackgroundTask = {
      ...task,
      id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };
    setBackgroundTasks((prev) => [...prev, newTask]);
    return newTask.id;
  }, []);

  const updateBackgroundTask = useCallback((id: string, status: BackgroundTask['status']) => {
    setBackgroundTasks((prev) => prev.map((task) => (task.id === id ? { ...task, status } : task)));
  }, []);

  const removeBackgroundTask = useCallback((id: string) => {
    setBackgroundTasks((prev) => prev.filter((task) => task.id !== id));
  }, []);

  return {
    // State
    model,
    tokens,
    connectionStatus,
    sandboxStatus,
    git,
    file,
    backgroundTasks,
    mcpServersActive,

    // Setters
    setModel,
    setTokensUsed,
    addTokens,
    setConnectionStatus,
    setSandboxStatus,
    setGit,
    setFile,
    setMcpServersActive,
    addBackgroundTask,
    updateBackgroundTask,
    removeBackgroundTask,
  };
}

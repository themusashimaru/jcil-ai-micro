'use client';

/**
 * CODE LAB STATUS BAR
 *
 * Bottom status bar with real-time information display.
 * Mirrors VS Code / Claude Code CLI status bar experience.
 *
 * Features:
 * - Model indicator (Opus/Sonnet/Haiku)
 * - Token usage with visual progress
 * - Connection status (sandbox/MCP)
 * - Current file info (language, encoding, line)
 * - Git branch indicator
 * - Background task count
 * - Keyboard shortcuts hint
 * - Live indicators with smooth animations
 *
 * WCAG 2.1 AA Accessible
 */

import React, { useState, useEffect } from 'react';
import { StatusBarStyles } from './StatusBarStyles';
import {
  ModelIndicator,
  TokenIndicator,
  ConnectionIndicator,
  SandboxIndicator,
  GitIndicator,
  FileIndicator,
  TaskIndicator,
} from './StatusBarIndicators';

// ============================================================================
// TYPES
// ============================================================================

export type ModelType = 'opus' | 'sonnet' | 'haiku';
export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'error';
export type SandboxStatus = 'active' | 'starting' | 'stopped' | 'error';

export interface TokenUsage {
  used: number;
  limit: number;
  costUSD?: number;
}

export interface FileInfo {
  name: string;
  language: string;
  encoding?: string;
  lineEnding?: 'LF' | 'CRLF';
  line?: number;
  column?: number;
}

export interface GitInfo {
  branch: string;
  isDirty: boolean;
  ahead?: number;
  behind?: number;
}

export interface BackgroundTask {
  id: string;
  name: string;
  status: 'running' | 'completed' | 'failed';
}

export interface CodeLabStatusBarProps {
  model?: ModelType;
  tokens?: TokenUsage;
  connectionStatus?: ConnectionStatus;
  sandboxStatus?: SandboxStatus;
  file?: FileInfo;
  git?: GitInfo;
  backgroundTasks?: BackgroundTask[];
  mcpServersActive?: number;
  onModelClick?: () => void;
  onTokensClick?: () => void;
  onConnectionClick?: () => void;
  onSandboxClick?: () => void;
  onGitClick?: () => void;
  onTasksClick?: () => void;
  className?: string;
}

// Re-export hook and its types from the extracted module
export { useStatusBar } from './useStatusBar';
export type { UseStatusBarOptions } from './useStatusBar';

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function CodeLabStatusBar({
  model = 'opus',
  tokens,
  connectionStatus = 'connected',
  sandboxStatus = 'active',
  file,
  git,
  backgroundTasks = [],
  mcpServersActive: _mcpServersActive = 0,
  onModelClick,
  onTokensClick,
  onConnectionClick,
  onSandboxClick,
  onGitClick,
  onTasksClick,
  className = '',
}: CodeLabStatusBarProps) {
  const [time, setTime] = useState<string>('');

  // Update time every minute
  useEffect(() => {
    const updateTime = () => {
      setTime(
        new Date().toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        })
      );
    };

    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <footer
      className={`code-lab-status-bar ${className}`}
      role="status"
      aria-label="Code Lab status bar"
    >
      <StatusBarStyles />

      {/* Left Section */}
      <div className="status-left">
        <ModelIndicator model={model} onClick={onModelClick} />

        <span className="status-separator" />

        {tokens && (
          <>
            <TokenIndicator usage={tokens} onClick={onTokensClick} />
            <span className="status-separator" />
          </>
        )}

        <ConnectionIndicator status={connectionStatus} onClick={onConnectionClick} />
        <SandboxIndicator status={sandboxStatus} onClick={onSandboxClick} />

        {/* MCP indicator removed — tools work seamlessly in background */}

        {backgroundTasks.length > 0 && (
          <>
            <span className="status-separator" />
            <TaskIndicator tasks={backgroundTasks} onClick={onTasksClick} />
          </>
        )}
      </div>

      {/* Center Section */}
      <div className="status-center">{git && <GitIndicator git={git} onClick={onGitClick} />}</div>

      {/* Right Section */}
      <div className="status-right">
        {file && (
          <>
            <FileIndicator file={file} />
            <span className="status-separator" />
          </>
        )}

        <div className="keyboard-hint" title="Open Command Palette">
          <span className="kbd">⌘</span>
          <span className="kbd">K</span>
        </div>

        <span className="status-separator" />

        <span className="status-time">{time}</span>
      </div>
    </footer>
  );
}

export default CodeLabStatusBar;

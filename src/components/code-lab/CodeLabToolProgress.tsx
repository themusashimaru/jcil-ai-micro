'use client';

/**
 * CODE LAB TOOL PROGRESS
 *
 * Beautiful progress indicators for tool executions.
 * Shows what the AI is doing in real-time.
 * Features:
 * - Animated progress indicators
 * - Tool-specific icons
 * - Expandable details
 * - Status colors
 */

import { useState } from 'react';
import './code-lab-tool-progress.css';

export type ToolStatus = 'pending' | 'running' | 'success' | 'error';

export interface ToolExecution {
  id: string;
  name: string;
  description?: string;
  status: ToolStatus;
  startTime?: Date;
  endTime?: Date;
  output?: string;
  error?: string;
}

interface CodeLabToolProgressProps {
  tools: ToolExecution[];
  className?: string;
}

function formatDuration(startTime?: Date, endTime?: Date): string {
  if (!startTime) return '';

  const end = endTime || new Date();
  const ms = end.getTime() - startTime.getTime();

  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

export function CodeLabToolProgress({ tools, className = '' }: CodeLabToolProgressProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (tools.length === 0) return null;

  const runningTools = tools.filter((t) => t.status === 'running');
  const completedTools = tools.filter((t) => t.status === 'success' || t.status === 'error');

  return (
    <div className={`tool-progress ${className}`}>
      {/* Running tools */}
      {runningTools.length > 0 && (
        <div className="progress-section running">
          <div className="section-header">
            <div className="running-indicator">
              <span className="pulse-dot" />
              <span>Running</span>
            </div>
            <span className="count">{runningTools.length}</span>
          </div>

          <div className="tool-list">
            {runningTools.map((tool) => (
              <div key={tool.id} className="tool-item running">
                <div className="tool-info">
                  <span className="tool-name">{tool.name}</span>
                  {tool.description && <span className="tool-desc">{tool.description}</span>}
                </div>
                <div className="tool-status">
                  <div className="spinner" />
                  <span className="duration">{formatDuration(tool.startTime)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Completed tools */}
      {completedTools.length > 0 && (
        <div className="progress-section completed">
          <div className="section-header">
            <span>Completed</span>
            <span className="count">{completedTools.length}</span>
          </div>

          <div className="tool-list">
            {completedTools.map((tool) => (
              <div
                key={tool.id}
                className={`tool-item ${tool.status}`}
                onClick={() => setExpandedId(expandedId === tool.id ? null : tool.id)}
              >
                <div className="tool-info">
                  <span className="tool-name">{tool.name}</span>
                  {tool.description && <span className="tool-desc">{tool.description}</span>}
                </div>
                <div className="tool-status">
                  <span className={`status-badge ${tool.status}`}>
                    {tool.status === 'success' ? '✓' : '✗'}
                  </span>
                  <span className="duration">{formatDuration(tool.startTime, tool.endTime)}</span>
                </div>

                {/* Expandable output */}
                {expandedId === tool.id && (tool.output || tool.error) && (
                  <div className="tool-output" onClick={(e) => e.stopPropagation()}>
                    {tool.error ? (
                      <pre className="error">{tool.error}</pre>
                    ) : (
                      <pre>{tool.output}</pre>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}

/**
 * Mini progress bar for inline display
 */
interface MiniProgressProps {
  running: boolean;
  progress?: number; // 0-100
  className?: string;
}

export function CodeLabMiniProgress({ running, progress, className = '' }: MiniProgressProps) {
  if (!running && !progress) return null;

  return (
    <div className={`mini-progress ${className}`}>
      <div
        className={`progress-bar ${running ? 'indeterminate' : ''}`}
        style={progress !== undefined ? { width: `${progress}%` } : undefined}
      />

    </div>
  );
}

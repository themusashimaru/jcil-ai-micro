/**
 * Workspace Panel — Right-side panel with tabs for Files, Changes, Deploy, etc.
 *
 * Extracted from CodeLab.tsx to reduce component size.
 */

'use client';

import { logger } from '@/lib/logger';
import { CodeLabLiveFileTree } from './CodeLabLiveFileTree';
import { CodeLabDiffViewer } from './CodeLabDiffViewer';
import { CodeLabVisualToCode } from './CodeLabVisualToCode';
import { CodeLabDeployFlow } from './CodeLabDeployFlow';
import { CodeLabDebugPanel } from './CodeLabDebugPanel';
import { CodeLabPlanView } from './CodeLabPlanView';
import { CodeLabMemoryEditor } from './CodeLabMemoryEditor';
import { CodeLabComponentBoundary } from './CodeLabComponentBoundary';
import type { CodeLabSession } from './types';
import type { FileNode } from './CodeLabLiveFileTree';
import type { FileDiff } from './CodeLabDiffViewer';
import type { Plan } from '@/lib/workspace/plan-mode';

const log = logger('WorkspacePanel');

type WorkspaceTab = 'files' | 'diff' | 'deploy' | 'visual' | 'debug' | 'plan' | 'memory' | 'tasks';

interface BackgroundAgent {
  id: string;
  name: string;
  status: 'running' | 'completed' | 'failed';
  startedAt: Date;
  output?: string;
}

interface CodeLabWorkspacePanelProps {
  activeTab: WorkspaceTab;
  setActiveTab: (tab: WorkspaceTab) => void;
  onClose: () => void;
  currentSessionId: string;
  currentSession?: CodeLabSession;
  // Files
  workspaceFiles: FileNode[];
  selectedFile: string | null;
  onFileSelect: (path: string) => void;
  onFileCreate: (path: string) => void;
  onFileDelete: (path: string) => void;
  onRefreshFiles: () => void;
  // Diff
  diffFiles: FileDiff[];
  // Deploy
  onDeploy: (config: {
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
  // Visual
  onVisualToCode: (
    imageBase64: string,
    framework: string,
    instructions?: string
  ) => Promise<{
    code: string;
    framework: string;
    language: string;
    preview?: string;
  }>;
  onInsertCode: (code: string) => void;
  // Debug
  onAIAnalysis: (debugState: unknown) => void;
  // Plan
  currentPlan: Plan | null;
  setCurrentPlan: (plan: Plan | null) => void;
  fetchPlanStatus: () => void;
  // Memory
  memoryFile?: {
    path: string;
    content: string;
    exists: boolean;
    lastModified?: Date;
  };
  onSaveMemory: (content: string) => Promise<void>;
  onLoadMemory: () => Promise<void>;
  memoryLoading: boolean;
  // Tasks
  backgroundAgents: BackgroundAgent[];
  // Git
  onGitPull: () => void;
  onGitPush: () => void;
}

export function CodeLabWorkspacePanel({
  activeTab,
  setActiveTab,
  onClose,
  currentSessionId,
  currentSession,
  workspaceFiles,
  selectedFile,
  onFileSelect,
  onFileCreate,
  onFileDelete,
  onRefreshFiles,
  diffFiles,
  onDeploy,
  onVisualToCode,
  onInsertCode,
  onAIAnalysis,
  currentPlan,
  setCurrentPlan,
  fetchPlanStatus,
  memoryFile,
  onSaveMemory,
  onLoadMemory,
  memoryLoading,
  backgroundAgents,
  onGitPull,
  onGitPush,
}: CodeLabWorkspacePanelProps) {
  return (
    <div className="workspace-panel">
      <div className="workspace-tabs" role="tablist" aria-label="Workspace panels">
        {/* Close/Back button */}
        <button
          className="workspace-close-btn"
          onClick={onClose}
          title="Close panel (Esc)"
          aria-label="Close workspace panel"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <button
          className={activeTab === 'files' ? 'active' : ''}
          onClick={() => setActiveTab('files')}
          role="tab"
          aria-selected={activeTab === 'files'}
          aria-label="Files panel"
        >
          Files
        </button>
        <button
          className={activeTab === 'diff' ? 'active' : ''}
          onClick={() => setActiveTab('diff')}
          role="tab"
          aria-selected={activeTab === 'diff'}
          aria-label="Changes panel"
        >
          Changes
        </button>
        <button
          className={activeTab === 'deploy' ? 'active' : ''}
          onClick={() => setActiveTab('deploy')}
          role="tab"
          aria-selected={activeTab === 'deploy'}
          aria-label="Deploy panel"
        >
          Deploy
        </button>
        <button
          className={activeTab === 'visual' ? 'active' : ''}
          onClick={() => setActiveTab('visual')}
          role="tab"
          aria-selected={activeTab === 'visual'}
          aria-label="Visual to code panel"
        >
          Visual
        </button>
        <button
          className={activeTab === 'debug' ? 'active' : ''}
          onClick={() => setActiveTab('debug')}
          role="tab"
          aria-selected={activeTab === 'debug'}
          aria-label="Debug panel"
        >
          Debug
        </button>
        <button
          className={activeTab === 'plan' ? 'active' : ''}
          onClick={() => {
            setActiveTab('plan');
            fetchPlanStatus();
          }}
          role="tab"
          aria-selected={activeTab === 'plan'}
          aria-label={`Plan panel${currentPlan && currentPlan.status === 'in_progress' ? ' (in progress)' : ''}`}
        >
          Plan {currentPlan && currentPlan.status === 'in_progress' && <span aria-hidden="true">●</span>}
        </button>
        <button
          className={activeTab === 'memory' ? 'active' : ''}
          onClick={() => {
            setActiveTab('memory');
            if (!memoryFile) onLoadMemory();
          }}
          role="tab"
          aria-selected={activeTab === 'memory'}
          aria-label={`Memory panel${memoryFile?.exists ? ' (file exists)' : ''}`}
        >
          Memory {memoryFile?.exists && <span aria-hidden="true">●</span>}
        </button>
        <button
          className={activeTab === 'tasks' ? 'active' : ''}
          onClick={() => setActiveTab('tasks')}
          title="Background Tasks (Ctrl+B)"
          role="tab"
          aria-selected={activeTab === 'tasks'}
          aria-label={`Background tasks${backgroundAgents.filter((a) => a.status === 'running').length > 0 ? ` (${backgroundAgents.filter((a) => a.status === 'running').length} running)` : ''}`}
        >
          Tasks{' '}
          {backgroundAgents.filter((a) => a.status === 'running').length > 0 &&
            `(${backgroundAgents.filter((a) => a.status === 'running').length})`}
        </button>
      </div>
      <div className="workspace-content">
        {activeTab === 'files' && (
          <CodeLabComponentBoundary componentName="File Browser">
            <CodeLabLiveFileTree
              files={workspaceFiles}
              selectedPath={selectedFile ?? undefined}
              onFileSelect={onFileSelect}
              onFileCreate={(path) => onFileCreate(path)}
              onFileDelete={onFileDelete}
              onRefresh={onRefreshFiles}
            />
          </CodeLabComponentBoundary>
        )}
        {activeTab === 'diff' && (
          <CodeLabComponentBoundary componentName="Diff Viewer">
            <div className="diff-list">
              {diffFiles.length === 0 ? (
                <div className="diff-empty">
                  <p>No changes to display</p>
                  <p className="hint">Push or pull from GitHub to see file changes</p>
                </div>
              ) : (
                diffFiles.map((fileDiff, index) => (
                  <CodeLabDiffViewer
                    key={`${fileDiff.oldPath || fileDiff.newPath}-${index}`}
                    diff={fileDiff}
                    onAcceptHunk={(hunkIndex) =>
                      log.debug('Accept hunk', { hunkIndex, file: fileDiff.newPath })
                    }
                    onRejectHunk={(hunkIndex) =>
                      log.debug('Reject hunk', { hunkIndex, file: fileDiff.newPath })
                    }
                  />
                ))
              )}
            </div>
          </CodeLabComponentBoundary>
        )}
        {activeTab === 'deploy' && (
          <CodeLabComponentBoundary componentName="Deploy">
            <CodeLabDeployFlow onDeploy={onDeploy} />
          </CodeLabComponentBoundary>
        )}
        {activeTab === 'visual' && (
          <CodeLabComponentBoundary componentName="Visual to Code">
            <CodeLabVisualToCode
              onGenerate={onVisualToCode as Parameters<typeof CodeLabVisualToCode>[0]['onGenerate']}
              onInsertCode={onInsertCode}
            />
          </CodeLabComponentBoundary>
        )}
        {activeTab === 'debug' && (
          <CodeLabComponentBoundary componentName="Debug Panel">
            <CodeLabDebugPanel
              sessionId={currentSessionId}
              token={currentSessionId}
              workspaceId={currentSessionId}
              onAIAnalysis={onAIAnalysis}
            />
          </CodeLabComponentBoundary>
        )}
        {activeTab === 'plan' &&
          (currentPlan ? (
            <CodeLabPlanView
              plan={currentPlan}
              onApprove={async () => {
                const res = await fetch('/api/code-lab/plan', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    action: 'approve',
                    sessionId: currentSessionId,
                  }),
                });
                if (res.ok) {
                  const data = await res.json();
                  setCurrentPlan(data.plan);
                }
              }}
              onSkipStep={async (reason) => {
                const res = await fetch('/api/code-lab/plan', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    action: 'skip',
                    reason,
                    sessionId: currentSessionId,
                  }),
                });
                if (res.ok) {
                  const data = await res.json();
                  setCurrentPlan(data.plan);
                }
              }}
              onCancelPlan={async () => {
                const res = await fetch('/api/code-lab/plan', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ action: 'cancel', sessionId: currentSessionId }),
                });
                if (res.ok) {
                  setCurrentPlan(null);
                }
              }}
            />
          ) : (
            <div className="plan-empty">
              <div className="plan-empty-icon">📋</div>
              <h3>No Active Plan</h3>
              <p>Claude will create a plan when tackling complex tasks.</p>
              <p className="hint">Plans break down work into trackable steps.</p>
            </div>
          ))}
        {activeTab === 'memory' && (
          <CodeLabComponentBoundary componentName="Memory Editor">
            <CodeLabMemoryEditor
              memoryFile={memoryFile}
              onSave={onSaveMemory}
              onLoad={onLoadMemory}
              isLoading={memoryLoading}
            />
          </CodeLabComponentBoundary>
        )}
        {activeTab === 'tasks' && (
          <div className="tasks-panel">
            <div className="tasks-header">
              <h3>Background Tasks</h3>
              <span className="tasks-hint">
                Ctrl+B to spawn • Like Claude Code parallel execution
              </span>
            </div>
            {backgroundAgents.length === 0 ? (
              <div className="tasks-empty">
                <p>No background tasks running</p>
                <p className="hint">
                  Background agents allow parallel task execution.
                  <br />
                  Claude will automatically spawn agents for complex tasks.
                </p>
              </div>
            ) : (
              <div className="tasks-list">
                {backgroundAgents.map((agent) => (
                  <div key={agent.id} className={`task-item ${agent.status}`}>
                    <div className="task-header">
                      <span className="task-name">{agent.name}</span>
                      <span className={`task-status ${agent.status}`}>
                        {agent.status === 'running' && '⏳'}
                        {agent.status === 'completed' && '✓'}
                        {agent.status === 'failed' && '✗'}
                        {agent.status}
                      </span>
                    </div>
                    <div className="task-time">Started {agent.startedAt.toLocaleTimeString()}</div>
                    {agent.output && <pre className="task-output">{agent.output}</pre>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      {currentSession?.repo && (
        <div className="workspace-git-actions">
          <button onClick={onGitPull} className="git-btn pull" aria-label="Git pull from remote">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
              />
            </svg>
            Pull
          </button>
          <button onClick={onGitPush} className="git-btn push" aria-label="Git push to remote">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
              />
            </svg>
            Push
          </button>
        </div>
      )}
    </div>
  );
}

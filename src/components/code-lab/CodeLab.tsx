'use client';

/** CODE LAB — Main layout component orchestrating hooks and sub-components. */

import { useState } from 'react';
import './code-lab.css';

import { CodeLabSidebar } from './CodeLabSidebar';
import { CodeLabThread } from './CodeLabThread';
import { CodeLabComposer } from './CodeLabComposer';
import { CodeLabCommandPalette } from './CodeLabCommandPalette';
import { CodeLabKeyboardShortcuts } from './CodeLabKeyboardShortcuts';
import { CodeLabTokenDisplay } from './CodeLabTokenDisplay';
export { CodeLabThinkingBlock, parseThinkingBlocks } from './CodeLabThinkingBlock';
import { CodeLabStatusBar } from './CodeLabStatusBar';
import { CodeLabWorkspacePanel } from './CodeLabWorkspacePanel';
import { useKeyboardShortcuts } from './useKeyboardShortcuts';
import { useSessionManager } from './useSessionManager';
import { useWorkspaceManager } from './useWorkspaceManager';
import { useMessenger } from './useMessenger';
import { useBackgroundAgents } from './useBackgroundAgents';
import { CodeLabPermissionDialog, usePermissionManager } from './CodeLabPermissionDialog';
import {
  CodeLabFileChangeIndicator,
  useFileChangeNotifications,
} from './CodeLabFileChangeIndicator';
import { CodeLabSessionHistory } from './CodeLabSessionHistory';

interface CodeLabProps {
  userId?: string;
}

export function CodeLab({ userId: _userId }: CodeLabProps) {
  const {
    sessions,
    setSessions,
    currentSessionId,
    setCurrentSessionId,
    currentSession,
    messages,
    setMessages,
    isLoading,
    setError,
    createSession,
    selectSession,
    deleteSession,
    renameSession,
    exportSession,
    setSessionRepo,
  } = useSessionManager();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const {
    pendingRequest: permissionRequest,
    isDialogOpen: permissionDialogOpen,
    requestPermission,
    handleAllow: handlePermissionAllow,
    handleDeny: handlePermissionDeny,
  } = usePermissionManager();

  const {
    hasChanges: hasFileChanges,
    clearChanges: clearFileChanges,
    dismissChanges: dismissFileChanges,
  } = useFileChangeNotifications(currentSessionId);

  const [workspacePanelOpen, setWorkspacePanelOpen] = useState(false);
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<
    'files' | 'diff' | 'deploy' | 'visual' | 'debug' | 'plan' | 'memory' | 'tasks'
  >('files');

  const { backgroundAgents } = useBackgroundAgents();

  const {
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
  } = useWorkspaceManager({
    currentSessionId,
    currentSession,
    setError,
    requestPermission,
  });

  const {
    isStreaming,
    currentModelId,
    thinkingConfig,
    modelSwitchFlash,
    handleModelChange,
    activeAgent,
    strategyLoading,
    deepResearchLoading,
    handleAgentSelect,
    handleCreativeMode,
    tokenStats,
    sendMessage,
    cancelStream,
    handleSlashCommand,
    handlePaletteMessage,
  } = useMessenger({
    currentSessionId,
    currentSession,
    sessions,
    setSessions,
    messages,
    setMessages,
    setError,
    createSession,
    fetchPlanStatus,
  });

  useKeyboardShortcuts({
    isStreaming,
    sidebarCollapsed,
    createSession,
    cancelStream,
    setSidebarCollapsed,
    setCommandPaletteOpen,
    setShortcutsOpen,
    setHistoryOpen,
    setWorkspacePanelOpen,
    setActiveWorkspaceTab,
  });

  return (
    <div className="code-lab">
      {/* Mobile backdrop when sidebar open */}
      {!sidebarCollapsed && (
        <div className="mobile-backdrop" onClick={() => setSidebarCollapsed(true)} />
      )}

      {/* Sidebar - Sessions & Repo */}
      <CodeLabSidebar
        sessions={sessions}
        currentSessionId={currentSessionId}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        onCreateSession={createSession}
        onSelectSession={selectSession}
        onDeleteSession={deleteSession}
        onRenameSession={renameSession}
        onSetRepo={setSessionRepo}
        onExportSession={exportSession}
        currentRepo={currentSession?.repo}
        currentCodeChanges={currentSession?.codeChanges}
      />

      {/* Main Content Area */}
      <main className="code-lab-main">
        {/* Mobile header with menu button */}
        <div className="mobile-header">
          <button className="mobile-menu-btn" onClick={() => setSidebarCollapsed(false)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
              />
            </svg>
          </button>
          <span className="mobile-title">{currentSession?.title || 'Code Lab'}</span>
          <div className="header-actions">
            <CodeLabTokenDisplay stats={tokenStats} compact />
            <button
              className={`header-btn ${workspacePanelOpen ? 'active' : ''}`}
              onClick={() => setWorkspacePanelOpen(!workspacePanelOpen)}
              title="Workspace Panel (Cmd+E)"
              aria-label="Toggle Workspace Panel"
              aria-pressed={workspacePanelOpen}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z"
                />
              </svg>
            </button>
          </div>
        </div>
        {currentSessionId ? (
          <div className="code-lab-content">
            <div className={`chat-area ${workspacePanelOpen ? 'with-panel' : ''}`}>
              {/* Thread - Messages */}
              <CodeLabThread
                messages={messages}
                isLoading={isLoading}
                isStreaming={isStreaming}
                sessionTitle={currentSession?.title || 'Session'}
                repo={currentSession?.repo}
              />

              {/* Composer - Input with inline model selector */}
              <CodeLabComposer
                onSend={sendMessage}
                isStreaming={isStreaming}
                onCancel={cancelStream}
                placeholder="Ask anything, build anything..."
                disabled={!currentSessionId}
                currentModel={currentModelId}
                onModelChange={handleModelChange}
                thinkingEnabled={thinkingConfig.enabled}
                modelSwitchFlash={modelSwitchFlash}
                // Agent buttons (Deep Research, Deep Strategy, Research)
                activeAgent={activeAgent}
                onAgentSelect={handleAgentSelect}
                strategyLoading={strategyLoading}
                deepResearchLoading={deepResearchLoading}
                // Creative tools (Create Image, Edit Image)
                onCreativeMode={handleCreativeMode}
              />
            </div>

            {/* Workspace Panel */}
            {workspacePanelOpen && currentSessionId && (
              <CodeLabWorkspacePanel
                activeTab={activeWorkspaceTab}
                setActiveTab={setActiveWorkspaceTab}
                onClose={() => setWorkspacePanelOpen(false)}
                currentSessionId={currentSessionId}
                currentSession={currentSession}
                workspaceFiles={workspaceFiles}
                selectedFile={selectedFile}
                onFileSelect={handleFileSelect}
                onFileCreate={handleFileCreate}
                onFileDelete={handleFileDelete}
                onRefreshFiles={() => {
                  if (currentSessionId) loadWorkspaceFiles(currentSessionId);
                }}
                diffFiles={diffFiles}
                onDeploy={handleDeploy}
                onVisualToCode={handleVisualToCode}
                onInsertCode={(code) =>
                  sendMessage(`/create file with this code:\n\`\`\`\n${code}\n\`\`\``)
                }
                onAIAnalysis={(debugState) => {
                  const debugContext = JSON.stringify(debugState, null, 2);
                  sendMessage(
                    `/analyze this debug state and help me understand what's happening:\n\`\`\`json\n${debugContext}\n\`\`\``
                  );
                }}
                currentPlan={currentPlan}
                setCurrentPlan={setCurrentPlan}
                fetchPlanStatus={fetchPlanStatus}
                memoryFile={memoryFile}
                onSaveMemory={saveMemoryFile}
                onLoadMemory={loadMemoryFile}
                memoryLoading={memoryLoading}
                backgroundAgents={backgroundAgents}
                onGitPull={handleGitPull}
                onGitPush={handleGitPush}
              />
            )}
          </div>
        ) : (
          // Empty state
          <div className="code-lab-empty">
            <div className="code-lab-empty-content">
              <div className="code-lab-empty-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5"
                  />
                </svg>
              </div>
              <h2>Code Lab</h2>
              <p>Your professional coding workspace</p>
              <button onClick={() => createSession()} className="code-lab-empty-btn">
                Start New Session
              </button>
            </div>
          </div>
        )}

        {/* Status Bar - Professional status visibility (Claude Code parity) */}
        {currentSessionId && (
          <CodeLabStatusBar
            model={
              currentModelId.includes('opus')
                ? 'opus'
                : currentModelId.includes('haiku')
                  ? 'haiku'
                  : 'sonnet'
            }
            tokens={{
              used: tokenStats.totalInputTokens + tokenStats.totalOutputTokens,
              limit: 200000,
              costUSD: tokenStats.totalCost.totalCost,
            }}
            connectionStatus="connected"
            sandboxStatus={currentSession?.repo ? 'active' : 'stopped'}
            git={
              currentSession?.repo
                ? {
                    branch: currentSession.repo.branch || 'main',
                    isDirty: false,
                  }
                : undefined
            }
            mcpServersActive={0}
            onModelClick={() => {
              /* Model selector handles this */
            }}
            onTokensClick={() => setWorkspacePanelOpen(true)}
          />
        )}
      </main>

      <CodeLabCommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onExecuteSlashCommand={handleSlashCommand}
        onSendMessage={handlePaletteMessage}
      />

      <CodeLabKeyboardShortcuts isOpen={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />

      <CodeLabSessionHistory
        isOpen={historyOpen}
        onClose={() => setHistoryOpen(false)}
        onSelectSession={(sessionId) => {
          setCurrentSessionId(sessionId);
          setHistoryOpen(false);
        }}
        currentSessionId={currentSessionId}
      />

      {hasFileChanges && (
        <CodeLabFileChangeIndicator
          sessionId={currentSessionId}
          workspaceActive={!!currentSession?.repo}
          onRefresh={() => {
            if (currentSessionId) {
              loadWorkspaceFiles(currentSessionId);
            }
            clearFileChanges();
          }}
          onDismiss={dismissFileChanges}
        />
      )}

      <CodeLabPermissionDialog
        request={permissionRequest}
        onAllow={handlePermissionAllow}
        onDeny={handlePermissionDeny}
        isOpen={permissionDialogOpen}
      />
    </div>
  );
}

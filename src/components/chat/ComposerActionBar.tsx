'use client';

import { RefObject } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { CreativeButton, type CreativeMode } from './CreativeButton';
import { ComposerAgentsMenu } from './ComposerAgentsMenu';
import type { ToolMode } from './ChatComposer';

export const TOOL_MODE_INFO: Record<string, { label: string; color: string }> = {
  search: { label: 'Web Search', color: '#3b82f6' },
  factcheck: { label: 'Fact Check', color: '#10b981' },
  research: { label: 'Deep Research', color: '#8b5cf6' },
};

interface ComposerActionBarProps {
  isStreaming: boolean;
  disabled?: boolean;
  toolMode: ToolMode;
  onClearToolMode: () => void;
  activeAgent?:
    | 'research'
    | 'strategy'
    | 'deep-research'
    | 'quick-research'
    | 'quick-strategy'
    | 'deep-writer'
    | 'quick-writer'
    | null;
  onAgentSelect?: (
    agent:
      | 'research'
      | 'strategy'
      | 'deep-research'
      | 'quick-research'
      | 'quick-strategy'
      | 'deep-writer'
      | 'quick-writer'
  ) => Promise<void> | void;
  strategyLoading?: boolean;
  deepResearchLoading?: boolean;
  deepWriterLoading?: boolean;
  quickWriterLoading?: boolean;
  onToggleAttachMenu: () => void;
  showAgentsMenu: boolean;
  onToggleAgentsMenu: () => void;
  onCloseAgentsMenu: () => void;
  agentsButtonRef: RefObject<HTMLButtonElement>;
  cameraInputRef: RefObject<HTMLInputElement>;
  photoInputRef: RefObject<HTMLInputElement>;
  fileInputRef: RefObject<HTMLInputElement>;
  handleFileSelect: (files: FileList | null) => void;
  onCreativeMode?: (mode: 'create-image' | 'edit-image' | 'view-gallery') => void;
  creativeMode: CreativeMode | null;
  onCreativeModeInternal: (mode: CreativeMode) => void;
  isVoiceSupported: boolean;
  isRecording: boolean;
  isTranscribing: boolean;
  toggleRecording: () => void;
  canSend: boolean;
  onSend: () => void;
  onStop?: () => void;
}

export function ComposerActionBar({
  isStreaming,
  disabled,
  toolMode,
  onClearToolMode,
  activeAgent,
  onAgentSelect,
  strategyLoading,
  deepResearchLoading,
  deepWriterLoading,
  quickWriterLoading,
  onToggleAttachMenu,
  showAgentsMenu,
  onToggleAgentsMenu,
  onCloseAgentsMenu,
  agentsButtonRef,
  cameraInputRef,
  photoInputRef,
  fileInputRef,
  handleFileSelect,
  onCreativeMode,
  creativeMode,
  onCreativeModeInternal,
  isVoiceSupported,
  isRecording,
  isTranscribing,
  toggleRecording,
  canSend,
  onSend,
  onStop,
}: ComposerActionBarProps) {
  const { theme } = useTheme();
  const toolInfo = toolMode !== 'none' ? TOOL_MODE_INFO[toolMode] : null;

  return (
    <div className="flex items-center justify-between px-2 pb-2">
      <div className="flex items-center gap-2">
        {/* Hidden file inputs */}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(e) => handleFileSelect(e.target.files)}
          className="hidden"
        />
        <input
          ref={photoInputRef}
          type="file"
          multiple
          accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
          onChange={(e) => handleFileSelect(e.target.files)}
          className="hidden"
        />
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.txt,.csv,.xlsx,.xls"
          onChange={(e) => handleFileSelect(e.target.files)}
          className="hidden"
        />

        {/* Attachment button */}
        <button
          onClick={onToggleAttachMenu}
          disabled={isStreaming || disabled}
          className="rounded-full p-2 disabled:opacity-50 flex items-center justify-center transition-colors hover:bg-white/10 text-text-muted"
          aria-label="Attach files"
          title="Attach files"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
            />
          </svg>
        </button>

        {/* Active tool mode indicator */}
        {toolMode !== 'none' && toolMode !== 'research' && toolInfo && (
          <div
            className="flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium"
            style={{ backgroundColor: `${toolInfo.color}20`, color: toolInfo.color }}
          >
            <span>{toolInfo.label}</span>
            <button
              onClick={onClearToolMode}
              className="ml-1 hover:opacity-70"
              aria-label="Clear tool mode"
              title="Clear"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        )}

        {/* Agents dropdown */}
        {onAgentSelect && (
          <ComposerAgentsMenu
            isOpen={showAgentsMenu}
            onToggle={onToggleAgentsMenu}
            onClose={onCloseAgentsMenu}
            activeAgent={activeAgent}
            onAgentSelect={onAgentSelect}
            toolMode={toolMode}
            onClearToolMode={onClearToolMode}
            isStreaming={isStreaming}
            disabled={disabled}
            strategyLoading={strategyLoading}
            deepResearchLoading={deepResearchLoading}
            deepWriterLoading={deepWriterLoading}
            quickWriterLoading={quickWriterLoading}
            buttonRef={agentsButtonRef}
          />
        )}

        {/* Creative button */}
        <CreativeButton
          disabled={isStreaming || disabled}
          activeMode={creativeMode}
          onSelect={(mode) => {
            if (onCreativeMode) {
              onCreativeMode(mode);
              return;
            }
            onCreativeModeInternal(mode);
          }}
        />
      </div>

      {/* Right side - mic and send */}
      <div className="flex items-center gap-1">
        {isVoiceSupported && (
          <button
            onClick={toggleRecording}
            disabled={isStreaming || disabled || isTranscribing}
            className="rounded-full p-1.5 transition-all flex items-center justify-center"
            aria-label={
              isRecording
                ? 'Stop recording'
                : isTranscribing
                  ? 'Transcribing audio'
                  : 'Start voice input'
            }
            title={
              isRecording ? 'Stop recording' : isTranscribing ? 'Transcribing...' : 'Voice input'
            }
            style={{
              backgroundColor: isRecording ? 'var(--error, #ef4444)' : 'transparent',
              color: isRecording
                ? 'white'
                : isTranscribing
                  ? 'var(--primary)'
                  : 'var(--text-muted)',
            }}
          >
            {isTranscribing ? (
              <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            ) : (
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                />
              </svg>
            )}
          </button>
        )}

        {isStreaming && onStop ? (
          <button
            onClick={onStop}
            className="rounded-full p-2 transition-all flex items-center justify-center bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-600/30"
            aria-label="Stop generating response"
            title="Stop generating (Esc)"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
              <rect x="6" y="6" width="12" height="12" rx="2" fill="white" />
            </svg>
          </button>
        ) : (
          <button
            onClick={onSend}
            disabled={!canSend}
            className={`rounded-full p-2 transition-all flex items-center justify-center send-btn ${!canSend ? 'send-btn-disabled bg-btn-disabled text-text-muted' : 'send-btn-enabled bg-primary'}`}
            aria-label="Send message"
            title="Send message"
            style={canSend ? { color: theme === 'light' ? 'white' : 'black' } : undefined}
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

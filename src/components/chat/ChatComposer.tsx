/**
 * CHAT COMPOSER COMPONENT
 *
 * PURPOSE:
 * - Text input with auto-resize
 * - File attachment with thumbnails or count badge
 * - Send message with keyboard shortcuts
 * - File upload validation (MIME, size)
 */

'use client';

import { useState, useRef, useEffect, memo, KeyboardEvent, ChangeEvent } from 'react';
import type { Attachment, Message, GeneratedImage } from '@/app/chat/types';
import { useVoiceInput } from '@/hooks/useVoiceInput';
import { useCodeExecutionOptional } from '@/contexts/CodeExecutionContext';
import { useTheme } from '@/contexts/ThemeContext';
import {
  CreativeButton,
  CreateImageModal,
  EditImageModal,
  GenerationGallery,
  type CreativeMode,
} from './CreativeButton';
import type { ProviderId } from '@/lib/ai/providers';
import { ComposerAgentsMenu } from './ComposerAgentsMenu';
import { ComposerProviderMenu } from './ComposerProviderMenu';
import { ComposerAttachmentPreview } from './ComposerAttachmentPreview';
import { ComposerAttachmentMenu } from './ComposerAttachmentMenu';
import { useFileUpload } from './useFileUpload';

// Tool mode types - search and research tools only
export type ToolMode = 'none' | 'search' | 'factcheck' | 'research';

// Legacy alias for backwards compatibility
export type SearchMode = ToolMode;

// Selected repo info passed to API
export interface SelectedRepoInfo {
  owner: string;
  repo: string;
  fullName: string;
  defaultBranch: string;
}

interface ChatComposerProps {
  onSendMessage: (
    content: string,
    attachments: Attachment[],
    searchMode?: SearchMode,
    selectedRepo?: SelectedRepoInfo | null
  ) => void;
  onStop?: () => void;
  isStreaming: boolean;
  disabled?: boolean;
  replyingTo?: Message | null;
  onClearReply?: () => void;
  initialText?: string;
  isAdmin?: boolean;
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
  quickResearchLoading?: boolean;
  quickStrategyLoading?: boolean;
  deepWriterLoading?: boolean;
  quickWriterLoading?: boolean;
  openCreateImage?: boolean;
  openEditImage?: boolean;
  onCloseCreateImage?: () => void;
  onCloseEditImage?: () => void;
  onCreativeMode?: (mode: 'create-image' | 'edit-image' | 'view-gallery') => void;
  conversationId?: string;
  onImageGenerated?: (image: GeneratedImage) => void;
  selectedProvider?: ProviderId;
  onProviderChange?: (provider: ProviderId) => void;
  configuredProviders?: ProviderId[];
}

// Rotating placeholder suggestions
const PLACEHOLDER_SUGGESTIONS = [
  'Type your message...',
  'Write a resume...',
  'Draft an email...',
  'Analyze data...',
  'Generate an invoice...',
  'Translate text...',
  'Research a topic...',
  'Write code...',
  'Plan a trip...',
];

// Tool mode display info
const TOOL_MODE_INFO: Record<string, { label: string; color: string }> = {
  search: { label: 'Web Search', color: '#3b82f6' },
  factcheck: { label: 'Fact Check', color: '#10b981' },
  research: { label: 'Deep Research', color: '#8b5cf6' },
};

export const ChatComposer = memo(function ChatComposer({
  onSendMessage,
  onStop,
  isStreaming,
  disabled,
  replyingTo,
  onClearReply,
  initialText,
  isAdmin,
  activeAgent,
  onAgentSelect,
  strategyLoading,
  deepResearchLoading,
  quickResearchLoading: _quickResearchLoading,
  quickStrategyLoading: _quickStrategyLoading,
  deepWriterLoading,
  quickWriterLoading,
  openCreateImage,
  openEditImage,
  onCloseCreateImage,
  onCloseEditImage,
  onCreativeMode,
  conversationId,
  onImageGenerated,
  selectedProvider = 'claude',
  onProviderChange,
  configuredProviders = ['claude'],
}: ChatComposerProps) {
  const codeExecution = useCodeExecutionOptional();
  const selectedRepo = codeExecution?.selectedRepo;
  const { theme } = useTheme();

  const [message, setMessage] = useState('');
  const {
    attachments,
    isDragging,
    fileError,
    handleFileSelect,
    removeAttachment,
    clearAttachments,
    handleDragOver,
    handleDragLeave,
    handleDrop,
  } = useFileUpload();
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [toolMode, setToolMode] = useState<ToolMode>('none');
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [displayedText, setDisplayedText] = useState('');
  const [charIndex, setCharIndex] = useState(0);
  const [initialDelayComplete, setInitialDelayComplete] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [showAgentsMenu, setShowAgentsMenu] = useState(false);
  const agentsButtonRef = useRef<HTMLButtonElement>(null);
  const [showProviderMenu, setShowProviderMenu] = useState(false);
  const [creativeMode, setCreativeMode] = useState<CreativeMode | null>(null);
  const [showCreateImageModal, setShowCreateImageModal] = useState(false);
  const [showEditImageModal, setShowEditImageModal] = useState(false);
  const [showGalleryModal, setShowGalleryModal] = useState(false);
  const lastInitialTextRef = useRef<string | undefined>(undefined);

  const {
    isRecording,
    isProcessing: isTranscribing,
    toggleRecording,
    isSupported: isVoiceSupported,
  } = useVoiceInput({
    onTranscript: (text) => setMessage((prev) => (prev ? `${prev} ${text}` : text)),
    onError: (error) => console.error('[Voice] Transcription error:', error),
  });

  useEffect(() => {
    if (openCreateImage) setShowCreateImageModal(true);
  }, [openCreateImage]);
  useEffect(() => {
    if (openEditImage) setShowEditImageModal(true);
  }, [openEditImage]);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (textareaRef.current && !disabled && !isStreaming) textareaRef.current.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (initialText && initialText !== lastInitialTextRef.current) {
      lastInitialTextRef.current = initialText;
      setMessage(initialText);
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(initialText.length, initialText.length);
      }
    }
  }, [initialText]);

  useEffect(() => {
    const timer = setTimeout(() => setInitialDelayComplete(true), 1500);
    return () => clearTimeout(timer);
  }, []);

  // Typewriter effect
  useEffect(() => {
    if (!initialDelayComplete || isFocused || message) return;
    const currentText = PLACEHOLDER_SUGGESTIONS[placeholderIndex % PLACEHOLDER_SUGGESTIONS.length];
    if (charIndex < currentText.length) {
      const timer = setTimeout(() => {
        setDisplayedText(currentText.slice(0, charIndex + 1));
        setCharIndex(charIndex + 1);
      }, 50);
      return () => clearTimeout(timer);
    } else {
      const timer = setTimeout(() => {
        setPlaceholderIndex((prev) => (prev + 1) % PLACEHOLDER_SUGGESTIONS.length);
        setDisplayedText('');
        setCharIndex(0);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [charIndex, placeholderIndex, isFocused, message, initialDelayComplete]);

  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
  };

  useEffect(() => {
    adjustTextareaHeight();
  }, [message]);

  const handleInputChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
    adjustTextareaHeight();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (e.key === 'Enter' && !e.shiftKey && !isMobile) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = () => {
    if ((!message.trim() && attachments.length === 0) || isStreaming || disabled || strategyLoading)
      return;
    const repoInfo = selectedRepo
      ? {
          owner: selectedRepo.owner,
          repo: selectedRepo.name,
          fullName: selectedRepo.fullName,
          defaultBranch: selectedRepo.defaultBranch,
        }
      : null;
    onSendMessage(message.trim(), attachments, toolMode, repoInfo);
    setMessage('');
    clearAttachments();
    setToolMode('none');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (photoInputRef.current) photoInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  // Get placeholder text based on tool mode or active agent
  const getPlaceholderText = (): string => {
    if (activeAgent === 'strategy') return 'Describe your complex problem or decision...';
    if (activeAgent === 'deep-research') return 'What topic do you want to research in depth?';
    if (toolMode === 'search') return 'Search the web...';
    if (toolMode === 'factcheck') return 'What do you want to fact check?';
    if (toolMode === 'research') return 'What would you like to research?';
    return '';
  };

  const toolInfo = toolMode !== 'none' ? TOOL_MODE_INFO[toolMode] : null;
  const placeholderText = getPlaceholderText();
  const hasContent = message.trim() || attachments.length > 0;
  const canSend = hasContent && !isStreaming && !disabled;

  return (
    <div className="py-2 px-2 md:px-4 md:py-3 pb-safe">
      <div className="mx-auto max-w-3xl">
        {/* Reply Preview */}
        {replyingTo && (
          <div className="mb-2 flex items-start gap-2 p-3 rounded-lg border border-primary bg-primary-hover">
            <svg
              className="h-4 w-4 mt-0.5 flex-shrink-0 text-primary"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
              />
            </svg>
            <div className="flex-1 min-w-0">
              <span className="text-xs font-semibold text-primary">Replying to:</span>
              <p className="text-sm mt-1 line-clamp-2 text-text-primary">
                {replyingTo.content.length > 150
                  ? replyingTo.content.slice(0, 150) + '...'
                  : replyingTo.content}
              </p>
            </div>
            <button
              onClick={onClearReply}
              className="p-1.5 rounded-full transition-colors flex-shrink-0 text-text-muted"
              aria-label="Cancel reply"
              title="Cancel reply"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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

        <ComposerAttachmentPreview attachments={attachments} onRemove={removeAttachment} />

        {/* Input Area */}
        <div
          className={`chat-input-glass relative rounded-3xl transition-all ${isDragging ? 'opacity-80' : ''}`}
          style={{ backgroundColor: 'var(--chat-input-bg)' }}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="relative">
            {/* Typewriter placeholder overlay */}
            {!isFocused && !message && !isDragging && (
              <div className="absolute inset-0 flex items-center pointer-events-none px-4 py-3 text-base">
                {isRecording ? (
                  <span className="font-medium text-text-muted">Recording...</span>
                ) : isTranscribing ? (
                  <span className="font-medium text-text-muted">Transcribing...</span>
                ) : placeholderText ? (
                  <span
                    className="font-medium"
                    style={{
                      color:
                        toolInfo?.color ||
                        (activeAgent === 'strategy'
                          ? '#a855f7'
                          : activeAgent === 'deep-research'
                            ? '#10b981'
                            : 'var(--primary)'),
                    }}
                  >
                    {placeholderText}
                  </span>
                ) : (
                  <span className="font-medium text-text-muted">
                    {displayedText}
                    <span className="animate-pulse">|</span>
                  </span>
                )}
              </div>
            )}
            <textarea
              ref={textareaRef}
              value={message}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder={isDragging ? 'Drop files here...' : ''}
              className="w-full resize-none bg-transparent px-4 py-3 text-base focus:outline-none min-h-[48px] text-text-primary"
              rows={1}
              disabled={isStreaming || disabled}
            />
          </div>

          {/* Action Bar */}
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
                onClick={() => setShowAttachMenu(!showAttachMenu)}
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

              {/* AI Provider selector - admin only */}
              {isAdmin && onProviderChange && (
                <ComposerProviderMenu
                  isOpen={showProviderMenu}
                  onToggle={() => setShowProviderMenu(!showProviderMenu)}
                  onClose={() => setShowProviderMenu(false)}
                  selectedProvider={selectedProvider}
                  onProviderChange={onProviderChange}
                  configuredProviders={configuredProviders}
                  isStreaming={isStreaming}
                  disabled={disabled}
                />
              )}

              {/* Active tool mode indicator */}
              {toolMode !== 'none' && toolMode !== 'research' && toolInfo && (
                <div
                  className="flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium"
                  style={{ backgroundColor: `${toolInfo.color}20`, color: toolInfo.color }}
                >
                  <span>{toolInfo.label}</span>
                  <button
                    onClick={() => setToolMode('none')}
                    className="ml-1 hover:opacity-70"
                    aria-label="Clear tool mode"
                    title="Clear"
                  >
                    <svg
                      className="h-3.5 w-3.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
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
                  onToggle={() => setShowAgentsMenu(!showAgentsMenu)}
                  onClose={() => setShowAgentsMenu(false)}
                  activeAgent={activeAgent}
                  onAgentSelect={onAgentSelect}
                  toolMode={toolMode}
                  onClearToolMode={() => setToolMode('none')}
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
                  if (mode === 'view-gallery') {
                    setShowGalleryModal(true);
                  } else {
                    setCreativeMode(mode);
                    if (mode === 'create-image') setShowCreateImageModal(true);
                    else if (mode === 'edit-image') setShowEditImageModal(true);
                  }
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
                    isRecording
                      ? 'Stop recording'
                      : isTranscribing
                        ? 'Transcribing...'
                        : 'Voice input'
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
                  className="rounded-full p-2 transition-all flex items-center justify-center bg-primary text-white"
                  aria-label="Stop generating response"
                  title="Stop generating"
                >
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                    <rect x="6" y="6" width="12" height="12" rx="2" />
                  </svg>
                </button>
              ) : (
                <button
                  onClick={handleSend}
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
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 10l7-7m0 0l7 7m-7-7v18"
                    />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>

        {fileError && <p className="mt-0 text-xs text-red-400">⚠️ {fileError}</p>}
      </div>

      {/* Attachment menu portal */}
      {isMounted && (
        <ComposerAttachmentMenu
          isOpen={showAttachMenu}
          onClose={() => setShowAttachMenu(false)}
          cameraInputRef={cameraInputRef}
          photoInputRef={photoInputRef}
          fileInputRef={fileInputRef}
        />
      )}

      {/* Creative Modals */}
      <CreateImageModal
        isOpen={showCreateImageModal}
        onClose={() => {
          setShowCreateImageModal(false);
          setCreativeMode(null);
          onCloseCreateImage?.();
        }}
        conversationId={conversationId}
        onImageGenerated={onImageGenerated}
      />
      <EditImageModal
        isOpen={showEditImageModal}
        onClose={() => {
          setShowEditImageModal(false);
          setCreativeMode(null);
          onCloseEditImage?.();
        }}
        conversationId={conversationId}
        onImageGenerated={onImageGenerated}
      />
      <GenerationGallery
        isOpen={showGalleryModal}
        onClose={() => setShowGalleryModal(false)}
        onReusePrompt={(prompt) => {
          setMessage(prompt);
          setShowGalleryModal(false);
          setCreativeMode('create-image');
          setShowCreateImageModal(true);
        }}
      />
    </div>
  );
});

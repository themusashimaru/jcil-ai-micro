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

import { useState, useRef, useEffect, useCallback, memo, KeyboardEvent, ChangeEvent } from 'react';
import type { Attachment, Message, GeneratedImage } from '@/app/chat/types';
import { useVoiceInput } from '@/hooks/useVoiceInput';
import { useToastActions } from '@/components/ui/Toast';
import { useCodeExecutionOptional } from '@/contexts/CodeExecutionContext';
import { ComposerAttachmentPreview } from './ComposerAttachmentPreview';
import { ComposerAttachmentMenu } from './ComposerAttachmentMenu';
import { useFileUpload } from './useFileUpload';
import { useTypewriterPlaceholder } from './useTypewriterPlaceholder';
import { ComposerActionBar, TOOL_MODE_INFO } from './ComposerActionBar';
import { ComposerReplyPreview } from './ComposerReplyPreview';
import { ComposerCreativeModals } from './ComposerCreativeModals';

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
  openCreateImage?: boolean;
  openEditImage?: boolean;
  onCloseCreateImage?: () => void;
  onCloseEditImage?: () => void;
  onCreativeMode?: (mode: 'create-image' | 'edit-image' | 'view-gallery') => void;
  conversationId?: string;
  onImageGenerated?: (image: GeneratedImage) => void;
}

export const ChatComposer = memo(function ChatComposer({
  onSendMessage,
  onStop,
  isStreaming,
  disabled,
  replyingTo,
  onClearReply,
  initialText,
  openCreateImage,
  openEditImage,
  onCloseCreateImage,
  onCloseEditImage,
  onCreativeMode,
  conversationId,
  onImageGenerated,
}: ChatComposerProps) {
  const codeExecution = useCodeExecutionOptional();
  const selectedRepo = codeExecution?.selectedRepo;

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
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [showCreateImageModal, setShowCreateImageModal] = useState(false);
  const [showEditImageModal, setShowEditImageModal] = useState(false);
  const [showGalleryModal, setShowGalleryModal] = useState(false);
  const lastInitialTextRef = useRef<string | undefined>(undefined);

  const { displayedText } = useTypewriterPlaceholder(isFocused, message);
  const toast = useToastActions();

  const handleVoiceError = useCallback(
    (error: string) => {
      toast.error(error);
    },
    [toast]
  );

  const {
    isRecording,
    isProcessing: isTranscribing,
    toggleRecording,
    isSupported: isVoiceSupported,
  } = useVoiceInput({
    onTranscript: (text) => setMessage((prev) => (prev ? `${prev} ${text}` : text)),
    onError: handleVoiceError,
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
    if ((!message.trim() && attachments.length === 0) || isStreaming || disabled) return;
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

  const getPlaceholderText = (): string => {
    if (toolMode === 'search') return 'Search the web...';
    if (toolMode === 'factcheck') return 'What do you want to fact check?';
    if (toolMode === 'research') return 'What would you like to research?';
    return '';
  };

  const toolInfo = toolMode !== 'none' ? TOOL_MODE_INFO[toolMode] : null;
  const placeholderText = getPlaceholderText();
  const hasContent = message.trim() || attachments.length > 0;
  const canSend = hasContent && !isStreaming && !disabled;

  const handleCreativeModeInternal = (mode: 'create-image' | 'edit-image' | 'view-gallery') => {
    if (mode === 'view-gallery') {
      setShowGalleryModal(true);
    } else {
      if (mode === 'create-image') setShowCreateImageModal(true);
      else if (mode === 'edit-image') setShowEditImageModal(true);
    }
  };

  return (
    <div className="py-2 px-2 md:px-4 lg:px-8 md:py-3 pb-safe">
      <div className="mx-auto max-w-3xl lg:max-w-3xl">
        {replyingTo && <ComposerReplyPreview replyingTo={replyingTo} onClearReply={onClearReply} />}

        <ComposerAttachmentPreview attachments={attachments} onRemove={removeAttachment} />

        <div
          className={`chat-input-glass relative rounded-3xl transition-all bg-[var(--chat-input-bg)] ${isDragging ? 'opacity-80' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="relative">
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
                      color: toolInfo?.color || 'var(--primary)',
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
              aria-label="Type your message"
              aria-describedby={fileError ? 'file-upload-error' : undefined}
              className="w-full resize-none bg-transparent px-4 py-3 text-base focus:outline-none min-h-[48px] text-text-primary"
              rows={1}
              disabled={isStreaming || disabled}
            />
          </div>

          <ComposerActionBar
            isStreaming={isStreaming}
            disabled={disabled}
            toolMode={toolMode}
            onClearToolMode={() => setToolMode('none')}
            onToggleAttachMenu={() => setShowAttachMenu(!showAttachMenu)}
            cameraInputRef={cameraInputRef}
            photoInputRef={photoInputRef}
            fileInputRef={fileInputRef}
            handleFileSelect={handleFileSelect}
            onCreativeMode={onCreativeMode}
            onCreativeModeInternal={handleCreativeModeInternal}
            isVoiceSupported={isVoiceSupported}
            isRecording={isRecording}
            isTranscribing={isTranscribing}
            toggleRecording={toggleRecording}
            canSend={!!canSend}
            onSend={handleSend}
            onStop={onStop}
          />
        </div>

        {fileError && (
          <p
            id="file-upload-error"
            role="alert"
            className="mt-1 px-3 py-2 text-sm font-medium text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg"
          >
            {fileError}
          </p>
        )}
      </div>

      {isMounted && (
        <ComposerAttachmentMenu
          isOpen={showAttachMenu}
          onClose={() => setShowAttachMenu(false)}
          cameraInputRef={cameraInputRef}
          photoInputRef={photoInputRef}
          fileInputRef={fileInputRef}
        />
      )}

      <ComposerCreativeModals
        showCreateImageModal={showCreateImageModal}
        showEditImageModal={showEditImageModal}
        showGalleryModal={showGalleryModal}
        onCloseCreateImage={() => {
          setShowCreateImageModal(false);
          onCloseCreateImage?.();
        }}
        onCloseEditImage={() => {
          setShowEditImageModal(false);
          onCloseEditImage?.();
        }}
        onCloseGallery={() => setShowGalleryModal(false)}
        onReusePrompt={(prompt) => {
          setMessage(prompt);
          setShowGalleryModal(false);
          setShowCreateImageModal(true);
        }}
        conversationId={conversationId}
        onImageGenerated={onImageGenerated}
      />
    </div>
  );
});

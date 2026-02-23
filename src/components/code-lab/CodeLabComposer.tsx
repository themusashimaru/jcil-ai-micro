'use client';

/**
 * CODE LAB COMPOSER
 *
 * Professional input area for the Code Lab:
 * - File attachments (images, PDFs, documents)
 * - Auto-expanding textarea with slash commands
 * - Model selector, agents, creative tools
 * - Keyboard shortcuts, paste, drag-drop
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { CodeLabSlashAutocomplete } from './CodeLabSlashAutocomplete';
import { CodeLabComposerModelDropdown } from './CodeLabComposerModelDropdown';
import { CodeLabComposerAgents } from './CodeLabComposerAgents';
import { CodeLabComposerCreative } from './CodeLabComposerCreative';
import './code-lab-composer.css';

// Attachment type
export interface CodeLabAttachment {
  id: string;
  file: File;
  preview?: string;
  type: 'image' | 'pdf' | 'document';
}

interface CodeLabComposerProps {
  onSend: (content: string, attachments?: CodeLabAttachment[], forceSearch?: boolean) => void;
  isStreaming: boolean;
  onCancel: () => void;
  placeholder?: string;
  disabled?: boolean;
  currentModel?: string;
  onModelChange?: (modelId: string) => void;
  thinkingEnabled?: boolean;
  modelSwitchFlash?: boolean;
  activeAgent?: 'research' | 'strategy' | 'deep-research' | null;
  onAgentSelect?: (agent: 'research' | 'strategy' | 'deep-research') => Promise<void> | void;
  strategyLoading?: boolean;
  deepResearchLoading?: boolean;
  onCreativeMode?: (mode: 'create-image' | 'edit-image') => void;
}

const ACCEPTED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain',
  'text/csv',
];
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_ATTACHMENTS = 10;

export function CodeLabComposer({
  onSend,
  isStreaming,
  onCancel,
  placeholder = 'Ask anything, build anything...',
  disabled = false,
  currentModel,
  onModelChange,
  thinkingEnabled = false,
  modelSwitchFlash = false,
  activeAgent,
  onAgentSelect,
  strategyLoading = false,
  deepResearchLoading = false,
  onCreativeMode,
}: CodeLabComposerProps) {
  const displayModelId =
    currentModel && thinkingEnabled && !currentModel.includes('haiku')
      ? `${currentModel}-thinking`
      : currentModel;

  const [content, setContent] = useState('');
  const [attachments, setAttachments] = useState<CodeLabAttachment[]>([]);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [modelSelectorOpen, setModelSelectorOpen] = useState(false);
  const [showAgentsMenu, setShowAgentsMenu] = useState(false);
  const [showCreativeMenu, setShowCreativeMenu] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, [content]);

  // Focus on mount (desktop only)
  useEffect(() => {
    const isMobile =
      typeof window !== 'undefined' &&
      (window.innerWidth < 768 ||
        'ontouchstart' in window ||
        navigator.maxTouchPoints > 0 ||
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent));
    if (!isMobile) textareaRef.current?.focus();
  }, []);

  // Cleanup ObjectURLs
  useEffect(() => {
    return () => {
      attachments.forEach((a) => {
        if (a.preview) URL.revokeObjectURL(a.preview);
      });
    };
  }, [attachments]);

  const handleFileSelect = useCallback(
    (files: FileList | null) => {
      if (!files) return;
      const availableSlots = MAX_ATTACHMENTS - attachments.length;
      if (availableSlots <= 0) return;

      const newAttachments: CodeLabAttachment[] = [];
      Array.from(files)
        .slice(0, availableSlots)
        .forEach((file) => {
          if (!ACCEPTED_TYPES.includes(file.type) || file.size > MAX_FILE_SIZE) return;
          let type: CodeLabAttachment['type'] = 'document';
          if (file.type.startsWith('image/')) type = 'image';
          else if (file.type === 'application/pdf') type = 'pdf';

          const attachment: CodeLabAttachment = {
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            file,
            type,
          };
          if (type === 'image') attachment.preview = URL.createObjectURL(file);
          newAttachments.push(attachment);
        });
      setAttachments((prev) => [...prev, ...newAttachments]);
    },
    [attachments.length]
  );

  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => {
      const removed = prev.find((a) => a.id === id);
      if (removed?.preview) URL.revokeObjectURL(removed.preview);
      return prev.filter((a) => a.id !== id);
    });
  }, []);

  const handleSubmit = useCallback(() => {
    const trimmed = content.trim();
    if ((trimmed || attachments.length > 0) && !isStreaming && !disabled) {
      onSend(trimmed, attachments.length > 0 ? attachments : undefined, false);
      setContent('');
      attachments.forEach((a) => {
        if (a.preview) URL.revokeObjectURL(a.preview);
      });
      setAttachments([]);
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
    }
  }, [content, attachments, isStreaming, disabled, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const cmdKey = isMac ? e.metaKey : e.ctrlKey;
    if ((e.key === 'Enter' && !e.shiftKey) || (cmdKey && e.key === 'Enter')) {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === 'Escape') {
      if (modelSelectorOpen) setModelSelectorOpen(false);
      else if (isStreaming) onCancel();
    }
    if (cmdKey && e.key === 'm') {
      e.preventDefault();
      setModelSelectorOpen((prev) => !prev);
    }
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      handleFileSelect(e.dataTransfer.files);
    },
    [handleFileSelect]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    if (
      e.clientX < rect.left ||
      e.clientX > rect.right ||
      e.clientY < rect.top ||
      e.clientY > rect.bottom
    ) {
      setIsDragging(false);
    }
  }, []);

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const imageFiles: File[] = [];
      for (let i = 0; i < e.clipboardData.items.length; i++) {
        const item = e.clipboardData.items[i];
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            const ext = item.type.split('/')[1] || 'png';
            imageFiles.push(
              new File(
                [file],
                `screenshot-${new Date().toISOString().replace(/[:.]/g, '-')}.${ext}`,
                { type: file.type }
              )
            );
          }
        }
      }
      if (imageFiles.length > 0) {
        e.preventDefault();
        const dt = new DataTransfer();
        imageFiles.forEach((f) => dt.items.add(f));
        handleFileSelect(dt.files);
      }
    },
    [handleFileSelect]
  );

  return (
    <div
      className={`code-lab-composer ${isDragging ? 'dragging' : ''}`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      {/* Attachment previews */}
      {attachments.length > 0 && (
        <div className="attachment-previews">
          {attachments.map((attachment) => (
            <div key={attachment.id} className="attachment-item">
              {attachment.type === 'image' && attachment.preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={attachment.preview} alt={attachment.file.name} />
              ) : (
                <div className="attachment-icon">
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    {attachment.type === 'pdf' ? (
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 2l5 5h-5V4zM8.5 18a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 1 0v1a.5.5 0 0 1-.5.5zm2 0a.5.5 0 0 1-.5-.5v-2a.5.5 0 0 1 1 0v2a.5.5 0 0 1-.5.5zm2 0a.5.5 0 0 1-.5-.5v-1.5a.5.5 0 0 1 1 0v1.5a.5.5 0 0 1-.5.5z" />
                    ) : (
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 2l5 5h-5V4zM8 15h8v1H8v-1zm0-2h8v1H8v-1z" />
                    )}
                  </svg>
                </div>
              )}
              <span className="attachment-name">{attachment.file.name}</span>
              <button
                className="attachment-remove"
                onClick={() => removeAttachment(attachment.id)}
                aria-label={`Remove attachment: ${attachment.file.name}`}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="composer-container">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ACCEPTED_TYPES.join(',')}
          onChange={(e) => handleFileSelect(e.target.files)}
          style={{ display: 'none' }}
          aria-label="Upload files"
        />

        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            setCursorPosition(e.target.selectionStart || 0);
          }}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={placeholder}
          disabled={disabled || isStreaming}
          rows={1}
          className="composer-input"
          aria-label="Message input - type your message or use slash commands. Paste images with Cmd+V"
          aria-describedby="composer-hints"
        />

        <CodeLabSlashAutocomplete
          inputValue={content}
          cursorPosition={cursorPosition}
          onSelect={(cmd) => {
            setContent(cmd);
            textareaRef.current?.focus();
          }}
          onClose={() => {}}
          inputElement={textareaRef.current}
        />

        <div className="composer-actions">
          <button
            className="composer-btn attach"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || isStreaming}
            title="Attach files (images, PDFs)"
            aria-label="Attach files such as images or PDFs"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13"
              />
            </svg>
          </button>

          {currentModel && onModelChange && (
            <CodeLabComposerModelDropdown
              isOpen={modelSelectorOpen}
              onToggle={() => !disabled && !isStreaming && setModelSelectorOpen(!modelSelectorOpen)}
              onClose={() => setModelSelectorOpen(false)}
              displayModelId={displayModelId || ''}
              onModelChange={onModelChange}
              disabled={disabled}
              isStreaming={isStreaming}
              modelSwitchFlash={modelSwitchFlash}
            />
          )}

          {onAgentSelect && (
            <CodeLabComposerAgents
              isOpen={showAgentsMenu}
              onToggle={() => setShowAgentsMenu(!showAgentsMenu)}
              onClose={() => setShowAgentsMenu(false)}
              activeAgent={activeAgent}
              onAgentSelect={onAgentSelect}
              disabled={disabled}
              isStreaming={isStreaming}
              strategyLoading={strategyLoading}
              deepResearchLoading={deepResearchLoading}
            />
          )}

          {onCreativeMode && (
            <CodeLabComposerCreative
              isOpen={showCreativeMenu}
              onToggle={() => setShowCreativeMenu(!showCreativeMenu)}
              onClose={() => setShowCreativeMenu(false)}
              onCreativeMode={onCreativeMode}
              disabled={disabled}
              isStreaming={isStreaming}
            />
          )}

          <div className="actions-spacer" />

          {isStreaming ? (
            <button
              className="composer-btn stop"
              onClick={onCancel}
              aria-label="Stop generating response"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
              Stop
            </button>
          ) : (
            <button
              className="composer-btn send"
              onClick={handleSubmit}
              disabled={(!content.trim() && attachments.length === 0) || disabled}
              aria-label="Send message"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 19V5m0 0l-6 6m6-6l6 6" />
              </svg>
            </button>
          )}
        </div>
      </div>

      <div className="composer-hint" id="composer-hints" aria-label="Keyboard shortcuts">
        <span>Enter to send</span>
        <span className="separator" aria-hidden="true">
          ·
        </span>
        <span>/ for commands</span>
        <span className="separator" aria-hidden="true">
          ·
        </span>
        <span>⌘M model</span>
        <span className="separator" aria-hidden="true">
          ·
        </span>
        <span>⌘/ shortcuts</span>
      </div>
    </div>
  );
}

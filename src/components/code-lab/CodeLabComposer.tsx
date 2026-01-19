'use client';

/**
 * CODE LAB COMPOSER
 *
 * Professional input area for the Code Lab:
 * - File attachments (images, PDFs, documents)
 * - Search toggle for Perplexity web search
 * - Auto-expanding textarea
 * - Keyboard shortcuts
 * - Image paste and drag-drop
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { CodeLabSlashAutocomplete } from './CodeLabSlashAutocomplete';

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
}

// Supported file types
const ACCEPTED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain',
  'text/csv',
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_ATTACHMENTS = 10; // Maximum number of attachments

export function CodeLabComposer({
  onSend,
  isStreaming,
  onCancel,
  placeholder = 'Ask anything, build anything...',
  disabled = false,
}: CodeLabComposerProps) {
  const [content, setContent] = useState('');
  const [attachments, setAttachments] = useState<CodeLabAttachment[]>([]);
  const [searchMode, setSearchMode] = useState(false);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
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

  // Focus on mount - only on desktop to avoid annoying keyboard popup on mobile
  useEffect(() => {
    // Check if device is mobile using various methods
    const isMobile =
      typeof window !== 'undefined' &&
      // Check screen width
      (window.innerWidth < 768 ||
        // Check for touch capability
        'ontouchstart' in window ||
        navigator.maxTouchPoints > 0 ||
        // Check user agent (fallback)
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent));

    // Only auto-focus on desktop
    if (!isMobile) {
      textareaRef.current?.focus();
    }
  }, []);

  // Cleanup ObjectURLs on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      attachments.forEach((attachment) => {
        if (attachment.preview) {
          URL.revokeObjectURL(attachment.preview);
        }
      });
    };
  }, [attachments]);

  // Handle file selection with validation
  const handleFileSelect = useCallback(
    (files: FileList | null) => {
      if (!files) return;

      // Check max attachments limit
      const currentCount = attachments.length;
      const availableSlots = MAX_ATTACHMENTS - currentCount;

      if (availableSlots <= 0) {
        console.warn(`[CodeLabComposer] Maximum attachments (${MAX_ATTACHMENTS}) reached`);
        return;
      }

      const newAttachments: CodeLabAttachment[] = [];

      Array.from(files)
        .slice(0, availableSlots) // Only take files up to available slots
        .forEach((file) => {
          // Validate type
          if (!ACCEPTED_TYPES.includes(file.type)) {
            console.warn(`[CodeLabComposer] Unsupported file type: ${file.type}`);
            return;
          }

          // Validate size
          if (file.size > MAX_FILE_SIZE) {
            console.warn(
              `[CodeLabComposer] File too large: ${file.name} (max ${MAX_FILE_SIZE / 1024 / 1024}MB)`
            );
            return;
          }

          // Determine type
          let type: CodeLabAttachment['type'] = 'document';
          if (file.type.startsWith('image/')) {
            type = 'image';
          } else if (file.type === 'application/pdf') {
            type = 'pdf';
          }

          // Create preview for images
          const attachment: CodeLabAttachment = {
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            file,
            type,
          };

          if (type === 'image') {
            attachment.preview = URL.createObjectURL(file);
          }

          newAttachments.push(attachment);
        });

      setAttachments((prev) => [...prev, ...newAttachments]);
    },
    [attachments.length]
  );

  // Remove attachment
  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => {
      const updated = prev.filter((a) => a.id !== id);
      // Revoke preview URL
      const removed = prev.find((a) => a.id === id);
      if (removed?.preview) {
        URL.revokeObjectURL(removed.preview);
      }
      return updated;
    });
  }, []);

  // Handle submit
  const handleSubmit = useCallback(() => {
    const trimmed = content.trim();
    if ((trimmed || attachments.length > 0) && !isStreaming && !disabled) {
      onSend(trimmed, attachments.length > 0 ? attachments : undefined, searchMode);
      setContent('');

      // Revoke ObjectURLs before clearing attachments to prevent memory leaks
      attachments.forEach((attachment) => {
        if (attachment.preview) {
          URL.revokeObjectURL(attachment.preview);
        }
      });
      setAttachments([]);
      setSearchMode(false);

      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  }, [content, attachments, isStreaming, disabled, onSend, searchMode]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const cmdKey = isMac ? e.metaKey : e.ctrlKey;

    // Send on Enter (without shift) or Cmd/Ctrl+Enter
    if ((e.key === 'Enter' && !e.shiftKey) || (cmdKey && e.key === 'Enter')) {
      e.preventDefault();
      handleSubmit();
    }

    // Cancel on Escape
    if (e.key === 'Escape' && isStreaming) {
      onCancel();
    }

    // Toggle search mode with Cmd/Ctrl+K
    if (cmdKey && e.key === 'k') {
      e.preventDefault();
      setSearchMode((prev) => !prev);
    }
  };

  // Handle drag and drop
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
    // Only set to false if leaving the composer area entirely
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setIsDragging(false);
    }
  }, []);

  // Handle paste for images (Claude Code parity - Cmd+V paste images)
  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const items = e.clipboardData.items;
      const imageFiles: File[] = [];

      // Check for image items in clipboard
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            // Create a meaningful filename for pasted images
            const ext = item.type.split('/')[1] || 'png';
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const renamedFile = new File([file], `screenshot-${timestamp}.${ext}`, {
              type: file.type,
            });
            imageFiles.push(renamedFile);
          }
        }
      }

      // If we found images, handle them
      if (imageFiles.length > 0) {
        e.preventDefault(); // Prevent default paste behavior for images
        const dataTransfer = new DataTransfer();
        imageFiles.forEach((file) => dataTransfer.items.add(file));
        handleFileSelect(dataTransfer.files);
      }
      // Let text paste through normally
    },
    [handleFileSelect]
  );

  // Track content changes for slash autocomplete
  const handleContentChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setContent(value);
    setCursorPosition(e.target.selectionStart || 0);
  }, []);

  // Handle slash command selection
  const handleSlashSelect = useCallback((command: string) => {
    setContent(command);
    textareaRef.current?.focus();
  }, []);

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
                  {attachment.type === 'pdf' ? (
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 2l5 5h-5V4zM8.5 18a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 1 0v1a.5.5 0 0 1-.5.5zm2 0a.5.5 0 0 1-.5-.5v-2a.5.5 0 0 1 1 0v2a.5.5 0 0 1-.5.5zm2 0a.5.5 0 0 1-.5-.5v-1.5a.5.5 0 0 1 1 0v1.5a.5.5 0 0 1-.5.5z" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 2l5 5h-5V4zM8 15h8v1H8v-1zm0-2h8v1H8v-1z" />
                    </svg>
                  )}
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

      {/* Search mode indicator */}
      {searchMode && (
        <div className="search-mode-indicator" role="status" aria-live="polite">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="8" />
            <path strokeLinecap="round" d="M21 21l-4.35-4.35" />
          </svg>
          <span>Web search enabled - will search for relevant info</span>
          <button onClick={() => setSearchMode(false)} aria-label="Disable web search">
            ×
          </button>
        </div>
      )}

      <div className="composer-container">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleContentChange}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={placeholder}
          disabled={disabled || isStreaming}
          rows={1}
          className="composer-input"
          aria-label="Message input - type your message or use slash commands. Paste images with Cmd+V"
          aria-describedby="composer-hints"
        />

        {/* Slash command autocomplete */}
        <CodeLabSlashAutocomplete
          inputValue={content}
          cursorPosition={cursorPosition}
          onSelect={handleSlashSelect}
          onClose={() => {}}
          inputElement={textareaRef.current}
        />

        <div className="composer-actions">
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={ACCEPTED_TYPES.join(',')}
            onChange={(e) => handleFileSelect(e.target.files)}
            style={{ display: 'none' }}
            aria-label="Upload files"
          />

          {/* File attach button */}
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

          {/* Search toggle button */}
          <button
            className={`composer-btn search ${searchMode ? 'active' : ''}`}
            onClick={() => setSearchMode(!searchMode)}
            disabled={disabled || isStreaming}
            title={searchMode ? 'Disable web search' : 'Enable web search'}
            aria-label={searchMode ? 'Disable web search' : 'Enable web search'}
            aria-pressed={searchMode}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
              />
            </svg>
          </button>

          {/* Send/Stop button */}
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
                strokeWidth="2"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"
                />
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
        <span>⌘K palette</span>
        <span className="separator" aria-hidden="true">
          ·
        </span>
        <span>⌘/ shortcuts</span>
      </div>

      <style jsx>{`
        .code-lab-composer {
          padding: 1rem 1.5rem 1.5rem;
          background: #1a1a1a;
          border-top: 1px solid #333;
          position: relative;
          transition: all 0.2s ease;
        }

        /* Drag and drop indicator (Claude Code parity) */
        .code-lab-composer.dragging {
          background: #2a2a2a;
          border-top-color: #555;
        }

        .code-lab-composer.dragging::before {
          content: 'Drop images or files here';
          position: absolute;
          inset: 0;
          background: rgba(255, 255, 255, 0.1);
          border: 2px dashed #666;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.9375rem;
          font-weight: 500;
          color: #ffffff;
          z-index: 10;
          pointer-events: none;
        }

        .attachment-previews {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          margin-bottom: 0.75rem;
        }

        .attachment-item {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.375rem 0.5rem;
          background: #333;
          border-radius: 8px;
          font-size: 0.75rem;
          color: #ffffff;
        }

        .attachment-item img {
          width: 32px;
          height: 32px;
          object-fit: cover;
          border-radius: 4px;
        }

        .attachment-icon {
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #444;
          border-radius: 4px;
          color: #ffffff;
        }

        .attachment-icon svg {
          width: 18px;
          height: 18px;
        }

        .attachment-name {
          max-width: 120px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          color: #ffffff;
        }

        .attachment-remove {
          background: none;
          border: none;
          padding: 0.25rem;
          cursor: pointer;
          color: #888;
          border-radius: 4px;
        }

        .attachment-remove:hover {
          background: #444;
          color: #ef4444;
        }

        .attachment-remove svg {
          width: 14px;
          height: 14px;
        }

        .search-mode-indicator {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 0.75rem;
          background: #333;
          border: 1px solid #555;
          border-radius: 8px;
          margin-bottom: 0.75rem;
          font-size: 0.8125rem;
          color: #ffffff;
        }

        .search-mode-indicator svg {
          width: 16px;
          height: 16px;
          flex-shrink: 0;
        }

        .search-mode-indicator span {
          flex: 1;
        }

        .search-mode-indicator button {
          background: none;
          border: none;
          font-size: 1.25rem;
          color: #ffffff;
          cursor: pointer;
          padding: 0;
          line-height: 1;
        }

        .composer-container {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          padding: 0.75rem 1rem;
          background: #000000;
          border: 1px solid #444;
          border-radius: 12px;
          transition:
            border-color 0.2s,
            box-shadow 0.2s;
        }

        .composer-container:focus-within {
          border-color: #666;
          box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.1);
        }

        .composer-input {
          width: 100%;
          border: none;
          background: transparent;
          font-size: 0.9375rem;
          line-height: 1.5;
          color: #ffffff;
          resize: none;
          outline: none;
          min-height: 60px;
          max-height: 200px;
        }

        .composer-input::placeholder {
          color: #888;
        }

        .composer-input:disabled {
          color: #666;
        }

        .composer-actions {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 0.5rem;
          padding-top: 0.25rem;
          border-top: 1px solid #333;
        }

        .composer-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.375rem;
          padding: 0.5rem;
          background: transparent;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          color: #888;
          transition: all 0.2s;
        }

        .composer-btn:hover:not(:disabled) {
          background: #333;
          color: #ffffff;
        }

        .composer-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .composer-btn svg {
          width: 20px;
          height: 20px;
        }

        .composer-btn.search.active {
          background: #333;
          color: #ffffff;
        }

        .composer-btn.send {
          background: #ffffff;
          color: #000000;
          padding: 0.5rem 0.75rem;
        }

        .composer-btn.send:hover:not(:disabled) {
          background: #e5e5e5;
          color: #000000;
        }

        .composer-btn.send:disabled {
          background: #333;
          color: #666;
        }

        .composer-btn.stop {
          background: #ef4444;
          color: white;
          padding: 0.5rem 0.75rem;
          font-size: 0.8125rem;
          font-weight: 500;
        }

        .composer-btn.stop:hover {
          background: #dc2626;
        }

        .composer-hint {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          margin-top: 0.5rem;
          font-size: 0.75rem;
          color: #888;
        }

        .separator {
          color: #555;
        }

        /* Mobile responsive styles */
        @media (max-width: 768px) {
          .code-lab-composer {
            padding: 0.75rem 1rem;
            padding-bottom: calc(0.75rem + env(safe-area-inset-bottom, 0));
            flex-shrink: 0;
          }

          .composer-container {
            padding: 0.625rem 0.75rem;
            gap: 0.5rem;
          }

          .composer-input {
            font-size: 16px; /* Prevents zoom on iOS */
            min-height: 44px;
          }

          .composer-btn {
            min-width: 44px;
            min-height: 44px;
          }

          .composer-btn svg {
            width: 20px;
            height: 20px;
          }

          .composer-btn.send,
          .composer-btn.stop {
            padding: 0.625rem 1rem;
          }

          .attachment-previews {
            gap: 0.375rem;
            overflow-x: auto;
            flex-wrap: nowrap;
            -webkit-overflow-scrolling: touch;
            padding-bottom: 0.25rem;
          }

          .attachment-item {
            flex-shrink: 0;
          }

          .attachment-name {
            max-width: 100px;
          }

          .search-mode-indicator {
            font-size: 0.75rem;
            padding: 0.5rem 0.625rem;
          }

          .composer-hint {
            display: none;
          }
        }

        /* Extra small screens */
        @media (max-width: 480px) {
          .code-lab-composer {
            padding: 0.5rem 0.75rem;
            padding-bottom: calc(0.5rem + env(safe-area-inset-bottom, 0));
          }

          .composer-container {
            padding: 0.5rem;
            border-radius: 10px;
          }

          .attachment-name {
            max-width: 80px;
          }
        }
      `}</style>
    </div>
  );
}

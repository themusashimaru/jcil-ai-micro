'use client';

/**
 * CODE LAB COMPOSER
 *
 * Professional input area for the Code Lab:
 * - File attachments (images, PDFs, documents)
 * - Search toggle for Perplexity web search
 * - Auto-expanding textarea
 * - Keyboard shortcuts
 */

import { useState, useRef, useEffect, useCallback } from 'react';

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

  // Focus on mount
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Handle file selection
  const handleFileSelect = useCallback((files: FileList | null) => {
    if (!files) return;

    const newAttachments: CodeLabAttachment[] = [];

    Array.from(files).forEach(file => {
      // Validate type
      if (!ACCEPTED_TYPES.includes(file.type)) {
        console.warn(`[CodeLabComposer] Unsupported file type: ${file.type}`);
        return;
      }

      // Validate size
      if (file.size > MAX_FILE_SIZE) {
        console.warn(`[CodeLabComposer] File too large: ${file.name}`);
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

    setAttachments(prev => [...prev, ...newAttachments]);
  }, []);

  // Remove attachment
  const removeAttachment = useCallback((id: string) => {
    setAttachments(prev => {
      const updated = prev.filter(a => a.id !== id);
      // Revoke preview URL
      const removed = prev.find(a => a.id === id);
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
      setAttachments([]);
      setSearchMode(false);

      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  }, [content, attachments, isStreaming, disabled, onSend, searchMode]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Send on Enter (without shift)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }

    // Cancel on Escape
    if (e.key === 'Escape' && isStreaming) {
      onCancel();
    }
  };

  // Handle drag and drop
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    handleFileSelect(e.dataTransfer.files);
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  return (
    <div
      className="code-lab-composer"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      {/* Attachment previews */}
      {attachments.length > 0 && (
        <div className="attachment-previews">
          {attachments.map(attachment => (
            <div key={attachment.id} className="attachment-item">
              {attachment.type === 'image' && attachment.preview ? (
                <img src={attachment.preview} alt={attachment.file.name} />
              ) : (
                <div className="attachment-icon">
                  {attachment.type === 'pdf' ? (
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 2l5 5h-5V4zM8.5 18a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 1 0v1a.5.5 0 0 1-.5.5zm2 0a.5.5 0 0 1-.5-.5v-2a.5.5 0 0 1 1 0v2a.5.5 0 0 1-.5.5zm2 0a.5.5 0 0 1-.5-.5v-1.5a.5.5 0 0 1 1 0v1.5a.5.5 0 0 1-.5.5z"/>
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 2l5 5h-5V4zM8 15h8v1H8v-1zm0-2h8v1H8v-1z"/>
                    </svg>
                  )}
                </div>
              )}
              <span className="attachment-name">{attachment.file.name}</span>
              <button
                className="attachment-remove"
                onClick={() => removeAttachment(attachment.id)}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Search mode indicator */}
      {searchMode && (
        <div className="search-mode-indicator">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path strokeLinecap="round" d="M21 21l-4.35-4.35" />
          </svg>
          <span>Web search enabled - will search for relevant info</span>
          <button onClick={() => setSearchMode(false)}>×</button>
        </div>
      )}

      <div className="composer-container">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled || isStreaming}
          rows={1}
          className="composer-input"
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
          />

          {/* File attach button */}
          <button
            className="composer-btn attach"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || isStreaming}
            title="Attach files (images, PDFs)"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
            </svg>
          </button>

          {/* Search toggle button */}
          <button
            className={`composer-btn search ${searchMode ? 'active' : ''}`}
            onClick={() => setSearchMode(!searchMode)}
            disabled={disabled || isStreaming}
            title={searchMode ? 'Disable web search' : 'Enable web search'}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
          </button>

          {/* Send/Stop button */}
          {isStreaming ? (
            <button
              className="composer-btn stop"
              onClick={onCancel}
            >
              <svg viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
              Stop
            </button>
          ) : (
            <button
              className="composer-btn send"
              onClick={handleSubmit}
              disabled={(!content.trim() && attachments.length === 0) || disabled}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
              </svg>
            </button>
          )}
        </div>
      </div>

      <div className="composer-hint">
        <span>Enter to send</span>
        <span className="separator">·</span>
        <span>Shift+Enter for new line</span>
        <span className="separator">·</span>
        <span>Drop files to attach</span>
      </div>

      <style jsx>{`
        .code-lab-composer {
          padding: 1rem 1.5rem 1.5rem;
          background: white;
          border-top: 1px solid #e5e7eb;
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
          background: #f3f4f6;
          border-radius: 8px;
          font-size: 0.75rem;
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
          background: #e5e7eb;
          border-radius: 4px;
          color: #6b7280;
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
          color: #374151;
        }

        .attachment-remove {
          background: none;
          border: none;
          padding: 0.25rem;
          cursor: pointer;
          color: #9ca3af;
          border-radius: 4px;
        }

        .attachment-remove:hover {
          background: #e5e7eb;
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
          background: #eef2ff;
          border: 1px solid #c7d2fe;
          border-radius: 8px;
          margin-bottom: 0.75rem;
          font-size: 0.8125rem;
          color: #4f46e5;
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
          color: #6366f1;
          cursor: pointer;
          padding: 0;
          line-height: 1;
        }

        .composer-container {
          display: flex;
          align-items: flex-end;
          gap: 0.75rem;
          padding: 0.75rem 1rem;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          transition: border-color 0.2s, box-shadow 0.2s;
        }

        .composer-container:focus-within {
          border-color: #6366f1;
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
        }

        .composer-input {
          flex: 1;
          border: none;
          background: transparent;
          font-size: 0.9375rem;
          line-height: 1.5;
          color: #1a1f36;
          resize: none;
          outline: none;
          min-height: 24px;
          max-height: 200px;
        }

        .composer-input::placeholder {
          color: #9ca3af;
        }

        .composer-input:disabled {
          color: #9ca3af;
        }

        .composer-actions {
          display: flex;
          align-items: center;
          gap: 0.5rem;
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
          color: #6b7280;
          transition: all 0.2s;
        }

        .composer-btn:hover:not(:disabled) {
          background: #e5e7eb;
          color: #374151;
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
          background: #eef2ff;
          color: #6366f1;
        }

        .composer-btn.send {
          background: #1a1f36;
          color: white;
          padding: 0.5rem 0.75rem;
        }

        .composer-btn.send:hover:not(:disabled) {
          background: #2d3348;
          color: white;
        }

        .composer-btn.send:disabled {
          background: #e5e7eb;
          color: #9ca3af;
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
          color: #9ca3af;
        }

        .separator {
          color: #d1d5db;
        }

        @media (max-width: 640px) {
          .composer-hint {
            display: none;
          }

          .code-lab-composer {
            padding: 0.75rem 1rem 1rem;
          }

          .composer-container {
            padding: 0.625rem 0.75rem;
            gap: 0.5rem;
          }

          .composer-input {
            font-size: 16px; /* Prevents zoom on iOS */
          }

          .composer-btn svg {
            width: 18px;
            height: 18px;
          }

          .attachment-previews {
            gap: 0.375rem;
          }

          .attachment-name {
            max-width: 80px;
          }

          .search-mode-indicator {
            font-size: 0.75rem;
            padding: 0.375rem 0.5rem;
          }
        }
      `}</style>
    </div>
  );
}

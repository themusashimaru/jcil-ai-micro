'use client';

/**
 * CODE LAB COMPOSER
 *
 * Professional input area for the Code Lab:
 * - Clean, minimal design
 * - Auto-expanding textarea
 * - Keyboard shortcuts (Cmd/Ctrl+Enter to send)
 * - File upload support (future)
 */

import { useState, useRef, useEffect, useCallback } from 'react';

interface CodeLabComposerProps {
  onSend: (content: string) => void;
  isStreaming: boolean;
  onCancel: () => void;
  placeholder?: string;
  disabled?: boolean;
}

export function CodeLabComposer({
  onSend,
  isStreaming,
  onCancel,
  placeholder = 'Ask anything, build anything...',
  disabled = false,
}: CodeLabComposerProps) {
  const [content, setContent] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  const handleSubmit = useCallback(() => {
    const trimmed = content.trim();
    if (trimmed && !isStreaming && !disabled) {
      onSend(trimmed);
      setContent('');

      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  }, [content, isStreaming, disabled, onSend]);

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

  return (
    <div className="code-lab-composer">
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
          {/* File attach button - coming soon */}
          <button
            className="composer-btn attach"
            disabled={disabled || isStreaming}
            title="Attach files (coming soon)"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
            </svg>
          </button>

          {/* Search button */}
          <button
            className="composer-btn search"
            title="Search docs"
            disabled={disabled || isStreaming}
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
              disabled={!content.trim() || disabled}
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
      </div>

      <style jsx>{`
        .code-lab-composer {
          padding: 1rem 1.5rem 1.5rem;
          background: white;
          border-top: 1px solid #e5e7eb;
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
        }
      `}</style>
    </div>
  );
}

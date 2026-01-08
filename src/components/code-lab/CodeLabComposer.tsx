'use client';

/**
 * CODE LAB COMPOSER
 *
 * Professional input area for the Code Lab:
 * - File attachments (images, PDFs, documents)
 * - Search toggle for Perplexity web search
 * - Voice input with Whisper transcription
 * - Auto-expanding textarea
 * - Keyboard shortcuts
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { useVoiceInput } from '@/hooks/useVoiceInput';
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Voice input - with comfortable settings for natural speech
  const {
    isRecording,
    isProcessing,
    audioLevel,
    isSupported: voiceSupported,
    toggleRecording,
    cancelRecording,
    duration: recordingDuration,
  } = useVoiceInput({
    onTranscript: (text) => {
      // Append transcribed text to current content
      setContent(prev => prev ? `${prev} ${text}` : text);
      // Focus the textarea after transcription
      textareaRef.current?.focus();
    },
    onError: (error) => {
      console.error('[Voice Input] Error:', error);
    },
    silenceTimeout: 4000,  // Stop after 4s of silence (comfortable pause)
    maxDuration: 120000,   // 2 minute max recording
  });

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
    const isMobile = typeof window !== 'undefined' && (
      // Check screen width
      window.innerWidth < 768 ||
      // Check for touch capability
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0 ||
      // Check user agent (fallback)
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    );

    // Only auto-focus on desktop
    if (!isMobile) {
      textareaRef.current?.focus();
    }
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
      setSearchMode(prev => !prev);
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
                // eslint-disable-next-line @next/next/no-img-element
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

      {/* Recording indicator */}
      {(isRecording || isProcessing) && (
        <div className={`recording-indicator ${isRecording ? 'active' : 'processing'}`}>
          <div className="recording-dot" />
          <span>
            {isProcessing
              ? 'Transcribing...'
              : `Recording... ${recordingDuration}s`}
          </span>
          {isRecording && (
            <div className="audio-level" style={{ width: `${audioLevel}%` }} />
          )}
          <button onClick={cancelRecording}>×</button>
        </div>
      )}

      <div className="composer-container">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleContentChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled || isStreaming}
          rows={1}
          className="composer-input"
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

          {/* Voice input button */}
          {voiceSupported && (
            <button
              className={`composer-btn voice ${isRecording ? 'recording' : ''} ${isProcessing ? 'processing' : ''}`}
              onClick={isRecording ? cancelRecording : toggleRecording}
              disabled={disabled || isStreaming || isProcessing}
              title={isRecording ? 'Stop recording' : isProcessing ? 'Processing...' : 'Voice input'}
              style={isRecording ? { '--audio-level': `${audioLevel}%` } as React.CSSProperties : undefined}
            >
              {isProcessing ? (
                <svg className="spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                </svg>
              ) : isRecording ? (
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="6" width="12" height="12" rx="2" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                </svg>
              )}
            </button>
          )}

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
        <span>/ for commands</span>
        <span className="separator">·</span>
        <span>⌘K palette</span>
        <span className="separator">·</span>
        <span>⌘/ shortcuts</span>
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

        .recording-indicator {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 0.75rem;
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 8px;
          margin-bottom: 0.75rem;
          font-size: 0.8125rem;
          color: #dc2626;
          position: relative;
          overflow: hidden;
        }

        .recording-indicator.processing {
          background: #f0fdf4;
          border-color: #bbf7d0;
          color: #16a34a;
        }

        .recording-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #dc2626;
          animation: pulse 1s ease-in-out infinite;
        }

        .recording-indicator.processing .recording-dot {
          background: #16a34a;
          animation: spin 1s linear infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.8); }
        }

        .audio-level {
          position: absolute;
          bottom: 0;
          left: 0;
          height: 3px;
          background: linear-gradient(90deg, #dc2626, #f87171);
          transition: width 0.1s ease-out;
        }

        .recording-indicator span {
          flex: 1;
        }

        .recording-indicator button {
          background: none;
          border: none;
          font-size: 1.25rem;
          color: currentColor;
          cursor: pointer;
          padding: 0;
          line-height: 1;
          z-index: 1;
        }

        .composer-container {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
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
          width: 100%;
          border: none;
          background: transparent;
          font-size: 0.9375rem;
          line-height: 1.5;
          color: #1a1f36;
          resize: none;
          outline: none;
          min-height: 60px;
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
          justify-content: flex-end;
          gap: 0.5rem;
          padding-top: 0.25rem;
          border-top: 1px solid #e5e7eb;
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

        .composer-btn.voice {
          position: relative;
        }

        .composer-btn.voice.recording {
          background: #dc2626;
          color: white;
          animation: voice-pulse 1.5s ease-in-out infinite;
        }

        .composer-btn.voice.recording::before {
          content: '';
          position: absolute;
          inset: -4px;
          border-radius: 12px;
          border: 2px solid #dc2626;
          opacity: 0.3;
          animation: voice-ring 1.5s ease-out infinite;
        }

        @keyframes voice-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }

        @keyframes voice-ring {
          0% { transform: scale(0.8); opacity: 0.5; }
          100% { transform: scale(1.2); opacity: 0; }
        }

        .composer-btn.voice.processing {
          background: #f3f4f6;
          color: #16a34a;
        }

        .composer-btn.voice .spinner {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
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

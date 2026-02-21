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
  // Model selector props (moved from header for cleaner UX)
  currentModel?: string;
  onModelChange?: (modelId: string) => void;
  // Thinking mode state (for showing correct selection)
  thinkingEnabled?: boolean;
  // Model switch flash state for visual feedback
  modelSwitchFlash?: boolean;
  // Agent props (Deep Research, Deep Strategy, Research)
  activeAgent?: 'research' | 'strategy' | 'deep-research' | null;
  onAgentSelect?: (agent: 'research' | 'strategy' | 'deep-research') => Promise<void> | void;
  strategyLoading?: boolean;
  deepResearchLoading?: boolean;
  // Creative tools (Image generation)
  onCreativeMode?: (mode: 'create-image' | 'edit-image') => void;
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

// Model display names for the inline selector
// Organized by provider: Claude, OpenAI GPT, xAI Grok, DeepSeek, Google
const MODEL_DISPLAY_NAMES: Record<
  string,
  { name: string; description?: string; provider?: string }
> = {
  // ========================================
  // CLAUDE MODELS (Anthropic)
  // ========================================
  'claude-sonnet-4-6': {
    name: 'Sonnet 4.6',
    description: 'Fast & capable',
    provider: 'claude',
  },
  'claude-opus-4-6': {
    name: 'Opus',
    description: 'Most capable',
    provider: 'claude',
  },
  'claude-haiku-4-5-20251001': {
    name: 'Haiku 4.5',
    description: 'Fastest',
    provider: 'claude',
  },
  // Extended thinking variants (deeper reasoning)
  'claude-sonnet-4-6-thinking': {
    name: 'Sonnet (Thinking)',
    description: 'Deep reasoning',
    provider: 'claude',
  },
  'claude-opus-4-6-thinking': {
    name: 'Opus (Thinking)',
    description: 'Deepest reasoning',
    provider: 'claude',
  },

  // ========================================
  // OPENAI GPT MODELS
  // ========================================
  'gpt-5.2': {
    name: 'GPT-5.2',
    description: 'All-around + strong coding',
    provider: 'openai',
  },

  // ========================================
  // XAI GROK MODELS
  // ========================================
  'grok-4-1-fast-reasoning': {
    name: 'Grok 4.1 Fast (R)',
    description: 'Reasoning, 2M context ($0.20/$0.50)',
    provider: 'xai',
  },
  'grok-code-fast-1': {
    name: 'Grok Code Fast',
    description: 'Agentic coding ($0.20/$1.50)',
    provider: 'xai',
  },

  // ========================================
  // DEEPSEEK MODELS
  // ========================================
  'deepseek-reasoner': {
    name: 'DeepSeek Reasoner',
    description: 'Math, logic, coding ($0.55/$2.19)',
    provider: 'deepseek',
  },

  // ========================================
  // GOOGLE GEMINI MODELS
  // ========================================
  'gemini-3-pro-preview': {
    name: 'Gemini 3 Pro',
    description: 'Deep reasoning, complex coding ($2/$12)',
    provider: 'google',
  },
  'gemini-3-flash-preview': {
    name: 'Gemini 3 Flash',
    description: 'Fast general AI, production ($0.50/$3)',
    provider: 'google',
  },
};

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
  // Agent props
  activeAgent,
  onAgentSelect,
  strategyLoading = false,
  deepResearchLoading = false,
  // Creative tools
  onCreativeMode,
}: CodeLabComposerProps) {
  // Compute the display model ID (includes -thinking suffix if thinking is enabled)
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
  const modelSelectorRef = useRef<HTMLDivElement>(null);
  const agentsMenuRef = useRef<HTMLDivElement>(null);
  const creativeMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modelSelectorRef.current && !modelSelectorRef.current.contains(e.target as Node)) {
        setModelSelectorOpen(false);
      }
      if (agentsMenuRef.current && !agentsMenuRef.current.contains(e.target as Node)) {
        setShowAgentsMenu(false);
      }
      if (creativeMenuRef.current && !creativeMenuRef.current.contains(e.target as Node)) {
        setShowCreativeMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
      // Search is now auto-triggered based on content patterns, no manual searchMode needed
      onSend(trimmed, attachments.length > 0 ? attachments : undefined, false);
      setContent('');

      // Revoke ObjectURLs before clearing attachments to prevent memory leaks
      attachments.forEach((attachment) => {
        if (attachment.preview) {
          URL.revokeObjectURL(attachment.preview);
        }
      });
      setAttachments([]);

      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  }, [content, attachments, isStreaming, disabled, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const cmdKey = isMac ? e.metaKey : e.ctrlKey;

    // Send on Enter (without shift) or Cmd/Ctrl+Enter
    if ((e.key === 'Enter' && !e.shiftKey) || (cmdKey && e.key === 'Enter')) {
      e.preventDefault();
      handleSubmit();
    }

    // Cancel on Escape
    if (e.key === 'Escape') {
      if (modelSelectorOpen) {
        setModelSelectorOpen(false);
      } else if (isStreaming) {
        onCancel();
      }
    }

    // Toggle model selector with Cmd/Ctrl+M
    if (cmdKey && e.key === 'm') {
      e.preventDefault();
      setModelSelectorOpen((prev) => !prev);
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

      <div className="composer-container">
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
          {/* File attach button - left side */}
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

          {/* Model selector - inline next to paperclip */}
          {currentModel && onModelChange && (
            <div className="inline-model-selector" ref={modelSelectorRef}>
              <button
                className={`model-selector-trigger ${modelSwitchFlash ? 'model-flash' : ''}`}
                onClick={() =>
                  !disabled && !isStreaming && setModelSelectorOpen(!modelSelectorOpen)
                }
                disabled={disabled || isStreaming}
                aria-expanded={modelSelectorOpen}
                aria-haspopup="listbox"
              >
                <span className="model-name">
                  {MODEL_DISPLAY_NAMES[displayModelId || '']?.name || 'Model'}
                </span>
                <svg
                  className={`model-chevron ${modelSelectorOpen ? 'open' : ''}`}
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Model dropdown */}
              {modelSelectorOpen && (
                <div className="model-dropdown" role="listbox">
                  {/* Claude Models */}
                  <div className="model-provider-header">Claude (Anthropic)</div>
                  {Object.entries(MODEL_DISPLAY_NAMES)
                    .filter(([, { provider }]) => provider === 'claude')
                    .map(([modelId, { name, description }]) => (
                      <button
                        key={modelId}
                        className={`model-option ${modelId === displayModelId ? 'selected' : ''}`}
                        onClick={() => {
                          onModelChange(modelId);
                          setModelSelectorOpen(false);
                        }}
                        role="option"
                        aria-selected={modelId === displayModelId}
                      >
                        <div className="model-info">
                          <span className="model-name">{name}</span>
                          {description && <span className="model-desc">{description}</span>}
                        </div>
                        {modelId === displayModelId && (
                          <svg
                            className="check"
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                          >
                            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                          </svg>
                        )}
                      </button>
                    ))}

                  {/* OpenAI Models */}
                  <div className="model-provider-header">OpenAI GPT</div>
                  {Object.entries(MODEL_DISPLAY_NAMES)
                    .filter(([, { provider }]) => provider === 'openai')
                    .map(([modelId, { name, description }]) => (
                      <button
                        key={modelId}
                        className={`model-option ${modelId === displayModelId ? 'selected' : ''}`}
                        onClick={() => {
                          onModelChange(modelId);
                          setModelSelectorOpen(false);
                        }}
                        role="option"
                        aria-selected={modelId === displayModelId}
                      >
                        <div className="model-info">
                          <span className="model-name">{name}</span>
                          {description && <span className="model-desc">{description}</span>}
                        </div>
                        {modelId === displayModelId && (
                          <svg
                            className="check"
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                          >
                            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                          </svg>
                        )}
                      </button>
                    ))}

                  {/* xAI Grok Models */}
                  <div className="model-provider-header">xAI (Grok)</div>
                  {Object.entries(MODEL_DISPLAY_NAMES)
                    .filter(([, { provider }]) => provider === 'xai')
                    .map(([modelId, { name, description }]) => (
                      <button
                        key={modelId}
                        className={`model-option ${modelId === displayModelId ? 'selected' : ''}`}
                        onClick={() => {
                          onModelChange(modelId);
                          setModelSelectorOpen(false);
                        }}
                        role="option"
                        aria-selected={modelId === displayModelId}
                      >
                        <div className="model-info">
                          <span className="model-name">{name}</span>
                          {description && <span className="model-desc">{description}</span>}
                        </div>
                        {modelId === displayModelId && (
                          <svg
                            className="check"
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                          >
                            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                          </svg>
                        )}
                      </button>
                    ))}

                  {/* DeepSeek Models */}
                  <div className="model-provider-header">DeepSeek</div>
                  {Object.entries(MODEL_DISPLAY_NAMES)
                    .filter(([, { provider }]) => provider === 'deepseek')
                    .map(([modelId, { name, description }]) => (
                      <button
                        key={modelId}
                        className={`model-option ${modelId === displayModelId ? 'selected' : ''}`}
                        onClick={() => {
                          onModelChange(modelId);
                          setModelSelectorOpen(false);
                        }}
                        role="option"
                        aria-selected={modelId === displayModelId}
                      >
                        <div className="model-info">
                          <span className="model-name">{name}</span>
                          {description && <span className="model-desc">{description}</span>}
                        </div>
                        {modelId === displayModelId && (
                          <svg
                            className="check"
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                          >
                            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                          </svg>
                        )}
                      </button>
                    ))}

                  {/* Google Gemini Models */}
                  <div className="model-provider-header">Google (Gemini)</div>
                  {Object.entries(MODEL_DISPLAY_NAMES)
                    .filter(([, { provider }]) => provider === 'google')
                    .map(([modelId, { name, description }]) => (
                      <button
                        key={modelId}
                        className={`model-option ${modelId === displayModelId ? 'selected' : ''}`}
                        onClick={() => {
                          onModelChange(modelId);
                          setModelSelectorOpen(false);
                        }}
                        role="option"
                        aria-selected={modelId === displayModelId}
                      >
                        <div className="model-info">
                          <span className="model-name">{name}</span>
                          {description && <span className="model-desc">{description}</span>}
                        </div>
                        {modelId === displayModelId && (
                          <svg
                            className="check"
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                          >
                            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                          </svg>
                        )}
                      </button>
                    ))}

                  <div className="model-hint">⌘M to toggle</div>
                </div>
              )}
            </div>
          )}

          {/* Agents dropdown button */}
          {onAgentSelect && (
            <div className="agents-menu-container" ref={agentsMenuRef}>
              <button
                className={`composer-btn agents ${activeAgent ? 'active' : ''}`}
                onClick={() => setShowAgentsMenu(!showAgentsMenu)}
                disabled={disabled || isStreaming}
                title="AI Agents"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2a4 4 0 0 1 4 4v2a4 4 0 1 1-8 0V6a4 4 0 0 1 4-4z" />
                  <path d="M16 14H8a4 4 0 0 0-4 4v2h16v-2a4 4 0 0 0-4-4z" />
                </svg>
                <span className="btn-label">Agents</span>
                {activeAgent && <span className="active-indicator" />}
              </button>

              {showAgentsMenu && (
                <div className="agents-dropdown">
                  <button
                    className={`agent-option ${activeAgent === 'deep-research' ? 'selected' : ''}`}
                    onClick={() => {
                      onAgentSelect('deep-research');
                      setShowAgentsMenu(false);
                    }}
                    disabled={deepResearchLoading}
                  >
                    <div className="agent-icon deep-research">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="11" cy="11" r="8" />
                        <path d="m21 21-4.35-4.35" />
                        <path d="M11 8v6M8 11h6" />
                      </svg>
                    </div>
                    <div className="agent-info">
                      <span className="agent-name">Deep Research</span>
                      <span className="agent-desc">Multi-source web research with synthesis</span>
                    </div>
                    {deepResearchLoading && <span className="loading-spinner" />}
                  </button>

                  <button
                    className={`agent-option ${activeAgent === 'strategy' ? 'selected' : ''}`}
                    onClick={() => {
                      onAgentSelect('strategy');
                      setShowAgentsMenu(false);
                    }}
                    disabled={strategyLoading}
                  >
                    <div className="agent-icon strategy">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 2a4 4 0 0 1 4 4c0 1.1-.9 2-2 2h-4c-1.1 0-2-.9-2-2a4 4 0 0 1 4-4z" />
                        <path d="M12 8v4" />
                        <path d="M10 18c-.55 0-1 .45-1 1s.45 1 1 1 1-.45 1-1-.45-1-1-1z" />
                        <path d="M14 18c-.55 0-1 .45-1 1s.45 1 1 1 1-.45 1-1-.45-1-1-1z" />
                        <path d="M12 12c-2 0-4 2-4 4v2h8v-2c0-2-2-4-4-4z" />
                      </svg>
                    </div>
                    <div className="agent-info">
                      <span className="agent-name">Deep Strategy</span>
                      <span className="agent-desc">Extended thinking for complex planning</span>
                    </div>
                    {strategyLoading && <span className="loading-spinner" />}
                  </button>

                  <button
                    className={`agent-option ${activeAgent === 'research' ? 'selected' : ''}`}
                    onClick={() => {
                      onAgentSelect('research');
                      setShowAgentsMenu(false);
                    }}
                  >
                    <div className="agent-icon research">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="11" cy="11" r="8" />
                        <path d="m21 21-4.35-4.35" />
                      </svg>
                    </div>
                    <div className="agent-info">
                      <span className="agent-name">Research</span>
                      <span className="agent-desc">Quick web search with AI summary</span>
                    </div>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Creative tools dropdown button */}
          {onCreativeMode && (
            <div className="creative-menu-container" ref={creativeMenuRef}>
              <button
                className="composer-btn creative"
                onClick={() => setShowCreativeMenu(!showCreativeMenu)}
                disabled={disabled || isStreaming}
                title="Creative Tools"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <path d="m21 15-5-5L5 21" />
                </svg>
                <span className="btn-label">Create</span>
              </button>

              {showCreativeMenu && (
                <div className="creative-dropdown">
                  <button
                    className="creative-option"
                    onClick={() => {
                      onCreativeMode('create-image');
                      setShowCreativeMenu(false);
                    }}
                  >
                    <div className="creative-icon create">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="3" width="18" height="18" rx="2" />
                        <path d="M12 8v8M8 12h8" />
                      </svg>
                    </div>
                    <div className="creative-info">
                      <span className="creative-name">Create Image</span>
                      <span className="creative-desc">Generate images from text descriptions</span>
                    </div>
                  </button>

                  <button
                    className="creative-option"
                    onClick={() => {
                      onCreativeMode('edit-image');
                      setShowCreativeMenu(false);
                    }}
                  >
                    <div className="creative-icon edit">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </div>
                    <div className="creative-info">
                      <span className="creative-name">Edit Image</span>
                      <span className="creative-desc">Modify uploaded images with AI</span>
                    </div>
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="actions-spacer" />

          {/* Send/Stop button - right side */}
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

        /* Inline model selector - inside composer actions */
        .inline-model-selector {
          position: relative;
        }

        .model-selector-trigger {
          display: flex;
          align-items: center;
          gap: 0.25rem;
          padding: 0.25rem 0.5rem;
          background: #2a2a2a;
          border: 1px solid #444;
          border-radius: 6px;
          font-size: 0.75rem;
          color: #ffffff;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .model-selector-trigger:hover:not(:disabled) {
          background: #333;
          border-color: #555;
        }

        .model-selector-trigger:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /* Green flash animation for model switch confirmation */
        .model-selector-trigger.model-flash {
          animation: modelSwitchFlash 0.8s ease-out;
        }

        @keyframes modelSwitchFlash {
          0% {
            background: #10b981;
            border-color: #10b981;
            color: #ffffff;
          }
          50% {
            background: #059669;
            border-color: #059669;
            color: #ffffff;
          }
          100% {
            background: #2a2a2a;
            border-color: #444;
            color: #ffffff;
          }
        }

        .model-selector-trigger .model-name {
          font-weight: 500;
          max-width: 200px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .model-chevron {
          transition: transform 0.2s ease;
          color: #888;
          flex-shrink: 0;
        }

        .model-chevron.open {
          transform: rotate(180deg);
        }

        .model-dropdown {
          position: absolute;
          bottom: calc(100% + 8px);
          left: 0;
          min-width: 275px;
          max-width: 375px;
          max-height: 50vh;
          overflow-y: auto;
          background: #1a1a1a;
          border: 1px solid #444;
          border-radius: 8px;
          box-shadow: 0 -8px 24px rgba(0, 0, 0, 0.5);
          animation: slideUp 0.15s ease;
          z-index: 1000;
          -webkit-overflow-scrolling: touch;
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .model-dropdown .model-option {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.625rem 0.75rem;
          background: none;
          border: none;
          border-bottom: 1px solid #333;
          cursor: pointer;
          text-align: left;
          color: #ffffff;
          font-size: 0.875rem;
          transition: background 0.1s ease;
        }

        .model-dropdown .model-option:last-of-type {
          border-bottom: none;
        }

        .model-dropdown .model-option:hover {
          background: #2a2a2a;
        }

        .model-dropdown .model-option.selected {
          background: #333;
        }

        .model-dropdown .model-option .model-info {
          display: flex;
          flex-direction: column;
          gap: 0.125rem;
          flex: 1;
        }

        .model-dropdown .model-option .model-desc {
          font-size: 0.6875rem;
          color: #888;
        }

        .model-dropdown .model-option .check {
          margin-left: auto;
          color: #10b981;
          flex-shrink: 0;
        }

        .model-provider-header {
          padding: 0.5rem 0.75rem 0.375rem;
          font-size: 0.6875rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #666;
          background: #1a1a1a;
          border-bottom: 1px solid #333;
        }

        .model-provider-header:not(:first-child) {
          border-top: 1px solid #333;
          margin-top: 0.25rem;
        }

        .model-hint {
          padding: 0.375rem 0.75rem;
          background: #222;
          border-top: 1px solid #333;
          font-size: 0.6875rem;
          color: #666;
          text-align: center;
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
          gap: 0.25rem;
          padding-top: 0.25rem;
          border-top: 1px solid #333;
        }

        .actions-spacer {
          flex: 1;
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
          transition: color 0.2s;
        }

        .composer-btn.attach {
          padding: 0.375rem;
        }

        .composer-btn.attach:hover:not(:disabled) {
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

        .composer-btn.send {
          background: #ffffff;
          color: #000000;
          width: 40px;
          height: 40px;
          padding: 0;
          border-radius: 50%;
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

          .composer-btn.attach {
            min-width: 36px;
            min-height: 36px;
          }

          .composer-btn svg {
            width: 20px;
            height: 20px;
          }

          /* Model selector mobile adjustments */
          .inline-model-selector .model-selector-trigger {
            padding: 0.375rem 0.5rem;
          }

          .inline-model-selector .model-selector-trigger .model-name {
            max-width: 100px;
          }

          .model-dropdown {
            left: 0;
            right: auto;
            min-width: 250px;
            max-height: 45vh;
          }

          .composer-btn.send {
            width: 44px;
            height: 44px;
            padding: 0;
            border-radius: 50%;
          }

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

          .composer-hint {
            display: none;
          }

          /* Hide button labels on tablet */
          .composer-btn .btn-label {
            display: none;
          }

          .agents-dropdown,
          .creative-dropdown {
            min-width: 260px;
          }
        }

        /* Agents dropdown */
        .agents-menu-container,
        .creative-menu-container {
          position: relative;
        }

        .composer-btn.agents,
        .composer-btn.creative {
          display: flex;
          align-items: center;
          gap: 0.375rem;
          padding: 0.375rem 0.5rem;
          background: #2a2a2a;
          border: 1px solid #444;
          border-radius: 6px;
          font-size: 0.75rem;
          color: #aaa;
          transition: all 0.15s ease;
        }

        .composer-btn.agents:hover:not(:disabled),
        .composer-btn.creative:hover:not(:disabled) {
          background: #333;
          border-color: #555;
          color: #fff;
        }

        .composer-btn.agents.active {
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          border-color: #6366f1;
          color: #fff;
        }

        .composer-btn.agents svg,
        .composer-btn.creative svg {
          width: 16px;
          height: 16px;
        }

        .composer-btn .btn-label {
          font-weight: 500;
        }

        .active-indicator {
          width: 6px;
          height: 6px;
          background: #10b981;
          border-radius: 50%;
          animation: pulse 1.5s ease-in-out infinite;
        }

        @keyframes pulse {
          0%,
          100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }

        .agents-dropdown,
        .creative-dropdown {
          position: absolute;
          bottom: calc(100% + 8px);
          left: 0;
          min-width: 280px;
          background: #1a1a1a;
          border: 1px solid #444;
          border-radius: 10px;
          box-shadow: 0 -8px 24px rgba(0, 0, 0, 0.5);
          animation: slideUp 0.15s ease;
          z-index: 1000;
          overflow: hidden;
        }

        .agent-option,
        .creative-option {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem 1rem;
          background: none;
          border: none;
          border-bottom: 1px solid #333;
          cursor: pointer;
          text-align: left;
          transition: background 0.1s ease;
        }

        .agent-option:last-child,
        .creative-option:last-child {
          border-bottom: none;
        }

        .agent-option:hover:not(:disabled),
        .creative-option:hover:not(:disabled) {
          background: #2a2a2a;
        }

        .agent-option.selected {
          background: #2a2a2a;
        }

        .agent-option:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .agent-icon,
        .creative-icon {
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
          flex-shrink: 0;
        }

        .agent-icon svg,
        .creative-icon svg {
          width: 20px;
          height: 20px;
        }

        .agent-icon.deep-research {
          background: linear-gradient(135deg, #ec4899, #8b5cf6);
          color: #fff;
        }

        .agent-icon.strategy {
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          color: #fff;
        }

        .agent-icon.research {
          background: linear-gradient(135deg, #3b82f6, #06b6d4);
          color: #fff;
        }

        .creative-icon.create {
          background: linear-gradient(135deg, #f59e0b, #ef4444);
          color: #fff;
        }

        .creative-icon.edit {
          background: linear-gradient(135deg, #10b981, #3b82f6);
          color: #fff;
        }

        .agent-info,
        .creative-info {
          display: flex;
          flex-direction: column;
          gap: 0.125rem;
          flex: 1;
          min-width: 0;
        }

        .agent-name,
        .creative-name {
          font-size: 0.875rem;
          font-weight: 500;
          color: #fff;
        }

        .agent-desc,
        .creative-desc {
          font-size: 0.6875rem;
          color: #888;
        }

        .loading-spinner {
          width: 16px;
          height: 16px;
          border: 2px solid #444;
          border-top-color: #8b5cf6;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
          flex-shrink: 0;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
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

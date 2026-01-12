/**
 * CHAT COMPOSER COMPONENT
 *
 * PURPOSE:
 * - Text input with auto-resize
 * - File attachment with thumbnails or count badge
 * - Send message with keyboard shortcuts
 * - File upload validation (MIME, size)
 *
 * FEATURES:
 * - Auto-expanding textarea
 * - Drag-and-drop file upload
 * - File preview with remove option
 * - "N images attached" badge for multiple files
 * - Shift+Enter for new line, Enter to send
 * - Character/attachment count
 */

'use client';

import { useState, useRef, useEffect, KeyboardEvent, ChangeEvent, DragEvent } from 'react';
import { createPortal } from 'react-dom';
import type { Attachment, Message } from '@/app/chat/types';
import { compressImage, isImageFile } from '@/lib/utils/imageCompression';
// ConnectorsButton and RepoDropdown removed from main chat
// These developer tools are now in Code Lab only
// import { ConnectorsButton } from './ConnectorsButton';
// import { RepoDropdown } from './RepoDropdown';
import { useCodeExecutionOptional } from '@/contexts/CodeExecutionContext';
import { useTheme } from '@/contexts/ThemeContext';

// Tool mode types - includes search tools, document creation, and resume generator
export type ToolMode =
  | 'none'
  | 'search'
  | 'factcheck'
  | 'research'
  | 'doc_word'
  | 'doc_excel'
  | 'doc_pdf'
  | 'resume_generator';

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
  onStop?: () => void; // Called when user clicks stop button during streaming
  isStreaming: boolean;
  disabled?: boolean; // When waiting for background reply
  showSearchButtons?: boolean; // Show Search/Fact Check buttons (Anthropic only)
  replyingTo?: Message | null; // Message being replied to
  onClearReply?: () => void; // Clear the reply
  initialText?: string; // Pre-fill the input with text (for quick prompts)
}

/**
 * Read file content and parse if needed
 * - CSV/TXT: Read as text directly
 * - XLSX/PDF: Send to server for parsing to extract readable text
 */
async function readFileContent(file: File): Promise<string> {
  // For text files, read directly
  if (file.type === 'text/plain' || file.type === 'text/csv') {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }

  // For Excel and PDF, read as base64 then parse server-side
  const base64Content = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });

  // Send to parsing API
  try {
    const response = await fetch('/api/files/parse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileName: file.name,
        fileType: file.type,
        content: base64Content,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to parse file');
    }

    const result = await response.json();
    return result.parsedText || base64Content;
  } catch (error) {
    console.error('[ChatComposer] File parsing failed, using raw content:', error);
    // Fall back to base64 if parsing fails
    return base64Content;
  }
}

// Rotating placeholder suggestions to showcase AI capabilities
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

export function ChatComposer({
  onSendMessage,
  onStop,
  isStreaming,
  disabled,
  showSearchButtons,
  replyingTo,
  onClearReply,
  initialText,
}: ChatComposerProps) {
  // Get selected repo from context (optional - may not be in provider)
  const codeExecution = useCodeExecutionOptional();
  const selectedRepo = codeExecution?.selectedRepo;

  // Get theme for button styling
  const { theme } = useTheme();

  const suggestions = PLACEHOLDER_SUGGESTIONS;
  const [message, setMessage] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  // Tool mode state (search, research, document creation)
  const [toolMode, setToolMode] = useState<ToolMode>('none');
  // Tools menu visibility
  const [showToolsMenu, setShowToolsMenu] = useState(false);
  // Typewriter animation state
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [displayedText, setDisplayedText] = useState('');
  const [charIndex, setCharIndex] = useState(0);
  const [initialDelayComplete, setInitialDelayComplete] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  // Track if component is mounted in browser (for portal)
  const [isMounted, setIsMounted] = useState(false);
  // Track last applied initialText to prevent re-applying on message changes
  const lastInitialTextRef = useRef<string | undefined>(undefined);

  // Set mounted state on client-side (for portal rendering)
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Auto-focus the textarea on mount so cursor blinks immediately
  useEffect(() => {
    // Small delay to let page render first
    const timer = setTimeout(() => {
      if (textareaRef.current && !disabled && !isStreaming) {
        textareaRef.current.focus();
      }
    }, 100);
    return () => clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle initial text from quick prompts
  // Uses ref to track last applied value, avoiding message dependency
  useEffect(() => {
    if (initialText && initialText !== lastInitialTextRef.current) {
      lastInitialTextRef.current = initialText;
      setMessage(initialText);
      // Focus the textarea and move cursor to end
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(initialText.length, initialText.length);
      }
    }
  }, [initialText]);

  // Initial delay before starting placeholder animation (let welcome screen animate first)
  useEffect(() => {
    const timer = setTimeout(() => {
      setInitialDelayComplete(true);
    }, 1500); // 1.5 second delay
    return () => clearTimeout(timer);
  }, []);

  // Typewriter effect - type out each character
  useEffect(() => {
    if (!initialDelayComplete) return; // Wait for initial delay
    if (isFocused || message) return; // Don't animate when focused or has content

    const currentText = suggestions[placeholderIndex % suggestions.length];

    if (charIndex < currentText.length) {
      // Type next character
      const timer = setTimeout(() => {
        setDisplayedText(currentText.slice(0, charIndex + 1));
        setCharIndex(charIndex + 1);
      }, 50); // 50ms per character for smooth typing
      return () => clearTimeout(timer);
    } else {
      // Finished typing, wait then move to next suggestion
      const timer = setTimeout(() => {
        setPlaceholderIndex((prev) => (prev + 1) % suggestions.length);
        setDisplayedText('');
        setCharIndex(0);
      }, 2000); // Wait 2 seconds before next suggestion
      return () => clearTimeout(timer);
    }
  }, [charIndex, placeholderIndex, isFocused, message, initialDelayComplete, suggestions]);

  // Auto-resize textarea
  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
  };

  // Watch for message changes and adjust textarea height (needed for mic transcription)
  useEffect(() => {
    adjustTextareaHeight();
  }, [message]);

  const handleInputChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
    adjustTextareaHeight();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Only send on Enter for desktop (non-touch devices)
    // Mobile users should use the Send button
    const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    if (e.key === 'Enter' && !e.shiftKey && !isMobile) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = () => {
    if ((!message.trim() && attachments.length === 0) || isStreaming) {
      return;
    }

    // Convert selected repo to API format
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
    setAttachments([]);
    // Reset tool mode after sending
    setToolMode('none');

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    // Reset file inputs so user can upload again
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (photoInputRef.current) photoInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  // Select a tool mode (closes menu)
  const selectToolMode = (mode: ToolMode) => {
    setToolMode(mode);
    setShowToolsMenu(false);
  };

  // Clear tool mode
  const clearToolMode = () => {
    setToolMode('none');
  };

  // Get placeholder text based on tool mode
  const getPlaceholderForMode = (): string => {
    switch (toolMode) {
      case 'search':
        return 'Search the web...';
      case 'factcheck':
        return 'What do you want to fact check?';
      case 'research':
        return 'What would you like to research?';
      case 'doc_word':
        return 'Describe the Word document you need...';
      case 'doc_excel':
        return 'Describe the spreadsheet you need...';
      case 'doc_pdf':
        return 'Describe the PDF/invoice you need...';
      case 'resume_generator':
        return "Let's build your perfect resume...";
      default:
        return '';
    }
  };

  // Get tool mode display info
  const getToolModeInfo = (): { label: string; color: string; icon: JSX.Element } | null => {
    switch (toolMode) {
      case 'search':
        return {
          label: 'Web Search',
          color: '#3b82f6',
          icon: (
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
              />
            </svg>
          ),
        };
      case 'factcheck':
        return {
          label: 'Fact Check',
          color: '#10b981',
          icon: (
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          ),
        };
      case 'research':
        return {
          label: 'Deep Research',
          color: '#8b5cf6',
          icon: (
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
              />
            </svg>
          ),
        };
      case 'doc_word':
        return {
          label: 'Word Document',
          color: '#2563eb',
          icon: (
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          ),
        };
      case 'doc_excel':
        return {
          label: 'Excel Spreadsheet',
          color: '#16a34a',
          icon: (
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 10h18M3 14h18M9 4v16M15 4v16M4 4h16a1 1 0 011 1v14a1 1 0 01-1 1H4a1 1 0 01-1-1V5a1 1 0 011-1z"
              />
            </svg>
          ),
        };
      case 'doc_pdf':
        return {
          label: 'PDF Invoice',
          color: '#dc2626',
          icon: (
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 21h10a2 2 0 002-2V9l-5-5H7a2 2 0 00-2 2v13a2 2 0 002 2z"
              />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 3v6h6" />
            </svg>
          ),
        };
      case 'resume_generator':
        return {
          label: 'Resume Generator',
          color: '#7c3aed',
          icon: (
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
          ),
        };
      default:
        return null;
    }
  };

  const handleFileSelect = async (files: FileList | null) => {
    if (!files) return;

    // Clear previous errors
    setFileError(null);

    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB per file (before compression)
    const MAX_FILE_COUNT = 10; // 10 files maximum (API limit)
    const newAttachments: Attachment[] = [];
    const fileArray = Array.from(files);

    // Check file count limit
    const totalFileCount = attachments.length + fileArray.length;
    if (totalFileCount > MAX_FILE_COUNT) {
      setFileError(
        `Maximum ${MAX_FILE_COUNT} files allowed. You currently have ${attachments.length} file(s). Remove some files first.`
      );
      setTimeout(() => setFileError(null), 5000);
      return;
    }

    // Validate file type
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
      'text/plain',
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];

    for (const file of fileArray) {
      // Validate individual file size
      if (file.size > MAX_FILE_SIZE) {
        const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
        setFileError(`"${file.name}" is too large (${sizeMB}MB). Maximum file size is 10MB.`);
        setTimeout(() => setFileError(null), 5000);
        return;
      }

      // Validate file type
      if (!allowedTypes.includes(file.type)) {
        setFileError(
          `"${file.name}" file type not supported. Allowed: images, PDF, TXT, CSV, XLSX.`
        );
        setTimeout(() => setFileError(null), 5000);
        return;
      }

      // CRITICAL FIX: Batch all file processing to prevent state inconsistencies
      // Process images with compression to avoid 413 errors
      if (isImageFile(file)) {
        try {
          const compressed = await compressImage(file);
          const attachment: Attachment = {
            id: `${Date.now()}-${file.name}`,
            name: file.name,
            type: 'image/jpeg', // Compressed images are always JPEG
            size: compressed.compressedSize,
            thumbnail: compressed.dataUrl,
            url: compressed.dataUrl,
          };
          newAttachments.push(attachment); // Add to batch instead of immediate state update
        } catch (error) {
          console.error('[ChatComposer] Failed to compress image:', file.name, error);
          setFileError(`Failed to process "${file.name}". Please try a different image.`);
          setTimeout(() => setFileError(null), 5000);
          // Continue processing other files - don't return early
        }
      } else {
        // Non-image files: Read content for data analysis
        try {
          const fileContent = await readFileContent(file);
          const attachment: Attachment = {
            id: `${Date.now()}-${file.name}`,
            name: file.name,
            type: file.type,
            size: file.size,
            url: fileContent, // Store file content for API
          };
          newAttachments.push(attachment);
        } catch (error) {
          console.error('[ChatComposer] Failed to read file:', file.name, error);
          setFileError(`Failed to read "${file.name}". Please try again.`);
          setTimeout(() => setFileError(null), 5000);
          // Continue processing other files - don't return early
        }
      }
    }

    // CRITICAL FIX: Update state once with all successfully processed attachments
    if (newAttachments.length > 0) {
      setAttachments((prev) => [...prev, ...newAttachments]);
    }
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const removeAttachment = (id: string) => {
    setAttachments(attachments.filter((a) => a.id !== id));
  };

  return (
    <div className="py-2 px-2 md:px-4 md:py-3 pb-safe">
      <div className="mx-auto max-w-3xl">
        {/* Reply Preview */}
        {replyingTo && (
          <div
            className="mb-2 flex items-start gap-2 p-3 rounded-lg border"
            style={{ backgroundColor: 'var(--primary-hover)', borderColor: 'var(--primary)' }}
          >
            <svg
              className="h-4 w-4 mt-0.5 flex-shrink-0"
              style={{ color: 'var(--primary)' }}
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
              <span className="text-xs font-semibold" style={{ color: 'var(--primary)' }}>
                Replying to:
              </span>
              <p className="text-sm mt-1 line-clamp-2" style={{ color: 'var(--text-primary)' }}>
                {replyingTo.content.length > 150
                  ? replyingTo.content.slice(0, 150) + '...'
                  : replyingTo.content}
              </p>
            </div>
            <button
              onClick={onClearReply}
              className="p-1.5 rounded-full transition-colors flex-shrink-0"
              style={{ color: 'var(--text-muted)' }}
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
        {/* Attachments Preview */}
        {attachments.length > 0 && (
          <div className="mb-2 md:mb-3 flex flex-wrap gap-2 md:gap-3">
            {attachments.slice(0, 4).map((attachment) => {
              const isImage = attachment.type?.startsWith('image/');
              const isPdf = attachment.type === 'application/pdf';
              const isExcel =
                attachment.type?.includes('spreadsheet') ||
                attachment.type?.includes('excel') ||
                attachment.name?.endsWith('.xlsx') ||
                attachment.name?.endsWith('.xls');
              const isCsv = attachment.type === 'text/csv' || attachment.name?.endsWith('.csv');
              const isText = attachment.type === 'text/plain' || attachment.name?.endsWith('.txt');

              return (
                <button
                  key={attachment.id}
                  onClick={() => removeAttachment(attachment.id)}
                  className="relative h-16 w-16 md:h-20 md:w-20 overflow-hidden rounded-lg border border-white/20 bg-white/5 cursor-pointer hover:border-red-400/50 hover:bg-red-500/10 transition-colors group"
                  title="Tap to remove"
                  aria-label={`Remove ${attachment.name}`}
                >
                  {attachment.thumbnail && isImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={attachment.thumbnail}
                      alt={attachment.name}
                      className="h-full w-full object-cover group-hover:opacity-70 transition-opacity"
                    />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-1 p-1 group-hover:opacity-70 transition-opacity">
                      {/* File type icon */}
                      {isPdf ? (
                        <svg
                          className="h-6 w-6 md:h-8 md:w-8 text-red-400"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M7 21h10a2 2 0 002-2V9l-5-5H7a2 2 0 00-2 2v13a2 2 0 002 2z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M14 3v6h6"
                          />
                        </svg>
                      ) : isExcel || isCsv ? (
                        <svg
                          className="h-6 w-6 md:h-8 md:w-8 text-green-400"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M3 10h18M3 14h18M9 4v16M15 4v16M4 4h16a1 1 0 011 1v14a1 1 0 01-1 1H4a1 1 0 01-1-1V5a1 1 0 011-1z"
                          />
                        </svg>
                      ) : isText ? (
                        <svg
                          className="h-6 w-6 md:h-8 md:w-8 text-blue-400"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                          />
                        </svg>
                      ) : (
                        <svg
                          className="h-6 w-6 md:h-8 md:w-8 text-gray-400"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                          />
                        </svg>
                      )}
                      {/* File name */}
                      <span className="truncate text-[8px] md:text-[10px] text-gray-300 max-w-full px-0.5 text-center leading-tight">
                        {attachment.name.length > 12
                          ? attachment.name.slice(0, 10) + '...'
                          : attachment.name}
                      </span>
                    </div>
                  )}
                </button>
              );
            })}
            {attachments.length > 4 && (
              <div className="flex h-16 w-16 md:h-20 md:w-20 items-center justify-center rounded-lg bg-white/5 text-sm text-gray-400 border border-white/20">
                +{attachments.length - 4}
              </div>
            )}
          </div>
        )}

        {/* Input Area - Clean Claude-style design */}
        <div
          className={`chat-input-glass relative rounded-3xl transition-all ${isDragging ? 'opacity-80' : ''}`}
          style={{
            backgroundColor: 'var(--chat-input-bg)',
          }}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="relative">
            {/* Typewriter placeholder overlay - shows tool mode placeholder when active */}
            {!isFocused && !message && !isDragging && (
              <div
                className="absolute inset-0 flex items-center pointer-events-none px-4 py-3"
                style={{ fontSize: '16px' }}
              >
                {toolMode !== 'none' ? (
                  // Tool mode placeholder (static, no animation)
                  <span
                    className="font-medium"
                    style={{ color: getToolModeInfo()?.color || 'var(--primary)' }}
                  >
                    {getPlaceholderForMode()}
                  </span>
                ) : (
                  // Normal typewriter animation
                  <span className="font-medium" style={{ color: 'var(--text-muted)' }}>
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
              className="w-full resize-none bg-transparent px-4 py-3 text-base focus:outline-none min-h-[48px]"
              rows={1}
              disabled={isStreaming || disabled}
              style={{ fontSize: '16px', color: 'var(--text-primary)' }}
            />
          </div>

          {/* Action Bar */}
          <div className="flex items-center justify-between px-2 pb-2">
            {/* Left side - attachment and tools */}
            <div className="flex items-center gap-1">
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
                className="rounded-full p-2 disabled:opacity-50 flex items-center justify-center transition-colors hover:bg-white/10"
                style={{ color: 'var(--text-muted)' }}
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
              {toolMode !== 'none' && getToolModeInfo() && (
                <div
                  className="flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium"
                  style={{
                    backgroundColor: `${getToolModeInfo()!.color}20`,
                    color: getToolModeInfo()!.color,
                  }}
                >
                  {getToolModeInfo()!.icon}
                  <span>{getToolModeInfo()!.label}</span>
                  <button onClick={clearToolMode} className="ml-1 hover:opacity-70" title="Clear">
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

              {/* Agents button */}
              {showSearchButtons && toolMode === 'none' && (
                <button
                  onClick={() => setShowToolsMenu(!showToolsMenu)}
                  disabled={isStreaming || disabled}
                  className="rounded-full px-3 py-1.5 disabled:opacity-50 flex items-center gap-1.5 transition-colors text-sm"
                  style={{ color: 'var(--text-muted)' }}
                  title="AI Agents"
                >
                  <span>Agents</span>
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>
              )}
            </div>

            {/* Right side - send button */}
            <div className="flex items-center">
              {isStreaming && onStop ? (
                <button
                  onClick={onStop}
                  className="rounded-full p-2 transition-all flex items-center justify-center"
                  title="Stop generating"
                  style={{ backgroundColor: 'var(--primary)', color: 'white' }}
                >
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                    <rect x="6" y="6" width="12" height="12" rx="2" />
                  </svg>
                </button>
              ) : (
                <button
                  onClick={handleSend}
                  disabled={
                    (!message.trim() && attachments.length === 0) || isStreaming || disabled
                  }
                  className="rounded-full p-2 transition-all flex items-center justify-center disabled:opacity-30"
                  title="Send message"
                  style={{
                    backgroundColor:
                      (!message.trim() && attachments.length === 0) || disabled
                        ? 'var(--text-muted)'
                        : 'var(--primary)',
                    color:
                      (!message.trim() && attachments.length === 0) || disabled
                        ? 'white'
                        : theme === 'light'
                          ? 'white'
                          : 'black',
                  }}
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

        {/* File Upload Error */}
        {fileError && <p className="mt-0 text-xs text-red-400">⚠️ {fileError}</p>}
      </div>

      {/* Attachment menu - rendered via Portal to avoid z-index/stacking context issues */}
      {/* The glass-morphism backdrop-filter creates a containing block that traps fixed elements */}
      {showAttachMenu &&
        isMounted &&
        createPortal(
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-[9998] bg-black/20 backdrop-blur-sm"
              onClick={() => setShowAttachMenu(false)}
              aria-hidden="true"
            />
            {/* Menu */}
            <div className="fixed bottom-24 left-4 z-[9999] w-56 rounded-lg border border-white/10 bg-zinc-900 shadow-xl">
              <button
                onClick={() => {
                  cameraInputRef.current?.click();
                  setShowAttachMenu(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-white hover:bg-white/10 transition-colors rounded-t-lg"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                Take a Photo
              </button>
              <button
                onClick={() => {
                  photoInputRef.current?.click();
                  setShowAttachMenu(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-white hover:bg-white/10 transition-colors border-t border-white/10"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                Upload Photo
              </button>
              <button
                onClick={() => {
                  fileInputRef.current?.click();
                  setShowAttachMenu(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-white hover:bg-white/10 transition-colors border-t border-white/10 rounded-b-lg"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                  />
                </svg>
                Upload File
              </button>
            </div>
          </>,
          document.body
        )}

      {/* Agents menu - rendered via Portal */}
      {showToolsMenu &&
        isMounted &&
        createPortal(
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-[9998] bg-black/20 backdrop-blur-sm"
              onClick={() => setShowToolsMenu(false)}
              aria-hidden="true"
            />
            {/* Menu - Clean text-only style */}
            <div className="fixed bottom-24 left-4 z-[9999] w-52 rounded-lg border border-white/10 bg-zinc-900 shadow-xl overflow-hidden">
              {/* Featured - Resume Generator */}
              <button
                onClick={() => selectToolMode('resume_generator')}
                className="w-full text-left px-3 py-2.5 text-sm font-medium text-white hover:bg-violet-600/20 transition-colors flex items-center gap-2 bg-violet-600/10 border-b border-white/10"
              >
                <svg
                  className="h-4 w-4 text-violet-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
                <span className="text-violet-300">Resume Generator</span>
                <span className="ml-auto text-[10px] bg-violet-500/30 text-violet-300 px-1.5 py-0.5 rounded">
                  ATS
                </span>
              </button>

              {/* Search Agents */}
              <div className="px-3 py-1.5 text-[10px] font-medium text-slate-500 uppercase tracking-wider">
                Search
              </div>
              <button
                onClick={() => selectToolMode('search')}
                className="w-full text-left px-3 py-2 text-sm text-white hover:bg-white/10 transition-colors"
              >
                Web Search
              </button>
              <button
                onClick={() => selectToolMode('factcheck')}
                className="w-full text-left px-3 py-2 text-sm text-white hover:bg-white/10 transition-colors"
              >
                Fact Check
              </button>
              <button
                onClick={() => selectToolMode('research')}
                className="w-full text-left px-3 py-2 text-sm text-white hover:bg-white/10 transition-colors"
              >
                Deep Research
              </button>

              {/* Documents */}
              <div className="px-3 py-1.5 text-[10px] font-medium text-slate-500 uppercase tracking-wider border-t border-white/10 mt-1">
                Create Document
              </div>
              <button
                onClick={() => selectToolMode('doc_word')}
                className="w-full text-left px-3 py-2 text-sm text-white hover:bg-white/10 transition-colors"
              >
                Word Document
              </button>
              <button
                onClick={() => selectToolMode('doc_excel')}
                className="w-full text-left px-3 py-2 text-sm text-white hover:bg-white/10 transition-colors"
              >
                Excel Spreadsheet
              </button>
              <button
                onClick={() => selectToolMode('doc_pdf')}
                className="w-full text-left px-3 py-2 text-sm text-white hover:bg-white/10 transition-colors rounded-b-lg"
              >
                PDF Invoice
              </button>
            </div>
          </>,
          document.body
        )}
    </div>
  );
}

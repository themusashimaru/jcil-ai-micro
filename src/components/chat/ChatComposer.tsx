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
import type { Attachment, Message, GeneratedImage } from '@/app/chat/types';
import { compressImage, isImageFile } from '@/lib/utils/imageCompression';
import { useVoiceInput } from '@/hooks/useVoiceInput';
// ConnectorsButton and RepoDropdown removed from main chat
// These developer tools are now in Code Lab only
// import { ConnectorsButton } from './ConnectorsButton';
// import { RepoDropdown } from './RepoDropdown';
import { ChatMCPButton } from './ChatMCPSettings';
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

// Tool mode types - search and research tools only
// Document generation is now integrated into regular chat for all users
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
  onStop?: () => void; // Called when user clicks stop button during streaming
  isStreaming: boolean;
  disabled?: boolean; // When waiting for background reply
  replyingTo?: Message | null; // Message being replied to
  onClearReply?: () => void; // Clear the reply
  initialText?: string; // Pre-fill the input with text (for quick prompts)
  // Agent props
  isAdmin?: boolean;
  activeAgent?: 'research' | 'strategy' | 'deep-research' | null;
  onAgentSelect?: (agent: 'research' | 'strategy' | 'deep-research') => Promise<void> | void;
  strategyLoading?: boolean; // Show loading state while strategy starts
  deepResearchLoading?: boolean; // Show loading state while deep research starts
  // External modal control (for carousel integration)
  openCreateImage?: boolean;
  openEditImage?: boolean;
  onCloseCreateImage?: () => void;
  onCloseEditImage?: () => void;
  // Inline creative mode callback (replaces modals)
  onCreativeMode?: (mode: 'create-image' | 'edit-image' | 'view-gallery') => void;
  // Current conversation ID (for linking generated images)
  conversationId?: string;
  // Callback when image is generated (to add to conversation)
  onImageGenerated?: (image: GeneratedImage) => void;
  // AI Provider selection
  selectedProvider?: ProviderId;
  onProviderChange?: (provider: ProviderId) => void;
  configuredProviders?: ProviderId[];
}

/**
 * Read file content and parse if needed
 * - CSV: Read as text directly (also suitable for analytics)
 * - XLSX: Keep base64 for analytics, also parse for AI context
 * - TXT: Read as text directly
 * - PDF: Parse to extract readable text
 */
async function readFileContent(file: File): Promise<{ content: string; rawData?: string }> {
  // For CSV files, read as text - this IS the data we need for analytics
  if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
    const textContent = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
    return { content: textContent, rawData: textContent };
  }

  // For plain text files, read directly
  if (file.type === 'text/plain') {
    const textContent = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
    return { content: textContent };
  }

  // For Excel and PDF, read as base64
  const base64Content = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });

  // For Excel files, keep raw data for analytics
  const isExcel =
    file.type === 'application/vnd.ms-excel' ||
    file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    file.name.endsWith('.xlsx') ||
    file.name.endsWith('.xls');

  // Send to parsing API to get readable text for AI context
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
    return {
      content: result.parsedText || base64Content,
      rawData: isExcel ? base64Content : undefined, // Keep raw data for Excel analytics
    };
  } catch (error) {
    console.error('[ChatComposer] File parsing failed, using raw content:', error);
    return {
      content: base64Content,
      rawData: isExcel ? base64Content : undefined,
    };
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

// Provider configuration for the selector
const PROVIDER_CONFIG: Record<
  ProviderId,
  { name: string; shortName: string; icon: string; color: string; description: string }
> = {
  claude: {
    name: 'Claude',
    shortName: 'Claude',
    icon: '🟣',
    color: '#8B5CF6',
    description: 'Anthropic Claude - best for complex reasoning',
  },
  openai: {
    name: 'OpenAI',
    shortName: 'GPT',
    icon: '🟢',
    color: '#10B981',
    description: 'GPT-5 - versatile general-purpose AI',
  },
  xai: {
    name: 'xAI Grok',
    shortName: 'Grok',
    icon: '⚡',
    color: '#F59E0B',
    description: 'Grok 4 - real-time knowledge',
  },
  deepseek: {
    name: 'DeepSeek',
    shortName: 'DeepSeek',
    icon: '🔵',
    color: '#3B82F6',
    description: 'DeepSeek R1 - cost-effective reasoning',
  },
  google: {
    name: 'Google Gemini',
    shortName: 'Gemini',
    icon: '🔴',
    color: '#EA4335',
    description: 'Gemini 3 - massive context window',
  },
};

export function ChatComposer({
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
  // Agents dropdown state
  const [showAgentsMenu, setShowAgentsMenu] = useState(false);
  const agentsButtonRef = useRef<HTMLButtonElement>(null);
  const agentsMenuRef = useRef<HTMLDivElement>(null);
  // Provider selector dropdown state
  const [showProviderMenu, setShowProviderMenu] = useState(false);
  const providerButtonRef = useRef<HTMLButtonElement>(null);
  const providerMenuRef = useRef<HTMLDivElement>(null);
  // Creative mode state
  const [creativeMode, setCreativeMode] = useState<CreativeMode | null>(null);
  const [showCreateImageModal, setShowCreateImageModal] = useState(false);
  const [showEditImageModal, setShowEditImageModal] = useState(false);
  const [showGalleryModal, setShowGalleryModal] = useState(false);

  // Voice input hook
  const {
    isRecording,
    isProcessing: isTranscribing,
    toggleRecording,
    isSupported: isVoiceSupported,
  } = useVoiceInput({
    onTranscript: (text) => {
      // Append transcribed text to message
      setMessage((prev) => (prev ? `${prev} ${text}` : text));
    },
    onError: (error) => {
      console.error('[Voice] Transcription error:', error);
    },
  });

  // External modal control - sync with external state
  useEffect(() => {
    if (openCreateImage) {
      setShowCreateImageModal(true);
    }
  }, [openCreateImage]);

  useEffect(() => {
    if (openEditImage) {
      setShowEditImageModal(true);
    }
  }, [openEditImage]);

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

  // Close agents menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      // Check if click is inside the button OR inside the dropdown menu
      const isInsideButton = agentsButtonRef.current?.contains(target);
      const isInsideMenu = agentsMenuRef.current?.contains(target);

      if (showAgentsMenu && !isInsideButton && !isInsideMenu) {
        setShowAgentsMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showAgentsMenu]);

  // Close provider menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      const isInsideButton = providerButtonRef.current?.contains(target);
      const isInsideMenu = providerMenuRef.current?.contains(target);

      if (showProviderMenu && !isInsideButton && !isInsideMenu) {
        setShowProviderMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showProviderMenu]);

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
    // Block sending if: empty, streaming, disabled, or strategy is loading
    if (
      (!message.trim() && attachments.length === 0) ||
      isStreaming ||
      disabled ||
      strategyLoading
    ) {
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

  // Clear tool mode
  const clearToolMode = () => {
    setToolMode('none');
  };

  // Get placeholder text based on tool mode or active agent
  const getPlaceholderForMode = (): string => {
    // Check active agent first (Strategy/Deep Research mode from parent)
    if (activeAgent === 'strategy') {
      return 'Describe your complex problem or decision...';
    }
    if (activeAgent === 'deep-research') {
      return 'What topic do you want to research in depth?';
    }

    switch (toolMode) {
      case 'search':
        return 'Search the web...';
      case 'factcheck':
        return 'What do you want to fact check?';
      case 'research':
        return 'What would you like to research?';
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
          const { content, rawData } = await readFileContent(file);
          const attachment: Attachment = {
            id: `${Date.now()}-${file.name}`,
            name: file.name,
            type: file.type,
            size: file.size,
            url: content, // Parsed content for AI context
            rawData: rawData, // Raw data for analytics (CSV/Excel)
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
            {/* Typewriter placeholder overlay - shows tool mode or agent placeholder when active */}
            {!isFocused && !message && !isDragging && (
              <div
                className="absolute inset-0 flex items-center pointer-events-none px-4 py-3"
                style={{ fontSize: '16px' }}
              >
                {toolMode !== 'none' ||
                activeAgent === 'strategy' ||
                activeAgent === 'deep-research' ? (
                  // Tool mode or agent placeholder (static, no animation)
                  <span
                    className="font-medium"
                    style={{
                      color:
                        activeAgent === 'strategy'
                          ? '#a855f7' // Purple for Strategy
                          : activeAgent === 'deep-research'
                            ? '#10b981' // Emerald for Deep Research
                            : getToolModeInfo()?.color || 'var(--primary)',
                    }}
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

              {/* AI Provider selector - admin only, positioned after paperclip, before MCP */}
              {isAdmin && onProviderChange && (
                <div className="relative flex items-center">
                  <button
                    ref={providerButtonRef}
                    onClick={() => setShowProviderMenu(!showProviderMenu)}
                    disabled={isStreaming || disabled}
                    className="disabled:opacity-50 flex items-center gap-1 transition-all text-xs hover:opacity-80"
                    style={{
                      color: 'var(--text-primary)',
                    }}
                    title="Select AI Provider"
                  >
                    <span>LLM</span>
                    <svg
                      className={`w-3 h-3 transition-transform ${showProviderMenu ? 'rotate-180' : ''}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </button>

                  {/* Provider dropdown menu */}
                  {showProviderMenu && (
                    <div
                      ref={providerMenuRef}
                      className="absolute bottom-full left-0 mb-2 w-64 rounded-xl shadow-xl overflow-hidden z-50"
                      style={{
                        backgroundColor: 'var(--surface-elevated)',
                        border: '1px solid var(--border)',
                      }}
                    >
                      <div className="p-2" style={{ borderBottom: '1px solid var(--border)' }}>
                        <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                          Select AI Provider
                        </p>
                      </div>
                      <div className="p-1">
                        {(Object.keys(PROVIDER_CONFIG) as ProviderId[]).map((providerId) => {
                          const provider = PROVIDER_CONFIG[providerId];
                          const isConfigured = configuredProviders.includes(providerId);
                          const isSelected = providerId === selectedProvider;

                          return (
                            <button
                              key={providerId}
                              onClick={() => {
                                if (isConfigured) {
                                  onProviderChange(providerId);
                                  setShowProviderMenu(false);
                                }
                              }}
                              disabled={!isConfigured}
                              className="w-full flex items-center gap-2 p-2 rounded-lg transition-colors"
                              style={{
                                backgroundColor: isSelected ? 'var(--glass-bg)' : 'transparent',
                                color: isSelected
                                  ? 'var(--text-primary)'
                                  : isConfigured
                                    ? 'var(--text-secondary)'
                                    : 'var(--text-muted)',
                                opacity: isConfigured ? 1 : 0.5,
                                cursor: isConfigured ? 'pointer' : 'not-allowed',
                              }}
                            >
                              <p className="text-sm font-medium">{provider.name}</p>
                              {!isConfigured && (
                                <span
                                  className="text-[10px] px-1.5 py-0.5 rounded"
                                  style={{
                                    backgroundColor: 'var(--glass-bg)',
                                    color: 'var(--text-muted)',
                                  }}
                                >
                                  Not configured
                                </span>
                              )}
                              {isSelected && isConfigured && (
                                <svg
                                  className="w-4 h-4 ml-auto"
                                  style={{ color: 'var(--text-muted)' }}
                                  fill="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                                </svg>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* MCP Servers button */}
              <ChatMCPButton disabled={isStreaming || disabled} />

              {/* Active tool mode indicator - excludes research since it shows inline */}
              {toolMode !== 'none' && toolMode !== 'research' && getToolModeInfo() && (
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

              {/* Agents dropdown button - unified entry point for all agents */}
              {onAgentSelect && (
                <div className="relative flex items-center">
                  <button
                    ref={agentsButtonRef}
                    onClick={() => setShowAgentsMenu(!showAgentsMenu)}
                    disabled={isStreaming || disabled}
                    className="disabled:opacity-50 flex items-center gap-1 transition-all text-xs hover:opacity-80"
                    style={{
                      color:
                        toolMode === 'research' ||
                        activeAgent === 'strategy' ||
                        activeAgent === 'deep-research'
                          ? '#c4b5fd'
                          : 'var(--text-primary)',
                    }}
                    title="Select an AI Agent"
                  >
                    <span>
                      {strategyLoading || deepResearchLoading
                        ? 'Starting...'
                        : toolMode === 'research'
                          ? 'Research'
                          : activeAgent === 'strategy'
                            ? 'Strategy'
                            : activeAgent === 'deep-research'
                              ? 'Deep Research'
                              : 'Agents'}
                    </span>
                    {(strategyLoading || deepResearchLoading) && (
                      <span className="w-1.5 h-1.5 bg-yellow-400 rounded-full animate-pulse" />
                    )}
                    {!strategyLoading &&
                      !deepResearchLoading &&
                      (toolMode === 'research' ||
                        activeAgent === 'strategy' ||
                        activeAgent === 'deep-research') && (
                        <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                      )}
                    <svg
                      className={`w-3 h-3 transition-transform ${showAgentsMenu ? 'rotate-180' : ''}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </button>

                  {/* Dropdown menu */}
                  {showAgentsMenu && (
                    <div
                      ref={agentsMenuRef}
                      className="absolute bottom-full left-0 mb-2 w-64 rounded-xl shadow-xl overflow-hidden z-50"
                      style={{
                        backgroundColor: 'var(--surface-elevated)',
                        border: '1px solid var(--border)',
                      }}
                    >
                      <div className="p-2" style={{ borderBottom: '1px solid var(--border)' }}>
                        <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                          Select an Agent
                        </p>
                      </div>
                      <div className="p-1">
                        {/* Regular Chat - Exit agent mode */}
                        {(toolMode === 'research' ||
                          activeAgent === 'strategy' ||
                          activeAgent === 'deep-research') && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              // Exit strategy mode if active
                              if (activeAgent === 'strategy') {
                                onAgentSelect?.('strategy'); // Toggle off
                              }
                              // Exit deep research mode if active
                              if (activeAgent === 'deep-research') {
                                onAgentSelect?.('deep-research'); // Toggle off
                              }
                              // Exit research mode if active
                              setToolMode('none');
                              setShowAgentsMenu(false);
                            }}
                            className="w-full flex items-center gap-2 p-2 rounded-lg transition-colors mb-1"
                            style={{ color: 'var(--text-secondary)' }}
                          >
                            <p className="text-sm font-medium">Exit Agent Mode</p>
                          </button>
                        )}

                        {/* Research Agent - Available to all */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            // If Strategy or Deep Research is active, notify parent to exit first
                            if (activeAgent === 'strategy') {
                              onAgentSelect?.('research');
                            }
                            if (activeAgent === 'deep-research') {
                              onAgentSelect?.('deep-research');
                            }
                            // Toggle research mode internally
                            setToolMode(toolMode === 'research' ? 'none' : 'research');
                            setShowAgentsMenu(false);
                          }}
                          className="w-full flex items-center gap-2 p-2 rounded-lg transition-colors"
                          style={{
                            backgroundColor:
                              toolMode === 'research' ? 'var(--glass-bg)' : 'transparent',
                            color:
                              toolMode === 'research'
                                ? 'var(--text-primary)'
                                : 'var(--text-secondary)',
                          }}
                        >
                          <p className="text-sm font-medium">Research Agent</p>
                          {toolMode === 'research' && (
                            <svg
                              className="w-4 h-4 ml-auto"
                              style={{ color: 'var(--text-muted)' }}
                              fill="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                            </svg>
                          )}
                        </button>

                        {/* Deep Strategy Agent - Available to all users */}
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            // Close menu first for immediate feedback
                            setShowAgentsMenu(false);
                            // Then await the async operation
                            await onAgentSelect?.('strategy');
                          }}
                          className="w-full flex items-center gap-2 p-2 rounded-lg transition-colors"
                          style={{
                            backgroundColor:
                              activeAgent === 'strategy' ? 'var(--glass-bg)' : 'transparent',
                            color:
                              activeAgent === 'strategy'
                                ? 'var(--text-primary)'
                                : 'var(--text-secondary)',
                          }}
                        >
                          <p className="text-sm font-medium">Deep Strategy Agent</p>
                          {activeAgent === 'strategy' && (
                            <svg
                              className="w-4 h-4 ml-auto"
                              style={{ color: 'var(--text-muted)' }}
                              fill="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                            </svg>
                          )}
                        </button>

                        {/* Deep Research Agent - Available to all users */}
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            setShowAgentsMenu(false);
                            await onAgentSelect?.('deep-research');
                          }}
                          className="w-full flex items-center gap-2 p-2 rounded-lg transition-colors"
                          style={{
                            backgroundColor:
                              activeAgent === 'deep-research' ? 'var(--glass-bg)' : 'transparent',
                            color:
                              activeAgent === 'deep-research'
                                ? 'var(--text-primary)'
                                : 'var(--text-secondary)',
                          }}
                        >
                          <p className="text-sm font-medium">Deep Research Agent</p>
                          {activeAgent === 'deep-research' && (
                            <svg
                              className="w-4 h-4 ml-auto"
                              style={{ color: 'var(--text-muted)' }}
                              fill="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Creative button - Image generation, editing, slides */}
              <CreativeButton
                disabled={isStreaming || disabled}
                activeMode={creativeMode}
                onSelect={(mode) => {
                  // Use inline mode callback if provided (preferred)
                  if (onCreativeMode) {
                    onCreativeMode(mode);
                    return;
                  }
                  // Fallback to modals for backward compatibility
                  if (mode === 'view-gallery') {
                    setShowGalleryModal(true);
                  } else {
                    setCreativeMode(mode);
                    if (mode === 'create-image') {
                      setShowCreateImageModal(true);
                    } else if (mode === 'edit-image') {
                      setShowEditImageModal(true);
                    }
                  }
                }}
              />
            </div>

            {/* Right side - mic and send buttons */}
            <div className="flex items-center gap-1">
              {/* Mic button - voice input */}
              {isVoiceSupported && (
                <button
                  onClick={toggleRecording}
                  disabled={isStreaming || disabled || isTranscribing}
                  className={`rounded-full p-1.5 transition-all flex items-center justify-center ${
                    isRecording ? 'animate-pulse' : ''
                  }`}
                  title={isRecording ? 'Stop recording' : isTranscribing ? 'Transcribing...' : 'Voice input'}
                  style={{
                    backgroundColor: isRecording
                      ? 'var(--error, #ef4444)'
                      : 'transparent',
                    color: isRecording
                      ? 'white'
                      : isTranscribing
                        ? 'var(--primary)'
                        : 'var(--text-muted)',
                  }}
                >
                  {isTranscribing ? (
                    // Loading spinner
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
                    // Microphone icon
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                      />
                    </svg>
                  )}
                </button>
              )}

              {/* Send/Stop button */}
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
                  className={`rounded-full p-2 transition-all flex items-center justify-center send-btn ${
                    (!message.trim() && attachments.length === 0) || disabled
                      ? 'send-btn-disabled'
                      : 'send-btn-enabled'
                  }`}
                  title="Send message"
                  style={{
                    backgroundColor:
                      (!message.trim() && attachments.length === 0) || disabled
                        ? 'var(--button-disabled-bg)'
                        : 'var(--primary)',
                    color:
                      (!message.trim() && attachments.length === 0) || disabled
                        ? 'var(--text-muted)'
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
          // Optionally open create modal with the prompt
          setCreativeMode('create-image');
          setShowCreateImageModal(true);
        }}
      />
    </div>
  );
}

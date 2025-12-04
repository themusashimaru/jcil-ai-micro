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
import type { Attachment } from '@/app/chat/types';
// REMOVED: QuickImageGenerator - chat now handles image generation naturally
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { compressImage, isImageFile } from '@/lib/utils/imageCompression';

interface ChatComposerProps {
  onSendMessage: (content: string, attachments: Attachment[]) => void;
  isStreaming: boolean;
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
  'Create an image...',
  'Write a resume...',
  'Draft an email...',
  'Analyze data...',
  'Generate an invoice...',
  'Translate text...',
  'Research a topic...',
  'Write code...',
  'Plan a trip...',
];

export function ChatComposer({ onSendMessage, isStreaming }: ChatComposerProps) {
  const [message, setMessage] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  // Typewriter animation state
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [displayedText, setDisplayedText] = useState('');
  const [charIndex, setCharIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Audio recording (mic-to-text using Whisper)
  const { recordingState, error: recordingError, startRecording, stopRecording } = useAudioRecorder();

  // Typewriter effect - type out each character
  useEffect(() => {
    if (isFocused || message) return; // Don't animate when focused or has content

    const currentText = PLACEHOLDER_SUGGESTIONS[placeholderIndex];

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
        setPlaceholderIndex((prev) => (prev + 1) % PLACEHOLDER_SUGGESTIONS.length);
        setDisplayedText('');
        setCharIndex(0);
      }, 2000); // Wait 2 seconds before next suggestion
      return () => clearTimeout(timer);
    }
  }, [charIndex, placeholderIndex, isFocused, message]);

  // Auto-resize textarea
  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
  };

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

    onSendMessage(message.trim(), attachments);
    setMessage('');
    setAttachments([]);

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    // Reset file inputs so user can upload again
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (photoInputRef.current) photoInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
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
      setFileError(`Maximum ${MAX_FILE_COUNT} files allowed. You currently have ${attachments.length} file(s). Remove some files first.`);
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
        setFileError(`"${file.name}" file type not supported. Allowed: images, PDF, TXT, CSV, XLSX.`);
        setTimeout(() => setFileError(null), 5000);
        return;
      }

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
          setAttachments((prev) => [...prev, attachment]);
        } catch (error) {
          console.error('[ChatComposer] Failed to compress image:', file.name, error);
          setFileError(`Failed to process "${file.name}". Please try a different image.`);
          setTimeout(() => setFileError(null), 5000);
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
        }
      }
    }

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

  const handleMicClick = async () => {
    if (recordingState === 'idle') {
      // Start recording
      await startRecording();
    } else if (recordingState === 'recording') {
      // Stop recording and transcribe
      try {
        const transcribedText = await stopRecording();
        // Append transcribed text to current message
        setMessage((prev) => (prev ? prev + ' ' + transcribedText : transcribedText));
        // Adjust textarea height after adding text
        setTimeout(adjustTextareaHeight, 0);
      } catch (error) {
        console.error('Transcription failed:', error);
      }
    }
  };

  return (
    <div className="glass-morphism border-t border-white/10 py-0 px-1 md:p-4 pb-safe">
      <div className="mx-auto max-w-[98%] sm:max-w-xl md:max-w-2xl">
        {/* Attachments Preview */}
        {attachments.length > 0 && (
          <div className="mb-2 md:mb-3 flex flex-wrap gap-2 md:gap-3">
            {attachments.slice(0, 4).map((attachment) => (
              <div
                key={attachment.id}
                className="relative h-16 w-16 md:h-20 md:w-20 overflow-hidden rounded-lg border border-white/20 bg-white/5"
              >
                {attachment.thumbnail ? (
                  <img
                    src={attachment.thumbnail}
                    alt={attachment.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-white/5">
                    <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24">
                      <path
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                      />
                    </svg>
                  </div>
                )}
                {/* Bold red X in top-right corner */}
                <button
                  onClick={() => removeAttachment(attachment.id)}
                  className="absolute top-0 right-0 m-1 hover:opacity-70 transition-opacity"
                  aria-label="Remove attachment"
                >
                  <svg
                    className="text-red-500"
                    width="10"
                    height="10"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={4}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
            {attachments.length > 4 && (
              <div className="flex h-16 w-16 md:h-20 md:w-20 items-center justify-center rounded-lg bg-white/5 text-sm text-gray-400 border border-white/20">
                +{attachments.length - 4}
              </div>
            )}
          </div>
        )}

        {/* Input Area */}
        <div
          className={`rounded-lg border transition-colors ${
            isDragging
              ? 'border-white/40 bg-white/10'
              : 'border-white/10 bg-white/5'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="relative">
            {/* Typewriter placeholder overlay */}
            {!isFocused && !message && recordingState !== 'recording' && !isDragging && (
              <div
                className="absolute inset-0 flex items-center pointer-events-none py-1.5 px-2 md:p-4"
                style={{ fontSize: '16px' }}
              >
                <span className="text-[#4DFFFF] font-medium">
                  {displayedText}
                  <span className="animate-pulse">|</span>
                </span>
              </div>
            )}
            <textarea
              ref={textareaRef}
              value={message}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder={
                recordingState === 'recording'
                  ? 'Listening...'
                  : isDragging
                  ? 'Drop files here...'
                  : ''
              }
              className="w-full resize-none bg-transparent py-1.5 px-2 md:p-4 text-base md:text-base text-white placeholder-[#4DFFFF] focus:outline-none min-h-[40px]"
              rows={1}
              disabled={isStreaming}
              style={{ fontSize: '16px' }}
            />
          </div>

          {/* Action Bar */}
          <div className="flex items-center justify-between border-t border-white/10 py-2 px-1 md:p-2">
            <div className="relative flex items-center gap-1 md:gap-2 overflow-x-auto scrollbar-hide scroll-smooth">
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
                disabled={isStreaming}
                className="rounded-lg p-1 md:p-2 text-[#4DFFFF] hover:bg-white/10 hover:text-white disabled:opacity-50 shrink-0 flex items-center justify-center"
                title="Attach files"
              >
                <svg className="h-4 w-4 md:h-5 md:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                  />
                </svg>
              </button>

              {/* REMOVED: Quick Image Generator, Coding Assistant, Data Analysis buttons
                  Chat now handles all of these naturally through conversation */}
            </div>

            <div className="flex items-center justify-center gap-0 md:gap-2 shrink-0">

              {/* Microphone Button */}
              <button
                onClick={handleMicClick}
                disabled={isStreaming || recordingState === 'transcribing'}
                className={`rounded-lg p-1 md:p-2 transition shrink-0 flex items-center justify-center ${
                  recordingState === 'recording'
                    ? 'bg-red-500 text-white animate-pulse'
                    : 'text-[#4DFFFF] hover:bg-white/10 hover:text-white'
                } disabled:opacity-50`}
                title={
                  recordingState === 'idle'
                    ? 'Start recording'
                    : recordingState === 'recording'
                    ? 'Stop recording'
                    : 'Transcribing...'
                }
              >
                {recordingState === 'transcribing' ? (
                  <svg className="h-4 w-4 md:h-5 md:w-5 animate-spin" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                ) : (
                  <svg className="h-4 w-4 md:h-5 md:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                    />
                  </svg>
                )}
              </button>

              <button
                onClick={handleSend}
                disabled={(!message.trim() && attachments.length === 0) || isStreaming}
                className="rounded-full bg-black border-2 border-[#4DFFFF] p-0.5 md:p-2.5 text-[#4DFFFF] transition-all hover:bg-[#4DFFFF]/10 disabled:opacity-50 disabled:animate-none shrink-0 flex items-center justify-center"
                title={isStreaming ? 'Sending...' : 'Send message'}
                style={{
                  borderColor: '#4DFFFF',
                  color: '#4DFFFF',
                  boxShadow: (!message.trim() && attachments.length === 0) || isStreaming
                    ? 'none'
                    : '0 0 8px #4DFFFF, 0 0 15px rgba(77, 255, 255, 0.4)',
                  animation: (!message.trim() && attachments.length === 0) || isStreaming ? 'none' : 'pulse-glow 2s ease-in-out infinite',
                }}
              >
                <svg className="h-5 w-5 md:h-6 md:w-6 -rotate-90" fill="#4DFFFF" viewBox="0 0 24 24">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                </svg>
              </button>

              {/* Pulse glow animation styles */}
              <style jsx>{`
                @keyframes pulse-glow {
                  0%, 100% {
                    box-shadow: 0 0 8px #4DFFFF, 0 0 15px rgba(77, 255, 255, 0.4);
                  }
                  50% {
                    box-shadow: 0 0 20px #4DFFFF, 0 0 30px rgba(77, 255, 255, 0.6), 0 0 40px rgba(77, 255, 255, 0.3);
                  }
                }
              `}</style>
            </div>
          </div>
        </div>

        {/* Recording Error */}
        {recordingError && (
          <p className="mt-0 text-xs text-red-400">
            {recordingError}
          </p>
        )}

        {/* File Upload Error */}
        {fileError && (
          <p className="mt-0 text-xs text-red-400">
            ⚠️ {fileError}
          </p>
        )}
      </div>

      {/* Attachment menu - rendered at root level to avoid z-index issues */}
      {showAttachMenu && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-[998] bg-black/20 backdrop-blur-sm"
            onClick={() => setShowAttachMenu(false)}
            aria-hidden="true"
          />
          {/* Menu */}
          <div className="fixed bottom-20 left-4 z-[999] w-56 rounded-lg border border-white/10 bg-zinc-900 shadow-xl">
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
        </>
      )}
    </div>
  );
}

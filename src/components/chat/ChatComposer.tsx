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

import { useState, useRef, KeyboardEvent, ChangeEvent, DragEvent } from 'react';
import type { Attachment } from '@/app/chat/types';
import { QuickImageGenerator } from './QuickImageGenerator';
import { QuickCodingAssistant } from './QuickCodingAssistant';
// import { QuickLiveSearch } from './QuickLiveSearch'; // HIDDEN: Auto-search now enabled for all conversations
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { VoiceChatButton } from './VoiceChatButton';

interface ChatComposerProps {
  onSendMessage: (content: string, attachments: Attachment[]) => void;
  onImageGenerated?: (imageUrl: string, prompt: string) => void;
  onCodeGenerated?: (response: string, request: string) => void;
  onSearchComplete?: (response: string, query: string) => void; // Kept for backward compatibility but not used
  onDataAnalysisComplete?: (response: string, source: string, type: 'file' | 'url') => void;
  isStreaming: boolean;
  selectedTool?: 'image' | 'code' | 'search' | 'data' | null; // 'search' kept for backward compatibility
  onSelectTool?: (tool: 'image' | 'code' | 'search' | 'data' | null) => void;
  lastAssistantMessage?: string;
  voiceModeActive: boolean;
  onVoiceModeChange: (active: boolean) => void;
}

export function ChatComposer({ onSendMessage, onImageGenerated, onCodeGenerated, onSearchComplete: _onSearchComplete, onDataAnalysisComplete, isStreaming, selectedTool, onSelectTool, lastAssistantMessage, voiceModeActive, onVoiceModeChange }: ChatComposerProps) {
  const [message, setMessage] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Audio recording
  const { recordingState, error: recordingError, startRecording, stopRecording } = useAudioRecorder();

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

  const handleFileSelect = (files: FileList | null) => {
    if (!files) return;

    // Clear previous errors
    setFileError(null);

    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB per file
    const MAX_TOTAL_SIZE = 10 * 1024 * 1024; // 10MB total for all files
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

    // Calculate total size of new files
    const newFilesSize = fileArray.reduce((sum, file) => sum + file.size, 0);
    const existingFilesSize = attachments.reduce((sum, att) => sum + att.size, 0);
    const totalSize = newFilesSize + existingFilesSize;

    // Check total size limit
    if (totalSize > MAX_TOTAL_SIZE) {
      const totalMB = (totalSize / (1024 * 1024)).toFixed(1);
      setFileError(`Total file size (${totalMB}MB) exceeds 10MB limit. Please remove some files and try again.`);
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

      const attachment: Attachment = {
        id: `${Date.now()}-${file.name}`,
        name: file.name,
        type: file.type,
        size: file.size,
      };

      // Generate thumbnail for images
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const base64Data = e.target?.result as string;
          attachment.thumbnail = base64Data;
          attachment.url = base64Data; // Also set url for compatibility
          setAttachments((prev) => [...prev, attachment]);
        };
        reader.onerror = () => {
          console.error('[ChatComposer] Failed to read file:', file.name);
          setFileError(`Failed to read "${file.name}". Please try again.`);
          setTimeout(() => setFileError(null), 5000);
        };
        reader.readAsDataURL(file);
      } else {
        newAttachments.push(attachment);
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

  // Voice chat auto-send handler
  const handleVoiceTranscription = (text: string) => {
    if (text && text.trim()) {
      // Auto-send the transcribed text
      onSendMessage(text.trim(), []);
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
                className="group relative overflow-hidden rounded-lg border border-white/20 bg-white/5"
              >
                {attachment.thumbnail ? (
                  <img
                    src={attachment.thumbnail}
                    alt={attachment.name}
                    className="h-16 w-16 md:h-20 md:w-20 object-cover"
                  />
                ) : (
                  <div className="flex h-16 w-16 md:h-20 md:w-20 items-center justify-center bg-white/5">
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
                {/* Always visible delete button */}
                <button
                  onClick={() => removeAttachment(attachment.id)}
                  className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 shadow-lg hover:bg-red-600 transition-colors"
                  aria-label="Remove attachment"
                >
                  <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6 18L18 6M6 6l12 12"
                    />
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
          className={`relative rounded-lg border transition-colors ${
            isDragging
              ? 'border-white/40 bg-white/10'
              : 'border-white/10 bg-white/5'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {/* Voice Chat Button - Top Right */}
          <div className="absolute -top-1 right-0.5 md:top-2 md:right-2 z-10">
            <VoiceChatButton
              onTranscriptionComplete={handleVoiceTranscription}
              isStreaming={isStreaming}
              lastAssistantMessage={lastAssistantMessage}
              voiceModeActive={voiceModeActive}
              onVoiceModeChange={onVoiceModeChange}
            />
          </div>

          <textarea
            ref={textareaRef}
            value={message}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={
              recordingState === 'recording'
                ? 'Listening...'
                : isDragging
                ? 'Drop files here...'
                : selectedTool === 'image'
                ? '🎨 Describe the image you want to create...'
                : selectedTool === 'code'
                ? '💻 What code do you need help with?'
                : selectedTool === 'data'
                ? '📊 Attach a file (CSV, XLSX, etc.) or paste a URL'
                : 'Type your message...'
            }
            className="w-full resize-none bg-transparent py-1.5 px-2 md:p-4 text-base md:text-base text-white placeholder-gray-400 focus:outline-none min-h-[40px]"
            rows={1}
            disabled={isStreaming}
            style={{ fontSize: '16px' }}
          />

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
                className="rounded-lg p-1 md:p-2 text-gray-400 hover:bg-white/10 hover:text-white disabled:opacity-50 shrink-0 flex items-center justify-center"
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

              {/* Quick Image Generator */}
              {onImageGenerated && onSelectTool && (
                <QuickImageGenerator
                  onImageGenerated={onImageGenerated}
                  isGenerating={isStreaming}
                  isSelected={selectedTool === 'image'}
                  onSelect={() => onSelectTool(selectedTool === 'image' ? null : 'image')}
                />
              )}

              {/* Quick Coding Assistant */}
              {onCodeGenerated && onSelectTool && (
                <QuickCodingAssistant
                  onCodeGenerated={onCodeGenerated}
                  isGenerating={isStreaming}
                  isSelected={selectedTool === 'code'}
                  onSelect={() => onSelectTool(selectedTool === 'code' ? null : 'code')}
                />
              )}

              {/* Quick Live Search - HIDDEN: Auto-search now enabled for all conversations */}
              {/* {onSearchComplete && onSelectTool && (
                <QuickLiveSearch
                  onSearchComplete={onSearchComplete}
                  isSearching={isStreaming}
                  isSelected={selectedTool === 'search'}
                  onSelect={() => onSelectTool(selectedTool === 'search' ? null : 'search')}
                />
              )} */}

              {/* Quick Data Analysis */}
              {onDataAnalysisComplete && onSelectTool && (
                <button
                  onClick={() => onSelectTool(selectedTool === 'data' ? null : 'data')}
                  className={`rounded-lg px-3 py-2 text-xs font-medium transition disabled:opacity-50 disabled:cursor-not-allowed border whitespace-nowrap flex items-center justify-center ${
                    selectedTool === 'data'
                      ? 'bg-white text-black border-white'
                      : 'bg-black text-white border-white/20 hover:bg-gray-800'
                  }`}
                  disabled={isStreaming}
                  aria-label="Data analysis mode"
                  title={selectedTool === 'data' ? "Data analysis mode active - attach file or paste URL" : "Select data analysis mode"}
                >
                  {selectedTool === 'data' ? '✓ Data' : 'Data'}
                </button>
              )}
            </div>

            <div className="flex items-center justify-center gap-0 md:gap-2 shrink-0">

              {/* Microphone Button */}
              <button
                onClick={handleMicClick}
                disabled={isStreaming || recordingState === 'transcribing'}
                className={`rounded-lg p-1 md:p-2 transition shrink-0 flex items-center justify-center ${
                  recordingState === 'recording'
                    ? 'bg-red-500 text-white animate-pulse'
                    : 'text-gray-400 hover:bg-white/10 hover:text-white'
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
                className="rounded-full bg-black border border-white/20 p-0.5 md:p-2.5 text-white transition hover:bg-gray-900 disabled:opacity-50 shrink-0 flex items-center justify-center"
                title={isStreaming ? 'Sending...' : 'Send message'}
              >
                <svg className="h-5 w-5 md:h-6 md:w-6 -rotate-90" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                </svg>
              </button>
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

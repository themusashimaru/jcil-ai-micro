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
import { QuickLiveSearch } from './QuickLiveSearch';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';

interface ChatComposerProps {
  onSendMessage: (content: string, attachments: Attachment[]) => void;
  onImageGenerated?: (imageUrl: string, prompt: string) => void;
  onCodeGenerated?: (response: string, request: string) => void;
  onSearchComplete?: (response: string, query: string) => void;
  isStreaming: boolean;
}

export function ChatComposer({ onSendMessage, onImageGenerated, onCodeGenerated, onSearchComplete, isStreaming }: ChatComposerProps) {
  const [message, setMessage] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    if ((!message.trim() && attachments.length === 0) || isStreaming) return;

    onSendMessage(message.trim(), attachments);
    setMessage('');
    setAttachments([]);

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleFileSelect = (files: FileList | null) => {
    if (!files) return;

    // Clear previous errors
    setFileError(null);

    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    const MAX_TOTAL_SIZE = 25 * 1024 * 1024; // 25MB total for all files
    const newAttachments: Attachment[] = [];
    const fileArray = Array.from(files);

    // Calculate total size of new files
    const newFilesSize = fileArray.reduce((sum, file) => sum + file.size, 0);
    const existingFilesSize = attachments.reduce((sum, att) => sum + att.size, 0);
    const totalSize = newFilesSize + existingFilesSize;

    // Check total size limit
    if (totalSize > MAX_TOTAL_SIZE) {
      const totalMB = (totalSize / (1024 * 1024)).toFixed(1);
      setFileError(`Total file size (${totalMB}MB) exceeds 25MB limit. Remove some files and try again.`);
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
          attachment.thumbnail = e.target?.result as string;
          setAttachments((prev) => [...prev, attachment]);
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

  return (
    <div className="glass-morphism border-t border-white/10 p-4">
      <div className="mx-auto max-w-3xl">
        {/* Attachments Preview */}
        {attachments.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {attachments.slice(0, 4).map((attachment) => (
              <div
                key={attachment.id}
                className="group relative overflow-hidden rounded-lg border border-white/10"
              >
                {attachment.thumbnail ? (
                  <img
                    src={attachment.thumbnail}
                    alt={attachment.name}
                    className="h-16 w-16 object-cover"
                  />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center bg-white/5">
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
                <button
                  onClick={() => removeAttachment(attachment.id)}
                  className="absolute right-1 top-1 rounded-full bg-black/60 p-1 opacity-0 transition-opacity hover:bg-black/80 group-hover:opacity-100"
                  aria-label="Remove attachment"
                >
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            ))}
            {attachments.length > 4 && (
              <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-white/5 text-sm text-gray-400">
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
                : 'Type your message... (Shift+Enter for new line)'
            }
            className="w-full resize-none bg-transparent p-4 text-white placeholder-gray-400 focus:outline-none"
            rows={1}
            disabled={isStreaming}
          />

          {/* Action Bar */}
          <div className="flex items-center justify-between border-t border-white/10 p-2">
            <div className="relative flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,.pdf,.txt,.csv,.xlsx"
                onChange={(e) => handleFileSelect(e.target.files)}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isStreaming}
                className="rounded-lg p-2 text-gray-400 hover:bg-white/10 hover:text-white disabled:opacity-50"
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

              {/* Quick Image Generator */}
              {onImageGenerated && (
                <QuickImageGenerator
                  onImageGenerated={onImageGenerated}
                  isGenerating={isStreaming}
                />
              )}

              {/* Quick Coding Assistant */}
              {onCodeGenerated && (
                <QuickCodingAssistant
                  onCodeGenerated={onCodeGenerated}
                  isGenerating={isStreaming}
                />
              )}

              {/* Quick Live Search */}
              {onSearchComplete && (
                <QuickLiveSearch
                  onSearchComplete={onSearchComplete}
                  isSearching={isStreaming}
                />
              )}

              {attachments.length > 0 && (
                <span className="text-xs text-gray-400">
                  {attachments.length} {attachments.length === 1 ? 'file' : 'files'} attached
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {message.length > 0 && (
                <span className="text-xs text-gray-400">{message.length}</span>
              )}

              {/* Microphone Button */}
              <button
                onClick={handleMicClick}
                disabled={isStreaming || recordingState === 'transcribing'}
                className={`rounded-lg p-2 transition ${
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
                  <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24">
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
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                className="rounded-lg bg-white px-6 py-2 text-sm font-semibold text-black transition hover:bg-gray-200 disabled:opacity-50"
              >
                {isStreaming ? 'Sending...' : 'Send'}
              </button>
            </div>
          </div>
        </div>

        {/* Recording Error */}
        {recordingError && (
          <p className="mt-2 text-xs text-red-400">
            {recordingError}
          </p>
        )}

        {/* File Upload Error */}
        {fileError && (
          <p className="mt-2 text-xs text-red-400">
            ⚠️ {fileError}
          </p>
        )}

        {/* Help Text */}
        <p className="mt-2 text-xs text-gray-500">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}

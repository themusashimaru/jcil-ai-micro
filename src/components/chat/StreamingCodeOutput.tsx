'use client';

/**
 * STREAMING CODE OUTPUT COMPONENT (Enhancement #9)
 *
 * Displays code generation in real-time with progress indicators.
 * Shows file-by-file generation with visual progress.
 *
 * Features:
 * - Real-time streaming display
 * - File-by-file progress tracking
 * - Syntax highlighting for partial code
 * - Cancel/interrupt capability
 * - Progress percentage
 */

import { useState, useEffect, useRef } from 'react';

interface StreamingFile {
  filename: string;
  content: string;
  language: string;
  isComplete: boolean;
  linesWritten: number;
}

interface StreamingCodeOutputProps {
  files: StreamingFile[];
  isStreaming: boolean;
  onCancel?: () => void;
  totalEstimatedLines?: number;
}

export function StreamingCodeOutput({
  files,
  isStreaming,
  onCancel,
  totalEstimatedLines = 100,
}: StreamingCodeOutputProps) {
  const [activeFileIndex, setActiveFileIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom while streaming
  useEffect(() => {
    if (isStreaming && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [files, isStreaming]);

  // Auto-advance to latest file being written
  useEffect(() => {
    const lastIncompleteIndex = files.findIndex((f) => !f.isComplete);
    if (lastIncompleteIndex !== -1) {
      setActiveFileIndex(lastIncompleteIndex);
    } else if (files.length > 0) {
      setActiveFileIndex(files.length - 1);
    }
  }, [files]);

  const totalLinesWritten = files.reduce((sum, f) => sum + f.linesWritten, 0);
  const progressPercent = Math.min(100, Math.round((totalLinesWritten / totalEstimatedLines) * 100));

  const activeFile = files[activeFileIndex];

  return (
    <div
      className="my-3 rounded-lg overflow-hidden border"
      style={{ backgroundColor: '#0d1117', borderColor: '#30363d' }}
    >
      {/* Header with progress */}
      <div
        className="flex items-center justify-between px-3 py-2 border-b"
        style={{ backgroundColor: 'rgba(136, 87, 255, 0.1)', borderColor: '#30363d' }}
      >
        <div className="flex items-center gap-2">
          {isStreaming ? (
            <svg className="w-4 h-4 text-purple-400 animate-pulse" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="12" r="4" />
            </svg>
          ) : (
            <svg className="w-4 h-4 text-green-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 13l4 4L19 7" />
            </svg>
          )}
          <span className="text-sm font-medium text-gray-300">
            {isStreaming ? 'Generating Code...' : 'Code Generated'}
          </span>
          <span className="text-xs text-gray-500">
            {files.length} file{files.length !== 1 ? 's' : ''} | {totalLinesWritten} lines
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Progress bar */}
          <div className="flex items-center gap-2">
            <div className="w-24 h-1.5 bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-purple-500 transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <span className="text-xs text-gray-400">{progressPercent}%</span>
          </div>

          {/* Cancel button */}
          {isStreaming && onCancel && (
            <button
              onClick={onCancel}
              className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded hover:bg-white/10"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* File tabs */}
      {files.length > 1 && (
        <div
          className="flex overflow-x-auto border-b"
          style={{ backgroundColor: '#161b22', borderColor: '#30363d' }}
        >
          {files.map((file, index) => (
            <button
              key={file.filename}
              onClick={() => setActiveFileIndex(index)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs whitespace-nowrap border-b-2 transition-colors ${
                index === activeFileIndex
                  ? 'border-purple-500 text-gray-200 bg-gray-800/50'
                  : 'border-transparent text-gray-400 hover:text-gray-300'
              }`}
            >
              {file.isComplete ? (
                <span className="text-green-400">✓</span>
              ) : (
                <span className="w-2 h-2 bg-purple-400 rounded-full animate-pulse" />
              )}
              <span>{file.filename}</span>
            </button>
          ))}
        </div>
      )}

      {/* Active file content */}
      {activeFile && (
        <div ref={scrollRef} className="overflow-auto" style={{ maxHeight: '400px' }}>
          <div className="flex">
            {/* Line numbers */}
            <div
              className="select-none text-right pr-3 py-2 text-xs"
              style={{ backgroundColor: '#161b22', color: '#484f58', minWidth: '3rem' }}
            >
              {activeFile.content.split('\n').map((_, i) => (
                <div key={i} className="leading-6">
                  {i + 1}
                </div>
              ))}
            </div>

            {/* Code content */}
            <div className="flex-1 py-2 overflow-x-auto">
              <pre
                className="text-sm font-mono leading-6"
                style={{ color: '#c9d1d9', margin: 0 }}
              >
                <code>{activeFile.content}</code>
                {isStreaming && !activeFile.isComplete && (
                  <span className="inline-block w-2 h-4 bg-purple-400 animate-pulse ml-0.5" />
                )}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* Status footer */}
      <div
        className="px-3 py-1.5 text-xs border-t"
        style={{ backgroundColor: '#161b22', borderColor: '#30363d' }}
      >
        {isStreaming ? (
          <span className="text-purple-400">
            Writing {activeFile?.filename || 'file'}...
          </span>
        ) : (
          <span className="text-gray-500">
            Generation complete. {files.filter(f => f.isComplete).length}/{files.length} files ready.
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Hook for managing streaming code generation
 */
export function useStreamingCode() {
  const [files, setFiles] = useState<StreamingFile[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const startFile = (filename: string, language: string) => {
    setFiles((prev) => [
      ...prev,
      {
        filename,
        content: '',
        language,
        isComplete: false,
        linesWritten: 0,
      },
    ]);
  };

  const appendContent = (filename: string, content: string) => {
    setFiles((prev) =>
      prev.map((f) =>
        f.filename === filename
          ? {
              ...f,
              content: f.content + content,
              linesWritten: (f.content + content).split('\n').length - 1,
            }
          : f
      )
    );
  };

  const completeFile = (filename: string) => {
    setFiles((prev) =>
      prev.map((f) => (f.filename === filename ? { ...f, isComplete: true } : f))
    );
  };

  const startStreaming = () => {
    abortRef.current = new AbortController();
    setIsStreaming(true);
    setFiles([]);
  };

  const stopStreaming = () => {
    abortRef.current?.abort();
    setIsStreaming(false);
  };

  const cancel = () => {
    stopStreaming();
  };

  return {
    files,
    isStreaming,
    startFile,
    appendContent,
    completeFile,
    startStreaming,
    stopStreaming,
    cancel,
    abortSignal: abortRef.current?.signal,
  };
}

export default StreamingCodeOutput;

/**
 * MESSAGE BUBBLE COMPONENT
 *
 * PURPOSE:
 * - Display individual message with glassmorphism styling
 * - Show tool call badges with status indicators
 * - Display file attachments (thumbnails or count badge)
 * - Support user and assistant message layouts
 *
 * FEATURES:
 * - Glassmorphism bubbles with tail/curvature
 * - Tool execution badges (web search, maps, image gen, etc.)
 * - File attachment thumbnails or "N images attached" badge
 * - Markdown rendering for message content
 */

'use client';

import { useState, useCallback, useEffect, lazy, Suspense } from 'react';
import type { Message } from '@/app/chat/types';
import { linkifyToReact } from '@/lib/utils/linkify';
import { MarkdownRenderer } from './MarkdownRenderer';
import type { ActionPreviewData } from './ActionPreviewCard';

// Lazy load MultiPagePreview for better performance
const MultiPagePreview = lazy(() => import('./MultiPagePreview'));

// Lazy load AnalyticsBlock for data visualization (avoids loading Recharts on every page)
const AnalyticsBlock = lazy(() =>
  import('@/components/analytics/AnalyticsBlock').then((mod) => ({ default: mod.AnalyticsBlock }))
);

/**
 * Code Preview Block Component
 * Displays generated code with preview and copy functionality
 */
interface CodePreviewBlockProps {
  code: string;
  language: string;
  title?: string;
  description?: string;
}

function CodePreviewBlock({ code, language, title, description }: CodePreviewBlockProps) {
  const [showCode, setShowCode] = useState(false);
  const [copied, setCopied] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [inlineExpanded, setInlineExpanded] = useState(true); // Auto-expand inline preview
  const [previewLoaded, setPreviewLoaded] = useState(false); // Track iframe load state

  // Reset preview loaded state when code changes
  useEffect(() => {
    setPreviewLoaded(false);
  }, [code]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, [code]);

  const openPreview = useCallback(() => {
    setPreviewOpen(true);
  }, []);

  const closePreview = useCallback(() => {
    setPreviewOpen(false);
  }, []);

  // Check if this is HTML code (for inline preview)
  const isHtml =
    language.toLowerCase() === 'html' || code.includes('<!DOCTYPE html>') || code.includes('<html');

  return (
    <div className="mb-3 rounded-xl border border-white/10 bg-white/5 overflow-hidden max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-violet-500/10 to-cyan-500/10 border-b border-white/10">
        <div className="flex items-center gap-2">
          <span className="text-xl">🌐</span>
          <div>
            <div className="font-medium text-white text-sm">{title || 'Generated Code'}</div>
            {description && (
              <div className="text-xs text-gray-400 truncate max-w-[200px]">{description}</div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs px-2 py-0.5 rounded bg-gradient-to-r from-violet-500/20 to-cyan-500/20 text-cyan-300 uppercase font-medium">
            {language}
          </span>
        </div>
      </div>

      {/* Inline Mini Preview - Auto-expanded for HTML */}
      {isHtml && (
        <div className="border-b border-white/10">
          <button
            onClick={() => setInlineExpanded(!inlineExpanded)}
            className="w-full flex items-center justify-between px-4 py-2 text-xs text-gray-400 hover:text-white transition-colors bg-black/20"
          >
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              Live Preview
            </span>
            <svg
              className={`w-4 h-4 transition-transform ${inlineExpanded ? 'rotate-180' : ''}`}
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
          {inlineExpanded && (
            <div
              className="relative cursor-pointer group overflow-hidden"
              onClick={openPreview}
              style={{ minHeight: '300px' }}
            >
              {/* Loading state background - only show before iframe loads */}
              {!previewLoaded && (
                <div className="absolute inset-0 bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center z-0">
                  <div className="text-center">
                    <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    <span className="text-xs text-gray-400">Loading preview...</span>
                  </div>
                </div>
              )}
              {/* Inline iframe preview */}
              <iframe
                srcDoc={code}
                className="relative w-full h-[300px] pointer-events-none z-10"
                title={`${title || 'Preview'} - Inline`}
                sandbox="allow-scripts allow-same-origin"
                style={{ backgroundColor: 'white' }}
                onLoad={() => setPreviewLoaded(true)}
              />
              {/* Hover overlay */}
              <div className="absolute inset-0 z-20 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                <div className="flex items-center gap-2 px-4 py-2 bg-white/20 backdrop-blur rounded-lg text-white text-sm font-medium">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
                    />
                  </svg>
                  Click to expand
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center gap-2 px-4 py-3 flex-wrap">
        <button
          onClick={openPreview}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-violet-500 to-cyan-500 text-white text-sm font-medium hover:from-violet-600 hover:to-cyan-600 transition-all shadow-lg shadow-violet-500/25"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
            />
          </svg>
          Full Screen
        </button>

        <button
          onClick={handleCopy}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 text-white text-sm font-medium hover:bg-white/20 transition-all"
        >
          {copied ? (
            <>
              <svg
                className="w-4 h-4 text-green-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              Copied!
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
              Copy
            </>
          )}
        </button>

        <button
          onClick={() => setShowCode(!showCode)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 text-white text-sm font-medium hover:bg-white/20 transition-all"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
            />
          </svg>
          {showCode ? 'Hide Code' : 'Code'}
        </button>
      </div>

      {/* Collapsible Code Block */}
      {showCode && (
        <div className="px-4 pb-4">
          <pre className="bg-black/40 rounded-lg p-4 overflow-x-auto text-xs text-gray-300 max-h-[400px] overflow-y-auto">
            <code>{code}</code>
          </pre>
        </div>
      )}

      {/* Full Screen Preview Modal */}
      {previewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="relative w-[95vw] h-[90vh] bg-slate-900 rounded-2xl overflow-hidden shadow-2xl border border-white/10">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-slate-800 border-b border-white/10">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500" />
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                </div>
                <span className="ml-2 text-sm font-medium text-white">{title || 'Preview'}</span>
              </div>
              <button
                onClick={closePreview}
                className="p-2 rounded-lg hover:bg-white/10 transition text-gray-400 hover:text-white"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* Iframe Preview */}
            <iframe
              srcDoc={code}
              className="w-full h-[calc(100%-52px)] bg-white"
              title={title || 'Code Preview'}
              sandbox="allow-scripts allow-same-origin"
            />
          </div>
        </div>
      )}
    </div>
  );
}

interface MessageBubbleProps {
  message: Message;
  isLast: boolean;
  isAdmin?: boolean;
  onReply?: (message: Message) => void;
  /** Enable code execution actions (Test/Push buttons) on code blocks */
  enableCodeActions?: boolean;
  /** Callback to regenerate a generated image with adjusted prompt */
  onRegenerateImage?: (generationId: string, originalPrompt: string, feedback: string) => void;
  /** Callback when action preview Send is clicked (for Composio integrations) */
  onActionSend?: (preview: ActionPreviewData) => Promise<void>;
  /** Callback when action preview Edit is requested */
  onActionEdit?: (preview: ActionPreviewData, instruction: string) => void;
  /** Callback when action preview is cancelled */
  onActionCancel?: (preview: ActionPreviewData) => void;
}

export function MessageBubble({
  message,
  isLast: _isLast,
  isAdmin,
  onReply,
  enableCodeActions,
  onRegenerateImage,
  onActionSend,
  onActionEdit,
  onActionCancel,
}: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);
  // Track save status per file (by index)
  const [savingFiles, setSavingFiles] = useState<Record<number, 'saving' | 'saved' | 'error'>>({});

  // Copy message content to clipboard
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Save generated file to My Files
  const handleSaveToMyFiles = async (fileIndex: number, downloadUrl: string, filename: string) => {
    setSavingFiles((prev) => ({ ...prev, [fileIndex]: 'saving' }));

    try {
      // Fetch the file content
      const response = await fetch(downloadUrl);
      if (!response.ok) throw new Error('Failed to fetch file');

      const blob = await response.blob();

      // Create FormData and upload to My Files
      const formData = new FormData();
      formData.append('file', blob, filename);

      const uploadResponse = await fetch('/api/documents/user/files', {
        method: 'POST',
        body: formData,
      });

      if (!uploadResponse.ok) {
        const err = await uploadResponse.json();
        throw new Error(err.error || 'Upload failed');
      }

      const { document } = await uploadResponse.json();

      // Trigger processing for the uploaded file
      await fetch('/api/documents/user/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId: document.id }),
      });

      setSavingFiles((prev) => ({ ...prev, [fileIndex]: 'saved' }));

      // Reset after 3 seconds
      setTimeout(() => {
        setSavingFiles((prev) => {
          const updated = { ...prev };
          delete updated[fileIndex];
          return updated;
        });
      }, 3000);
    } catch (error) {
      console.error('Failed to save to My Files:', error);
      setSavingFiles((prev) => ({ ...prev, [fileIndex]: 'error' }));

      // Reset error after 3 seconds
      setTimeout(() => {
        setSavingFiles((prev) => {
          const updated = { ...prev };
          delete updated[fileIndex];
          return updated;
        });
      }, 3000);
    }
  };

  const getToolIcon = (toolName: string) => {
    const icons: Record<string, string> = {
      web_search: '🔍',
      maps: '🗺️',
      places: '📍',
      weather: '⛅',
      image_gen: '🎨',
      video_gen: '🎬',
      file_analysis: '📊',
      amazon_search: '🛒',
    };
    return icons[toolName] || '🔧';
  };

  const getToolStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-gray-500/20 text-gray-300',
      running: 'bg-blue-500/20 text-blue-300 animate-pulse',
      completed: 'bg-green-500/20 text-green-300',
      error: 'bg-red-500/20 text-red-300',
    };
    return colors[status] || colors.pending;
  };

  return (
    <div className={`flex items-start gap-2 mb-2 ${isUser ? 'justify-end' : ''}`}>
      {/* User Avatar - User messages on left side of their bubble */}
      {isUser && (
        <div
          className="mt-1 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full order-first"
          style={{
            backgroundColor: 'var(--avatar-bg)',
            color: 'var(--primary)',
          }}
        >
          {/* User icon */}
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
              clipRule="evenodd"
            />
          </svg>
        </div>
      )}

      {/* Message Content */}
      <div className="space-y-0 overflow-x-hidden flex-1 max-w-full">
        {/* Tool Calls */}
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="flex flex-wrap gap-0">
            {message.toolCalls.map((tool) => (
              <div
                key={tool.id}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${getToolStatusColor(
                  tool.status
                )}`}
              >
                <span>{getToolIcon(tool.name)}</span>
                <span className="capitalize">{tool.name.replace(/_/g, ' ')}</span>
                {tool.status === 'running' && (
                  <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24">
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
                )}
              </div>
            ))}
          </div>
        )}

        {/* Attachments */}
        {message.attachments && message.attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 max-w-full overflow-hidden">
            {message.attachments.map((attachment) => {
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
                <div
                  key={attachment.id}
                  className="group relative overflow-hidden rounded-lg border border-white/10"
                >
                  {attachment.thumbnail && isImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={attachment.thumbnail}
                      alt={attachment.name}
                      className="h-16 w-16 object-cover"
                    />
                  ) : (
                    <div className="flex h-16 min-w-[80px] max-w-[120px] flex-col items-center justify-center gap-1 bg-white/5 px-2 py-1">
                      {/* File type icon */}
                      {isPdf ? (
                        <svg
                          className="h-6 w-6 text-red-400"
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
                          <text x="7" y="17" fontSize="6" fill="currentColor" fontWeight="bold">
                            PDF
                          </text>
                        </svg>
                      ) : isExcel || isCsv ? (
                        <svg
                          className="h-6 w-6 text-green-400"
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
                          className="h-6 w-6 text-blue-400"
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
                          className="h-6 w-6 text-gray-400"
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
                      <span className="truncate text-[10px] text-gray-300 max-w-full px-1">
                        {attachment.name}
                      </span>
                    </div>
                  )}
                  {/* Hover overlay for images */}
                  {isImage && attachment.thumbnail && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 transition-opacity group-hover:opacity-100">
                      <span className="truncate px-2 text-xs text-white">{attachment.name}</span>
                    </div>
                  )}
                </div>
              );
            })}
            {message.attachments.length > 4 && (
              <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-white/5 text-xs text-gray-400">
                +{message.attachments.length - 4}
              </div>
            )}
          </div>
        )}

        {/* Generated Image (legacy) */}
        {message.imageUrl && !message.generatedImage && (
          <div className="mb-2 overflow-hidden rounded-lg border border-white/10 max-w-sm relative group">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={message.imageUrl}
              alt="AI-generated image"
              className="w-full h-auto rounded-lg"
            />
            {/* Download button */}
            <a
              href={message.imageUrl}
              download={`generated-image-${Date.now()}.png`}
              className="absolute bottom-2 right-2 rounded-full bg-black/70 p-2 opacity-0 group-hover:opacity-100 md:opacity-100 transition-opacity hover:bg-black/90"
              title="Download image"
            >
              <svg
                className="h-5 w-5 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
            </a>
          </div>
        )}

        {/* Generated Image from Creative Tools (with metadata) */}
        {message.generatedImage && (
          <div className="mb-2 overflow-hidden rounded-xl border border-white/10 max-w-md relative group">
            {/* Image with gradient overlay for metadata */}
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={message.generatedImage.imageUrl}
                alt={message.generatedImage.prompt}
                className="w-full h-auto"
              />
              {/* Overlay with metadata on hover */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3">
                <p className="text-xs text-white/90 line-clamp-2">
                  {message.generatedImage.prompt}
                </p>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-white/60">
                    {message.generatedImage.dimensions.width} x{' '}
                    {message.generatedImage.dimensions.height}
                  </span>
                  <div className="flex items-center gap-2">
                    {message.generatedImage.verification && (
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          message.generatedImage.verification.matches
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-yellow-500/20 text-yellow-400'
                        }`}
                      >
                        {message.generatedImage.verification.matches ? 'Verified' : 'Review'}
                      </span>
                    )}
                    {/* Regenerate button when verification fails */}
                    {message.generatedImage.verification &&
                      !message.generatedImage.verification.matches &&
                      onRegenerateImage && (
                        <button
                          onClick={() =>
                            onRegenerateImage(
                              message.generatedImage!.id,
                              message.generatedImage!.prompt,
                              message.generatedImage!.verification!.feedback
                            )
                          }
                          className="text-xs px-2 py-0.5 rounded-full bg-blue-500/80 text-white hover:bg-blue-500 transition-colors"
                        >
                          Regenerate
                        </button>
                      )}
                  </div>
                </div>
              </div>
              {/* Download button - always visible on mobile */}
              <a
                href={message.generatedImage.imageUrl}
                download={`${message.generatedImage.type}-${message.generatedImage.id}.png`}
                className="absolute top-2 right-2 rounded-full bg-black/70 p-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity hover:bg-black/90"
                title="Download image"
              >
                <svg
                  className="h-5 w-5 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  />
                </svg>
              </a>
            </div>
            {/* Type badge */}
            <div className="absolute top-2 left-2">
              <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-800/90 text-white border border-gray-600">
                {message.generatedImage.type === 'edit' ? 'Edited' : 'Created'}
              </span>
            </div>
          </div>
        )}

        {/* Data Analytics with Charts */}
        {message.analytics && (
          <Suspense
            fallback={
              <div className="mb-3 rounded-xl border border-white/10 bg-white/5 p-4 animate-pulse">
                <div className="h-4 bg-white/10 rounded w-1/3 mb-2"></div>
                <div className="h-32 bg-white/10 rounded w-full"></div>
              </div>
            }
          >
            <AnalyticsBlock analytics={message.analytics} />
          </Suspense>
        )}

        {/* Code Preview (Landing Pages, Websites) */}
        {message.codePreview && (
          <CodePreviewBlock
            code={message.codePreview.code}
            language={message.codePreview.language}
            title={message.codePreview.title}
            description={message.codePreview.description}
          />
        )}

        {/* Multi-Page Website Preview */}
        {message.multiPageWebsite && (
          <Suspense
            fallback={
              <div className="mb-3 rounded-xl border border-white/10 bg-white/5 p-4 animate-pulse">
                <div className="h-4 bg-white/10 rounded w-1/3 mb-2"></div>
                <div className="h-8 bg-white/10 rounded w-full"></div>
              </div>
            }
          >
            <MultiPagePreview
              website={message.multiPageWebsite}
              onPushToGitHub={() => {
                // Trigger GitHub push via chat
                window.dispatchEvent(
                  new CustomEvent('forge-action', {
                    detail: { action: 'push-to-github', website: message.multiPageWebsite },
                  })
                );
              }}
              onDeploy={() => {
                // Trigger Vercel deploy via chat
                window.dispatchEvent(
                  new CustomEvent('forge-action', {
                    detail: { action: 'deploy-vercel', website: message.multiPageWebsite },
                  })
                );
              }}
            />
          </Suspense>
        )}

        {/* Generated Video */}
        {message.videoUrl && (
          <div className="mb-2 overflow-hidden rounded-lg border border-white/10 max-w-md relative group">
            <video
              src={message.videoUrl}
              controls
              className="w-full h-auto rounded-lg"
              preload="metadata"
            />
            {/* Download button */}
            <a
              href={message.videoUrl}
              download={`generated-video-${Date.now()}.mp4`}
              className="absolute bottom-12 right-2 rounded-full bg-black/70 p-2 opacity-0 group-hover:opacity-100 md:opacity-100 transition-opacity hover:bg-black/90"
              title="Download video"
            >
              <svg
                className="h-5 w-5 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
            </a>
          </div>
        )}

        {/* Video Job Progress */}
        {message.videoJob && !message.videoUrl && (
          <div className="mb-2 overflow-hidden rounded-lg border border-white/10 max-w-md p-4 bg-white/5">
            <div className="flex items-center gap-3 mb-3">
              <div className="text-2xl">🎬</div>
              <div className="flex-1">
                <div className="text-sm font-medium text-white">
                  {message.videoJob.status === 'queued' && 'Video Queued'}
                  {message.videoJob.status === 'in_progress' && 'Generating Video...'}
                  {message.videoJob.status === 'completed' && 'Video Ready!'}
                  {message.videoJob.status === 'failed' && 'Generation Failed'}
                </div>
                <div className="text-xs text-gray-400">
                  {message.videoJob.model} - {message.videoJob.seconds}s - {message.videoJob.size}
                  {/* Multi-segment indicator */}
                  {message.videoJob.segment && (
                    <span className="ml-2 px-1.5 py-0.5 bg-purple-500/20 text-purple-300 rounded">
                      Segment {message.videoJob.segment.current}/{message.videoJob.segment.total}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Progress bar */}
            {(message.videoJob.status === 'queued' ||
              message.videoJob.status === 'in_progress') && (
              <div className="mb-3">
                <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300"
                    style={{ width: `${message.videoJob.progress}%` }}
                  />
                </div>
                <div className="text-xs text-gray-400 mt-1 text-right">
                  {message.videoJob.progress}%
                  {message.videoJob.segment && (
                    <span className="ml-2">
                      (
                      {message.videoJob.segment.total_seconds -
                        message.videoJob.segment.seconds_remaining}
                      s / {message.videoJob.segment.total_seconds}s total)
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Completed segments list */}
            {message.videoJob.completed_segments &&
              message.videoJob.completed_segments.length > 0 && (
                <div className="mb-3 space-y-2">
                  <div className="text-xs text-gray-400">Completed segments:</div>
                  {message.videoJob.completed_segments.map((url, idx) => (
                    <a
                      key={url}
                      href={url}
                      download={`segment-${idx + 1}.mp4`}
                      className="flex items-center gap-2 text-xs text-blue-400 hover:text-blue-300"
                    >
                      <span>✓ Segment {idx + 1}</span>
                      <svg
                        className="h-3 w-3"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                        />
                      </svg>
                    </a>
                  ))}
                </div>
              )}

            {/* Error message */}
            {message.videoJob.status === 'failed' && message.videoJob.error && (
              <div className="text-sm text-red-400 mb-2">{message.videoJob.error.message}</div>
            )}

            {/* Status-specific UI */}
            {message.videoJob.status === 'completed' && (
              <a
                href={message.videoJob.download_url}
                className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg transition"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  />
                </svg>
                Download Video
              </a>
            )}

            {(message.videoJob.status === 'queued' ||
              message.videoJob.status === 'in_progress') && (
              <div className="text-xs text-gray-400 flex items-center gap-2">
                <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24">
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
                {message.videoJob.segment ? (
                  <span>
                    Generating segment {message.videoJob.segment.current} of{' '}
                    {message.videoJob.segment.total}...
                  </span>
                ) : (
                  <span>Video generation typically takes 1-3 minutes</span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Shopping Products - Horizontal Scrolling */}
        {message.products && message.products.length > 0 && (
          <div className="mb-3">
            <div
              className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              {message.products.map((product) => (
                <a
                  key={product.url || product.title}
                  href={product.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group relative flex-shrink-0 w-64 overflow-hidden rounded-lg border border-white/10 bg-white/5 transition hover:border-white/20 hover:bg-white/10 snap-start"
                >
                  {/* Product Image */}
                  {product.image && (
                    <div className="h-48 overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={product.image}
                        alt={product.title}
                        className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                  )}

                  {/* Product Info */}
                  <div className="p-4 space-y-2">
                    <h4 className="line-clamp-2 text-sm font-semibold text-white group-hover:text-blue-400 min-h-[2.5rem]">
                      {product.title}
                    </h4>
                    {product.price && (
                      <p className="text-lg font-bold text-green-400">{product.price}</p>
                    )}
                    {product.rating && <p className="text-xs text-gray-400">⭐ {product.rating}</p>}
                  </div>

                  {/* External Link Icon */}
                  <div className="absolute right-2 top-2 rounded-full bg-black/60 p-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                      />
                    </svg>
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Message Bubble - User gets bubble styling, AI flows into background */}
        <div
          className={`${
            isUser ? 'chat-bubble chat-bubble-tail right user-bubble' : 'ai-message-clean'
          }`}
          style={{
            userSelect: 'text',
            WebkitUserSelect: 'text',
            color: isUser ? 'var(--chat-user-bubble-text)' : 'var(--text-primary)',
          }}
        >
          <div className="break-words select-text">
            {isUser ? (
              // User messages: simple text with linkified URLs
              <div className="whitespace-pre-wrap">{linkifyToReact(message.content)}</div>
            ) : (
              // AI messages: full markdown rendering with optional code actions
              <>
                <MarkdownRenderer
                  content={message.content}
                  enableCodeActions={enableCodeActions}
                  onActionSend={onActionSend}
                  onActionEdit={onActionEdit}
                  onActionCancel={onActionCancel}
                />
                {/* Blinking cursor while streaming - shows at end of response */}
                {message.isStreaming && (
                  <span
                    className="inline-block ml-0.5"
                    style={{
                      color: 'var(--primary)',
                      animation: 'blink 1s step-end infinite',
                      fontSize: '1rem',
                      lineHeight: 1,
                    }}
                  >
                    ▋
                  </span>
                )}
              </>
            )}
          </div>

          {/* Citations/Sources from Live Search */}
          {!isUser && message.citations && message.citations.length > 0 && (
            <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
              <div
                className="flex items-center gap-1 text-xs mb-2"
                style={{ color: 'var(--text-muted)' }}
              >
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                  />
                </svg>
                <span>Sources ({message.citations.length})</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {message.citations.slice(0, 5).map((citation) => {
                  // Handle multiple citation formats:
                  // - String URL directly
                  // - Object with url/link/source/href field
                  let url = '';
                  let title = '';

                  if (typeof citation === 'string') {
                    url = citation;
                  } else if (citation && typeof citation === 'object') {
                    // Try multiple possible URL field names
                    // Cast through unknown to handle both Citation type and other formats
                    const c = citation as unknown as Record<string, unknown>;
                    url = String(c.url || c.link || c.source || c.href || c.source_url || '');
                    title = String(c.title || c.name || c.source_name || '');
                  }

                  // Fallback to domain if no title
                  if (!title && url) {
                    try {
                      title = new URL(url).hostname.replace('www.', '');
                    } catch {
                      title = 'Source';
                    }
                  }

                  // Skip if no valid URL
                  if (!url || !url.startsWith('http')) return null;

                  return (
                    <a
                      key={url}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all hover:scale-105 cursor-pointer"
                      style={{
                        backgroundColor: 'var(--primary-hover)',
                        color: 'var(--primary)',
                        border: '1px solid var(--primary)',
                      }}
                      title={url}
                      onClick={(e) => {
                        e.stopPropagation();
                        window.open(url, '_blank', 'noopener,noreferrer');
                      }}
                    >
                      <span className="truncate max-w-[150px]">{title}</span>
                      <svg
                        className="h-3 w-3 flex-shrink-0"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                        />
                      </svg>
                    </a>
                  );
                })}
                {message.citations.length > 5 && (
                  <span className="px-2 py-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                    +{message.citations.length - 5} more
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Native Document Download Section (Preview/Download for PDFs, Excel, Word) */}
          {!isUser && message.documentDownload && (
            <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
              <div className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>
                📎 Your document is ready:
              </div>
              <div className="flex flex-col gap-2">
                {(() => {
                  const doc = message.documentDownload;
                  // Get icon and label based on file type
                  const getDocInfo = (mimeType: string, filename: string) => {
                    if (
                      mimeType.includes('spreadsheet') ||
                      mimeType.includes('xlsx') ||
                      filename.endsWith('.xlsx')
                    ) {
                      return {
                        icon: '📊',
                        label: 'Excel Spreadsheet',
                        color: 'from-green-600 to-green-700',
                      };
                    }
                    if (
                      mimeType.includes('document') ||
                      mimeType.includes('docx') ||
                      filename.endsWith('.docx')
                    ) {
                      return {
                        icon: '📄',
                        label: 'Word Document',
                        color: 'from-blue-600 to-blue-700',
                      };
                    }
                    if (mimeType.includes('pdf') || filename.endsWith('.pdf')) {
                      return {
                        icon: '📑',
                        label: 'PDF Document',
                        color: 'from-red-600 to-red-700',
                      };
                    }
                    return { icon: '📁', label: 'Document', color: 'from-gray-600 to-gray-700' };
                  };

                  const { icon, label, color } = getDocInfo(doc.mimeType, doc.filename);

                  return (
                    <>
                      {/* Preview Button - Only for PDFs */}
                      {doc.canPreview && (
                        <button
                          className={`inline-flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-all hover:scale-[1.02] cursor-pointer w-full text-left bg-gradient-to-r ${color} text-white`}
                          title={`Preview ${doc.filename}`}
                          onClick={() => {
                            // Open PDF in new tab for preview
                            const newWindow = window.open('', '_blank');
                            if (newWindow) {
                              newWindow.document.write(`
                                <!DOCTYPE html>
                                <html>
                                <head>
                                  <title>${doc.filename}</title>
                                  <style>
                                    body { margin: 0; padding: 0; background: #1a1a2e; display: flex; flex-direction: column; height: 100vh; }
                                    .header { background: #16213e; color: white; padding: 12px 20px; display: flex; align-items: center; justify-content: space-between; }
                                    .title { font-family: system-ui, sans-serif; font-size: 14px; }
                                    .download-btn { background: #4ade80; color: #000; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: 500; font-size: 13px; }
                                    .download-btn:hover { background: #22c55e; }
                                    iframe { flex: 1; border: none; }
                                  </style>
                                </head>
                                <body>
                                  <div class="header">
                                    <span class="title">📑 ${doc.filename}</span>
                                    <button class="download-btn" onclick="downloadFile()">⬇️ Download</button>
                                  </div>
                                  <iframe src="${doc.dataUrl}"></iframe>
                                  <script>
                                    function downloadFile() {
                                      const link = document.createElement('a');
                                      link.href = '${doc.dataUrl}';
                                      link.download = '${doc.filename}';
                                      link.click();
                                    }
                                  </script>
                                </body>
                                </html>
                              `);
                              newWindow.document.close();
                            }
                          }}
                        >
                          <span className="text-lg">{icon}</span>
                          <div className="flex-1">
                            <div className="font-semibold">Preview {label}</div>
                            <div className="text-xs opacity-80 truncate max-w-[200px]">
                              {doc.filename}
                            </div>
                          </div>
                          <svg
                            className="h-5 w-5 flex-shrink-0"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                            />
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                            />
                          </svg>
                        </button>
                      )}

                      {/* Download Button */}
                      <button
                        className={`inline-flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-all hover:scale-[1.02] cursor-pointer w-full text-left ${
                          doc.canPreview
                            ? 'bg-white/10 text-white border border-white/20'
                            : `bg-gradient-to-r ${color} text-white`
                        }`}
                        title={`Download ${doc.filename}`}
                        onClick={() => {
                          const link = document.createElement('a');
                          link.href = doc.dataUrl;
                          link.download = doc.filename;
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                        }}
                      >
                        <span className="text-lg">{icon}</span>
                        <div className="flex-1">
                          <div className="font-semibold">Download {label}</div>
                          <div className="text-xs opacity-80 truncate max-w-[200px]">
                            {doc.filename}
                          </div>
                        </div>
                        <svg
                          className="h-5 w-5 flex-shrink-0"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                          />
                        </svg>
                      </button>
                    </>
                  );
                })()}
              </div>
            </div>
          )}

          {/* Generated Files Download Section */}
          {!isUser && message.files && message.files.length > 0 && (
            <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
              <div className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>
                📎 Your document is ready:
              </div>
              <div className="flex flex-col gap-2">
                {message.files.map((file, index) => {
                  // Get icon and label based on file type
                  const getFileInfo = (mimeType: string, filename: string) => {
                    if (
                      mimeType.includes('spreadsheet') ||
                      mimeType.includes('xlsx') ||
                      filename.endsWith('.xlsx')
                    ) {
                      return { icon: '📊', label: 'Excel Spreadsheet' };
                    }
                    if (
                      mimeType.includes('presentation') ||
                      mimeType.includes('pptx') ||
                      filename.endsWith('.pptx')
                    ) {
                      return { icon: '📽️', label: 'PowerPoint' };
                    }
                    if (
                      mimeType.includes('document') ||
                      mimeType.includes('docx') ||
                      filename.endsWith('.docx')
                    ) {
                      return { icon: '📄', label: 'Word Document' };
                    }
                    if (mimeType.includes('pdf') || filename.endsWith('.pdf')) {
                      return { icon: '📑', label: 'PDF' };
                    }
                    return { icon: '📁', label: 'Document' };
                  };

                  const { icon, label } = getFileInfo(file.mime_type, file.filename);

                  return (
                    <div
                      key={file.download_url || `${file.filename}-${index}`}
                      className="flex flex-col gap-1"
                    >
                      {/* Download to Device Button */}
                      <button
                        className="inline-flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-all hover:scale-[1.02] cursor-pointer w-full text-left"
                        style={{
                          backgroundColor: 'var(--primary)',
                          color: 'white',
                        }}
                        title={`Download ${file.filename}`}
                        onClick={async () => {
                          // Use fetch + blob to force download (prevents opening in viewer)
                          try {
                            const response = await fetch(file.download_url);
                            const blob = await response.blob();
                            const url = window.URL.createObjectURL(blob);
                            const link = document.createElement('a');
                            link.href = url;
                            link.download = file.filename;
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                            window.URL.revokeObjectURL(url);
                          } catch (err) {
                            // Fallback: open in new tab
                            console.error('Download failed:', err);
                            window.open(file.download_url, '_blank');
                          }
                        }}
                      >
                        <span className="text-lg">{icon}</span>
                        <div className="flex-1">
                          <div className="font-semibold">Download {label}</div>
                          <div className="text-xs opacity-80 truncate max-w-[200px]">
                            {file.filename}
                          </div>
                        </div>
                        <svg
                          className="h-5 w-5 flex-shrink-0"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                          />
                        </svg>
                      </button>

                      {/* Save to My Files Button */}
                      <button
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all hover:scale-[1.01] cursor-pointer w-full text-left disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{
                          backgroundColor: 'var(--glass-bg)',
                          border: '1px solid var(--border)',
                          color: 'var(--text-primary)',
                        }}
                        title="Save to My Files for AI recall"
                        disabled={savingFiles[index] === 'saving'}
                        onClick={() => handleSaveToMyFiles(index, file.download_url, file.filename)}
                      >
                        {savingFiles[index] === 'saving' ? (
                          <>
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
                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                              />
                            </svg>
                            <span>Saving...</span>
                          </>
                        ) : savingFiles[index] === 'saved' ? (
                          <>
                            <svg
                              className="h-4 w-4 text-green-500"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                            <span className="text-green-500">Saved to My Files!</span>
                          </>
                        ) : savingFiles[index] === 'error' ? (
                          <>
                            <svg
                              className="h-4 w-4 text-red-500"
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
                            <span className="text-red-500">Failed to save</span>
                          </>
                        ) : (
                          <>
                            <svg
                              className="h-4 w-4"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z"
                              />
                            </svg>
                            <span>Save to My Files</span>
                            <span className="text-[10px] opacity-60">(for AI recall)</span>
                          </>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Timestamp, Copy Button, Session ID, and Admin Badges */}
          <div
            className={`mt-1 flex items-center gap-2 text-xs font-mono ${isUser ? 'light-mode-timestamp' : ''}`}
            style={{
              color: isUser ? 'var(--chat-user-bubble-text)' : 'var(--text-muted)',
              opacity: isUser ? 0.7 : 1,
            }}
          >
            {/* Hacker-style timestamp: 14:34:27 UTC with epoch on hover */}
            <span
              title={`Epoch: ${Math.floor(new Date(message.timestamp).getTime() / 1000)}`}
              className="cursor-help"
            >
              {new Date(message.timestamp).toLocaleTimeString('en-GB', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false,
              })}{' '}
              <span className="opacity-60">UTC</span>
            </span>
            {/* Copy button - AI messages only */}
            {!isUser && (
              <button
                onClick={handleCopy}
                className="p-1 rounded hover:bg-white/10 transition-colors"
                title={copied ? 'Copied!' : 'Copy message'}
              >
                {copied ? (
                  <svg
                    className="h-3.5 w-3.5 text-green-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                ) : (
                  <svg
                    className="h-3.5 w-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                    />
                  </svg>
                )}
              </button>
            )}
            {/* Reply button - AI messages only */}
            {!isUser && onReply && (
              <button
                onClick={() => onReply(message)}
                className="p-1 rounded hover:bg-white/10 transition-colors"
                title="Reply to this message"
              >
                <svg
                  className="h-3.5 w-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  style={{ color: 'var(--text-muted)' }}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
                  />
                </svg>
              </button>
            )}
            {/* Model indicator - admin only, shows which AI model responded */}
            {isAdmin && !isUser && message.model && (
              <span
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                  message.model.includes('haiku')
                    ? 'bg-cyan-500/20 text-cyan-400'
                    : message.model.includes('sonnet')
                      ? 'bg-violet-500/20 text-violet-400'
                      : message.model.includes('opus')
                        ? 'bg-amber-500/20 text-amber-400'
                        : message.model.includes('sonar')
                          ? 'bg-orange-500/20 text-orange-400'
                          : 'bg-purple-500/20 text-purple-400'
                }`}
              >
                {message.model}
              </span>
            )}
            {/* Admin-only search provider indicator */}
            {isAdmin && !isUser && message.searchProvider && (
              <span
                className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-orange-500/20 text-orange-400"
                title={`Search: ${message.searchProvider}`}
              >
                🔍 {message.searchProvider}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

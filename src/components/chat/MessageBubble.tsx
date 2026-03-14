/** Message bubble — displays individual messages with rich content */

'use client';

import { useState, useMemo, useRef, useEffect, lazy, Suspense, memo } from 'react';
import type { Message } from '@/app/chat/types';
import { linkifyToReact } from '@/lib/utils/linkify';
import { MarkdownRenderer } from './MarkdownRenderer';
import type { ActionPreviewData } from './ActionPreviewCard';
import type { DestructiveActionData } from './DestructiveActionCard';
import type { ScheduledActionData } from './ScheduledActionCard';
import { getToolEntry } from '@/lib/ai/tools/registry';
import { CodePreviewBlock } from './CodePreviewBlock';
import { MessageFooter } from './MessageFooter';
import { MessageCitations } from './MessageCitations';
import { MessageDocumentDownload } from './MessageDocumentDownload';
import { MessageGeneratedFiles } from './MessageGeneratedFiles';
import { MessageVideoJob } from './MessageVideoJob';
import { MessageAttachments } from './MessageAttachments';
import { GeneratedImageBlock } from './GeneratedImageBlock';
import { ShoppingProducts } from './ShoppingProducts';

const MultiPagePreview = lazy(() => import('./MultiPagePreview'));
const AnalyticsBlock = lazy(() =>
  import('@/components/analytics/AnalyticsBlock').then((mod) => ({ default: mod.AnalyticsBlock }))
);

const TOOL_ICONS: Record<string, string> = {
  web_search: '🔍',
  maps: '🗺️',
  places: '📍',
  weather: '⛅',
  image_gen: '🎨',
  video_gen: '🎬',
  file_analysis: '📊',
  amazon_search: '🛒',
  desktop_sandbox: '🖥️',
  screenshot: '📸',
  run_code: '⚡',
  workspace: '💻',
};

const TOOL_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-gray-500/20 text-gray-300',
  running: 'bg-blue-500/20 text-blue-300 animate-pulse',
  completed: 'bg-green-500/20 text-green-300',
  error: 'bg-red-500/20 text-red-300',
};

interface MessageBubbleProps {
  message: Message;
  isLast: boolean;
  isAdmin?: boolean;
  onReply?: (message: Message) => void;
  enableCodeActions?: boolean;
  onRegenerateImage?: (generationId: string, originalPrompt: string, feedback: string) => void;
  onActionSend?: (preview: ActionPreviewData) => Promise<void>;
  onActionEdit?: (preview: ActionPreviewData, instruction: string) => void;
  onActionCancel?: (preview: ActionPreviewData) => void;
  onDestructiveConfirm?: (data: DestructiveActionData) => Promise<void>;
  onDestructiveCancel?: (data: DestructiveActionData) => void;
  onScheduledConfirm?: (data: ScheduledActionData) => Promise<void>;
  onScheduledModifyTime?: (data: ScheduledActionData, newTime: string) => void;
  onScheduledCancel?: (data: ScheduledActionData) => void;
  onRetry?: () => void;
}

export const MessageBubble = memo(
  function MessageBubble({
    message,
    isLast: _isLast,
    isAdmin,
    onReply,
    enableCodeActions,
    onRegenerateImage,
    onActionSend,
    onActionEdit,
    onActionCancel,
    onDestructiveConfirm,
    onDestructiveCancel,
    onScheduledConfirm,
    onScheduledModifyTime,
    onScheduledCancel,
    onRetry,
  }: MessageBubbleProps) {
    const isUser = message.role === 'user';
    const [thinkingManuallyToggled, setThinkingManuallyToggled] = useState(false);

    const { thinkingContent, displayContent, isStillThinking } = useMemo(() => {
      if (isUser || !message.content) {
        return { thinkingContent: '', displayContent: message.content, isStillThinking: false };
      }

      // Match completed thinking blocks
      const thinkingRegex = /\n?<thinking>\n?([\s\S]*?)\n?<\/thinking>\n?/g;
      const thinkingParts: string[] = [];
      let match;
      while ((match = thinkingRegex.exec(message.content)) !== null) {
        thinkingParts.push(match[1]);
      }

      // Check for in-progress thinking (open tag, no close tag yet — still streaming)
      const openThinkingMatch = message.content.match(/<thinking>\n?([\s\S]*)$/);
      const stillThinking = !!openThinkingMatch && !message.content.endsWith('</thinking>');
      if (stillThinking && openThinkingMatch) {
        thinkingParts.push(openThinkingMatch[1]);
      }

      let cleaned =
        thinkingParts.length > 0
          ? message.content
              .replace(thinkingRegex, '')
              .replace(/<thinking>[\s\S]*$/, '') // Remove in-progress thinking tag
              .trim()
          : message.content;
      // Strip hidden image reference links (e.g. [ref:https://...supabase.co/...])
      cleaned = cleaned.replace(/\n*\[ref:https?:\/\/[^\]]+\]/g, '').trim();

      // Deduplicate: extended thinking often includes the full answer at the end
      // of the thinking block, then the same answer is in the text response.
      // Strategy: strip overlap from the response AND trim the thinking to just reasoning.
      if (thinkingParts.length > 0 && cleaned) {
        for (const part of thinkingParts) {
          const trimmedPart = part.trim();
          if (!trimmedPart) continue;

          // Exact prefix match
          if (cleaned.startsWith(trimmedPart)) {
            cleaned = cleaned.slice(trimmedPart.length).trim();
            continue;
          }

          // Find overlap: thinking often ends with the same text the response starts with.
          // Check successive lines of thinking to find where it starts matching the response.
          const lines = trimmedPart.split('\n');
          for (let i = 1; i < lines.length; i++) {
            const suffix = lines.slice(i).join('\n').trim();
            if (suffix.length > 40 && cleaned.startsWith(suffix)) {
              cleaned = cleaned.slice(suffix.length).trim();
              break;
            }
          }
        }
      }

      // Trim thinking to just the reasoning — remove any portion that duplicates the response.
      let thinkingDisplay = thinkingParts.join('\n\n');
      if (thinkingDisplay && cleaned) {
        const responseStart = cleaned.slice(0, 120).trim();
        if (responseStart.length > 30) {
          const overlapIdx = thinkingDisplay.indexOf(responseStart);
          if (overlapIdx > 0) {
            thinkingDisplay = thinkingDisplay.slice(0, overlapIdx).trim();
          }
        }
      }

      return {
        thinkingContent: thinkingDisplay,
        displayContent: cleaned,
        isStillThinking: stillThinking,
      };
    }, [message.content, isUser]);

    // Auto-expand thinking while streaming, auto-collapse when done
    const thinkingExpanded = thinkingManuallyToggled
      ? true // User clicked to expand — keep it open
      : isStillThinking; // Auto-expand while thinking, auto-collapse when done

    return (
      <div
        className={`flex items-start gap-2 mb-2 ${isUser ? 'justify-end' : ''}`}
        aria-busy={message.isStreaming || false}
      >
        {/* User Avatar */}
        {isUser && (
          <div className="mt-1 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full order-first bg-avatar-bg text-primary">
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                clipRule="evenodd"
              />
            </svg>
          </div>
        )}

        <div className="space-y-0 overflow-x-hidden flex-1 max-w-full">
          {/* Tool Calls */}
          {message.toolCalls && message.toolCalls.length > 0 && (
            <div className="flex flex-wrap gap-0">
              {message.toolCalls.map((tool) => (
                <div
                  key={tool.id}
                  role="status"
                  aria-label={`Tool ${tool.name.replace(/_/g, ' ')}: ${tool.status}`}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${TOOL_STATUS_COLORS[tool.status] || TOOL_STATUS_COLORS.pending}`}
                >
                  <span>{TOOL_ICONS[tool.name] || '🔧'}</span>
                  <span className="capitalize">{tool.name.replace(/_/g, ' ')}</span>
                  {getToolEntry(tool.name)?.status === 'beta' && (
                    <span className="rounded bg-amber-500/20 px-1 py-0.5 text-[10px] font-semibold uppercase leading-none text-amber-400">
                      beta
                    </span>
                  )}
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
            <MessageAttachments attachments={message.attachments} />
          )}

          {/* Generated Image (legacy) */}
          {message.imageUrl && !message.generatedImage && (
            <div className="mb-2 overflow-hidden rounded-lg border border-white/10 max-w-sm relative group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={message.imageUrl}
                alt={`AI-generated image${message.content ? `: ${message.content.slice(0, 120)}` : ''}`}
                className="w-full h-auto rounded-lg"
              />
              <DownloadLink
                href={message.imageUrl}
                filename={`generated-image-${Date.now()}.png`}
                className="absolute bottom-2 right-2"
              />
            </div>
          )}

          {/* Generated Image (with metadata) */}
          {message.generatedImage && (
            <GeneratedImageBlock image={message.generatedImage} onRegenerate={onRegenerateImage} />
          )}

          {/* Analytics */}
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

          {/* Code Preview */}
          {message.codePreview && (
            <CodePreviewBlock
              code={message.codePreview.code}
              language={message.codePreview.language}
              title={message.codePreview.title}
              description={message.codePreview.description}
            />
          )}

          {/* Multi-Page Website */}
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
                  window.dispatchEvent(
                    new CustomEvent('forge-action', {
                      detail: { action: 'push-to-github', website: message.multiPageWebsite },
                    })
                  );
                }}
                onDeploy={() => {
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
              <DownloadLink
                href={message.videoUrl}
                filename={`generated-video-${Date.now()}.mp4`}
                className="absolute bottom-12 right-2"
              />
            </div>
          )}

          {/* Video Job Progress */}
          {message.videoJob && !message.videoUrl && <MessageVideoJob videoJob={message.videoJob} />}

          {/* Shopping Products */}
          {message.products && message.products.length > 0 && (
            <ShoppingProducts products={message.products} />
          )}

          {/* Message Bubble */}
          <div
            className={`select-text ${isUser ? 'chat-bubble chat-bubble-tail right user-bubble text-[var(--chat-user-bubble-text)]' : 'ai-message-clean text-text-primary'}`}
          >
            <div className="break-words select-text">
              {isUser ? (
                <div className="whitespace-pre-wrap">{linkifyToReact(message.content)}</div>
              ) : (
                <>
                  {thinkingContent && (
                    <ThinkingBlock
                      content={thinkingContent}
                      expanded={thinkingExpanded}
                      isStreaming={isStillThinking}
                      onToggle={() => setThinkingManuallyToggled(!thinkingManuallyToggled)}
                    />
                  )}
                  <MarkdownRenderer
                    content={displayContent}
                    enableCodeActions={enableCodeActions}
                    onActionSend={onActionSend}
                    onActionEdit={onActionEdit}
                    onActionCancel={onActionCancel}
                    onDestructiveConfirm={onDestructiveConfirm}
                    onDestructiveCancel={onDestructiveCancel}
                    onScheduledConfirm={onScheduledConfirm}
                    onScheduledModifyTime={onScheduledModifyTime}
                    onScheduledCancel={onScheduledCancel}
                  />
                  {message.isStreaming && (
                    <span className="inline-block ml-0.5 text-primary animate-[blink_1s_step-end_infinite] text-base leading-none">
                      ▋
                    </span>
                  )}
                </>
              )}
            </div>

            {!isUser && message.citations && message.citations.length > 0 && (
              <MessageCitations citations={message.citations} />
            )}

            {!isUser && message.documentDownload && (
              <MessageDocumentDownload documentDownload={message.documentDownload} />
            )}

            {!isUser && message.files && message.files.length > 0 && (
              <MessageGeneratedFiles files={message.files} />
            )}

            <MessageFooter
              message={message}
              isUser={isUser}
              isAdmin={isAdmin}
              onReply={onReply}
              onRetry={message.isError ? onRetry : undefined}
            />
          </div>
        </div>
      </div>
    );
  },
  function areEqual(prev, next) {
    return (
      prev.message.id === next.message.id &&
      prev.message.content === next.message.content &&
      prev.message.toolCalls === next.message.toolCalls &&
      prev.message.attachments === next.message.attachments &&
      prev.message.isStreaming === next.message.isStreaming &&
      prev.message.isError === next.message.isError &&
      prev.message.generatedImage === next.message.generatedImage &&
      prev.message.videoUrl === next.message.videoUrl &&
      prev.isLast === next.isLast &&
      prev.isAdmin === next.isAdmin &&
      prev.enableCodeActions === next.enableCodeActions
    );
  }
);

// ---------------------------------------------------------------------------
// Inline helper components (small, not worth separate files)
// ---------------------------------------------------------------------------

function DownloadLink({
  href,
  filename,
  className,
}: {
  href: string;
  filename: string;
  className: string;
}) {
  return (
    <a
      href={href}
      download={filename}
      className={`rounded-full bg-black/70 p-2 opacity-0 group-hover:opacity-100 md:opacity-100 transition-opacity hover:bg-black/90 ${className}`}
      title="Download"
      aria-label={`Download ${filename}`}
    >
      <svg
        className="h-5 w-5 text-white"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
        />
      </svg>
    </a>
  );
}

function ThinkingBlock({
  content,
  expanded,
  isStreaming,
  onToggle,
}: {
  content: string;
  expanded: boolean;
  isStreaming?: boolean;
  onToggle: () => void;
}) {
  const thinkingRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of thinking content while streaming
  useEffect(() => {
    if (expanded && isStreaming && thinkingRef.current) {
      thinkingRef.current.scrollTop = thinkingRef.current.scrollHeight;
    }
  }, [expanded, isStreaming, content]);

  // Clean thinking content: strip residual tags, normalize whitespace,
  // and deduplicate consecutive identical paragraphs (streaming artifact)
  const cleanedContent = useMemo(() => {
    const stripped = content
      .replace(/<\/?thinking>/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    // Deduplicate consecutive identical paragraphs — a streaming artifact
    // where the same thinking text appears multiple times
    const paragraphs = stripped.split(/\n\n+/);
    const deduped: string[] = [];
    for (const p of paragraphs) {
      if (deduped.length === 0 || deduped[deduped.length - 1] !== p) {
        deduped.push(p);
      }
    }
    return deduped.join('\n\n');
  }, [content]);

  return (
    <div
      className="mb-3 rounded-lg text-xs border border-theme"
      style={{ background: 'var(--bg-tertiary)' }}
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-3 py-2 text-left text-text-secondary"
        aria-expanded={expanded}
      >
        <span
          className="inline-block transition-transform duration-150"
          style={{
            transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
          }}
        >
          {expanded ? '▼' : '▶'}
        </span>
        <span>Thinking</span>
        {isStreaming && <span className="inline-block ml-1 text-primary animate-pulse">...</span>}
      </button>
      {expanded && (
        <div
          ref={thinkingRef}
          className="px-3 pb-3 border-t border-theme overflow-y-auto"
          style={{ color: 'var(--text-secondary)', maxHeight: '200px' }}
        >
          <div className="whitespace-pre-wrap">{cleanedContent}</div>
          {isStreaming && (
            <span className="inline-block ml-0.5 text-primary animate-[blink_1s_step-end_infinite]">
              ▋
            </span>
          )}
        </div>
      )}
    </div>
  );
}

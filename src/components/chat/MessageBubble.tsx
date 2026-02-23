/** Message bubble — displays individual messages with rich content */

'use client';

import { useState, useMemo, lazy, Suspense, memo } from 'react';
import type { Message } from '@/app/chat/types';
import { linkifyToReact } from '@/lib/utils/linkify';
import { MarkdownRenderer } from './MarkdownRenderer';
import type { ActionPreviewData } from './ActionPreviewCard';
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
  }: MessageBubbleProps) {
    const isUser = message.role === 'user';
    const [thinkingExpanded, setThinkingExpanded] = useState(false);

    const { thinkingContent, displayContent } = useMemo(() => {
      if (isUser || !message.content) {
        return { thinkingContent: '', displayContent: message.content };
      }
      const thinkingRegex = /\n?<thinking>\n([\s\S]*?)\n<\/thinking>\n?/g;
      const thinkingParts: string[] = [];
      let match;
      while ((match = thinkingRegex.exec(message.content)) !== null) {
        thinkingParts.push(match[1]);
      }
      const cleaned =
        thinkingParts.length > 0
          ? message.content.replace(thinkingRegex, '').trim()
          : message.content;
      return { thinkingContent: thinkingParts.join('\n\n'), displayContent: cleaned };
    }, [message.content, isUser]);

    return (
      <div className={`flex items-start gap-2 mb-2 ${isUser ? 'justify-end' : ''}`}>
        {/* User Avatar */}
        {isUser && (
          <div
            className="mt-1 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full order-first"
            style={{ backgroundColor: 'var(--avatar-bg)', color: 'var(--primary)' }}
          >
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
                alt="AI-generated image"
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
            className={`${isUser ? 'chat-bubble chat-bubble-tail right user-bubble' : 'ai-message-clean'}`}
            style={{
              userSelect: 'text',
              WebkitUserSelect: 'text',
              color: isUser ? 'var(--chat-user-bubble-text)' : 'var(--text-primary)',
            }}
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
                      onToggle={() => setThinkingExpanded(!thinkingExpanded)}
                    />
                  )}
                  <MarkdownRenderer
                    content={displayContent}
                    enableCodeActions={enableCodeActions}
                    onActionSend={onActionSend}
                    onActionEdit={onActionEdit}
                    onActionCancel={onActionCancel}
                  />
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

            {!isUser && message.citations && message.citations.length > 0 && (
              <MessageCitations citations={message.citations} />
            )}

            {!isUser && message.documentDownload && (
              <MessageDocumentDownload documentDownload={message.documentDownload} />
            )}

            {!isUser && message.files && message.files.length > 0 && (
              <MessageGeneratedFiles files={message.files} />
            )}

            <MessageFooter message={message} isUser={isUser} isAdmin={isAdmin} onReply={onReply} />
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
    >
      <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
  onToggle,
}: {
  content: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className="mb-3 rounded-lg text-xs"
      style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-3 py-2 text-left"
        style={{ color: 'var(--text-secondary)' }}
      >
        <span
          style={{
            transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
            transition: 'transform 0.15s',
          }}
        >
          ▶
        </span>
        <span>Thinking</span>
      </button>
      {expanded && (
        <div
          className="px-3 pb-3 whitespace-pre-wrap"
          style={{ color: 'var(--text-tertiary)', borderTop: '1px solid var(--border)' }}
        >
          {content}
        </div>
      )}
    </div>
  );
}

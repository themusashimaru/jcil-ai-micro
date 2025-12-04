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
 * - Copy message button
 */

'use client';

import { useState, useMemo } from 'react';
import type { Message } from '@/app/chat/types';
import { linkifyToReact } from '@/lib/utils/linkify';
import { MarkdownRenderer } from './MarkdownRenderer';
import { ConnectorAction, parseConnectorActions } from './ConnectorAction';

interface MessageBubbleProps {
  message: Message;
  isLast: boolean;
}

export function MessageBubble({ message, isLast }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);

  // Parse connector actions from AI messages
  const { cleanContent, actions } = useMemo(() => {
    if (isUser) {
      return { cleanContent: message.content, actions: [] };
    }
    return parseConnectorActions(message.content);
  }, [message.content, isUser]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
    <div className={`flex items-start gap-0 mb-1 ${isUser ? 'justify-end' : ''}`}>
      {/* Avatar - both AI and user messages, always on left */}
      <div className={`mt-0 flex h-3 w-3 flex-shrink-0 items-center justify-center rounded-full ${
        isUser ? 'bg-white/5 text-gray-400' : 'bg-cyan-500/10 text-cyan-400'
      }`}>
        <svg className="h-2 w-2" fill="currentColor" viewBox="0 0 20 20">
          <path d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" />
        </svg>
      </div>

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
          <div className="flex flex-wrap gap-1 max-w-full overflow-hidden">
            {message.attachments.map((attachment) => (
              <div
                key={attachment.id}
                className="group relative overflow-hidden rounded-lg border border-white/10"
              >
                {attachment.thumbnail ? (
                  <img
                    src={attachment.thumbnail}
                    alt={attachment.name}
                    className="h-10 w-10 object-cover"
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center bg-white/5">
                    <svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24">
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
                <div className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 transition-opacity group-hover:opacity-100">
                  <span className="truncate px-2 text-xs text-white">
                    {attachment.name}
                  </span>
                </div>
              </div>
            ))}
            {message.attachments.length > 4 && (
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/5 text-xs text-gray-400">
                +{message.attachments.length - 4}
              </div>
            )}
          </div>
        )}

        {/* Generated Image */}
        {message.imageUrl && (
          <div className="mb-2 overflow-hidden rounded-lg border border-white/10 max-w-sm relative group">
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
              <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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

        {/* Shopping Products - Horizontal Scrolling */}
        {message.products && message.products.length > 0 && (
          <div className="mb-3">
            <div
              className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              {message.products.map((product, index) => (
                <a
                  key={index}
                  href={product.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group relative flex-shrink-0 w-64 overflow-hidden rounded-lg border border-white/10 bg-white/5 transition hover:border-white/20 hover:bg-white/10 snap-start"
                >
                  {/* Product Image */}
                  {product.image && (
                    <div className="h-48 overflow-hidden">
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
                    {product.rating && (
                      <p className="text-xs text-gray-400">⭐ {product.rating}</p>
                    )}
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

        {/* Message Bubble */}
        <div
          className={`chat-bubble chat-bubble-tail ${
            isUser ? 'right bg-blue-600 text-white' : 'left border border-blue-500'
          }`}
        >
          <div className="break-words">
            {isUser ? (
              // User messages: simple text with linkified URLs
              <div className="whitespace-pre-wrap">{linkifyToReact(message.content)}</div>
            ) : (
              // AI messages: full markdown rendering with clean content (action markers removed)
              <MarkdownRenderer content={cleanContent} />
            )}
          </div>

          {/* Connector Actions - Show interactive cards for any detected actions */}
          {!isUser && actions.length > 0 && (
            <div className="mt-3 space-y-2">
              {actions.map((actionItem, index) => (
                <ConnectorAction
                  key={`${actionItem.service}-${actionItem.action}-${index}`}
                  service={actionItem.service}
                  action={actionItem.action}
                  params={actionItem.params}
                  description={actionItem.description}
                />
              ))}
            </div>
          )}

          {/* Citations/Sources from Live Search */}
          {!isUser && message.citations && message.citations.length > 0 && (
            <div className="mt-3 pt-3 border-t border-white/10">
              <div className="flex items-center gap-1 text-xs text-gray-400 mb-2">
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                <span>Sources ({message.citations.length})</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {message.citations.slice(0, 5).map((url, index) => {
                  // Extract domain from URL for display
                  let domain = url;
                  try {
                    domain = new URL(url).hostname.replace('www.', '');
                  } catch {
                    // Keep original URL if parsing fails
                  }
                  return (
                    <a
                      key={index}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/5 text-xs text-blue-400 hover:bg-white/10 hover:text-blue-300 transition-colors truncate max-w-[200px]"
                      title={url}
                    >
                      <span className="truncate">{domain}</span>
                      <svg className="h-2.5 w-2.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  );
                })}
                {message.citations.length > 5 && (
                  <span className="px-2 py-0.5 text-xs text-gray-500">
                    +{message.citations.length - 5} more
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Timestamp */}
          <div
            className={`mt-1 text-xs ${
              isUser ? 'text-white/70' : 'text-gray-400'
            }`}
          >
            {new Date(message.timestamp).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </div>
        </div>

        {/* Actions */}
        {!isUser && isLast && (
          <div className="flex gap-0">
            <button
              onClick={handleCopy}
              className={`rounded px-1 py-0 text-xs flex items-center justify-center transition-colors ${
                copied
                  ? 'text-green-400'
                  : 'text-gray-400 hover:bg-white/5 hover:text-white'
              }`}
              title={copied ? 'Copied!' : 'Copy message'}
            >
              {copied ? (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              ) : (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
              )}
            </button>
            <button
              className="rounded px-1 py-0 text-xs text-gray-400 hover:bg-white/5 hover:text-white flex items-center justify-center"
              title="Regenerate"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

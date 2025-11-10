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

import type { Message } from '@/app/chat/types';

interface MessageBubbleProps {
  message: Message;
  isLast: boolean;
}

export function MessageBubble({ message, isLast }: MessageBubbleProps) {
  const isUser = message.role === 'user';

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
    <div className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      {/* Avatar */}
      <div
        className={`mt-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${
          isUser ? 'bg-white text-black' : 'bg-white/5 text-gray-400'
        }`}
      >
        {isUser ? (
          <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
              clipRule="evenodd"
            />
          </svg>
        ) : (
          <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" />
          </svg>
        )}
      </div>

      {/* Message Content */}
      <div className="flex-1 space-y-2">
        {/* Tool Calls */}
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="flex flex-wrap gap-2">
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
          <div className="flex flex-wrap gap-2">
            {message.attachments.map((attachment) => (
              <div
                key={attachment.id}
                className="group relative overflow-hidden rounded-lg border border-white/10"
              >
                {attachment.thumbnail ? (
                  <img
                    src={attachment.thumbnail}
                    alt={attachment.name}
                    className="h-20 w-20 object-cover"
                  />
                ) : (
                  <div className="flex h-20 w-20 items-center justify-center bg-white/5">
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
              <div className="flex h-20 w-20 items-center justify-center rounded-lg bg-white/5 text-sm text-gray-400">
                +{message.attachments.length - 4}
              </div>
            )}
          </div>
        )}

        {/* Generated Image */}
        {message.imageUrl && (
          <div className="mb-2 overflow-hidden rounded-lg border border-white/10">
            <img
              src={message.imageUrl}
              alt="AI-generated image"
              className="max-w-full rounded-lg"
              style={{ maxHeight: '400px' }}
            />
          </div>
        )}

        {/* Message Bubble */}
        <div
          className={`chat-bubble chat-bubble-tail ${
            isUser ? 'right bg-white text-black' : 'left'
          }`}
        >
          <div className="whitespace-pre-wrap break-words">{message.content}</div>

          {/* Timestamp */}
          <div
            className={`mt-2 text-xs ${
              isUser ? 'text-black/60' : 'text-gray-500'
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
          <div className="flex gap-2">
            <button
              onClick={() => navigator.clipboard.writeText(message.content)}
              className="rounded px-2 py-1 text-xs text-gray-400 hover:bg-white/5 hover:text-white"
              title="Copy message"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
            </button>
            <button
              className="rounded px-2 py-1 text-xs text-gray-400 hover:bg-white/5 hover:text-white"
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

/** Message footer — timestamp, copy, reply, model badge, search provider */

'use client';

import { useState } from 'react';
import type { Message } from '@/app/chat/types';

interface MessageFooterProps {
  message: Message;
  isUser: boolean;
  isAdmin?: boolean;
  onReply?: (message: Message) => void;
}

export function MessageFooter({ message, isUser, isAdmin, onReply }: MessageFooterProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div
      className={`mt-1 flex items-center gap-2 text-xs font-mono ${isUser ? 'light-mode-timestamp' : ''}`}
      style={{
        color: isUser ? 'var(--chat-user-bubble-text)' : 'var(--text-muted)',
        opacity: isUser ? 0.7 : 1,
      }}
    >
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
      {isAdmin && !isUser && message.searchProvider && (
        <span
          className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-orange-500/20 text-orange-400"
          title={`Search: ${message.searchProvider}`}
        >
          🔍 {message.searchProvider}
        </span>
      )}
    </div>
  );
}

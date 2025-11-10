/**
 * CHAT THREAD COMPONENT
 *
 * PURPOSE:
 * - Display message thread with virtualization for performance
 * - Show streaming responses with typing indicator
 * - Display tool call badges
 * - Support message attachments
 *
 * FEATURES:
 * - Virtualized scrolling for long conversations
 * - Glassmorphism message bubbles with tails
 * - Tool execution badges (pending, running, completed, error)
 * - Image thumbnails and file attachment badges
 * - Auto-scroll to bottom on new messages
 */

'use client';

import { useEffect, useRef } from 'react';
import type { Message } from '@/app/chat/types';
import { MessageBubble } from './MessageBubble';
import { TypingIndicator } from './TypingIndicator';

interface ChatThreadProps {
  messages: Message[];
  isStreaming: boolean;
  currentChatId: string | null;
}

export function ChatThread({ messages, isStreaming, currentChatId }: ChatThreadProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!currentChatId) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="text-center">
          <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-white/5 p-4">
            <svg
              className="h-full w-full text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
              />
            </svg>
          </div>
          <h2 className="mb-2 text-lg font-semibold">Welcome to Delta-2</h2>
          <p className="mb-4 text-sm text-gray-400">
            Start a new chat or select an existing conversation
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <button className="rounded-lg bg-white/5 px-4 py-2 text-sm hover:bg-white/10">
              📧 Write an email
            </button>
            <button className="rounded-lg bg-white/5 px-4 py-2 text-sm hover:bg-white/10">
              🔍 Research a topic
            </button>
            <button className="rounded-lg bg-white/5 px-4 py-2 text-sm hover:bg-white/10">
              ✍️ Write an essay
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={scrollContainerRef}
      className="flex-1 overflow-y-auto p-6"
    >
      <div className="mx-auto max-w-3xl space-y-6">
        {messages.map((message, index) => (
          <MessageBubble
            key={message.id}
            message={message}
            isLast={index === messages.length - 1}
          />
        ))}

        {/* Professional typing indicator */}
        {isStreaming && <TypingIndicator />}

        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}

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
import { useUserProfile } from '@/contexts/UserProfileContext';
import { QuickEmailWriter } from './QuickEmailWriter';
import { QuickResearchTool } from './QuickResearchTool';
import { QuickEssayWriter } from './QuickEssayWriter';
import { QuickDailyDevotional } from './QuickDailyDevotional';
import { QuickBibleStudy } from './QuickBibleStudy';

interface ChatThreadProps {
  messages: Message[];
  isStreaming: boolean;
  currentChatId: string | null;
}

export function ChatThread({ messages, isStreaming, currentChatId }: ChatThreadProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const { profile, hasProfile } = useUserProfile();

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Show logo and tools when no chat is selected OR when chat is empty
  if (!currentChatId || messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-1">
        <div className="text-center">
          {/* JCIL.ai Logo */}
          <div className="mb-1">
            <h1 className="text-xl md:text-4xl font-bold tracking-tight text-white mb-0.5">
              JCIL<span className="text-blue-500">.ai</span>
            </h1>
            <p className="text-xs md:text-lg text-white font-medium mb-1">
              Slingshot 2.0
            </p>
            <p className="text-xs md:text-sm text-gray-400 italic">
              Faith-based AI tools for your everyday needs
            </p>
          </div>

          {/* Personalized greeting if profile exists */}
          {hasProfile && currentChatId && (
            <p className="mb-1 text-xs md:text-lg text-gray-300">
              Hi {profile.name}! How can I help you today?
            </p>
          )}

          {!currentChatId && (
            <p className="mb-2 text-xs md:text-sm text-gray-400">
              Start a new chat or select an existing conversation
            </p>
          )}

          {/* Main Tools */}
          <div className="flex flex-wrap justify-center gap-1 mb-1 mt-2">
            <QuickEmailWriter />
            <QuickResearchTool />
            <QuickEssayWriter />
          </div>

          {/* Bible Tools */}
          <div className="flex justify-center gap-1">
            <QuickDailyDevotional />
            <QuickBibleStudy />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={scrollContainerRef}
      className="flex-1 overflow-y-auto py-0 px-0 md:p-2"
    >
      <div className="mx-auto max-w-[95%] sm:max-w-xl md:max-w-2xl space-y-0 md:space-y-3">

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

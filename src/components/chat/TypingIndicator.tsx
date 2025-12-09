/**
 * TYPING INDICATOR COMPONENT
 *
 * PURPOSE:
 * - Show professional loading messages while AI is processing
 * - Cycles through various status messages
 * - Provides visual feedback during streaming
 */

'use client';

import { useEffect, useState } from 'react';

const PROFESSIONAL_MESSAGES = [
  'Analyzing text...',
  'Processing information...',
  'Synthesizing response...',
  'Generating insights...',
  'Evaluating context...',
  'Formulating answer...',
  'Consulting knowledge base...',
  'Crafting response...',
];

export function TypingIndicator() {
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    // Rotate through messages every 2 seconds
    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % PROFESSIONAL_MESSAGES.length);
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-start gap-3">
      {/* AI Avatar */}
      <div
        className="mt-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full"
        style={{ backgroundColor: 'var(--primary-hover)', color: 'var(--primary)' }}
      >
        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
          <path d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" />
        </svg>
      </div>

      {/* Typing Message */}
      <div className="flex-1 space-y-2">
        <div
          className="inline-block rounded-lg px-4 py-3"
          style={{ backgroundColor: 'var(--glass-bg)', border: '1px solid var(--border)' }}
        >
          <div className="flex items-center gap-3">
            {/* Animated dots */}
            <div className="flex gap-1">
              <div className="h-2 w-2 animate-bounce rounded-full" style={{ backgroundColor: 'var(--primary)', animationDelay: '0ms' }} />
              <div className="h-2 w-2 animate-bounce rounded-full" style={{ backgroundColor: 'var(--primary)', animationDelay: '150ms' }} />
              <div className="h-2 w-2 animate-bounce rounded-full" style={{ backgroundColor: 'var(--primary)', animationDelay: '300ms' }} />
            </div>

            {/* Professional message */}
            <span className="text-sm transition-opacity duration-300" style={{ color: 'var(--text-secondary)' }}>
              {PROFESSIONAL_MESSAGES[messageIndex]}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

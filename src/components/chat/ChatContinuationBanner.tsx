/**
 * CHAT CONTINUATION BANNER
 *
 * Shows when a chat is getting long and offers to:
 * - Summarize the conversation
 * - Create a new chat with context
 * - Keep the to-do list going
 */

'use client';

import { useState } from 'react';

// Threshold for showing the banner
export const CHAT_LENGTH_THRESHOLD = 40;
export const CHAT_LENGTH_WARNING = 30;

interface ChatContinuationBannerProps {
  messageCount: number;
  onContinue: (summary: string, todos: string[]) => void;
  onDismiss: () => void;
  isGenerating?: boolean;
}

export function ChatContinuationBanner({
  messageCount,
  onContinue,
  onDismiss,
  isGenerating = false,
}: ChatContinuationBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  // Don't show if dismissed or below threshold
  if (dismissed || messageCount < CHAT_LENGTH_WARNING) {
    return null;
  }

  const isUrgent = messageCount >= CHAT_LENGTH_THRESHOLD;
  const remaining = CHAT_LENGTH_THRESHOLD - messageCount;

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss();
  };

  const handleContinue = () => {
    // The parent will handle generating the summary
    onContinue('', []);
  };

  return (
    <div
      className={`mx-4 mb-4 p-4 rounded-xl border backdrop-blur-md transition-all ${
        isUrgent
          ? 'bg-amber-500/10 border-amber-500/30'
          : 'bg-blue-500/10 border-blue-500/30'
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className={`p-2 rounded-lg ${isUrgent ? 'bg-amber-500/20' : 'bg-blue-500/20'}`}>
          <svg
            className={`w-5 h-5 ${isUrgent ? 'text-amber-400' : 'text-blue-400'}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className={`font-medium ${isUrgent ? 'text-amber-200' : 'text-blue-200'}`}>
            {isUrgent
              ? 'This conversation is getting long'
              : `${remaining} messages until this chat reaches its limit`}
          </p>
          <p className="text-sm text-gray-400 mt-1">
            {isUrgent
              ? 'For the best experience, continue in a new chat. I\'ll create a summary with your to-do list.'
              : 'Consider starting fresh soon to keep things snappy.'}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {isUrgent && (
            <button
              onClick={handleContinue}
              disabled={isGenerating}
              className="px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isGenerating ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
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
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Summarizing...
                </>
              ) : (
                'Continue in New Chat'
              )}
            </button>
          )}
          <button
            onClick={handleDismiss}
            className="p-2 text-gray-500 hover:text-gray-300 transition-colors"
            title="Dismiss"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Generate a conversation summary prompt for the AI
 */
export function generateSummaryPrompt(messages: Array<{ role: string; content: string }>): string {
  // Get the last 20 messages for context
  const recentMessages = messages.slice(-20);
  const conversation = recentMessages
    .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content.slice(0, 500)}${m.content.length > 500 ? '...' : ''}`)
    .join('\n\n');

  return `Please analyze this conversation and provide:

1. **Summary** (2-3 sentences): What was discussed and accomplished
2. **Key Points** (bullet list): Important information or decisions
3. **To-Do List** (if any): Tasks mentioned but not completed
4. **Context for Next Chat**: Brief context to continue the conversation

Conversation:
${conversation}

Format your response as:
## Summary
[summary]

## Key Points
- [point 1]
- [point 2]

## To-Do List
- [ ] [task 1]
- [ ] [task 2]

## Continue With
[context for the next chat]`;
}

/**
 * CODE COMMAND COMPOSER
 *
 * Professional input for Code Command
 * Features:
 * - Clean black/white design
 * - Keyboard shortcuts (Ctrl+Enter to send)
 * - Auto-resize textarea
 */

'use client';

import { useState, useRef, useEffect, KeyboardEvent } from 'react';

interface CodeCommandComposerProps {
  onSendMessage: (message: string) => void;
  isStreaming: boolean;
}

export function CodeCommandComposer({ onSendMessage, isStreaming }: CodeCommandComposerProps) {
  const [message, setMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 300) + 'px';
  };

  useEffect(() => {
    adjustTextareaHeight();
  }, [message]);

  // Focus textarea on mount
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleSubmit = () => {
    if (!message.trim() || isStreaming) return;
    onSendMessage(message.trim());
    setMessage('');
    // Reset height after sending
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Ctrl/Cmd + Enter to send
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
      return;
    }

    // Plain Enter sends (Shift+Enter for newline)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="bg-black border-t border-white/10 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Input area */}
        <div className="flex items-end gap-3 bg-white/5 border border-white/10 rounded-2xl p-3">
          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about code, debugging, architecture..."
            disabled={isStreaming}
            className="flex-1 bg-transparent text-white placeholder-gray-500 resize-none outline-none min-h-[24px] max-h-[300px] leading-relaxed"
            rows={1}
          />

          {/* Send button */}
          <button
            onClick={handleSubmit}
            disabled={!message.trim() || isStreaming}
            className={`p-2 rounded-xl transition-all ${
              message.trim() && !isStreaming
                ? 'bg-blue-600 text-white hover:bg-blue-500'
                : 'bg-white/10 text-gray-500 cursor-not-allowed'
            }`}
          >
            {isStreaming ? (
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            )}
          </button>
        </div>

        {/* Keyboard hint */}
        <div className="mt-2 text-xs text-gray-600 text-center">
          Press Enter to send · Shift+Enter for new line
        </div>
      </div>
    </div>
  );
}

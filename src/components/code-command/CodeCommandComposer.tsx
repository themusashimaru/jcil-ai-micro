/**
 * CODE COMMAND COMPOSER
 *
 * Terminal-style input for Code Command
 * Features:
 * - Green terminal aesthetic
 * - Command prompt style
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
    <div className="bg-[#0a0a0a] border-t border-green-900/30 p-4 font-mono">
      <div className="max-w-4xl mx-auto">
        {/* Input area */}
        <div className="flex items-start gap-2 bg-[#111] border border-green-900/30 rounded-lg p-3">
          {/* Prompt symbol */}
          <span className="text-green-500 font-bold mt-1 select-none">$</span>

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter your code command..."
            disabled={isStreaming}
            className="flex-1 bg-transparent text-green-100 placeholder-green-800 resize-none outline-none min-h-[24px] max-h-[300px] leading-relaxed"
            rows={1}
          />

          {/* Send button */}
          <button
            onClick={handleSubmit}
            disabled={!message.trim() || isStreaming}
            className={`px-3 py-1 rounded text-sm font-semibold transition-all ${
              message.trim() && !isStreaming
                ? 'bg-green-600 text-black hover:bg-green-500'
                : 'bg-green-900/30 text-green-800 cursor-not-allowed'
            }`}
          >
            {isStreaming ? 'Running...' : 'Execute'}
          </button>
        </div>

        {/* Keyboard hint */}
        <div className="mt-2 text-xs text-green-800 flex justify-between">
          <span>Press Enter to execute • Shift+Enter for new line</span>
          <span>GPT-5.1</span>
        </div>
      </div>
    </div>
  );
}

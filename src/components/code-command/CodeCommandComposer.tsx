/**
 * CODE COMMAND COMPOSER
 *
 * Same styling as regular ChatComposer
 * Clean, simple input matching the main chat interface
 */

'use client';

import { useState, useRef, useEffect, KeyboardEvent } from 'react';

interface CodeCommandComposerProps {
  onSendMessage: (message: string) => void;
  isStreaming: boolean;
}

export function CodeCommandComposer({ onSendMessage, isStreaming }: CodeCommandComposerProps) {
  const [message, setMessage] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
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
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
      return;
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
  };

  return (
    <div className="glass-morphism py-0 px-1 md:p-4 pb-safe" style={{ border: 'none' }}>
      <div className="mx-auto max-w-[98%] sm:max-w-xl md:max-w-2xl">
        {/* Input Area with living glow effect - same as ChatComposer */}
        <div className="relative">
          {/* Subtle living glow aura */}
          <div
            className="absolute -inset-[2px] rounded-lg blur-sm pointer-events-none"
            style={{
              background: 'linear-gradient(90deg, #4DFFFF, #00BFFF, #4DFFFF)',
              backgroundSize: '200% 100%',
              animation: 'living-glow 4s ease-in-out infinite',
            }}
          />
          <div
            className="relative rounded-lg transition-colors bg-black/80"
            style={{
              boxShadow: '0 0 20px rgba(77, 255, 255, 0.15), inset 0 0 20px rgba(77, 255, 255, 0.05)',
            }}
          >
            <div className="relative">
              {/* Placeholder */}
              {!isFocused && !message && (
                <div
                  className="absolute inset-0 flex items-center pointer-events-none py-1.5 px-2 md:p-4"
                  style={{ fontSize: '16px' }}
                >
                  <span className="text-[#4DFFFF] font-medium">
                    Ask about code, debugging, architecture...
                    <span className="animate-pulse">|</span>
                  </span>
                </div>
              )}
              <textarea
                ref={textareaRef}
                value={message}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                placeholder=""
                className="w-full resize-none bg-transparent py-1.5 px-2 md:p-4 text-base md:text-base text-white placeholder-[#4DFFFF] focus:outline-none min-h-[40px]"
                rows={1}
                disabled={isStreaming}
                style={{ fontSize: '16px' }}
              />
            </div>

            {/* Action Bar */}
            <div className="flex items-center justify-end py-2 px-2 md:p-2">
              {/* Send button */}
              <button
                onClick={handleSubmit}
                disabled={!message.trim() || isStreaming}
                className="rounded-lg p-2 md:p-2 bg-[#4DFFFF] hover:bg-[#00BFFF] text-black disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
              >
                {isStreaming ? (
                  <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

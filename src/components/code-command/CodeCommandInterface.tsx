/**
 * CODE COMMAND INTERFACE
 *
 * Main container for the Code Command feature
 * Combines thread and composer with terminal styling
 */

'use client';

import { useState, useCallback } from 'react';
import { useChat } from 'ai/react';
import { CodeCommandThread } from './CodeCommandThread';
import { CodeCommandComposer } from './CodeCommandComposer';

interface CodeCommandInterfaceProps {
  onClose?: () => void;
}

export function CodeCommandInterface({ onClose }: CodeCommandInterfaceProps) {
  const [error, setError] = useState<string | null>(null);

  // Use the AI SDK's useChat hook with our Code Command API
  const {
    messages,
    append,
    isLoading,
    error: chatError,
  } = useChat({
    api: '/api/code-command',
    onError: (err) => {
      console.error('[Code Command] Chat error:', err);
      setError(err.message || 'An error occurred');
    },
  });

  // Handle sending a message
  const handleSendMessage = useCallback(async (content: string) => {
    setError(null);
    try {
      await append({
        role: 'user',
        content,
      });
    } catch (err) {
      console.error('[Code Command] Send error:', err);
      setError('Failed to send message');
    }
  }, [append]);

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#111] border-b border-green-900/30">
        <div className="flex items-center gap-3">
          {/* Terminal dots */}
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500/80" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
            <div className="w-3 h-3 rounded-full bg-green-500/80" />
          </div>
          <span className="font-mono text-green-500 text-sm font-semibold">
            Code Command
          </span>
        </div>

        {/* Close button */}
        {onClose && (
          <button
            onClick={onClose}
            className="text-green-600 hover:text-green-400 transition-colors font-mono text-sm"
          >
            [ESC] Close
          </button>
        )}
      </div>

      {/* Error banner */}
      {(error || chatError) && (
        <div className="px-4 py-2 bg-red-900/30 border-b border-red-900/50 font-mono text-sm text-red-400">
          <span className="text-red-500">ERROR:</span> {error || chatError?.message}
        </div>
      )}

      {/* Thread */}
      <CodeCommandThread
        messages={messages.map((m) => ({
          id: m.id,
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }))}
        isStreaming={isLoading}
      />

      {/* Composer */}
      <CodeCommandComposer
        onSendMessage={handleSendMessage}
        isStreaming={isLoading}
      />
    </div>
  );
}

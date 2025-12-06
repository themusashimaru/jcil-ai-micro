/**
 * CODE COMMAND INTERFACE
 *
 * Main container - same layout as regular chat
 * No extra header, just a simple back button
 */

'use client';

import { useState, useCallback, useRef } from 'react';
import { CodeCommandThread } from './CodeCommandThread';
import { CodeCommandComposer } from './CodeCommandComposer';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface CodeCommandInterfaceProps {
  onClose?: () => void;
}

export function CodeCommandInterface({ onClose }: CodeCommandInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleSendMessage = useCallback(async (content: string) => {
    if (isStreaming) return;

    setError(null);

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content,
    };

    const assistantMessage: Message = {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      content: '',
    };

    setMessages((prev) => [...prev, userMessage, assistantMessage]);
    setIsStreaming(true);

    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch('/api/code-command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMessage].map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error ${response.status}`);
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        fullContent += chunk;

        setMessages((prev) => {
          const newMessages = [...prev];
          const lastMessage = newMessages[newMessages.length - 1];
          if (lastMessage && lastMessage.role === 'assistant') {
            lastMessage.content = fullContent;
          }
          return newMessages;
        });
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        // Request aborted
      } else {
        console.error('[Code Command] Error:', err);
        setError(err instanceof Error ? err.message : 'An error occurred');

        setMessages((prev) => {
          const newMessages = [...prev];
          const lastMessage = newMessages[newMessages.length - 1];
          if (lastMessage && lastMessage.role === 'assistant' && !lastMessage.content) {
            newMessages.pop();
          }
          return newMessages;
        });
      }
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  }, [messages, isStreaming]);

  const handleClose = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    onClose?.();
  }, [onClose]);

  return (
    <div className="flex flex-col h-full">
      {/* Simple back button - minimal header */}
      {onClose && (
        <div className="absolute top-4 left-4 z-10">
          <button
            onClick={handleClose}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors px-3 py-2 rounded-lg hover:bg-white/10"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span className="text-sm">Back to Chat</span>
          </button>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="px-4 py-2 bg-red-900/30 border-b border-red-500/30 text-sm text-red-400">
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-2 text-red-500 hover:text-red-300"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Thread */}
      <CodeCommandThread
        messages={messages}
        isStreaming={isStreaming}
      />

      {/* Composer */}
      <CodeCommandComposer
        onSendMessage={handleSendMessage}
        isStreaming={isStreaming}
      />
    </div>
  );
}

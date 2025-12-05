/**
 * CODE COMMAND INTERFACE
 *
 * Main container for the Code Command feature
 * Professional design matching main chat
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

  // Handle sending a message with streaming response
  const handleSendMessage = useCallback(async (content: string) => {
    if (isStreaming) return;

    setError(null);

    // Add user message
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content,
    };

    // Create placeholder for assistant response
    const assistantMessage: Message = {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      content: '',
    };

    setMessages((prev) => [...prev, userMessage, assistantMessage]);
    setIsStreaming(true);

    // Create abort controller for this request
    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch('/api/code-command', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
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

      // Stream the response (AI SDK v5 toTextStreamResponse = plain text)
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // Simple text streaming - just decode and append
        const chunk = decoder.decode(value, { stream: true });
        fullContent += chunk;

        // Update the message with accumulated content
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
        // Request was aborted, don't show error
      } else {
        console.error('[Code Command] Error:', err);
        setError(err instanceof Error ? err.message : 'An error occurred');

        // Remove the empty assistant message on error
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

  // Handle close - abort any ongoing request
  const handleClose = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    onClose?.();
  }, [onClose]);

  return (
    <div className="flex flex-col h-full bg-black">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-black border-b border-white/10">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold">
            <span className="text-white">JCIL</span>
            <span className="text-blue-500">.ai</span>
            <span className="text-gray-500 font-normal ml-2">Code Command</span>
          </h1>
        </div>

        {/* Close button */}
        {onClose && (
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-lg"
            title="Back to Chat"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

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

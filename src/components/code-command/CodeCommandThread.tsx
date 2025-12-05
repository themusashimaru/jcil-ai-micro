/**
 * CODE COMMAND THREAD
 *
 * Professional message display for Code Command
 * Features:
 * - Clean black/white design matching main chat
 * - Code blocks with syntax highlighting (green/red for diffs)
 * - Professional welcome screen
 */

'use client';

import { useEffect, useRef } from 'react';
import { CodeBlock, parseCodeBlocks } from './CodeBlock';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface CodeCommandThreadProps {
  messages: Message[];
  isStreaming: boolean;
}

/**
 * Render message content with code block support
 */
function MessageContent({ content }: { content: string }) {
  const parts = parseCodeBlocks(content);

  if (parts.length === 0) {
    return <p className="whitespace-pre-wrap leading-relaxed">{content}</p>;
  }

  return (
    <div className="space-y-4">
      {parts.map((part, index) => {
        if (part.type === 'code') {
          return (
            <CodeBlock
              key={index}
              code={part.content}
              language={part.language}
              showLineNumbers={true}
            />
          );
        }
        return (
          <p key={index} className="whitespace-pre-wrap leading-relaxed">
            {part.content}
          </p>
        );
      })}
    </div>
  );
}

export function CodeCommandThread({ messages, isStreaming }: CodeCommandThreadProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const showWelcome = messages.length === 0;

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Welcome screen - clean professional design
  if (showWelcome) {
    return (
      <div className="flex flex-1 items-center justify-center p-4 bg-black">
        <div className="text-center">
          {/* Logo/Title */}
          <div className="mb-6">
            <h1 className="text-4xl md:text-5xl font-semibold mb-2">
              <span className="text-white">JCIL</span>
              <span className="text-blue-500">.ai</span>
            </h1>
            <h2 className="text-xl md:text-2xl text-gray-400 font-medium">
              Code Command
            </h2>
          </div>

          {/* Description */}
          <p className="text-gray-500 text-sm md:text-base max-w-md mx-auto mb-8">
            Advanced coding assistant powered by GPT-5.1
          </p>

          {/* Features */}
          <div className="flex flex-wrap justify-center gap-3 text-xs text-gray-600">
            <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10">
              Complex debugging
            </span>
            <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10">
              Code review
            </span>
            <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10">
              Architecture design
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Message thread - professional design
  return (
    <div className="flex-1 overflow-y-auto p-4 bg-black">
      <div className="max-w-4xl mx-auto space-y-6">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`${
              message.role === 'user'
                ? 'flex justify-end'
                : ''
            }`}
          >
            <div
              className={`${
                message.role === 'user'
                  ? 'bg-blue-600 text-white rounded-2xl rounded-br-md px-4 py-3 max-w-[85%]'
                  : 'text-gray-100 max-w-full'
              }`}
            >
              {message.role === 'user' ? (
                <p className="whitespace-pre-wrap">{message.content}</p>
              ) : (
                <MessageContent content={message.content} />
              )}
            </div>
          </div>
        ))}

        {/* Streaming indicator */}
        {isStreaming && (
          <div className="flex items-center gap-2 text-gray-400">
            <div className="flex gap-1">
              <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}

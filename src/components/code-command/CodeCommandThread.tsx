/**
 * CODE COMMAND THREAD
 *
 * Terminal-style message display for Code Command
 * Features:
 * - Green-on-black terminal aesthetic
 * - Code blocks with syntax highlighting
 * - Diff highlighting
 * - Typewriter welcome animation
 */

'use client';

import { useEffect, useRef, useState } from 'react';
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
 * Typewriter hook for welcome animation
 */
function useTypewriter(text: string, speed: number = 30, delay: number = 0, enabled: boolean = true) {
  const [displayedText, setDisplayedText] = useState('');
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    if (!enabled || !text) {
      setDisplayedText('');
      setIsComplete(false);
      return;
    }

    setDisplayedText('');
    setIsComplete(false);

    const startTimeout = setTimeout(() => {
      let currentIndex = 0;
      const interval = setInterval(() => {
        if (currentIndex < text.length) {
          setDisplayedText(text.slice(0, currentIndex + 1));
          currentIndex++;
        } else {
          setIsComplete(true);
          clearInterval(interval);
        }
      }, speed);

      return () => clearInterval(interval);
    }, delay);

    return () => clearTimeout(startTimeout);
  }, [text, speed, delay, enabled]);

  return { displayedText, isComplete };
}

/**
 * Render message content with code block support
 */
function MessageContent({ content, isUser }: { content: string; isUser: boolean }) {
  const parts = parseCodeBlocks(content);

  if (parts.length === 0) {
    return <p className="whitespace-pre-wrap">{content}</p>;
  }

  return (
    <div className="space-y-3">
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
          <p key={index} className="whitespace-pre-wrap">
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

  // Typewriter animations for welcome screen
  const { displayedText: titleText, isComplete: titleDone } = useTypewriter(
    'JCIL.ai',
    40,
    200,
    showWelcome
  );

  const { displayedText: subtitleText, isComplete: subtitleDone } = useTypewriter(
    'Code Command',
    30,
    0,
    showWelcome && titleDone
  );

  const { displayedText: descText } = useTypewriter(
    'For complex coding tasks, debugging, and software engineering',
    20,
    100,
    showWelcome && subtitleDone
  );

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Welcome screen
  if (showWelcome) {
    return (
      <div className="flex flex-1 items-center justify-center p-4 bg-[#0a0a0a]">
        <div className="text-center font-mono">
          {/* Terminal-style header */}
          <div className="mb-6">
            <div className="text-4xl md:text-6xl font-bold mb-2">
              <span className="text-green-400">{titleText}</span>
              {!titleDone && titleText && (
                <span className="animate-pulse text-green-500">_</span>
              )}
            </div>
            <div className="text-2xl md:text-4xl text-green-500 font-bold min-h-[2.5rem]">
              {subtitleText}
              {titleDone && !subtitleDone && subtitleText && (
                <span className="animate-pulse">_</span>
              )}
            </div>
          </div>

          {/* Description */}
          <p className="text-green-600 text-sm md:text-base min-h-[1.5rem] max-w-md mx-auto">
            {descText}
            {subtitleDone && descText && descText !== 'For complex coding tasks, debugging, and software engineering' && (
              <span className="animate-pulse text-green-500">_</span>
            )}
          </p>

          {/* Terminal decoration */}
          <div className="mt-8 text-green-800 text-xs">
            <span className="text-green-600">$</span> GPT-5.1 initialized
          </div>
          <div className="text-green-800 text-xs">
            <span className="text-green-600">$</span> Ready for input...
          </div>
        </div>
      </div>
    );
  }

  // Message thread
  return (
    <div className="flex-1 overflow-y-auto p-4 bg-[#0a0a0a] font-mono">
      <div className="max-w-4xl mx-auto space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`${
              message.role === 'user'
                ? 'border-l-2 border-cyan-500 pl-4'
                : 'border-l-2 border-green-500 pl-4'
            }`}
          >
            {/* Role indicator */}
            <div className={`text-xs mb-1 ${
              message.role === 'user' ? 'text-cyan-500' : 'text-green-500'
            }`}>
              {message.role === 'user' ? '> USER' : '> CODE_COMMAND'}
            </div>

            {/* Message content */}
            <div className={`text-sm ${
              message.role === 'user' ? 'text-cyan-100' : 'text-green-100'
            }`}>
              <MessageContent content={message.content} isUser={message.role === 'user'} />
            </div>
          </div>
        ))}

        {/* Streaming indicator */}
        {isStreaming && (
          <div className="border-l-2 border-green-500 pl-4">
            <div className="text-xs text-green-500 mb-1">> CODE_COMMAND</div>
            <div className="flex items-center gap-2 text-green-400">
              <span className="animate-pulse">Processing</span>
              <span className="animate-bounce">.</span>
              <span className="animate-bounce" style={{ animationDelay: '0.1s' }}>.</span>
              <span className="animate-bounce" style={{ animationDelay: '0.2s' }}>.</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}

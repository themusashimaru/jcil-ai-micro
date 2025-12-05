/**
 * CODE COMMAND THREAD
 *
 * Same layout as regular ChatThread, but with advanced code blocks
 * Only difference: code blocks have line numbers and syntax highlighting
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
 * Typewriter hook - same as ChatThread
 */
function useTypewriter(text: string, speed: number = 40, delay: number = 0, enabled: boolean = true) {
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
 * Render message content - text normally, code blocks with advanced features
 */
function MessageContent({ content }: { content: string }) {
  const parts = parseCodeBlocks(content);

  if (parts.length === 0) {
    return <p className="whitespace-pre-wrap text-sm md:text-base">{content}</p>;
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
          <p key={index} className="whitespace-pre-wrap text-sm md:text-base">
            {part.content}
          </p>
        );
      })}
    </div>
  );
}

export function CodeCommandThread({ messages, isStreaming }: CodeCommandThreadProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const showWelcome = messages.length === 0;

  // Typewriter for welcome - same style as regular chat
  const modelText = 'Code Command';
  const subtitleText = 'Advanced coding assistant powered by GPT-5.1';
  const promptText = 'Ask about code, debugging, architecture...';

  const { displayedText: modelDisplayed, isComplete: modelDone } = useTypewriter(
    modelText, 25, 200, showWelcome
  );
  const { displayedText: subtitleDisplayed, isComplete: subtitleDone } = useTypewriter(
    subtitleText, 20, 0, showWelcome && modelDone
  );
  const { displayedText: promptDisplayed } = useTypewriter(
    promptText, 15, 100, showWelcome && subtitleDone
  );

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Welcome screen - matching regular chat style
  if (showWelcome) {
    return (
      <div className="flex flex-1 items-center justify-center p-1">
        <div className="text-center">
          {/* Logo - same as regular chat */}
          <div className="mb-1">
            <h1 className="text-6xl md:text-8xl font-bold mb-2">
              <span className="text-white">JCIL</span>
              <span className="text-blue-500">.ai</span>
            </h1>
            <p className="text-sm md:text-xl text-white font-medium mb-1 min-h-[1.5em]">
              {modelDisplayed}
              {!modelDone && modelDisplayed && (
                <span className="animate-pulse text-[#4DFFFF]">|</span>
              )}
            </p>
            <p className="text-xs md:text-sm text-white italic min-h-[1.25em]">
              {subtitleDisplayed}
              {!subtitleDone && subtitleDisplayed && (
                <span className="animate-pulse text-[#4DFFFF]">|</span>
              )}
            </p>
          </div>

          <p className="mb-2 text-xs md:text-sm text-white min-h-[1.25em]">
            {promptDisplayed}
            {subtitleDone && promptDisplayed && promptDisplayed !== promptText && (
              <span className="animate-pulse text-[#4DFFFF]">|</span>
            )}
          </p>
        </div>
      </div>
    );
  }

  // Message thread - same layout as regular chat
  return (
    <div
      ref={scrollContainerRef}
      className="flex-1 overflow-y-auto overflow-x-hidden py-0 px-0 md:p-2"
    >
      <div className="mx-auto max-w-[95%] sm:max-w-lg md:max-w-xl space-y-0 md:space-y-3">
        {messages.map((message) => {
          const isUser = message.role === 'user';

          return (
            <div key={message.id} className={`flex items-start gap-0 mb-1 ${isUser ? 'justify-end' : ''}`}>
              {/* Avatar - same as regular chat */}
              <div className={`mt-0 flex h-3 w-3 flex-shrink-0 items-center justify-center rounded-full ${
                isUser ? 'bg-white/5 text-gray-400' : 'bg-cyan-500/10 text-cyan-400'
              }`}>
                <svg className="h-2 w-2" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" />
                </svg>
              </div>

              {/* Message Content */}
              <div className="space-y-0 overflow-x-hidden flex-1 max-w-full">
                <div className={`text-white ${isUser ? 'text-right' : ''}`}>
                  <MessageContent content={message.content} />
                </div>
              </div>
            </div>
          );
        })}

        {/* Streaming indicator - same as regular chat TypingIndicator */}
        {isStreaming && (
          <div className="flex items-start gap-0 mb-1">
            <div className="mt-0 flex h-3 w-3 flex-shrink-0 items-center justify-center rounded-full bg-cyan-500/10 text-cyan-400">
              <svg className="h-2 w-2" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" />
              </svg>
            </div>
            <div className="flex items-center gap-1 ml-2">
              <div className="w-2 h-2 bg-cyan-400/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 bg-cyan-400/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 bg-cyan-400/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}

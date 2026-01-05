'use client';

/**
 * CODE LAB THREAD
 *
 * The main conversation display area.
 * - AI responses flow naturally (no bubbles)
 * - User messages in subtle containers
 * - Code blocks with syntax highlighting
 * - Terminal-style output for code generation
 */

import { useRef, useEffect } from 'react';
import { CodeLabMessage } from './CodeLabMessage';
import type { CodeLabMessage as Message, CodeLabSession } from './types';

interface CodeLabThreadProps {
  messages: Message[];
  isLoading: boolean;
  isStreaming: boolean;
  sessionTitle: string;
  repo?: CodeLabSession['repo'];
}

export function CodeLabThread({
  messages,
  isLoading,
  isStreaming,
  sessionTitle,
  repo,
}: CodeLabThreadProps) {
  const threadRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  return (
    <div className="code-lab-thread" ref={threadRef}>
      {/* Header */}
      <header className="thread-header">
        <div className="thread-title">
          <h1>{sessionTitle}</h1>
          {repo && (
            <span className="thread-repo">
              <svg viewBox="0 0 16 16" fill="currentColor">
                <path d="M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 0 1 0-1.5h1.75v-2h-8a1 1 0 0 0-.714 1.7.75.75 0 1 1-1.072 1.05A2.495 2.495 0 0 1 2 11.5Zm10.5-1h-8a1 1 0 0 0-1 1v6.708A2.486 2.486 0 0 1 4.5 9h8ZM5 12.25a.25.25 0 0 1 .25-.25h3.5a.25.25 0 0 1 .25.25v3.25a.25.25 0 0 1-.4.2l-1.45-1.087a.249.249 0 0 0-.3 0L5.4 15.7a.25.25 0 0 1-.4-.2Z" />
              </svg>
              {repo.fullName}
            </span>
          )}
        </div>
      </header>

      {/* Messages */}
      <div className="thread-messages">
        {isLoading ? (
          <div className="thread-loading">
            <div className="loading-spinner" />
            <span>Loading conversation...</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="thread-welcome">
            <div className="welcome-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
              </svg>
            </div>
            <h2>What would you like to build?</h2>
            <p>
              I can help you write code, search documentation, debug issues,
              or just discuss your project.
            </p>
            <div className="welcome-suggestions">
              <button>Build a REST API</button>
              <button>Review my code</button>
              <button>Help me debug</button>
              <button>Search docs</button>
            </div>
          </div>
        ) : (
          messages.map((message, index) => (
            <CodeLabMessage
              key={message.id}
              message={message}
              isLast={index === messages.length - 1}
            />
          ))
        )}

        {/* Streaming indicator */}
        {isStreaming && (
          <div className="stream-indicator">
            <span className="stream-dot" />
            <span className="stream-dot" />
            <span className="stream-dot" />
          </div>
        )}

        {/* Scroll anchor */}
        <div ref={bottomRef} />
      </div>

      <style jsx>{`
        .code-lab-thread {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .thread-header {
          padding: 1rem 1.5rem;
          border-bottom: 1px solid #e5e7eb;
          background: white;
        }

        .thread-title {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .thread-title h1 {
          font-size: 1.125rem;
          font-weight: 600;
          color: #1a1f36;
          margin: 0;
        }

        .thread-repo {
          display: inline-flex;
          align-items: center;
          gap: 0.375rem;
          padding: 0.25rem 0.625rem;
          background: #f3f4f6;
          border-radius: 9999px;
          font-size: 0.75rem;
          color: #6b7280;
        }

        .thread-repo svg {
          width: 14px;
          height: 14px;
        }

        .thread-messages {
          flex: 1;
          overflow-y: auto;
          padding: 1.5rem;
        }

        .thread-loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 3rem;
          color: #9ca3af;
          gap: 1rem;
        }

        .loading-spinner {
          width: 24px;
          height: 24px;
          border: 2px solid #e5e7eb;
          border-top-color: #6366f1;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .thread-welcome {
          max-width: 600px;
          margin: 3rem auto;
          text-align: center;
        }

        .welcome-icon {
          width: 64px;
          height: 64px;
          margin: 0 auto 1.5rem;
          color: #6366f1;
        }

        .welcome-icon svg {
          width: 100%;
          height: 100%;
        }

        .thread-welcome h2 {
          font-size: 1.5rem;
          font-weight: 600;
          color: #1a1f36;
          margin: 0 0 0.75rem;
        }

        .thread-welcome p {
          color: #6b7280;
          margin: 0 0 2rem;
          line-height: 1.6;
        }

        .welcome-suggestions {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 0.5rem;
        }

        .welcome-suggestions button {
          padding: 0.5rem 1rem;
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 9999px;
          font-size: 0.875rem;
          color: #374151;
          cursor: pointer;
          transition: all 0.2s;
        }

        .welcome-suggestions button:hover {
          background: #f9fafb;
          border-color: #6366f1;
          color: #6366f1;
        }

        .stream-indicator {
          display: flex;
          align-items: center;
          gap: 0.25rem;
          padding: 1rem 0;
        }

        .stream-dot {
          width: 6px;
          height: 6px;
          background: #6366f1;
          border-radius: 50%;
          animation: pulse 1.4s ease-in-out infinite;
        }

        .stream-dot:nth-child(2) {
          animation-delay: 0.2s;
        }

        .stream-dot:nth-child(3) {
          animation-delay: 0.4s;
        }

        @keyframes pulse {
          0%, 80%, 100% {
            opacity: 0.3;
            transform: scale(0.8);
          }
          40% {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </div>
  );
}

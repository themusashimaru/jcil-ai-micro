'use client';

/**
 * CODE LAB MESSAGE
 *
 * Renders individual messages in the thread:
 * - AI responses: Flow naturally, no bubble - like reading documentation
 * - User messages: Subtle container to distinguish input
 * - Code blocks: Syntax highlighted with copy button
 * - Terminal output: Professional monospace styling
 * - Agent type indicators: Show which mode is active
 *
 * SECURITY: Uses sanitizeHtml to prevent XSS attacks
 */

import { useState, useMemo } from 'react';
import type { CodeLabMessage as MessageType } from './types';
import { COPY_FEEDBACK_DURATION_MS } from './types';
import { CodeLabThinkingBlock, parseThinkingBlocks } from './CodeLabThinkingBlock';
import { parseMarkdown } from './CodeLabMessageMarkdown';
import { CodeBlock, TerminalBlock, TextBlock } from './CodeLabMessageBlocks';

interface CodeLabMessageProps {
  message: MessageType;
  isLast: boolean;
}

// Agent type configuration
interface AgentType {
  name: string;
  icon: string;
  color: string;
  bgColor: string;
}

const AGENT_TYPES: Record<string, AgentType> = {
  workspace: {
    name: 'Workspace Agent',
    icon: '>',
    color: 'var(--cl-agent-workspace)',
    bgColor: 'var(--cl-agent-workspace-bg)',
  },
  standard: {
    name: 'AI Assistant',
    icon: '',
    color: 'var(--cl-agent-standard)',
    bgColor: 'var(--cl-agent-standard-bg)',
  },
  code: {
    name: 'Code Generator',
    icon: '',
    color: 'var(--cl-agent-code)',
    bgColor: 'var(--cl-agent-code-bg)',
  },
};

// Model display names for showing which model generated the response
const MODEL_DISPLAY_NAMES: Record<string, string> = {
  // Claude models
  'claude-sonnet-4-6': 'Sonnet 4.6',
  'claude-opus-4-6': 'Opus 4.6',
  'claude-sonnet-4-6-thinking': 'Sonnet 4.6 (Thinking)',
  'claude-opus-4-6-thinking': 'Opus 4.6 (Thinking)',
  // OpenAI models
  'gpt-5.2': 'GPT-5.2',
  // xAI Grok models
  'grok-4-1-fast-reasoning': 'Grok 4.1 Fast (R)',
  'grok-code-fast-1': 'Grok Code Fast',
  // DeepSeek models
  'deepseek-reasoner': 'DeepSeek Reasoner',
  // Google Gemini models
  'gemini-3-pro-preview': 'Gemini 3 Pro',
  'gemini-3-flash-preview': 'Gemini 3 Flash',
};

export function CodeLabMessage({ message, isLast: _isLast }: CodeLabMessageProps) {
  const [copiedBlock, setCopiedBlock] = useState<number | null>(null);

  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  // Detect agent type from message metadata or content patterns
  const agentType = useMemo(() => {
    if (isUser || isSystem) return null;
    // Check for workspace agent patterns in content
    if (
      message.content?.includes('`> ') ||
      message.content?.includes('`Running ') ||
      message.content?.includes('execute_shell') ||
      message.content?.includes('/workspace')
    ) {
      return AGENT_TYPES.workspace;
    }
    // Get model name from modelId if available
    const modelName = message.modelId ? MODEL_DISPLAY_NAMES[message.modelId] : null;
    return {
      ...AGENT_TYPES.standard,
      name: modelName || AGENT_TYPES.standard.name,
    };
  }, [message.content, message.modelId, isUser, isSystem]);

  // Extract thinking blocks from content (Claude Code parity)
  const { thinking, output, isThinkingComplete } = useMemo(() => {
    if (isUser || isSystem) {
      return { thinking: null, output: message.content, isThinkingComplete: true };
    }
    return parseThinkingBlocks(message.content);
  }, [message.content, isUser, isSystem]);

  // Parse the output content for code blocks (after thinking extraction)
  const parsedContent = useMemo(() => {
    return parseMarkdown(output);
  }, [output]);

  const handleCopyCode = async (code: string, blockIndex: number) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedBlock(blockIndex);
      setTimeout(() => setCopiedBlock(null), COPY_FEEDBACK_DURATION_MS);
    } catch (err) {
      // Client-side only - browser console for user debugging
      console.error('Failed to copy:', err);
    }
  };

  if (isSystem) {
    return (
      <div className="message message-system">
        <div className="system-content">{message.content}</div>
        <style jsx>{`
          .message-system {
            padding: 0.75rem 1rem;
            background: #fef3c7;
            border-left: 3px solid #f59e0b;
            border-radius: 0 8px 8px 0;
            margin: 1rem 0;
          }
          .system-content {
            font-size: 0.875rem;
            color: #92400e;
          }
        `}</style>
      </div>
    );
  }

  if (isUser) {
    return (
      <div className="message message-user">
        <div className="user-avatar">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
          </svg>
        </div>
        <div className="user-content">{message.content}</div>
        <style jsx>{`
          .message-user {
            display: flex;
            gap: 0.75rem;
            padding: 1rem;
            background: #000000;
            border: 1px solid #333;
            border-radius: 12px;
            margin: 1.5rem 0;
          }
          .user-avatar {
            width: 32px;
            height: 32px;
            background: #333;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
          }
          .user-avatar svg {
            width: 18px;
            height: 18px;
            color: white;
          }
          .user-content {
            flex: 1;
            font-size: 0.9375rem;
            line-height: 1.6;
            color: #ffffff;
            white-space: pre-wrap;
          }
        `}</style>
      </div>
    );
  }

  // Assistant message - flows naturally
  return (
    <div className={`message message-assistant ${message.isStreaming ? 'streaming' : ''}`}>
      {/* Agent Type Indicator */}
      {agentType && (
        <div
          className="agent-indicator"
          style={{ color: agentType.color, background: agentType.bgColor }}
        >
          <span className="agent-icon">{agentType.icon}</span>
          <span className="agent-name">{agentType.name}</span>
        </div>
      )}

      {/* Claude's Extended Thinking (Claude Code parity) */}
      {thinking && (
        <CodeLabThinkingBlock
          content={thinking}
          isStreaming={!isThinkingComplete && message.isStreaming}
          defaultExpanded={false}
        />
      )}

      {parsedContent.map((block, index) => {
        // Generate stable key from block type and content prefix
        const blockKey = `${block.type}-${index}-${block.content.slice(0, 20).replace(/\s/g, '')}`;
        if (block.type === 'code') {
          return (
            <CodeBlock
              key={blockKey}
              block={block}
              blockIndex={index}
              copiedBlock={copiedBlock}
              onCopyCode={handleCopyCode}
            />
          );
        }

        if (block.type === 'terminal') {
          return <TerminalBlock key={blockKey} block={block} />;
        }

        return <TextBlock key={blockKey} block={block} />;
      })}

      {message.isStreaming && <span className="cursor" />}

      <style jsx>{`
        .message-assistant {
          padding: 0.5rem 0;
          line-height: 1.7;
          color: #ffffff;
        }

        .message-assistant.streaming {
          opacity: 1;
        }

        .cursor {
          display: inline-block;
          width: 8px;
          height: 18px;
          background: #ffffff;
          margin-left: 2px;
          animation: blink 1s infinite;
        }

        @keyframes blink {
          0%,
          50% {
            opacity: 1;
          }
          51%,
          100% {
            opacity: 0;
          }
        }

        /* Agent Type Indicator */
        .agent-indicator {
          display: inline-flex;
          align-items: center;
          gap: 0.375rem;
          padding: 0.25rem 0.625rem;
          border-radius: 12px;
          font-size: 0.6875rem;
          font-weight: 500;
          margin-bottom: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.025em;
          background: #1a1a1a !important;
          color: #ffffff !important;
        }

        .agent-icon {
          font-family: 'SF Mono', 'Menlo', monospace;
          font-weight: 700;
        }

        .agent-name {
          opacity: 0.9;
        }
      `}</style>
    </div>
  );
}

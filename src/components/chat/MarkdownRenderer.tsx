/**
 * MARKDOWN RENDERER COMPONENT
 *
 * PURPOSE:
 * - Render markdown content with proper formatting
 * - Styled for dark glassmorphism theme
 * - Handles headers, bold, italic, lists, code, links
 *
 * USAGE:
 * - <MarkdownRenderer content={message.content} />
 */

'use client';

import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';

interface MarkdownRendererProps {
  content: string;
}

// Custom components for dark theme styling
const components: Components = {
  // Headers
  h1: ({ children }) => (
    <h1 className="text-xl font-bold text-white mt-4 mb-2 first:mt-0">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-lg font-bold text-white mt-3 mb-2 first:mt-0">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-base font-semibold text-white mt-3 mb-1 first:mt-0">{children}</h3>
  ),
  h4: ({ children }) => (
    <h4 className="text-sm font-semibold text-white mt-2 mb-1 first:mt-0">{children}</h4>
  ),

  // Paragraphs
  p: ({ children }) => (
    <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>
  ),

  // Bold and italic
  strong: ({ children }) => (
    <strong className="font-semibold text-white">{children}</strong>
  ),
  em: ({ children }) => (
    <em className="italic text-gray-200">{children}</em>
  ),

  // Lists
  ul: ({ children }) => (
    <ul className="list-disc list-inside mb-2 space-y-1 ml-2">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal list-inside mb-2 space-y-1 ml-2">{children}</ol>
  ),
  li: ({ children }) => (
    <li className="text-gray-200">{children}</li>
  ),

  // Links
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-blue-400 hover:text-blue-300 underline break-all"
    >
      {children}
    </a>
  ),

  // Code blocks
  code: ({ className, children }) => {
    const isInline = !className;
    if (isInline) {
      return (
        <code className="bg-white/10 text-pink-300 px-1.5 py-0.5 rounded text-sm font-mono">
          {children}
        </code>
      );
    }
    // Block code
    return (
      <code className="block bg-black/40 text-green-300 p-3 rounded-lg text-sm font-mono overflow-x-auto my-2">
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="bg-black/40 rounded-lg overflow-x-auto my-2">{children}</pre>
  ),

  // Blockquotes
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-blue-500/50 pl-4 py-1 my-2 italic text-gray-300 bg-white/5 rounded-r">
      {children}
    </blockquote>
  ),

  // Horizontal rule
  hr: () => (
    <hr className="border-white/20 my-4" />
  ),

  // Tables (for Breaking News categories, etc.)
  table: ({ children }) => (
    <div className="overflow-x-auto my-2">
      <table className="min-w-full border-collapse">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-white/10">{children}</thead>
  ),
  tbody: ({ children }) => (
    <tbody className="divide-y divide-white/10">{children}</tbody>
  ),
  tr: ({ children }) => (
    <tr className="border-b border-white/10">{children}</tr>
  ),
  th: ({ children }) => (
    <th className="px-3 py-2 text-left text-sm font-semibold text-white">{children}</th>
  ),
  td: ({ children }) => (
    <td className="px-3 py-2 text-sm text-gray-300">{children}</td>
  ),
};

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <div className="markdown-content text-gray-200">
      <ReactMarkdown components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}

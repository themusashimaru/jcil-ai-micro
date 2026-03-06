import { sanitizeUrl, escapeHtml } from '@/lib/sanitize';

export interface ContentBlock {
  type: 'text' | 'code' | 'terminal';
  content: string;
  language?: string;
}

export function parseMarkdown(content: string): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;

  let lastIndex = 0;
  let match;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    // Add text before code block
    if (match.index > lastIndex) {
      const textContent = content.slice(lastIndex, match.index).trim();
      if (textContent) {
        blocks.push({
          type: 'text',
          content: formatText(textContent),
        });
      }
    }

    // Determine if it's a terminal block
    const language = match[1].toLowerCase();
    const isTerminal = ['bash', 'sh', 'shell', 'terminal', 'console'].includes(language);

    blocks.push({
      type: isTerminal ? 'terminal' : 'code',
      content: match[2].trim(),
      language: match[1] || undefined,
    });

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < content.length) {
    const textContent = content.slice(lastIndex).trim();
    if (textContent) {
      blocks.push({
        type: 'text',
        content: formatText(textContent),
      });
    }
  }

  return blocks.length > 0 ? blocks : [{ type: 'text', content: formatText(content) }];
}

function formatText(text: string): string {
  // SECURITY FIX: Convert markdown to HTML with URL sanitization
  return (
    text
      // Headers
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      // Bold
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      // Italic
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      // Inline code
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      // Links - SECURITY FIX: Sanitize URLs to prevent javascript: and data: protocols
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, linkText, url) => {
        const safeUrl = sanitizeUrl(url);
        return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${escapeHtml(linkText)}</a>`;
      })
      // Unordered lists
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
      // Ordered lists
      .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
      // Paragraphs
      .replace(/\n\n/g, '</p><p>')
      .replace(/^(.+)$/gm, (match) => {
        if (match.startsWith('<')) return match;
        return `<p>${match}</p>`;
      })
      // Clean up
      .replace(/<p><\/p>/g, '')
      .replace(/<p>(<[hul])/g, '$1')
      .replace(/(<\/[hul][^>]*>)<\/p>/g, '$1')
  );
}

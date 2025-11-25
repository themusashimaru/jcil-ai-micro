/**
 * LINKIFY UTILITY
 *
 * PURPOSE:
 * - Convert plain text URLs to clickable HTML links
 * - Support http://, https://, and www. prefixes
 * - Open links in new tab with security attributes
 *
 * USAGE:
 * - linkify(text) - Returns HTML string with clickable links
 * - linkifyToReact(text) - Returns React elements array
 */

/**
 * Detect and convert URLs in text to clickable HTML links
 */
export function linkify(text: string): string {
  // URL detection regex - matches http://, https://, and www.
  const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;

  return text.replace(urlRegex, (url) => {
    // Add https:// to www. links
    const href = url.startsWith('www.') ? `https://${url}` : url;

    return `<a href="${href}" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:text-blue-300 underline break-all">${url}</a>`;
  });
}

/**
 * Convert text with URLs to React elements
 * Use this for React components that can't use dangerouslySetInnerHTML
 */
export function linkifyToReact(text: string): (string | JSX.Element)[] {
  const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;
  const parts: (string | JSX.Element)[] = [];
  let lastIndex = 0;
  let match;

  while ((match = urlRegex.exec(text)) !== null) {
    // Add text before URL
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    // Add URL as link
    const url = match[0];
    const href = url.startsWith('www.') ? `https://${url}` : url;

    parts.push(
      <a
        key={match.index}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-400 hover:text-blue-300 underline break-all"
      >
        {url}
      </a>
    );

    lastIndex = match.index + url.length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
}

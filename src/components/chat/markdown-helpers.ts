import { extractGalleryImages } from './ScreenshotGallery';

/**
 * Convert plain URLs to markdown links
 * Only converts URLs that aren't already in markdown link format [text](url)
 */
export function autoLinkifyUrls(text: string): string {
  const urlRegex = /(?<!\]\()(?<!\()(https?:\/\/[^\s<>)\]"']+)/gi;

  return text.replace(urlRegex, (url) => {
    let displayText = url;
    try {
      const urlObj = new URL(url);
      displayText = urlObj.hostname.replace('www.', '');
    } catch {
      // Keep original URL if parsing fails
    }
    return `[${displayText}](${url})`;
  });
}

/**
 * Filter out internal checkpoint state markers from content
 * These are used for resume functionality and shouldn't be visible to users
 */
export function filterInternalMarkers(text: string): string {
  return text.replace(/\[c:[A-Za-z0-9+/=]+\]/g, '');
}

/**
 * When content has 2+ markdown images, extract them into a screenshot-gallery
 * code block so they render as a scrollable gallery instead of stacked.
 */
export function groupImagesIntoGallery(content: string): string {
  const images = extractGalleryImages(content);
  if (images.length < 2) return content;

  let result = content;
  const imgRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
  result = result.replace(imgRegex, '').trim();

  const galleryJson = JSON.stringify(images);
  result += `\n\n\`\`\`screenshot-gallery\n${galleryJson}\n\`\`\``;

  return result;
}

/** Get file extension from language identifier */
export function getExtensionForLanguage(lang: string): string {
  const map: Record<string, string> = {
    javascript: '.js',
    js: '.js',
    typescript: '.ts',
    ts: '.ts',
    jsx: '.jsx',
    tsx: '.tsx',
    python: '.py',
    py: '.py',
    html: '.html',
    css: '.css',
    json: '.json',
    bash: '.sh',
    sh: '.sh',
    sql: '.sql',
  };
  return map[lang.toLowerCase()] || '.txt';
}

/** Get display name for language identifier */
export function getDisplayLanguage(lang: string): string {
  const map: Record<string, string> = {
    js: 'JavaScript',
    javascript: 'JavaScript',
    ts: 'TypeScript',
    typescript: 'TypeScript',
    jsx: 'React JSX',
    tsx: 'React TSX',
    py: 'Python',
    python: 'Python',
    html: 'HTML',
    css: 'CSS',
    json: 'JSON',
    bash: 'Bash',
    sh: 'Shell',
    sql: 'SQL',
  };
  return map[lang.toLowerCase()] || lang.toUpperCase();
}

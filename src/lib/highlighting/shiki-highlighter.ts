/**
 * Shiki syntax highlighter singleton.
 * Lazy-loads grammars on demand for fast initial load.
 */

import { createHighlighter, type Highlighter } from 'shiki';

let highlighterPromise: Promise<Highlighter> | null = null;

const SUPPORTED_LANGS = [
  'javascript',
  'typescript',
  'jsx',
  'tsx',
  'python',
  'html',
  'css',
  'json',
  'markdown',
  'bash',
  'sql',
  'rust',
  'go',
  'java',
  'cpp',
  'c',
  'ruby',
  'php',
  'swift',
  'kotlin',
  'yaml',
  'toml',
  'dockerfile',
  'xml',
] as const;

function getHighlighter(): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: ['one-dark-pro'],
      langs: [...SUPPORTED_LANGS],
    });
  }
  return highlighterPromise;
}

// Map common language aliases
const LANG_ALIASES: Record<string, string> = {
  js: 'javascript',
  ts: 'typescript',
  py: 'python',
  rb: 'ruby',
  sh: 'bash',
  shell: 'bash',
  zsh: 'bash',
  yml: 'yaml',
  'c++': 'cpp',
  'c#': 'csharp',
  cs: 'csharp',
  md: 'markdown',
  plaintext: 'text',
  text: 'text',
  txt: 'text',
};

function resolveLanguage(lang: string): string {
  const lower = lang.toLowerCase().trim();
  return LANG_ALIASES[lower] || lower;
}

/**
 * Highlight code with Shiki. Returns HTML string.
 * Falls back to plain text if language is unsupported.
 */
export async function highlightCode(code: string, language: string): Promise<string> {
  const resolved = resolveLanguage(language);

  // Skip highlighting for unsupported or empty
  if (resolved === 'text' || !code.trim()) {
    return escapeHtml(code);
  }

  try {
    const highlighter = await getHighlighter();
    const html = highlighter.codeToHtml(code, {
      lang: resolved as (typeof SUPPORTED_LANGS)[number],
      theme: 'one-dark-pro',
    });
    return html;
  } catch {
    // Language not supported — return escaped plain text
    return `<pre class="shiki"><code>${escapeHtml(code)}</code></pre>`;
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

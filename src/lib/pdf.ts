/**
 * PDF Generation
 *
 * Convert Markdown/HTML to PDF
 * Uses Puppeteer for high-quality PDF generation
 */

// Note: This module requires puppeteer to be installed
// npm install puppeteer

/**
 * Convert Markdown to HTML with basic styling
 */
export function markdownToHtml(markdown: string): string {
  // Basic Markdown to HTML conversion
  // For production, consider using 'marked' or 'markdown-it' library
  let html = markdown
    // Headers
    .replace(/^### (.*)$/gm, '<h3>$1</h3>')
    .replace(/^## (.*)$/gm, '<h2>$1</h2>')
    .replace(/^# (.*)$/gm, '<h1>$1</h1>')
    // Bold
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    // Code blocks
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    // Unordered lists
    .replace(/^\- (.*)$/gm, '<li>$1</li>')
    // Paragraphs (double newlines)
    .replace(/\n\n/g, '</p><p>')
    // Single newlines in text
    .replace(/\n/g, '<br>');

  // Wrap list items
  html = html.replace(/(<li>.*<\/li>\s*)+/g, '<ul>$&</ul>');

  return `<p>${html}</p>`;
}

/**
 * Generate a full HTML document with styling
 */
export function generateHtmlDocument(content: string, title?: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title || 'Document'}</title>
  <style>
    * {
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 800px;
      margin: 0 auto;
      padding: 40px 20px;
    }
    h1 {
      font-size: 2em;
      margin-top: 0;
      margin-bottom: 0.5em;
      color: #111;
    }
    h2 {
      font-size: 1.5em;
      margin-top: 1.5em;
      margin-bottom: 0.5em;
      color: #222;
    }
    h3 {
      font-size: 1.25em;
      margin-top: 1.2em;
      margin-bottom: 0.5em;
      color: #333;
    }
    p {
      margin-bottom: 1em;
    }
    ul, ol {
      margin-bottom: 1em;
      padding-left: 2em;
    }
    li {
      margin-bottom: 0.5em;
    }
    pre {
      background: #f5f5f5;
      border-radius: 4px;
      padding: 1em;
      overflow-x: auto;
      font-size: 0.9em;
    }
    code {
      font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace;
      background: #f0f0f0;
      padding: 0.2em 0.4em;
      border-radius: 3px;
      font-size: 0.9em;
    }
    pre code {
      background: none;
      padding: 0;
    }
    a {
      color: #0066cc;
      text-decoration: none;
    }
    a:hover {
      text-decoration: underline;
    }
    blockquote {
      border-left: 4px solid #ddd;
      margin-left: 0;
      padding-left: 1em;
      color: #666;
    }
    table {
      border-collapse: collapse;
      width: 100%;
      margin-bottom: 1em;
    }
    th, td {
      border: 1px solid #ddd;
      padding: 8px;
      text-align: left;
    }
    th {
      background: #f5f5f5;
    }
    hr {
      border: none;
      border-top: 1px solid #ddd;
      margin: 2em 0;
    }
  </style>
</head>
<body>
  ${content}
</body>
</html>`;
}

/**
 * Convert Markdown to PDF using Puppeteer
 *
 * @param markdown - Markdown content
 * @param options - PDF options
 */
export async function markdownToPdf(
  markdown: string,
  options: {
    title?: string;
    format?: 'Letter' | 'A4' | 'Legal';
    printBackground?: boolean;
  } = {}
): Promise<Buffer> {
  const { title, format = 'Letter', printBackground = true } = options;

  // Convert markdown to HTML
  const htmlContent = markdownToHtml(markdown);
  const fullHtml = generateHtmlDocument(htmlContent, title);

  try {
    // Dynamic import to avoid issues if puppeteer isn't installed
    const puppeteer = await import('puppeteer');
    const browser = await puppeteer.default.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      headless: true,
    });

    const page = await browser.newPage();
    await page.setContent(fullHtml, { waitUntil: 'networkidle0' });

    const pdf = await page.pdf({
      format,
      printBackground,
      margin: {
        top: '0.75in',
        right: '0.75in',
        bottom: '0.75in',
        left: '0.75in',
      },
    });

    await browser.close();
    return Buffer.from(pdf);
  } catch {
    // Fallback: return HTML if Puppeteer not available
    console.error('[PDF] Puppeteer not available, returning HTML');
    throw new Error(
      'PDF generation requires Puppeteer. Install with: npm install puppeteer'
    );
  }
}

/**
 * Convert HTML to PDF
 */
export async function htmlToPdf(
  html: string,
  options: {
    format?: 'Letter' | 'A4' | 'Legal';
    printBackground?: boolean;
  } = {}
): Promise<Buffer> {
  const { format = 'Letter', printBackground = true } = options;

  try {
    const puppeteer = await import('puppeteer');
    const browser = await puppeteer.default.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      headless: true,
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdf = await page.pdf({
      format,
      printBackground,
      margin: {
        top: '0.75in',
        right: '0.75in',
        bottom: '0.75in',
        left: '0.75in',
      },
    });

    await browser.close();
    return Buffer.from(pdf);
  } catch {
    throw new Error(
      'PDF generation requires Puppeteer. Install with: npm install puppeteer'
    );
  }
}

/**
 * Validate PDF buffer
 */
export function isValidPdf(buffer: Buffer): boolean {
  // PDF files start with %PDF
  return buffer.slice(0, 4).toString() === '%PDF';
}

/**
 * Get PDF info (page count estimate)
 */
export function estimatePdfPages(buffer: Buffer): number {
  // Very rough estimate based on file size
  // ~100KB per page average for text documents
  return Math.max(1, Math.ceil(buffer.length / 100_000));
}

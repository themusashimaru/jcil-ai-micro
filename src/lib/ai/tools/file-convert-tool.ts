/**
 * FILE CONVERSION TOOL
 *
 * Converts files between formats without external system dependencies.
 *
 * Supported conversions:
 * - Markdown → HTML, PDF, DOCX, TXT
 * - HTML → TXT, Markdown
 * - DOCX → HTML, TXT
 * - JSON → CSV, YAML
 * - CSV → JSON
 * - YAML → JSON
 *
 * Created: 2026-01-31
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// Lazy-loaded libraries
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let MarkdownIt: any = null;
let mammoth: typeof import('mammoth') | null = null;
let yaml: typeof import('yaml') | null = null;

async function initMarkdownIt(): Promise<boolean> {
  if (MarkdownIt) return true;
  try {
    const mod = await import('markdown-it');
    MarkdownIt = mod.default || mod;
    return true;
  } catch {
    return false;
  }
}

async function initMammoth(): Promise<boolean> {
  if (mammoth) return true;
  try {
    mammoth = await import('mammoth');
    return true;
  } catch {
    return false;
  }
}

async function initYaml(): Promise<boolean> {
  if (yaml) return true;
  try {
    yaml = await import('yaml');
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const fileConvertTool: UnifiedTool = {
  name: 'convert_file',
  description: `Convert files between different formats.

Supported conversions:
- Markdown → HTML, TXT
- HTML → TXT, Markdown
- DOCX → HTML, TXT (extracts text content)
- JSON → CSV, YAML
- CSV → JSON
- YAML → JSON

Input: Provide file content as text or base64.
Output: Returns converted file as downloadable.

Note: For complex document conversions (e.g., preserving exact formatting), consider using the code execution tool with Pandoc.`,
  parameters: {
    type: 'object',
    properties: {
      content: {
        type: 'string',
        description: 'The file content as text (for text formats) or base64 (for binary formats)',
      },
      content_url: {
        type: 'string',
        description: 'URL to fetch the file content from',
      },
      from_format: {
        type: 'string',
        enum: ['markdown', 'html', 'docx', 'json', 'csv', 'yaml', 'txt'],
        description: 'Source format',
      },
      to_format: {
        type: 'string',
        enum: ['markdown', 'html', 'txt', 'json', 'csv', 'yaml'],
        description: 'Target format',
      },
      filename: {
        type: 'string',
        description: 'Optional output filename (without extension)',
      },
    },
    required: ['from_format', 'to_format'],
  },
};

// ============================================================================
// AVAILABILITY CHECK
// ============================================================================

export function isFileConvertAvailable(): boolean {
  // Always available for basic conversions
  return true;
}

// ============================================================================
// CONVERSION FUNCTIONS
// ============================================================================

async function markdownToHtml(markdown: string): Promise<string> {
  await initMarkdownIt();
  if (!MarkdownIt) {
    throw new Error('Markdown library not available');
  }
  const md = new MarkdownIt({ html: true, linkify: true, typographer: true });
  return md.render(markdown);
}

function htmlToText(html: string): string {
  // Simple HTML to text conversion
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<li>/gi, '• ')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function htmlToMarkdown(html: string): string {
  // Simple HTML to Markdown conversion
  let md = html;

  // Headers
  md = md.replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n');
  md = md.replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n');
  md = md.replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n');
  md = md.replace(/<h4[^>]*>(.*?)<\/h4>/gi, '#### $1\n\n');
  md = md.replace(/<h5[^>]*>(.*?)<\/h5>/gi, '##### $1\n\n');
  md = md.replace(/<h6[^>]*>(.*?)<\/h6>/gi, '###### $1\n\n');

  // Bold and italic
  md = md.replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**');
  md = md.replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**');
  md = md.replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*');
  md = md.replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*');

  // Links
  md = md.replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)');

  // Images
  md = md.replace(/<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*\/?>/gi, '![$2]($1)');
  md = md.replace(/<img[^>]*src="([^"]*)"[^>]*\/?>/gi, '![]($1)');

  // Lists
  md = md.replace(/<ul[^>]*>/gi, '\n');
  md = md.replace(/<\/ul>/gi, '\n');
  md = md.replace(/<ol[^>]*>/gi, '\n');
  md = md.replace(/<\/ol>/gi, '\n');
  md = md.replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n');

  // Paragraphs and breaks
  md = md.replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n');
  md = md.replace(/<br\s*\/?>/gi, '\n');

  // Code
  md = md.replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`');
  md = md.replace(/<pre[^>]*>(.*?)<\/pre>/gis, '```\n$1\n```\n');

  // Blockquotes
  md = md.replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gis, (_, content) => {
    return (
      content
        .split('\n')
        .map((line: string) => '> ' + line)
        .join('\n') + '\n'
    );
  });

  // Horizontal rules
  md = md.replace(/<hr\s*\/?>/gi, '\n---\n');

  // Remove remaining tags
  md = md.replace(/<[^>]+>/g, '');

  // Decode entities
  md = md
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  // Clean up whitespace
  md = md.replace(/\n{3,}/g, '\n\n').trim();

  return md;
}

async function docxToHtml(base64: string): Promise<string> {
  await initMammoth();
  if (!mammoth) {
    throw new Error('DOCX conversion library not available');
  }

  const buffer = Buffer.from(base64, 'base64');
  const result = await mammoth.convertToHtml({ buffer });
  return result.value;
}

function jsonToCsv(json: string): string {
  const data = JSON.parse(json);

  if (!Array.isArray(data)) {
    throw new Error('JSON must be an array of objects for CSV conversion');
  }

  if (data.length === 0) {
    return '';
  }

  // Get headers from first object
  const headers = Object.keys(data[0]);

  // Escape CSV value
  const escapeValue = (val: unknown): string => {
    if (val === null || val === undefined) return '';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  };

  // Build CSV
  const rows = [headers.map(escapeValue).join(',')];
  for (const row of data) {
    const values = headers.map((h) => escapeValue(row[h]));
    rows.push(values.join(','));
  }

  return rows.join('\n');
}

function csvToJson(csv: string): string {
  const lines = csv.split('\n').filter((line) => line.trim());
  if (lines.length === 0) return '[]';

  // Parse CSV line respecting quotes
  const parseLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current);
    return result;
  };

  const headers = parseLine(lines[0]);
  const data = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseLine(lines[i]);
    const obj: Record<string, string> = {};
    headers.forEach((header, idx) => {
      obj[header.trim()] = values[idx]?.trim() || '';
    });
    data.push(obj);
  }

  return JSON.stringify(data, null, 2);
}

async function jsonToYaml(json: string): Promise<string> {
  await initYaml();
  if (!yaml) {
    throw new Error('YAML library not available');
  }
  const data = JSON.parse(json);
  return yaml.stringify(data);
}

async function yamlToJson(yamlStr: string): Promise<string> {
  await initYaml();
  if (!yaml) {
    throw new Error('YAML library not available');
  }
  const data = yaml.parse(yamlStr);
  return JSON.stringify(data, null, 2);
}

// ============================================================================
// TOOL EXECUTOR
// ============================================================================

export async function executeFileConvert(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const args = toolCall.arguments as {
    content?: string;
    content_url?: string;
    from_format: string;
    to_format: string;
    filename?: string;
  };

  // Validate required parameters
  if (!args.content && !args.content_url) {
    return {
      toolCallId: toolCall.id,
      content: 'Error: Either content or content_url must be provided',
      isError: true,
    };
  }

  if (!args.from_format || !args.to_format) {
    return {
      toolCallId: toolCall.id,
      content: 'Error: Both from_format and to_format are required',
      isError: true,
    };
  }

  try {
    // Get content
    let content = args.content || '';
    if (args.content_url) {
      const response = await fetch(args.content_url);
      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.status}`);
      }
      content = await response.text();
    }

    // Validate conversion path
    const conversionKey = `${args.from_format}→${args.to_format}`;
    let result: string;
    let mimeType: string;
    let extension: string;

    switch (conversionKey) {
      // Markdown conversions
      case 'markdown→html':
        result = await markdownToHtml(content);
        mimeType = 'text/html';
        extension = 'html';
        break;
      case 'markdown→txt':
        result = htmlToText(await markdownToHtml(content));
        mimeType = 'text/plain';
        extension = 'txt';
        break;

      // HTML conversions
      case 'html→txt':
        result = htmlToText(content);
        mimeType = 'text/plain';
        extension = 'txt';
        break;
      case 'html→markdown':
        result = htmlToMarkdown(content);
        mimeType = 'text/markdown';
        extension = 'md';
        break;

      // DOCX conversions
      case 'docx→html':
        result = await docxToHtml(content);
        mimeType = 'text/html';
        extension = 'html';
        break;
      case 'docx→txt':
        result = htmlToText(await docxToHtml(content));
        mimeType = 'text/plain';
        extension = 'txt';
        break;

      // JSON conversions
      case 'json→csv':
        result = jsonToCsv(content);
        mimeType = 'text/csv';
        extension = 'csv';
        break;
      case 'json→yaml':
        result = await jsonToYaml(content);
        mimeType = 'text/yaml';
        extension = 'yaml';
        break;

      // CSV conversions
      case 'csv→json':
        result = csvToJson(content);
        mimeType = 'application/json';
        extension = 'json';
        break;

      // YAML conversions
      case 'yaml→json':
        result = await yamlToJson(content);
        mimeType = 'application/json';
        extension = 'json';
        break;

      // TXT pass-through
      case 'txt→txt':
        result = content;
        mimeType = 'text/plain';
        extension = 'txt';
        break;

      default:
        return {
          toolCallId: toolCall.id,
          content: `Error: Conversion from ${args.from_format} to ${args.to_format} is not supported. Supported conversions: markdown→html/txt, html→txt/markdown, docx→html/txt, json→csv/yaml, csv→json, yaml→json`,
          isError: true,
        };
    }

    const timestamp = Date.now();
    const baseFilename = args.filename || `converted_${timestamp}`;
    const filename = `${baseFilename}.${extension}`;

    return {
      toolCallId: toolCall.id,
      content: JSON.stringify({
        success: true,
        message: `Converted ${args.from_format} to ${args.to_format}`,
        filename,
        format: args.to_format,
        mimeType,
        size: `${(result.length / 1024).toFixed(1)} KB`,
        preview: result.length > 500 ? result.substring(0, 500) + '...' : result,
        // Base64 data for the file
        fileData: Buffer.from(result).toString('base64'),
        // For text files, include the full content
        ...(mimeType.startsWith('text/') || mimeType === 'application/json'
          ? { fullContent: result }
          : {}),
      }),
    };
  } catch (error) {
    return {
      toolCallId: toolCall.id,
      content: `Error converting file: ${(error as Error).message}`,
      isError: true,
    };
  }
}

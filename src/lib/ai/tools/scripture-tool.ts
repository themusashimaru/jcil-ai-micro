/**
 * SCRIPTURE REFERENCE & BIBLE STUDY TOOL
 *
 * Creates structured Bible study reference sheets with cross-references,
 * original language word studies, historical context, and application points.
 *
 * The AI (Opus) generates all scholarly content and passes it as structured
 * arguments; this tool formats it into a beautiful study reference.
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const scriptureTool: UnifiedTool = {
  name: 'scripture_reference',
  description: `Create structured Bible study reference sheets with cross-references, original language word studies, historical context, and application points.

Use this when:
- User asks about a Bible verse or passage
- User wants cross-references for a scripture
- User asks about Greek/Hebrew word meanings
- User wants to study a biblical topic in depth
- User needs historical or cultural context for a passage

Returns a comprehensive scripture study reference with cross-references, word studies, context, and application — formatted for study or teaching.`,
  parameters: {
    type: 'object',
    properties: {
      reference: {
        type: 'string',
        description: 'Specific verse reference (e.g., "John 3:16", "Romans 8:28-30")',
      },
      topic: {
        type: 'string',
        description: 'Topic to find scripture about (e.g., "forgiveness", "faith", "anxiety")',
      },
      text: {
        type: 'string',
        description: 'The primary verse/passage text',
      },
      cross_references: {
        type: 'array',
        description: 'Related scripture cross-references',
        items: {
          type: 'object',
          properties: {
            reference: { type: 'string' },
            text: { type: 'string' },
            connection: { type: 'string', description: 'How this relates to the primary passage' },
          },
        },
      },
      original_language: {
        type: 'object',
        description: 'Original language word studies',
        properties: {
          hebrew_or_greek: { type: 'string', description: '"Hebrew" or "Greek"' },
          key_words: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                word: { type: 'string', description: 'English word' },
                original: { type: 'string', description: 'Original language word' },
                transliteration: { type: 'string' },
                meaning: { type: 'string', description: 'Full meaning/definition' },
              },
            },
          },
        },
      },
      historical_context: {
        type: 'string',
        description: 'Historical and cultural background',
      },
      theological_themes: {
        type: 'array',
        items: { type: 'string' },
        description: 'Key theological themes in this passage',
      },
      application_points: {
        type: 'array',
        items: { type: 'string' },
        description: 'Practical application points',
      },
      related_topics: {
        type: 'array',
        items: { type: 'string' },
        description: 'Related topics for further study',
      },
      format: {
        type: 'string',
        enum: ['markdown', 'html'],
        description: 'Output format. Default: "markdown"',
      },
    },
    required: ['text'],
  },
};

// ============================================================================
// TYPES
// ============================================================================

interface CrossReference {
  reference: string;
  text: string;
  connection: string;
}

interface KeyWord {
  word: string;
  original: string;
  transliteration: string;
  meaning: string;
}

interface OriginalLanguage {
  hebrew_or_greek: string;
  key_words: KeyWord[];
}

interface ScriptureArgs {
  reference?: string;
  topic?: string;
  text: string;
  cross_references?: CrossReference[];
  original_language?: OriginalLanguage;
  historical_context?: string;
  theological_themes?: string[];
  application_points?: string[];
  related_topics?: string[];
  format?: 'markdown' | 'html';
}

// ============================================================================
// FORMATTERS
// ============================================================================

function formatMarkdown(args: ScriptureArgs): string {
  const lines: string[] = [];
  const heading = args.reference
    ? `Scripture Study: ${args.reference}`
    : args.topic
      ? `Scripture Study: ${args.topic}`
      : 'Scripture Study';

  lines.push(`# ${heading}`);
  lines.push('');

  // Primary passage
  if (args.reference) {
    lines.push(`## ${args.reference}`);
  }
  lines.push('');
  lines.push(`> ${args.text}`);
  lines.push('');

  // Cross-references
  if (args.cross_references && args.cross_references.length > 0) {
    lines.push('## Cross-References');
    lines.push('');
    args.cross_references.forEach((ref, i) => {
      lines.push(`${i + 1}. **${ref.reference}** — "${ref.text}"`);
      lines.push(`   _Connection:_ ${ref.connection}`);
      lines.push('');
    });
  }

  // Original language
  if (args.original_language && args.original_language.key_words?.length > 0) {
    lines.push(`## Original Language (${args.original_language.hebrew_or_greek})`);
    lines.push('');
    lines.push('| English | Original | Transliteration | Meaning |');
    lines.push('|---------|----------|-----------------|---------|');
    for (const kw of args.original_language.key_words) {
      lines.push(`| ${kw.word} | ${kw.original} | ${kw.transliteration} | ${kw.meaning} |`);
    }
    lines.push('');
  }

  // Historical context
  if (args.historical_context) {
    lines.push('## Historical & Cultural Context');
    lines.push('');
    lines.push(args.historical_context);
    lines.push('');
  }

  // Theological themes
  if (args.theological_themes && args.theological_themes.length > 0) {
    lines.push('## Theological Themes');
    lines.push('');
    for (const theme of args.theological_themes) {
      lines.push(`- ${theme}`);
    }
    lines.push('');
  }

  // Application points
  if (args.application_points && args.application_points.length > 0) {
    lines.push('## Application');
    lines.push('');
    for (const point of args.application_points) {
      lines.push(`- ${point}`);
    }
    lines.push('');
  }

  // Related topics
  if (args.related_topics && args.related_topics.length > 0) {
    lines.push('## Further Study');
    lines.push('');
    for (const topic of args.related_topics) {
      lines.push(`- ${topic}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatHtml(args: ScriptureArgs): string {
  const heading = args.reference
    ? `Scripture Study: ${escapeHtml(args.reference)}`
    : args.topic
      ? `Scripture Study: ${escapeHtml(args.topic)}`
      : 'Scripture Study';

  const sections: string[] = [];

  // Primary passage
  sections.push(`
    <div style="background:#f8f5f0;border-left:4px solid #8b6914;padding:16px 20px;margin-bottom:20px;border-radius:0 8px 8px 0;">
      ${args.reference ? `<h3 style="margin:0 0 8px;color:#5c4a1e;font-family:Georgia,serif;">${escapeHtml(args.reference)}</h3>` : ''}
      <p style="font-family:Georgia,serif;font-size:16px;line-height:1.7;color:#3a3020;margin:0;font-style:italic;">${escapeHtml(args.text)}</p>
    </div>
  `);

  // Cross-references
  if (args.cross_references && args.cross_references.length > 0) {
    const refs = args.cross_references
      .map(
        (ref, i) => `
      <li style="margin-bottom:12px;">
        <strong style="color:#5c4a1e;">${i + 1}. ${escapeHtml(ref.reference)}</strong> — <em style="font-family:Georgia,serif;">"${escapeHtml(ref.text)}"</em>
        <br/><span style="color:#666;font-size:14px;">Connection: ${escapeHtml(ref.connection)}</span>
      </li>`
      )
      .join('');
    sections.push(`<h2 style="color:#5c4a1e;border-bottom:1px solid #d4c9a8;padding-bottom:6px;">Cross-References</h2><ol style="padding-left:20px;">${refs}</ol>`);
  }

  // Original language
  if (args.original_language && args.original_language.key_words?.length > 0) {
    const rows = args.original_language.key_words
      .map(
        (kw) => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #e8e0d0;">${escapeHtml(kw.word)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e8e0d0;font-family:Georgia,serif;">${escapeHtml(kw.original)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e8e0d0;font-style:italic;">${escapeHtml(kw.transliteration)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e8e0d0;">${escapeHtml(kw.meaning)}</td>
      </tr>`
      )
      .join('');
    sections.push(`
      <h2 style="color:#5c4a1e;border-bottom:1px solid #d4c9a8;padding-bottom:6px;">Original Language (${escapeHtml(args.original_language.hebrew_or_greek)})</h2>
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
        <thead><tr style="background:#f0ead8;">
          <th style="padding:8px 12px;text-align:left;">English</th>
          <th style="padding:8px 12px;text-align:left;">Original</th>
          <th style="padding:8px 12px;text-align:left;">Transliteration</th>
          <th style="padding:8px 12px;text-align:left;">Meaning</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    `);
  }

  // Historical context
  if (args.historical_context) {
    sections.push(`
      <h2 style="color:#5c4a1e;border-bottom:1px solid #d4c9a8;padding-bottom:6px;">Historical &amp; Cultural Context</h2>
      <p style="line-height:1.7;color:#333;">${escapeHtml(args.historical_context)}</p>
    `);
  }

  // Theological themes
  if (args.theological_themes && args.theological_themes.length > 0) {
    const items = args.theological_themes.map((t) => `<li style="margin-bottom:6px;">${escapeHtml(t)}</li>`).join('');
    sections.push(`<h2 style="color:#5c4a1e;border-bottom:1px solid #d4c9a8;padding-bottom:6px;">Theological Themes</h2><ul style="padding-left:20px;">${items}</ul>`);
  }

  // Application
  if (args.application_points && args.application_points.length > 0) {
    const items = args.application_points.map((p) => `<li style="margin-bottom:6px;">${escapeHtml(p)}</li>`).join('');
    sections.push(`<h2 style="color:#5c4a1e;border-bottom:1px solid #d4c9a8;padding-bottom:6px;">Application</h2><ul style="padding-left:20px;">${items}</ul>`);
  }

  // Related topics
  if (args.related_topics && args.related_topics.length > 0) {
    const items = args.related_topics.map((t) => `<li style="margin-bottom:4px;">${escapeHtml(t)}</li>`).join('');
    sections.push(`<h2 style="color:#5c4a1e;border-bottom:1px solid #d4c9a8;padding-bottom:6px;">Further Study</h2><ul style="padding-left:20px;">${items}</ul>`);
  }

  return `<div style="font-family:'Segoe UI',Tahoma,sans-serif;max-width:720px;margin:0 auto;padding:24px;background:#fff;border:1px solid #e0d8c8;border-radius:12px;">
    <h1 style="color:#3a2a0a;font-family:Georgia,serif;text-align:center;margin-bottom:24px;">${heading}</h1>
    ${sections.join('\n')}
  </div>`;
}

// ============================================================================
// TOOL EXECUTOR
// ============================================================================

export async function executeScripture(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, name, arguments: rawArgs } = toolCall;

  if (name !== 'scripture_reference') {
    return { toolCallId: id, content: `Unknown tool: ${name}`, isError: true };
  }

  const args = (typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs) as ScriptureArgs;

  if (!args.text) {
    return { toolCallId: id, content: 'The "text" parameter is required (primary passage text).', isError: true };
  }

  const format = args.format || 'markdown';
  const content = format === 'html' ? formatHtml(args) : formatMarkdown(args);

  return { toolCallId: id, content, isError: false };
}

// ============================================================================
// AVAILABILITY CHECK
// ============================================================================

export function isScriptureAvailable(): boolean {
  return true; // Pure formatter — always available
}

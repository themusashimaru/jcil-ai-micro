/**
 * DAILY DEVOTIONAL TOOL
 *
 * Creates daily devotional readings with scripture, reflection,
 * prayer, application questions, and action steps.
 *
 * The AI (Opus) generates all devotional content and passes it as structured
 * arguments; this tool formats it into a clean, readable devotional.
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const devotionalTool: UnifiedTool = {
  name: 'daily_devotional',
  description: `Create daily devotional readings with scripture, reflection, prayer, and application.

Use this when:
- User wants a daily devotional or quiet time guide
- User asks for a devotional on a specific topic or verse
- User wants help with personal Bible study
- User is looking for spiritual reflection content

Returns a complete devotional reading with scripture, meditation, prayer, reflection questions, and an action step for the day.`,
  parameters: {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        description: 'Devotional title',
      },
      date: {
        type: 'string',
        description: 'Date for the devotional (e.g., "2026-03-19"). Default: today',
      },
      scripture_reference: {
        type: 'string',
        description: 'Primary verse reference (e.g., "Psalm 23:1-6")',
      },
      scripture_text: {
        type: 'string',
        description: 'Full text of the scripture passage',
      },
      theme: {
        type: 'string',
        description: 'Theme or topic (e.g., "trust", "patience", "grace")',
      },
      reflection: {
        type: 'string',
        description: 'The devotional reflection/meditation text (2-4 paragraphs)',
      },
      prayer: {
        type: 'string',
        description: 'A closing prayer',
      },
      application_questions: {
        type: 'array',
        description: 'Questions for personal reflection',
        items: { type: 'string' },
      },
      action_step: {
        type: 'string',
        description: 'One concrete thing to do today',
      },
      additional_reading: {
        type: 'array',
        description: 'Other scripture references to explore',
        items: { type: 'string' },
      },
      quote: {
        type: 'string',
        description: 'An optional inspirational quote',
      },
      format: {
        type: 'string',
        description: 'Output format: "markdown" or "html". Default: "markdown"',
        enum: ['markdown', 'html'],
      },
    },
    required: ['title', 'scripture_reference', 'scripture_text', 'reflection'],
  },
};

// ============================================================================
// TYPES
// ============================================================================

interface DevotionalArgs {
  title: string;
  date?: string;
  scripture_reference: string;
  scripture_text: string;
  theme?: string;
  reflection: string;
  prayer?: string;
  application_questions?: string[];
  action_step?: string;
  additional_reading?: string[];
  quote?: string;
  format?: 'markdown' | 'html';
}

// ============================================================================
// READING TIME ESTIMATE
// ============================================================================

function estimateReadingTime(text: string): number {
  const words = text.split(/\s+/).length;
  return Math.max(1, Math.ceil(words / 200)); // ~200 wpm
}

// ============================================================================
// MARKDOWN FORMATTER
// ============================================================================

function formatMarkdown(args: DevotionalArgs): string {
  const lines: string[] = [];
  const date = args.date || new Date().toISOString().split('T')[0];

  lines.push(`# ${args.title}`);
  lines.push('');
  lines.push(`**Date:** ${date}`);
  if (args.theme) {
    lines.push(`**Theme:** ${args.theme}`);
  }
  const readTime = estimateReadingTime(
    args.scripture_text + ' ' + args.reflection + ' ' + (args.prayer || '')
  );
  lines.push(`**Reading Time:** ~${readTime} min`);
  lines.push('');

  // Scripture
  lines.push('---');
  lines.push('');
  lines.push(`## ${args.scripture_reference}`);
  lines.push('');
  lines.push(`> ${args.scripture_text}`);
  lines.push('');

  // Quote
  if (args.quote) {
    lines.push(`> *"${args.quote}"*`);
    lines.push('');
  }

  // Reflection
  lines.push('## Reflection');
  lines.push('');
  lines.push(args.reflection);
  lines.push('');

  // Application questions
  if (args.application_questions && args.application_questions.length > 0) {
    lines.push('## Questions for Reflection');
    lines.push('');
    args.application_questions.forEach((q, i) => {
      lines.push(`${i + 1}. ${q}`);
    });
    lines.push('');
  }

  // Action step
  if (args.action_step) {
    lines.push('## Today\'s Action Step');
    lines.push('');
    lines.push(`**${args.action_step}**`);
    lines.push('');
  }

  // Prayer
  if (args.prayer) {
    lines.push('## Prayer');
    lines.push('');
    lines.push(`*${args.prayer}*`);
    lines.push('');
  }

  // Additional reading
  if (args.additional_reading && args.additional_reading.length > 0) {
    lines.push('## Additional Reading');
    lines.push('');
    for (const ref of args.additional_reading) {
      lines.push(`- ${ref}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

// ============================================================================
// HTML FORMATTER
// ============================================================================

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatHtml(args: DevotionalArgs): string {
  const date = args.date || new Date().toISOString().split('T')[0];
  const readTime = estimateReadingTime(
    args.scripture_text + ' ' + args.reflection + ' ' + (args.prayer || '')
  );
  const sections: string[] = [];

  // Metadata
  const metaParts = [`<span>${escapeHtml(date)}</span>`];
  if (args.theme) {
    metaParts.push(`<span>Theme: ${escapeHtml(args.theme)}</span>`);
  }
  metaParts.push(`<span>~${readTime} min read</span>`);

  sections.push(`<div style="display:flex;gap:16px;justify-content:center;color:#8b7d5a;font-size:13px;margin-bottom:20px;">${metaParts.join(' | ')}</div>`);

  // Scripture
  sections.push(`<div style="background:#f8f5f0;border-left:4px solid #8b6914;padding:16px 20px;margin-bottom:20px;border-radius:0 8px 8px 0;">
    <h3 style="margin:0 0 8px;color:#5c4a1e;font-family:Georgia,serif;font-size:16px;">${escapeHtml(args.scripture_reference)}</h3>
    <p style="font-family:Georgia,serif;font-size:15px;line-height:1.8;color:#3a3020;margin:0;font-style:italic;">${escapeHtml(args.scripture_text)}</p>
  </div>`);

  // Quote
  if (args.quote) {
    sections.push(`<div style="text-align:center;padding:12px 24px;margin-bottom:20px;color:#666;font-style:italic;font-size:14px;">
      "${escapeHtml(args.quote)}"
    </div>`);
  }

  // Reflection — convert paragraph breaks
  const reflectionParagraphs = args.reflection
    .split(/\n\n+/)
    .map((p) => `<p style="line-height:1.8;color:#333;margin:0 0 14px;">${escapeHtml(p.trim())}</p>`)
    .join('');
  sections.push(`<div style="margin-bottom:20px;">
    <h2 style="color:#5c4a1e;font-size:18px;margin-bottom:12px;">Reflection</h2>
    ${reflectionParagraphs}
  </div>`);

  // Application questions
  if (args.application_questions && args.application_questions.length > 0) {
    const qs = args.application_questions
      .map((q, i) => `<li style="margin-bottom:8px;">${i + 1}. ${escapeHtml(q)}</li>`)
      .join('');
    sections.push(`<div style="margin-bottom:20px;">
      <h2 style="color:#5c4a1e;font-size:18px;margin-bottom:12px;">Questions for Reflection</h2>
      <ol style="padding-left:20px;line-height:1.6;">${qs}</ol>
    </div>`);
  }

  // Action step
  if (args.action_step) {
    sections.push(`<div style="background:#e8f6ef;border:1px solid #a3d9c0;padding:14px 18px;border-radius:8px;margin-bottom:20px;">
      <h3 style="color:#1a7a4c;margin:0 0 6px;font-size:15px;">Today's Action Step</h3>
      <p style="margin:0;color:#2d5a3f;font-size:15px;">${escapeHtml(args.action_step)}</p>
    </div>`);
  }

  // Prayer
  if (args.prayer) {
    sections.push(`<div style="margin-bottom:20px;">
      <h2 style="color:#5c4a1e;font-size:18px;margin-bottom:12px;">Prayer</h2>
      <p style="font-style:italic;line-height:1.7;color:#555;">${escapeHtml(args.prayer)}</p>
    </div>`);
  }

  // Additional reading
  if (args.additional_reading && args.additional_reading.length > 0) {
    const items = args.additional_reading
      .map((r) => `<li style="margin-bottom:4px;">${escapeHtml(r)}</li>`)
      .join('');
    sections.push(`<div style="margin-bottom:12px;">
      <h2 style="color:#5c4a1e;font-size:18px;margin-bottom:10px;">Additional Reading</h2>
      <ul style="padding-left:20px;color:#555;line-height:1.6;">${items}</ul>
    </div>`);
  }

  return `<div style="font-family:'Segoe UI',Tahoma,sans-serif;max-width:680px;margin:0 auto;padding:28px;background:#fffdf8;border:1px solid #e8e0d0;border-radius:12px;">
    <h1 style="color:#3a2a0a;font-family:Georgia,serif;text-align:center;margin:0 0 8px;font-size:24px;">${escapeHtml(args.title)}</h1>
    ${sections.join('\n')}
  </div>`;
}

// ============================================================================
// TOOL EXECUTOR
// ============================================================================

export async function executeDevotional(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, name, arguments: rawArgs } = toolCall;

  if (name !== 'daily_devotional') {
    return { toolCallId: id, content: `Unknown tool: ${name}`, isError: true };
  }

  const args = (typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs) as DevotionalArgs;

  if (!args.title) {
    return { toolCallId: id, content: 'The "title" parameter is required.', isError: true };
  }
  if (!args.scripture_reference) {
    return { toolCallId: id, content: 'The "scripture_reference" parameter is required.', isError: true };
  }
  if (!args.scripture_text) {
    return { toolCallId: id, content: 'The "scripture_text" parameter is required.', isError: true };
  }
  if (!args.reflection) {
    return { toolCallId: id, content: 'The "reflection" parameter is required.', isError: true };
  }

  const format = args.format || 'markdown';
  const content = format === 'html' ? formatHtml(args) : formatMarkdown(args);

  const readTime = estimateReadingTime(
    args.scripture_text + ' ' + args.reflection + ' ' + (args.prayer || '')
  );

  const metadata = JSON.stringify({
    date: args.date || new Date().toISOString().split('T')[0],
    theme: args.theme || null,
    reading_time_minutes: readTime,
  });

  return {
    toolCallId: id,
    content: `${content}\n\n<!-- metadata: ${metadata} -->`,
    isError: false,
  };
}

// ============================================================================
// AVAILABILITY CHECK
// ============================================================================

export function isDevotionalAvailable(): boolean {
  return true; // Pure formatter — always available
}

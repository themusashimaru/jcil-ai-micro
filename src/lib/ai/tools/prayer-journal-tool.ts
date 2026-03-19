/**
 * PRAYER JOURNAL TOOL
 *
 * Creates structured prayer journal entries using the ACTS framework
 * (Adoration, Confession, Thanksgiving, Supplication).
 *
 * The AI (Opus) generates the devotional content and passes it as structured
 * arguments; this tool formats it into a beautiful journal entry.
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const prayerJournalTool: UnifiedTool = {
  name: 'prayer_journal',
  description: `Create structured prayer journal entries using the ACTS framework (Adoration, Confession, Thanksgiving, Supplication).

Use this when:
- User wants to journal their prayers
- User asks for help organizing prayer time
- User wants to track prayer requests and answered prayers
- User wants a devotional journaling structure
- User mentions prayer lists or prayer tracking

Returns a beautifully formatted prayer journal entry with scripture, praise, requests, reflections, and action steps.`,
  parameters: {
    type: 'object',
    properties: {
      date: {
        type: 'string',
        description: 'Entry date (e.g., "2026-03-19"). Default: today',
      },
      scripture: {
        type: 'object',
        description: 'Scripture of the day: { reference: string, text: string }',
      },
      praise_items: {
        type: 'array',
        description: 'Things to praise God for (Adoration)',
        items: { type: 'string' },
      },
      thanksgiving_items: {
        type: 'array',
        description: 'Things to be thankful for (Thanksgiving)',
        items: { type: 'string' },
      },
      prayer_requests: {
        type: 'array',
        description: 'Prayer requests. Each object: { request: string, category: "personal"|"family"|"church"|"community"|"nation"|"world"|"other", urgent?: boolean }',
        items: { type: 'object' },
      },
      confessions: {
        type: 'array',
        description: 'Areas for confession and growth (kept general)',
        items: { type: 'string' },
      },
      reflections: {
        type: 'string',
        description: 'Personal reflections or what God is teaching you',
      },
      answered_prayers: {
        type: 'array',
        description: 'Answered prayers. Each object: { original_request: string, how_answered: string, date_answered: string }',
        items: { type: 'object' },
      },
      listening_notes: {
        type: 'string',
        description: 'What you sense God saying',
      },
      action_steps: {
        type: 'array',
        description: 'Action items from prayer time',
        items: { type: 'string' },
      },
      format: {
        type: 'string',
        description: 'Output format: "markdown" or "html". Default: "markdown"',
        enum: ['markdown', 'html'],
      },
    },
    required: [],
  },
};

// ============================================================================
// TYPES
// ============================================================================

interface ScriptureRef {
  reference: string;
  text: string;
}

interface PrayerRequest {
  request: string;
  category?: string;
  urgent?: boolean;
}

interface AnsweredPrayer {
  original_request: string;
  how_answered: string;
  date_answered: string;
}

interface PrayerJournalArgs {
  date?: string;
  scripture?: ScriptureRef;
  praise_items?: string[];
  thanksgiving_items?: string[];
  prayer_requests?: PrayerRequest[];
  confessions?: string[];
  reflections?: string;
  answered_prayers?: AnsweredPrayer[];
  listening_notes?: string;
  action_steps?: string[];
  format?: 'markdown' | 'html';
}

// ============================================================================
// CATEGORY LABELS
// ============================================================================

const CATEGORY_LABELS: Record<string, string> = {
  personal: 'Personal',
  family: 'Family',
  church: 'Church',
  community: 'Community',
  nation: 'Nation',
  world: 'World',
  other: 'Other',
};

// ============================================================================
// MARKDOWN FORMATTER
// ============================================================================

function formatMarkdown(args: PrayerJournalArgs): string {
  const lines: string[] = [];
  const date = args.date || new Date().toISOString().split('T')[0];

  lines.push(`# Prayer Journal — ${date}`);
  lines.push('');

  // Scripture of the day
  if (args.scripture) {
    lines.push('## Scripture of the Day');
    lines.push('');
    lines.push(`> ${args.scripture.text}`);
    lines.push(`> — *${args.scripture.reference}*`);
    lines.push('');
  }

  // Adoration / Praise
  if (args.praise_items && args.praise_items.length > 0) {
    lines.push('## Adoration');
    lines.push('');
    for (const item of args.praise_items) {
      lines.push(`- ${item}`);
    }
    lines.push('');
  }

  // Confession
  if (args.confessions && args.confessions.length > 0) {
    lines.push('## Confession');
    lines.push('');
    for (const item of args.confessions) {
      lines.push(`- ${item}`);
    }
    lines.push('');
  }

  // Thanksgiving
  if (args.thanksgiving_items && args.thanksgiving_items.length > 0) {
    lines.push('## Thanksgiving');
    lines.push('');
    for (const item of args.thanksgiving_items) {
      lines.push(`- ${item}`);
    }
    lines.push('');
  }

  // Supplication / Prayer requests
  if (args.prayer_requests && args.prayer_requests.length > 0) {
    lines.push('## Supplication');
    lines.push('');

    // Group by category
    const grouped = groupByCategory(args.prayer_requests);
    for (const [category, requests] of Object.entries(grouped)) {
      const label = CATEGORY_LABELS[category] || category;
      lines.push(`### ${label}`);
      for (const req of requests) {
        const urgentMark = req.urgent ? ' **[URGENT]**' : '';
        lines.push(`- ${req.request}${urgentMark}`);
      }
      lines.push('');
    }
  }

  // Reflections
  if (args.reflections) {
    lines.push('## Reflections');
    lines.push('');
    lines.push(args.reflections);
    lines.push('');
  }

  // Listening notes
  if (args.listening_notes) {
    lines.push('## Listening');
    lines.push('');
    lines.push(`> ${args.listening_notes}`);
    lines.push('');
  }

  // Answered prayers
  if (args.answered_prayers && args.answered_prayers.length > 0) {
    lines.push('## Praise Report — Answered Prayers');
    lines.push('');
    for (const ap of args.answered_prayers) {
      lines.push(`- **Request:** ${ap.original_request}`);
      lines.push(`  **Answered:** ${ap.how_answered} *(${ap.date_answered})*`);
      lines.push('');
    }
  }

  // Action steps
  if (args.action_steps && args.action_steps.length > 0) {
    lines.push('## Action Steps');
    lines.push('');
    for (const step of args.action_steps) {
      lines.push(`- [ ] ${step}`);
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

function formatHtml(args: PrayerJournalArgs): string {
  const date = args.date || new Date().toISOString().split('T')[0];
  const sections: string[] = [];

  // Scripture
  if (args.scripture) {
    sections.push(`<div style="background:#f8f5f0;border-left:4px solid #8b6914;padding:14px 18px;margin-bottom:20px;border-radius:0 8px 8px 0;">
      <p style="font-family:Georgia,serif;font-size:15px;line-height:1.7;color:#3a3020;margin:0;font-style:italic;">${escapeHtml(args.scripture.text)}</p>
      <p style="text-align:right;margin:6px 0 0;color:#6b5b3a;font-size:13px;">— ${escapeHtml(args.scripture.reference)}</p>
    </div>`);
  }

  // Adoration
  if (args.praise_items && args.praise_items.length > 0) {
    const items = args.praise_items.map((p) => `<li style="margin-bottom:6px;">${escapeHtml(p)}</li>`).join('');
    sections.push(htmlSection('Adoration', `<ul style="padding-left:20px;line-height:1.6;">${items}</ul>`, '#c0392b'));
  }

  // Confession
  if (args.confessions && args.confessions.length > 0) {
    const items = args.confessions.map((c) => `<li style="margin-bottom:6px;">${escapeHtml(c)}</li>`).join('');
    sections.push(htmlSection('Confession', `<ul style="padding-left:20px;line-height:1.6;">${items}</ul>`, '#7f8c8d'));
  }

  // Thanksgiving
  if (args.thanksgiving_items && args.thanksgiving_items.length > 0) {
    const items = args.thanksgiving_items.map((t) => `<li style="margin-bottom:6px;">${escapeHtml(t)}</li>`).join('');
    sections.push(htmlSection('Thanksgiving', `<ul style="padding-left:20px;line-height:1.6;">${items}</ul>`, '#27ae60'));
  }

  // Supplication
  if (args.prayer_requests && args.prayer_requests.length > 0) {
    const grouped = groupByCategory(args.prayer_requests);
    let requestsHtml = '';
    for (const [category, requests] of Object.entries(grouped)) {
      const label = CATEGORY_LABELS[category] || category;
      const items = requests
        .map((r) => {
          const urgentBadge = r.urgent
            ? ' <span style="background:#e74c3c;color:#fff;padding:1px 6px;border-radius:4px;font-size:11px;margin-left:4px;">URGENT</span>'
            : '';
          return `<li style="margin-bottom:6px;">${escapeHtml(r.request)}${urgentBadge}</li>`;
        })
        .join('');
      requestsHtml += `<h4 style="color:#555;margin:12px 0 6px;">${escapeHtml(label)}</h4><ul style="padding-left:20px;">${items}</ul>`;
    }
    sections.push(htmlSection('Supplication', requestsHtml, '#2980b9'));
  }

  // Reflections
  if (args.reflections) {
    sections.push(htmlSection('Reflections', `<p style="line-height:1.7;color:#333;">${escapeHtml(args.reflections)}</p>`, '#8e44ad'));
  }

  // Listening
  if (args.listening_notes) {
    sections.push(htmlSection('Listening', `<blockquote style="background:#fdf6ec;border-left:3px solid #f0c040;padding:10px 14px;margin:8px 0;border-radius:0 6px 6px 0;font-style:italic;">${escapeHtml(args.listening_notes)}</blockquote>`, '#f39c12'));
  }

  // Answered prayers
  if (args.answered_prayers && args.answered_prayers.length > 0) {
    const items = args.answered_prayers
      .map(
        (ap) => `<li style="margin-bottom:10px;">
        <strong>Request:</strong> ${escapeHtml(ap.original_request)}<br/>
        <strong>Answered:</strong> ${escapeHtml(ap.how_answered)} <em>(${escapeHtml(ap.date_answered)})</em>
      </li>`
      )
      .join('');
    sections.push(htmlSection('Praise Report — Answered Prayers', `<ul style="padding-left:20px;line-height:1.6;">${items}</ul>`, '#27ae60'));
  }

  // Action steps
  if (args.action_steps && args.action_steps.length > 0) {
    const items = args.action_steps.map((s) => `<li style="margin-bottom:6px;">${escapeHtml(s)}</li>`).join('');
    sections.push(htmlSection('Action Steps', `<ul style="padding-left:20px;list-style-type:square;line-height:1.6;">${items}</ul>`, '#2c3e50'));
  }

  return `<div style="font-family:'Segoe UI',Tahoma,sans-serif;max-width:680px;margin:0 auto;padding:24px;background:#fffdf8;border:1px solid #e8e0d0;border-radius:12px;">
    <h1 style="color:#3a2a0a;font-family:Georgia,serif;text-align:center;margin:0 0 4px;font-size:22px;">Prayer Journal</h1>
    <p style="text-align:center;color:#8b7d5a;margin:0 0 20px;font-size:14px;">${escapeHtml(date)}</p>
    ${sections.join('\n')}
  </div>`;
}

function htmlSection(title: string, content: string, accentColor: string): string {
  return `<div style="margin-bottom:20px;">
    <h2 style="color:${accentColor};border-bottom:2px solid ${accentColor};padding-bottom:6px;font-size:17px;margin-bottom:10px;">${title}</h2>
    ${content}
  </div>`;
}

// ============================================================================
// HELPERS
// ============================================================================

function groupByCategory(requests: PrayerRequest[]): Record<string, PrayerRequest[]> {
  const grouped: Record<string, PrayerRequest[]> = {};
  for (const req of requests) {
    const cat = req.category || 'other';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(req);
  }
  return grouped;
}

// ============================================================================
// TOOL EXECUTOR
// ============================================================================

export async function executePrayerJournal(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, name, arguments: rawArgs } = toolCall;

  if (name !== 'prayer_journal') {
    return { toolCallId: id, content: `Unknown tool: ${name}`, isError: true };
  }

  const args = (typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs) as PrayerJournalArgs;
  const format = args.format || 'markdown';
  const content = format === 'html' ? formatHtml(args) : formatMarkdown(args);

  return { toolCallId: id, content, isError: false };
}

// ============================================================================
// AVAILABILITY CHECK
// ============================================================================

export function isPrayerJournalAvailable(): boolean {
  return true; // Pure formatter — always available
}

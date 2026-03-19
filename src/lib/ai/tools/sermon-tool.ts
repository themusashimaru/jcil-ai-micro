/**
 * SERMON & BIBLE LESSON OUTLINE TOOL
 *
 * Creates structured sermon outlines and Bible lesson plans with introduction,
 * main points with illustrations, and conclusion. The AI generates all content
 * and passes it as structured arguments; this tool formats it for the pulpit.
 */
import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const sermonTool: UnifiedTool = {
  name: 'sermon_outline',
  description: `Create structured sermon outlines and Bible lesson plans with introduction, main points, illustrations, and conclusion.

Use this when:
- User is preparing a sermon or Bible lesson
- User wants help structuring a devotional talk
- User needs a youth group lesson plan
- User wants to organize teaching notes for a passage

Returns a complete, structured outline with scripture references, illustrations, applications, and time guidance — ready for the pulpit or study group.`,
  parameters: {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        description: 'Sermon or lesson title',
      },
      passage: {
        type: 'string',
        description: 'Primary scripture passage reference (e.g., "Philippians 4:4-9")',
      },
      passage_text: {
        type: 'string',
        description: 'Full text of the primary passage',
      },
      type: {
        type: 'string',
        description: 'Type of outline to create',
        enum: ['sermon', 'bible_study', 'devotional_talk', 'youth_lesson'],
      },
      duration_minutes: {
        type: 'number',
        description: 'Target duration in minutes. Default: 30',
        default: 30,
      },
      audience: {
        type: 'string',
        description: 'Target audience description (e.g., "mixed congregation", "college students")',
      },
      introduction: {
        type: 'object',
        description: 'Introduction section: { hook: string (attention grabber), context: string (passage context), thesis: string (main point), transition: string (bridge to body) }',
      },
      main_points: {
        type: 'array',
        description: 'Main points array. Each object: { point: string (title), scripture: string (supporting verse), explanation: string, illustration: string (story/example), application: string (so-what) }',
        items: { type: 'object' },
      },
      conclusion: {
        type: 'object',
        description: 'Conclusion section: { summary: string, call_to_action: string, closing_prayer_prompt: string, closing_verse: string }',
      },
      discussion_questions: {
        type: 'array',
        description: 'Discussion questions (primarily for bible_study type)',
        items: { type: 'string' },
      },
      format: {
        type: 'string',
        description: 'Output format. Default: "markdown"',
        enum: ['markdown', 'html'],
      },
    },
    required: ['title', 'passage'],
  },
};

// -- Types --

interface MainPoint { point: string; scripture?: string; explanation?: string; illustration?: string; application?: string; }
interface Introduction { hook?: string; context?: string; thesis?: string; transition?: string; }
interface Conclusion { summary?: string; call_to_action?: string; closing_prayer_prompt?: string; closing_verse?: string; }
interface SermonArgs {
  title: string; passage: string; passage_text?: string;
  type?: 'sermon' | 'bible_study' | 'devotional_talk' | 'youth_lesson';
  duration_minutes?: number; audience?: string; introduction?: Introduction;
  main_points?: MainPoint[]; conclusion?: Conclusion;
  discussion_questions?: string[]; format?: 'markdown' | 'html';
}

// -- Time Allocation --

function computeTimeAllocation(
  duration: number,
  pointCount: number
): { intro: number; perPoint: number; conclusion: number } {
  const intro = Math.max(3, Math.round(duration * 0.15));
  const conclusion = Math.max(3, Math.round(duration * 0.12));
  const bodyTime = Math.max(1, duration - intro - conclusion);
  const perPoint = pointCount > 0 ? Math.round(bodyTime / pointCount) : bodyTime;
  return { intro, perPoint, conclusion };
}

const TYPE_LABELS: Record<string, string> = {
  sermon: 'Sermon',
  bible_study: 'Bible Study',
  devotional_talk: 'Devotional Talk',
  youth_lesson: 'Youth Lesson',
};

// -- Markdown Formatter --

function formatMarkdown(args: SermonArgs): string {
  const lines: string[] = [];
  const duration = args.duration_minutes || 30;
  const points = args.main_points || [];
  const time = computeTimeAllocation(duration, points.length);
  const typeLabel = TYPE_LABELS[args.type || 'sermon'] || 'Sermon';

  lines.push(`# ${args.title}`);
  lines.push('');
  lines.push(`**Type:** ${typeLabel} | **Passage:** ${args.passage} | **Duration:** ~${duration} min`);
  if (args.audience) {
    lines.push(`**Audience:** ${args.audience}`);
  }
  lines.push('');

  // Passage text
  if (args.passage_text) {
    lines.push('---');
    lines.push('');
    lines.push(`> ${args.passage_text}`);
    lines.push(`> — *${args.passage}*`);
    lines.push('');
  }

  lines.push('---');
  lines.push('');

  // Introduction
  if (args.introduction) {
    const intro = args.introduction;
    lines.push(`## I. Introduction (~${time.intro} min)`);
    lines.push('');
    if (intro.hook) {
      lines.push(`**Hook:** ${intro.hook}`);
      lines.push('');
    }
    if (intro.context) {
      lines.push(`**Context:** ${intro.context}`);
      lines.push('');
    }
    if (intro.thesis) {
      lines.push(`**Main Idea:** ${intro.thesis}`);
      lines.push('');
    }
    if (intro.transition) {
      lines.push(`*Transition:* ${intro.transition}`);
      lines.push('');
    }
  }

  // Main points
  if (points.length > 0) {
    const numerals = ['II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
    points.forEach((pt, i) => {
      const numeral = numerals[i] || `${i + 2}`;
      lines.push(`## ${numeral}. ${pt.point} (~${time.perPoint} min)`);
      lines.push('');
      if (pt.scripture) {
        lines.push(`**Scripture:** ${pt.scripture}`);
        lines.push('');
      }
      if (pt.explanation) {
        lines.push(pt.explanation);
        lines.push('');
      }
      if (pt.illustration) {
        lines.push(`> **Illustration:** ${pt.illustration}`);
        lines.push('');
      }
      if (pt.application) {
        lines.push(`**Application:** ${pt.application}`);
        lines.push('');
      }
    });
  }

  // Conclusion
  if (args.conclusion) {
    const conc = args.conclusion;
    const concNumeral = points.length + 2;
    lines.push(`## ${toRoman(concNumeral)}. Conclusion (~${time.conclusion} min)`);
    lines.push('');
    if (conc.summary) {
      lines.push(`**Summary:** ${conc.summary}`);
      lines.push('');
    }
    if (conc.call_to_action) {
      lines.push(`**Call to Action:** ${conc.call_to_action}`);
      lines.push('');
    }
    if (conc.closing_verse) {
      lines.push(`**Closing Verse:** ${conc.closing_verse}`);
      lines.push('');
    }
    if (conc.closing_prayer_prompt) {
      lines.push(`*Prayer Prompt:* ${conc.closing_prayer_prompt}`);
      lines.push('');
    }
  }

  // Discussion questions
  if (args.discussion_questions && args.discussion_questions.length > 0) {
    lines.push('---');
    lines.push('');
    lines.push('## Discussion Questions');
    lines.push('');
    args.discussion_questions.forEach((q, i) => {
      lines.push(`${i + 1}. ${q}`);
    });
    lines.push('');
  }

  return lines.join('\n');
}

// -- HTML Formatter --

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatHtml(args: SermonArgs): string {
  const duration = args.duration_minutes || 30;
  const points = args.main_points || [];
  const time = computeTimeAllocation(duration, points.length);
  const typeLabel = TYPE_LABELS[args.type || 'sermon'] || 'Sermon';
  const sections: string[] = [];

  // Metadata bar
  sections.push(`
    <div style="display:flex;flex-wrap:wrap;gap:16px;margin-bottom:16px;font-size:14px;color:#555;">
      <span><strong>Type:</strong> ${escapeHtml(typeLabel)}</span>
      <span><strong>Passage:</strong> ${escapeHtml(args.passage)}</span>
      <span><strong>Duration:</strong> ~${duration} min</span>
      ${args.audience ? `<span><strong>Audience:</strong> ${escapeHtml(args.audience)}</span>` : ''}
    </div>`);

  // Passage text
  if (args.passage_text) {
    sections.push(`
    <div style="background:#f8f5f0;border-left:4px solid #8b6914;padding:16px 20px;margin:16px 0;border-radius:0 8px 8px 0;">
      <p style="font-family:Georgia,serif;font-size:15px;line-height:1.7;color:#3a3020;margin:0;font-style:italic;">${escapeHtml(args.passage_text)}</p>
      <p style="text-align:right;margin:8px 0 0;color:#6b5b3a;font-size:13px;">— ${escapeHtml(args.passage)}</p>
    </div>`);
  }

  // Introduction
  if (args.introduction) {
    const intro = args.introduction;
    let body = '';
    if (intro.hook) body += `<p><strong>Hook:</strong> ${escapeHtml(intro.hook)}</p>`;
    if (intro.context) body += `<p><strong>Context:</strong> ${escapeHtml(intro.context)}</p>`;
    if (intro.thesis) body += `<p><strong>Main Idea:</strong> ${escapeHtml(intro.thesis)}</p>`;
    if (intro.transition) body += `<p style="font-style:italic;color:#666;">Transition: ${escapeHtml(intro.transition)}</p>`;
    sections.push(`
    <div style="margin:20px 0;">
      <h3 style="color:#2c3e50;border-bottom:2px solid #8b6914;padding-bottom:6px;">I. Introduction <span style="font-weight:normal;font-size:13px;color:#888;">(~${time.intro} min)</span></h3>
      ${body}
    </div>`);
  }

  // Main points
  if (points.length > 0) {
    const numerals = ['II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
    points.forEach((pt, i) => {
      const numeral = numerals[i] || `${i + 2}`;
      let body = '';
      if (pt.scripture) body += `<p><strong>Scripture:</strong> ${escapeHtml(pt.scripture)}</p>`;
      if (pt.explanation) body += `<p style="line-height:1.7;">${escapeHtml(pt.explanation)}</p>`;
      if (pt.illustration) body += `<blockquote style="border-left:3px solid #d4c9a8;margin:12px 0;padding:8px 16px;background:#faf8f4;color:#555;font-style:italic;"><strong>Illustration:</strong> ${escapeHtml(pt.illustration)}</blockquote>`;
      if (pt.application) body += `<p><strong>Application:</strong> ${escapeHtml(pt.application)}</p>`;
      sections.push(`
      <div style="margin:20px 0;">
        <h3 style="color:#2c3e50;border-bottom:2px solid #8b6914;padding-bottom:6px;">${numeral}. ${escapeHtml(pt.point)} <span style="font-weight:normal;font-size:13px;color:#888;">(~${time.perPoint} min)</span></h3>
        ${body}
      </div>`);
    });
  }

  // Conclusion
  if (args.conclusion) {
    const conc = args.conclusion;
    let body = '';
    if (conc.summary) body += `<p><strong>Summary:</strong> ${escapeHtml(conc.summary)}</p>`;
    if (conc.call_to_action) body += `<p><strong>Call to Action:</strong> ${escapeHtml(conc.call_to_action)}</p>`;
    if (conc.closing_verse) body += `<p><strong>Closing Verse:</strong> ${escapeHtml(conc.closing_verse)}</p>`;
    if (conc.closing_prayer_prompt) body += `<p style="font-style:italic;color:#666;">Prayer Prompt: ${escapeHtml(conc.closing_prayer_prompt)}</p>`;
    sections.push(`
    <div style="margin:20px 0;">
      <h3 style="color:#2c3e50;border-bottom:2px solid #8b6914;padding-bottom:6px;">Conclusion <span style="font-weight:normal;font-size:13px;color:#888;">(~${time.conclusion} min)</span></h3>
      ${body}
    </div>`);
  }

  // Discussion questions
  if (args.discussion_questions && args.discussion_questions.length > 0) {
    const qs = args.discussion_questions.map((q, i) => `<li style="margin-bottom:8px;">${i + 1}. ${escapeHtml(q)}</li>`).join('');
    sections.push(`
    <div style="margin:20px 0;padding:16px;background:#f0f7ff;border-radius:8px;">
      <h3 style="color:#2c3e50;margin-top:0;">Discussion Questions</h3>
      <ol style="padding-left:20px;list-style:none;">${qs}</ol>
    </div>`);
  }

  return `<div style="font-family:'Segoe UI',Tahoma,sans-serif;max-width:720px;margin:0 auto;padding:24px;background:#fff;border:1px solid #e0d8c8;border-radius:12px;">
    <h2 style="color:#2c1810;font-family:Georgia,serif;text-align:center;margin:0 0 8px;">${escapeHtml(args.title)}</h2>
    ${sections.join('\n')}
  </div>`;
}

// -- Utilities --

function toRoman(n: number): string {
  const map: [number, string][] = [
    [10, 'X'], [9, 'IX'], [8, 'VIII'], [7, 'VII'], [6, 'VI'],
    [5, 'V'], [4, 'IV'], [3, 'III'], [2, 'II'], [1, 'I'],
  ];
  let result = '';
  let remaining = n;
  for (const [value, numeral] of map) {
    while (remaining >= value) {
      result += numeral;
      remaining -= value;
    }
  }
  return result;
}

// -- Tool Executor --

export async function executeSermon(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, name, arguments: rawArgs } = toolCall;

  if (name !== 'sermon_outline') {
    return { toolCallId: id, content: `Unknown tool: ${name}`, isError: true };
  }

  const args = (typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs) as SermonArgs;

  if (!args.title) {
    return { toolCallId: id, content: 'The "title" parameter is required.', isError: true };
  }
  if (!args.passage) {
    return { toolCallId: id, content: 'The "passage" parameter is required.', isError: true };
  }

  const format = args.format || 'markdown';
  const content = format === 'html' ? formatHtml(args) : formatMarkdown(args);

  const pointCount = args.main_points?.length || 0;
  const metadata = JSON.stringify({
    passage: args.passage,
    type: args.type || 'sermon',
    duration_minutes: args.duration_minutes || 30,
    point_count: pointCount,
  });

  return {
    toolCallId: id,
    content: `${content}\n\n<!-- metadata: ${metadata} -->`,
    isError: false,
  };
}

// -- Availability --

export function isSermonAvailable(): boolean {
  return true; // Pure formatter — always available
}

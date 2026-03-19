/**
 * SMALL GROUP / BIBLE STUDY DISCUSSION GUIDE TOOL
 *
 * Creates complete small group Bible study discussion guides using the
 * Observation-Interpretation-Application (OIA) method. The AI generates all
 * discussion content; this tool formats it into a printable, leader-ready guide.
 */
import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const smallGroupTool: UnifiedTool = {
  name: 'small_group_guide',
  description: `Create complete small group Bible study discussion guides using the Observation-Interpretation-Application method.

Use this when:
- User is leading a small group or Bible study
- User needs discussion questions for a passage
- User wants a structured group study plan
- User is preparing for a home group or Sunday school class

Returns a complete discussion guide with icebreaker, passage context, tiered questions (observe/interpret/apply), leader notes, and prayer focus — ready to print and lead.`,
  parameters: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Study title' },
      passage: { type: 'string', description: 'Scripture passage reference (e.g., "Philippians 4:4-9")' },
      passage_text: { type: 'string', description: 'Full text of the passage' },
      group_size: { type: 'string', description: 'Group size: "small" (3-6), "medium" (7-12), "large" (13+). Default: "medium"', enum: ['small', 'medium', 'large'] },
      duration_minutes: { type: 'number', description: 'Session duration in minutes. Default: 60', default: 60 },
      icebreaker: { type: 'object', description: 'Icebreaker: { question: string, time_minutes: number (default 5) }' },
      opening_prayer_prompt: { type: 'string', description: 'Suggested opening prayer theme' },
      context: { type: 'string', description: 'Brief context for the passage (historical, literary, theological)' },
      observation_questions: { type: 'array', description: '"What does the text say?" questions', items: { type: 'string' } },
      interpretation_questions: { type: 'array', description: '"What does it mean?" questions', items: { type: 'string' } },
      application_questions: { type: 'array', description: '"How does it apply to us?" questions', items: { type: 'string' } },
      deeper_dive: { type: 'array', description: 'Deeper study topics. Each: { topic: string, explanation: string, discussion_prompt: string }', items: { type: 'object' } },
      leader_notes: { type: 'array', description: 'Tips for the group leader', items: { type: 'string' } },
      prayer_focus: { type: 'array', description: 'Prayer topics for closing', items: { type: 'string' } },
      next_week_preview: { type: 'string', description: 'Preview of next week\'s study' },
      take_home: { type: 'string', description: 'One key takeaway for the week' },
      format: { type: 'string', description: 'Output format. Default: "markdown"', enum: ['markdown', 'html'] },
    },
    required: ['title', 'passage'],
  },
};

// -- Types --

interface Icebreaker { question: string; time_minutes?: number; }
interface DeeperDive { topic: string; explanation: string; discussion_prompt: string; }
interface SmallGroupArgs {
  title: string; passage: string; passage_text?: string;
  group_size?: 'small' | 'medium' | 'large'; duration_minutes?: number;
  icebreaker?: Icebreaker; opening_prayer_prompt?: string; context?: string;
  observation_questions?: string[]; interpretation_questions?: string[];
  application_questions?: string[]; deeper_dive?: DeeperDive[];
  leader_notes?: string[]; prayer_focus?: string[];
  next_week_preview?: string; take_home?: string; format?: 'markdown' | 'html';
}

// -- Time Allocation --

function computeTime(duration: number, hasDeeper: boolean) {
  const ice = 5, pOpen = 3, read = 5, pClose = 5, deeper = hasDeeper ? 5 : 0;
  const rem = duration - ice - pOpen - read - pClose - deeper;
  const obs = Math.round(rem * 0.25), interp = Math.round(rem * 0.35);
  return { ice, pOpen, read, obs, interp, apply: rem - obs - interp, deeper, pClose };
}

const SIZE_LABELS: Record<string, string> = { small: '3-6 people', medium: '7-12 people', large: '13+ people' };

// -- Markdown Formatter --

function formatMarkdown(a: SmallGroupArgs): string {
  const dur = a.duration_minutes || 60;
  const t = computeTime(dur, (a.deeper_dive?.length || 0) > 0);
  const sz = SIZE_LABELS[a.group_size || 'medium'];
  const L: string[] = [];
  const push = (...s: string[]) => L.push(...s);

  push(`# ${a.title}`, '', `**Passage:** ${a.passage} | **Duration:** ~${dur} min | **Group Size:** ${sz}`, '');
  if (a.passage_text) push('---', '', `> ${a.passage_text}`, `> — *${a.passage}*`, '');
  push('---', '');
  if (a.icebreaker) push(`## Icebreaker (~${a.icebreaker.time_minutes || t.ice} min)`, '', a.icebreaker.question, '');
  if (a.opening_prayer_prompt) push(`## Opening Prayer (~${t.pOpen} min)`, '', a.opening_prayer_prompt, '');
  if (a.context) push('## Background & Context', '', a.context, '');

  const qSections: [string, number, string[] | undefined][] = [
    ['Observation: What Does the Text Say?', t.obs, a.observation_questions],
    ['Interpretation: What Does It Mean?', t.interp, a.interpretation_questions],
    ['Application: How Does It Apply?', t.apply, a.application_questions],
  ];
  for (const [label, mins, qs] of qSections) {
    if (qs && qs.length > 0) {
      push(`## ${label} (~${mins} min)`, '');
      qs.forEach((q, i) => push(`${i + 1}. ${q}`));
      push('');
    }
  }

  if (a.deeper_dive && a.deeper_dive.length > 0) {
    push(`## Deeper Dive (~${t.deeper} min)`, '');
    for (const dd of a.deeper_dive) push(`### ${dd.topic}`, '', dd.explanation, '', `**Discussion:** ${dd.discussion_prompt}`, '');
  }
  if (a.take_home) push('## Key Takeaway', '', `**${a.take_home}**`, '');
  if (a.prayer_focus && a.prayer_focus.length > 0) {
    push(`## Closing Prayer (~${t.pClose} min)`, '', 'Pray together about:');
    a.prayer_focus.forEach((p) => push(`- ${p}`));
    push('');
  }
  if (a.next_week_preview) push('## Next Week', '', a.next_week_preview, '');
  if (a.leader_notes && a.leader_notes.length > 0) {
    push('---', '', '## For the Leader', '');
    a.leader_notes.forEach((n) => push(`- ${n}`));
    push('');
  }
  return L.join('\n');
}

// -- HTML Formatter --

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function hSec(title: string, body: string, color: string): string {
  return `<div style="margin-bottom:20px;"><h2 style="color:${color};border-bottom:2px solid ${color};padding-bottom:6px;font-size:17px;margin-bottom:10px;">${title}</h2>${body}</div>`;
}

function timeTag(min: number): string {
  return `<span style="color:#999;font-weight:normal;font-size:13px;">(~${min} min)</span>`;
}

function formatHtml(a: SmallGroupArgs): string {
  const dur = a.duration_minutes || 60;
  const t = computeTime(dur, (a.deeper_dive?.length || 0) > 0);
  const sz = SIZE_LABELS[a.group_size || 'medium'];
  const S: string[] = [];

  S.push(`<div style="display:flex;gap:16px;flex-wrap:wrap;justify-content:center;color:#666;font-size:13px;margin-bottom:20px;"><span><strong>Passage:</strong> ${esc(a.passage)}</span><span>~${dur} min</span><span>${esc(sz)}</span></div>`);

  if (a.passage_text) {
    S.push(`<div style="background:#f8f5f0;border-left:4px solid #8b6914;padding:14px 18px;margin-bottom:20px;border-radius:0 8px 8px 0;"><p style="font-family:Georgia,serif;font-size:15px;line-height:1.7;color:#3a3020;margin:0;font-style:italic;">${esc(a.passage_text)}</p><p style="text-align:right;margin:6px 0 0;color:#6b5b3a;font-size:13px;">— ${esc(a.passage)}</p></div>`);
  }
  if (a.icebreaker) S.push(hSec(`Icebreaker ${timeTag(a.icebreaker.time_minutes || t.ice)}`, `<p style="line-height:1.6;">${esc(a.icebreaker.question)}</p>`, '#e67e22'));
  if (a.opening_prayer_prompt) S.push(hSec(`Opening Prayer ${timeTag(t.pOpen)}`, `<p style="line-height:1.6;font-style:italic;">${esc(a.opening_prayer_prompt)}</p>`, '#8e44ad'));
  if (a.context) S.push(hSec('Background &amp; Context', `<p style="line-height:1.7;color:#333;">${esc(a.context)}</p>`, '#7f8c8d'));

  const oiaData: [string, number, string[] | undefined, string][] = [
    ['Observation: What Does the Text Say?', t.obs, a.observation_questions, '#2980b9'],
    ['Interpretation: What Does It Mean?', t.interp, a.interpretation_questions, '#8e44ad'],
    ['Application: How Does It Apply?', t.apply, a.application_questions, '#27ae60'],
  ];
  for (const [label, mins, qs, color] of oiaData) {
    if (qs && qs.length > 0) {
      const items = qs.map((q, i) => `<li style="margin-bottom:8px;">${i + 1}. ${esc(q)}</li>`).join('');
      S.push(hSec(`${esc(label)} ${timeTag(mins)}`, `<ol style="padding-left:20px;line-height:1.6;">${items}</ol>`, color));
    }
  }
  if (a.deeper_dive && a.deeper_dive.length > 0) {
    const dd = a.deeper_dive.map((d) => `<div style="margin-bottom:12px;"><h4 style="color:#444;margin:0 0 6px;">${esc(d.topic)}</h4><p style="line-height:1.6;margin:0 0 6px;">${esc(d.explanation)}</p><p style="margin:0;"><strong>Discussion:</strong> ${esc(d.discussion_prompt)}</p></div>`).join('');
    S.push(hSec(`Deeper Dive ${timeTag(t.deeper)}`, dd, '#c0392b'));
  }
  if (a.take_home) S.push(`<div style="background:#e8f6ef;border:1px solid #a3d9c0;padding:14px 18px;border-radius:8px;margin-bottom:20px;text-align:center;"><h3 style="color:#1a7a4c;margin:0 0 6px;font-size:15px;">Key Takeaway</h3><p style="margin:0;color:#2d5a3f;font-size:15px;font-weight:600;">${esc(a.take_home)}</p></div>`);
  if (a.prayer_focus && a.prayer_focus.length > 0) {
    const items = a.prayer_focus.map((p) => `<li style="margin-bottom:6px;">${esc(p)}</li>`).join('');
    S.push(hSec(`Closing Prayer ${timeTag(t.pClose)}`, `<p style="margin-bottom:8px;">Pray together about:</p><ul style="padding-left:20px;line-height:1.6;">${items}</ul>`, '#8e44ad'));
  }
  if (a.next_week_preview) S.push(`<div style="background:#f0f0f0;padding:12px 16px;border-radius:8px;margin-bottom:20px;"><h3 style="color:#555;margin:0 0 6px;font-size:14px;">Next Week</h3><p style="margin:0;color:#333;font-size:14px;">${esc(a.next_week_preview)}</p></div>`);
  if (a.leader_notes && a.leader_notes.length > 0) {
    const items = a.leader_notes.map((n) => `<li style="margin-bottom:6px;">${esc(n)}</li>`).join('');
    S.push(`<div style="border-top:2px dashed #ccc;padding-top:16px;margin-top:24px;"><h2 style="color:#999;font-size:16px;margin-bottom:10px;">For the Leader</h2><ul style="padding-left:20px;color:#666;line-height:1.6;font-size:14px;">${items}</ul></div>`);
  }

  return `<div style="font-family:'Segoe UI',Tahoma,sans-serif;max-width:720px;margin:0 auto;padding:24px;background:#fff;border:1px solid #ddd;border-radius:12px;"><h1 style="color:#2c3e50;text-align:center;margin:0 0 8px;font-size:24px;">${esc(a.title)}</h1>${S.join('\n')}</div>`;
}

// -- Tool Executor --

export async function executeSmallGroup(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, name, arguments: rawArgs } = toolCall;
  if (name !== 'small_group_guide') {
    return { toolCallId: id, content: `Unknown tool: ${name}`, isError: true };
  }
  const args = (typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs) as SmallGroupArgs;
  if (!args.title) return { toolCallId: id, content: 'The "title" parameter is required.', isError: true };
  if (!args.passage) return { toolCallId: id, content: 'The "passage" parameter is required.', isError: true };

  const content = (args.format === 'html' ? formatHtml : formatMarkdown)(args);
  const totalQ = (args.observation_questions?.length || 0) + (args.interpretation_questions?.length || 0) + (args.application_questions?.length || 0);
  const meta = JSON.stringify({ passage: args.passage, duration_minutes: args.duration_minutes || 60, group_size: args.group_size || 'medium', question_count: totalQ });
  return { toolCallId: id, content: `${content}\n\n<!-- metadata: ${meta} -->`, isError: false };
}

// -- Availability --

export function isSmallGroupAvailable(): boolean {
  return true; // Pure formatter — always available
}

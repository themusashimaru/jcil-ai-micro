/**
 * MEETING MINUTES TOOL — Structured meeting minutes document generator.
 * Produces professional meeting minutes with agenda, decisions, action items,
 * and attendee tracking.
 * No external dependencies. Created: 2026-03-19
 */
import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// TYPES
// ============================================================================

interface AgendaItem {
  topic: string;
  discussion: string;
  decision?: string;
}

type ActionStatus = 'pending' | 'in_progress' | 'completed';

interface ActionItem {
  task: string;
  assignee: string;
  deadline: string;
  status?: ActionStatus;
}

// ============================================================================
// HELPERS
// ============================================================================

function esc(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function statusLabel(s: ActionStatus): string {
  switch (s) {
    case 'completed': return 'Completed';
    case 'in_progress': return 'In Progress';
    default: return 'Pending';
  }
}

// ============================================================================
// MARKDOWN FORMATTER
// ============================================================================

function formatMarkdown(
  title: string, date: string, attendees: string[], time: string,
  location: string, facilitator: string, noteTaker: string,
  agendaItems: AgendaItem[], actionItems: ActionItem[],
  nextMeeting: string, notes: string,
): string {
  const L: string[] = [];
  L.push(`# ${title}`, '');
  L.push('| Field | Value |', '|-------|-------|');
  L.push(`| **Date** | ${date} |`);
  if (time) L.push(`| **Time** | ${time} |`);
  if (location) L.push(`| **Location** | ${location} |`);
  if (facilitator) L.push(`| **Facilitator** | ${facilitator} |`);
  if (noteTaker) L.push(`| **Note Taker** | ${noteTaker} |`);
  L.push('');

  L.push('## Attendees', '');
  for (const a of attendees) L.push(`- ${a}`);
  L.push('');

  if (agendaItems.length > 0) {
    L.push('## Agenda & Discussion', '');
    for (let i = 0; i < agendaItems.length; i++) {
      const item = agendaItems[i];
      L.push(`### ${i + 1}. ${item.topic}`, '');
      L.push(`**Discussion:** ${item.discussion}`, '');
      if (item.decision) L.push(`**Decision:** ${item.decision}`, '');
    }
  }

  if (actionItems.length > 0) {
    L.push('## Action Items', '');
    L.push('| # | Task | Assignee | Deadline | Status |',
      '|---|------|----------|----------|--------|');
    for (let i = 0; i < actionItems.length; i++) {
      const a = actionItems[i];
      L.push(`| ${i + 1} | ${a.task} | ${a.assignee} | ${a.deadline} | ${statusLabel(a.status ?? 'pending')} |`);
    }
    L.push('');
  }

  if (nextMeeting) L.push(`## Next Meeting`, '', nextMeeting, '');
  if (notes) L.push('## Additional Notes', '', notes, '');

  return L.join('\n');
}

// ============================================================================
// HTML FORMATTER
// ============================================================================

const CSS = [
  'body{font-family:system-ui,sans-serif;max-width:900px;margin:0 auto;padding:20px;color:#e0e0e0;background:#121225}',
  'h1{color:#c0c8e0;border-bottom:3px solid #1a1a2e;padding-bottom:10px;text-align:center}',
  'h2{color:#a0b0d0;margin-top:28px;border-bottom:1px solid #2a2a4e;padding-bottom:6px}',
  'h3{color:#8090b0;margin-top:16px}',
  '.meta{display:grid;grid-template-columns:1fr 1fr;gap:8px 24px;background:#1a1a2e;padding:16px 20px;border-radius:8px;margin-bottom:24px}',
  '.meta-item{display:flex;gap:8px}.meta-label{font-weight:700;color:#8090b0;min-width:120px}',
  '.meta-value{color:#c0c8e0}',
  '.attendee-list{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}',
  '.attendee{background:#1a1a2e;color:#c0c8e0;padding:6px 14px;border-radius:20px;font-size:.9em;border:1px solid #2a2a4e}',
  '.agenda-card{border:1px solid #2a2a4e;border-radius:8px;padding:16px;margin:12px 0;background:#16162a}',
  '.agenda-card h3{margin-top:0;color:#c0c8e0}',
  '.agenda-discussion{color:#b0b8d0;margin:8px 0}',
  '.agenda-decision{background:#1a2a1a;border-left:4px solid #2d8a4e;padding:8px 14px;border-radius:4px;margin:8px 0;color:#80d0a0}',
  'table{width:100%;border-collapse:collapse;margin:12px 0}',
  'th,td{border:1px solid #2a2a4e;padding:8px 12px;text-align:left}',
  'th{background:#1a1a2e;color:#c0c8e0}tr:nth-child(even){background:#16162a}',
  '.status{padding:3px 10px;border-radius:12px;font-size:.85em;font-weight:600;display:inline-block}',
  '.status-completed{background:#1a3a1a;color:#60d060}',
  '.status-in_progress{background:#3a3a1a;color:#d0d060}',
  '.status-pending{background:#2a2a3a;color:#9090a0}',
  '.next-meeting{background:#1a1a2e;padding:14px 20px;border-radius:8px;margin-top:20px;border-left:4px solid #4a5a8a;color:#c0c8e0}',
  '.notes{background:#16162a;padding:14px 20px;border-radius:8px;margin-top:16px;color:#b0b8d0;font-style:italic}',
  '@media print{body{background:#fff;color:#1a1a1a;padding:0}h1{color:#1a1a2e}h2{color:#2a2a4e}',
  '.meta,.agenda-card,.next-meeting,.notes{background:#f5f5fa;border-color:#ccc;color:#1a1a1a}',
  '.attendee{background:#e8e8f0;color:#1a1a2e;border-color:#ccc}th{background:#1a1a2e;color:#fff}}',
].join('');

function formatHtml(
  title: string, date: string, attendees: string[], time: string,
  location: string, facilitator: string, noteTaker: string,
  agendaItems: AgendaItem[], actionItems: ActionItem[],
  nextMeeting: string, notes: string,
): string {
  const h: string[] = [];
  h.push(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>${esc(title)}</title>`);
  h.push(`<style>${CSS}</style></head><body>`);
  h.push(`<h1>${esc(title)}</h1>`);

  h.push('<div class="meta">');
  h.push(`<div class="meta-item"><span class="meta-label">Date:</span><span class="meta-value">${esc(date)}</span></div>`);
  if (time) h.push(`<div class="meta-item"><span class="meta-label">Time:</span><span class="meta-value">${esc(time)}</span></div>`);
  if (location) h.push(`<div class="meta-item"><span class="meta-label">Location:</span><span class="meta-value">${esc(location)}</span></div>`);
  if (facilitator) h.push(`<div class="meta-item"><span class="meta-label">Facilitator:</span><span class="meta-value">${esc(facilitator)}</span></div>`);
  if (noteTaker) h.push(`<div class="meta-item"><span class="meta-label">Note Taker:</span><span class="meta-value">${esc(noteTaker)}</span></div>`);
  h.push('</div>');

  h.push('<h2>Attendees</h2><div class="attendee-list">');
  for (const a of attendees) h.push(`<span class="attendee">${esc(a)}</span>`);
  h.push('</div>');

  if (agendaItems.length > 0) {
    h.push('<h2>Agenda &amp; Discussion</h2>');
    for (let i = 0; i < agendaItems.length; i++) {
      const item = agendaItems[i];
      h.push(`<div class="agenda-card"><h3>${i + 1}. ${esc(item.topic)}</h3>`);
      h.push(`<div class="agenda-discussion">${esc(item.discussion)}</div>`);
      if (item.decision) h.push(`<div class="agenda-decision"><strong>Decision:</strong> ${esc(item.decision)}</div>`);
      h.push('</div>');
    }
  }

  if (actionItems.length > 0) {
    h.push('<h2>Action Items</h2>');
    h.push('<table><thead><tr><th>#</th><th>Task</th><th>Assignee</th><th>Deadline</th><th>Status</th></tr></thead><tbody>');
    for (let i = 0; i < actionItems.length; i++) {
      const a = actionItems[i];
      const st = a.status ?? 'pending';
      h.push(`<tr><td>${i + 1}</td><td>${esc(a.task)}</td><td>${esc(a.assignee)}</td><td>${esc(a.deadline)}</td>`);
      h.push(`<td><span class="status status-${st}">${statusLabel(st)}</span></td></tr>`);
    }
    h.push('</tbody></table>');
  }

  if (nextMeeting) h.push(`<div class="next-meeting"><strong>Next Meeting:</strong> ${esc(nextMeeting)}</div>`);
  if (notes) h.push(`<div class="notes"><strong>Additional Notes:</strong> ${esc(notes)}</div>`);

  h.push('</body></html>');
  return h.join('\n');
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const meetingMinutesTool: UnifiedTool = {
  name: 'create_meeting_minutes',
  description: `Generate structured meeting minutes with agenda, decisions, action items, and attendee tracking.
Use this when the user needs to document a meeting, record decisions, or track action items from a discussion.
Returns professional meeting minutes with attendee list, agenda discussion, decision records, and action item tracking.`,
  parameters: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Meeting title (e.g., "Q1 Product Review")' },
      date: { type: 'string', description: 'Meeting date (e.g., "2026-03-19")' },
      attendees: { type: 'array', items: { type: 'string' }, description: 'List of attendee names' },
      time: { type: 'string', description: 'Meeting time (e.g., "10:00 AM - 11:30 AM")' },
      location: { type: 'string', description: 'Meeting location or virtual link' },
      facilitator: { type: 'string', description: 'Meeting facilitator name' },
      note_taker: { type: 'string', description: 'Person taking notes' },
      agenda_items: {
        type: 'array', description: 'Agenda topics with discussion and decisions',
        items: {
          type: 'object', required: ['topic', 'discussion'],
          properties: {
            topic: { type: 'string', description: 'Agenda topic title' },
            discussion: { type: 'string', description: 'Summary of discussion' },
            decision: { type: 'string', description: 'Decision reached (if any)' },
          },
        },
      },
      action_items: {
        type: 'array', description: 'Tasks assigned during the meeting',
        items: {
          type: 'object', required: ['task', 'assignee', 'deadline'],
          properties: {
            task: { type: 'string', description: 'Task description' },
            assignee: { type: 'string', description: 'Person responsible' },
            deadline: { type: 'string', description: 'Due date' },
            status: { type: 'string', enum: ['pending', 'in_progress', 'completed'], description: 'Task status. Default: "pending"' },
          },
        },
      },
      next_meeting: { type: 'string', description: 'Next meeting date/time/details' },
      notes: { type: 'string', description: 'Additional notes or remarks' },
      format: { type: 'string', enum: ['markdown', 'html'], description: 'Output format. Default: "markdown"' },
    },
    required: ['title', 'date', 'attendees'],
  },
};

// ============================================================================
// AVAILABILITY CHECK
// ============================================================================

export function isMeetingMinutesAvailable(): boolean {
  return true;
}

// ============================================================================
// TOOL EXECUTOR
// ============================================================================

export async function executeMeetingMinutes(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const args = toolCall.arguments as {
    title: string;
    date: string;
    attendees: string[];
    time?: string;
    location?: string;
    facilitator?: string;
    note_taker?: string;
    agenda_items?: AgendaItem[];
    action_items?: ActionItem[];
    next_meeting?: string;
    notes?: string;
    format?: 'markdown' | 'html';
  };

  if (!args.title?.trim()) {
    return { toolCallId: toolCall.id, content: 'Error: title parameter is required', isError: true };
  }
  if (!args.date?.trim()) {
    return { toolCallId: toolCall.id, content: 'Error: date parameter is required', isError: true };
  }
  if (!Array.isArray(args.attendees) || args.attendees.length === 0) {
    return { toolCallId: toolCall.id, content: 'Error: attendees array is required and must not be empty', isError: true };
  }

  if (args.agenda_items) {
    for (let i = 0; i < args.agenda_items.length; i++) {
      const item = args.agenda_items[i];
      if (!item.topic || !item.discussion) {
        return {
          toolCallId: toolCall.id,
          content: `Error: agenda item at index ${i} is missing required fields (topic, discussion)`,
          isError: true,
        };
      }
    }
  }

  if (args.action_items) {
    for (let i = 0; i < args.action_items.length; i++) {
      const item = args.action_items[i];
      if (!item.task || !item.assignee || !item.deadline) {
        return {
          toolCallId: toolCall.id,
          content: `Error: action item at index ${i} is missing required fields (task, assignee, deadline)`,
          isError: true,
        };
      }
    }
  }

  const fmt = args.format ?? 'markdown';
  const time = args.time ?? '';
  const location = args.location ?? '';
  const facilitator = args.facilitator ?? '';
  const noteTaker = args.note_taker ?? '';
  const agendaItems = args.agenda_items ?? [];
  const actionItems = args.action_items ?? [];
  const nextMeeting = args.next_meeting ?? '';
  const notes = args.notes ?? '';

  try {
    const formatted = fmt === 'html'
      ? formatHtml(args.title, args.date, args.attendees, time, location, facilitator, noteTaker, agendaItems, actionItems, nextMeeting, notes)
      : formatMarkdown(args.title, args.date, args.attendees, time, location, facilitator, noteTaker, agendaItems, actionItems, nextMeeting, notes);

    return {
      toolCallId: toolCall.id,
      content: JSON.stringify({
        success: true,
        message: `Meeting minutes created: ${args.title}`,
        format: fmt,
        formatted_output: formatted,
        summary: {
          title: args.title,
          date: args.date,
          attendee_count: args.attendees.length,
          agenda_item_count: agendaItems.length,
          action_item_count: actionItems.length,
          decisions_count: agendaItems.filter((a) => !!a.decision).length,
          has_next_meeting: !!nextMeeting,
        },
      }),
    };
  } catch (error) {
    return {
      toolCallId: toolCall.id,
      content: `Error generating meeting minutes: ${(error as Error).message}`,
      isError: true,
    };
  }
}

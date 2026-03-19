/**
 * EVENT PLANNER TOOL — Comprehensive event planning with timeline, vendors,
 * budget tracking, guest management, and task checklists.
 * No external dependencies. Created: 2026-03-19
 */
import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

type EventType = 'wedding' | 'conference' | 'party' | 'fundraiser' | 'corporate' | 'other';
type VendorStatus = 'confirmed' | 'pending' | 'cancelled';
type TaskStatus = 'done' | 'pending' | 'overdue';

interface TimelineEntry { time: string; activity: string; responsible?: string; notes?: string }
interface Vendor { name: string; service: string; contact?: string; cost?: string; status: VendorStatus }
interface Task { task: string; assignee?: string; due_date?: string; status: TaskStatus }
interface BudgetCategory { name: string; allocated: string; spent: string }
interface Budget { total: string; categories: BudgetCategory[] }

function esc(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function cap(s: string): string { return s.charAt(0).toUpperCase() + s.slice(1); }

function parseCurrency(s: string): number { return parseFloat(s.replace(/[^0-9.-]/g, '')) || 0; }

function taskMarker(s: TaskStatus): string { return s === 'done' ? '[x]' : s === 'overdue' ? '[!]' : '[ ]'; }

function vendorLabel(s: VendorStatus): string { return cap(s); }

// ============================================================================
// MARKDOWN FORMATTER
// ============================================================================

function formatMarkdown(
  name: string, type: EventType, date: string, venue: string | undefined,
  guests: number | undefined, timeline: TimelineEntry[], vendors: Vendor[],
  tasks: Task[], budget: Budget | undefined, notes: string | undefined,
): string {
  const L: string[] = [];
  L.push(`# ${name}`, '', `**Type:** ${cap(type)}`, `**Date:** ${date}`);
  if (venue) L.push(`**Venue:** ${venue}`);
  if (guests) L.push(`**Expected Guests:** ${guests}`);
  L.push('', '## Day-of Timeline', '', '| Time | Activity | Responsible | Notes |',
    '|------|----------|-------------|-------|');
  for (const t of timeline) {
    L.push(`| ${t.time} | ${t.activity} | ${t.responsible ?? '-'} | ${t.notes ?? '-'} |`);
  }
  L.push('');
  if (budget) {
    const totalNum = parseCurrency(budget.total);
    let totalSpent = 0;
    L.push('## Budget', '', '| Category | Allocated | Spent | Remaining |', '|----------|-----------|-------|-----------|');
    for (const c of budget.categories) {
      const alloc = parseCurrency(c.allocated), spent = parseCurrency(c.spent);
      totalSpent += spent;
      L.push(`| ${c.name} | ${c.allocated} | ${c.spent} | $${(alloc - spent).toFixed(2)} |`);
    }
    const rem = totalNum - totalSpent;
    const label = rem >= 0 ? `$${rem.toFixed(2)} remaining` : `$${Math.abs(rem).toFixed(2)} over budget`;
    L.push(`| **Total** | **${budget.total}** | **$${totalSpent.toFixed(2)}** | **${label}** |`, '');
  }
  if (vendors.length > 0) {
    L.push('## Vendors', '', '| Vendor | Service | Contact | Cost | Status |',
      '|--------|---------|---------|------|--------|');
    for (const v of vendors)
      L.push(`| ${v.name} | ${v.service} | ${v.contact ?? '-'} | ${v.cost ?? '-'} | ${vendorLabel(v.status)} |`);
    L.push('');
  }
  if (tasks.length > 0) {
    L.push('## Task Checklist', '');
    for (const t of tasks) {
      const extra = [t.assignee ? `(${t.assignee})` : '', t.due_date ? `— due ${t.due_date}` : ''].filter(Boolean).join(' ');
      L.push(`- ${taskMarker(t.status)} ${t.task}${extra ? ' ' + extra : ''}`);
    }
    L.push('');
  }
  if (notes) L.push('## Notes', '', `> ${notes}`, '');
  return L.join('\n');
}

// ============================================================================
// HTML FORMATTER
// ============================================================================

const CSS = [
  'body{font-family:system-ui,sans-serif;max-width:900px;margin:0 auto;padding:20px;color:#1a1a1a}',
  'h1{color:#5a1a5e;border-bottom:2px solid #5a1a5e;padding-bottom:8px}',
  'h2{color:#6b2b6f;margin-top:28px}',
  '.meta{background:#f5eaf6;padding:12px 16px;border-radius:6px;margin-bottom:20px}',
  '.meta span{margin-right:20px}',
  '.tl{position:relative;padding-left:32px;margin:16px 0}',
  '.tl::before{content:"";position:absolute;left:12px;top:0;bottom:0;width:2px;background:#5a1a5e}',
  '.tl-item{position:relative;margin-bottom:16px}',
  '.tl-item::before{content:"";position:absolute;left:-24px;top:6px;width:10px;height:10px;border-radius:50%;background:#5a1a5e}',
  '.time-badge{display:inline-block;background:#5a1a5e;color:#fff;padding:2px 8px;border-radius:4px;font-size:.85em;margin-bottom:4px}',
  '.tl-resp{font-size:.85em;color:#666}.tl-note{font-size:.85em;color:#888;font-style:italic}',
  'table{width:100%;border-collapse:collapse;margin:12px 0}',
  'th,td{border:1px solid #ddd;padding:8px 12px;text-align:left}',
  'th{background:#5a1a5e;color:#fff}tr:nth-child(even){background:#faf5fa}',
  '.progress-wrap{background:#eee;border-radius:4px;height:18px;position:relative;overflow:hidden}',
  '.progress-bar{height:100%;border-radius:4px;background:#5a1a5e;transition:width .3s}',
  '.progress-over{background:#c0392b}',
  '.vendor-card{border:1px solid #ddd;border-radius:8px;padding:12px 16px;margin:8px 0;display:flex;justify-content:space-between;align-items:center}',
  '.vendor-info{flex:1}.vendor-info strong{display:block;margin-bottom:2px}.vendor-info small{color:#666}',
  '.badge{padding:3px 10px;border-radius:12px;font-size:.8em;font-weight:600;color:#fff}',
  '.badge-confirmed{background:#27ae60}.badge-pending{background:#e67e22}.badge-cancelled{background:#c0392b}',
  '.task-list{list-style:none;padding:0}.task-list li{padding:6px 0;display:flex;align-items:center;gap:8px}',
  '.task-list input[type=checkbox]{width:18px;height:18px}',
  '.task-overdue{color:#c0392b;font-weight:600}.task-meta{font-size:.85em;color:#666}',
  '.notes{background:#f5eaf6;padding:12px 16px;border-radius:6px;border-left:4px solid #5a1a5e;margin-top:20px}',
  '@media print{body{padding:0}.tl{break-inside:avoid}.vendor-card{break-inside:avoid}}',
].join('');

function formatHtml(
  name: string, type: EventType, date: string, venue: string | undefined,
  guests: number | undefined, timeline: TimelineEntry[], vendors: Vendor[],
  tasks: Task[], budget: Budget | undefined, notes: string | undefined,
): string {
  const h: string[] = [];
  h.push(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>${esc(name)}</title>`);
  h.push(`<style>${CSS}</style></head><body>`);
  h.push(`<h1>${esc(name)}</h1>`);
  h.push(`<div class="meta"><span><strong>Type:</strong> ${esc(cap(type))}</span>`);
  h.push(`<span><strong>Date:</strong> ${esc(date)}</span>`);
  if (venue) h.push(`<span><strong>Venue:</strong> ${esc(venue)}</span>`);
  if (guests) h.push(`<span><strong>Guests:</strong> ${guests}</span>`);
  h.push('</div>');
  // Timeline stepper
  h.push('<h2>Day-of Timeline</h2><div class="tl">');
  for (const t of timeline) {
    h.push(`<div class="tl-item"><div class="time-badge">${esc(t.time)}</div>`);
    h.push(`<div><strong>${esc(t.activity)}</strong></div>`);
    if (t.responsible) h.push(`<div class="tl-resp">Responsible: ${esc(t.responsible)}</div>`);
    if (t.notes) h.push(`<div class="tl-note">${esc(t.notes)}</div>`);
    h.push('</div>');
  }
  h.push('</div>');
  // Budget with progress bars
  if (budget) {
    const totalNum = parseCurrency(budget.total);
    let totalSpent = 0;
    h.push('<h2>Budget</h2><table><thead><tr><th>Category</th><th>Allocated</th><th>Spent</th><th>Progress</th></tr></thead><tbody>');
    for (const c of budget.categories) {
      const alloc = parseCurrency(c.allocated), spent = parseCurrency(c.spent);
      totalSpent += spent;
      const pct = alloc > 0 ? Math.min((spent / alloc) * 100, 100) : 0;
      const over = spent > alloc;
      h.push(`<tr><td>${esc(c.name)}</td><td>${esc(c.allocated)}</td><td>${esc(c.spent)}</td>`);
      h.push(`<td><div class="progress-wrap"><div class="progress-bar${over ? ' progress-over' : ''}" style="width:${pct}%"></div></div></td></tr>`);
    }
    const rem = totalNum - totalSpent;
    const label = rem >= 0 ? `$${rem.toFixed(2)} remaining` : `$${Math.abs(rem).toFixed(2)} over budget`;
    h.push(`<tr style="font-weight:700"><td>Total</td><td>${esc(budget.total)}</td><td>$${totalSpent.toFixed(2)}</td><td>${label}</td></tr>`);
    h.push('</tbody></table>');
  }
  // Vendor cards
  if (vendors.length > 0) {
    h.push('<h2>Vendors</h2>');
    for (const v of vendors) {
      h.push(`<div class="vendor-card"><div class="vendor-info"><strong>${esc(v.name)}</strong>`);
      h.push(`<small>${esc(v.service)}${v.contact ? ' &middot; ' + esc(v.contact) : ''}${v.cost ? ' &middot; ' + esc(v.cost) : ''}</small>`);
      h.push(`</div><span class="badge badge-${v.status}">${cap(v.status)}</span></div>`);
    }
  }
  // Task list with checkboxes
  if (tasks.length > 0) {
    h.push('<h2>Task Checklist</h2><ul class="task-list">');
    for (const t of tasks) {
      const checked = t.status === 'done' ? ' checked' : '';
      const cls = t.status === 'overdue' ? ' class="task-overdue"' : '';
      const meta: string[] = [];
      if (t.assignee) meta.push(esc(t.assignee));
      if (t.due_date) meta.push(`due ${esc(t.due_date)}`);
      h.push(`<li><input type="checkbox"${checked}><span${cls}>${esc(t.task)}</span>`);
      if (meta.length) h.push(`<span class="task-meta">(${meta.join(' &middot; ')})</span>`);
      h.push('</li>');
    }
    h.push('</ul>');
  }
  if (notes) h.push(`<div class="notes"><strong>Notes:</strong> ${esc(notes)}</div>`);
  h.push('</body></html>');
  return h.join('\n');
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const eventPlannerTool: UnifiedTool = {
  name: 'plan_event',
  description: `Create comprehensive event plans with timelines, vendor tracking, budgets, and task checklists.

Use this when:
- User is planning a wedding, conference, party, fundraiser, or corporate event
- User needs a day-of timeline or event schedule
- User wants to track vendors, budgets, or tasks for an event
- User needs an organized event plan to print or share

Returns a complete event plan with timeline, vendor status, budget breakdown, and task checklist.`,
  parameters: {
    type: 'object',
    properties: {
      event_name: { type: 'string', description: 'Name of the event' },
      event_type: {
        type: 'string', description: 'Type of event',
        enum: ['wedding', 'conference', 'party', 'fundraiser', 'corporate', 'other'],
      },
      date: { type: 'string', description: 'Event date (e.g., "2026-06-15")' },
      venue: { type: 'string', description: 'Venue name or location' },
      expected_guests: { type: 'number', description: 'Expected guest count' },
      budget: {
        type: 'object', description: 'Budget with total and category breakdowns',
        properties: {
          total: { type: 'string', description: 'Total budget (e.g., "$10,000")' },
          categories: {
            type: 'array', items: {
              type: 'object', required: ['name', 'allocated', 'spent'],
              properties: {
                name: { type: 'string', description: 'Category name' },
                allocated: { type: 'string', description: 'Allocated amount' },
                spent: { type: 'string', description: 'Amount spent so far' },
              },
            },
          },
        },
      },
      timeline: {
        type: 'array', description: 'Day-of timeline entries',
        items: {
          type: 'object', required: ['time', 'activity'],
          properties: {
            time: { type: 'string', description: 'Time slot (e.g., "10:00 AM")' },
            activity: { type: 'string', description: 'Activity or event' },
            responsible: { type: 'string', description: 'Person responsible' },
            notes: { type: 'string', description: 'Additional notes' },
          },
        },
      },
      vendors: {
        type: 'array', description: 'Vendor list with status tracking',
        items: {
          type: 'object', required: ['name', 'service', 'status'],
          properties: {
            name: { type: 'string', description: 'Vendor name' },
            service: { type: 'string', description: 'Service provided' },
            contact: { type: 'string', description: 'Contact info' },
            cost: { type: 'string', description: 'Cost' },
            status: { type: 'string', enum: ['confirmed', 'pending', 'cancelled'], description: 'Vendor status' },
          },
        },
      },
      tasks: {
        type: 'array', description: 'Task checklist with status',
        items: {
          type: 'object', required: ['task', 'status'],
          properties: {
            task: { type: 'string', description: 'Task description' },
            assignee: { type: 'string', description: 'Person assigned' },
            due_date: { type: 'string', description: 'Due date' },
            status: { type: 'string', enum: ['done', 'pending', 'overdue'], description: 'Task status' },
          },
        },
      },
      notes: { type: 'string', description: 'Additional notes' },
      format: { type: 'string', enum: ['markdown', 'html'], description: 'Output format. Default: "markdown"' },
    },
    required: ['event_name', 'event_type', 'date', 'timeline'],
  },
};

export function isEventPlannerAvailable(): boolean { return true; }

// ============================================================================
// TOOL EXECUTOR
// ============================================================================

export async function executeEventPlanner(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const args = toolCall.arguments as {
    event_name: string; event_type: EventType; date: string; venue?: string;
    expected_guests?: number; budget?: Budget; timeline: TimelineEntry[];
    vendors?: Vendor[]; tasks?: Task[]; notes?: string; format?: 'markdown' | 'html';
  };

  if (!args.event_name?.trim())
    return { toolCallId: toolCall.id, content: 'Error: event_name parameter is required', isError: true };
  if (!args.event_type)
    return { toolCallId: toolCall.id, content: 'Error: event_type parameter is required', isError: true };
  if (!args.date)
    return { toolCallId: toolCall.id, content: 'Error: date parameter is required', isError: true };
  if (!Array.isArray(args.timeline) || args.timeline.length === 0)
    return { toolCallId: toolCall.id, content: 'Error: timeline array is required and must not be empty', isError: true };

  for (let i = 0; i < args.timeline.length; i++) {
    const t = args.timeline[i];
    if (!t.time || !t.activity)
      return { toolCallId: toolCall.id, content: `Error: timeline entry at index ${i} is missing required fields (time, activity)`, isError: true };
  }
  if (args.vendors) {
    for (let i = 0; i < args.vendors.length; i++) {
      const v = args.vendors[i];
      if (!v.name || !v.service || !v.status)
        return { toolCallId: toolCall.id, content: `Error: vendor at index ${i} is missing required fields (name, service, status)`, isError: true };
    }
  }
  if (args.tasks) {
    for (let i = 0; i < args.tasks.length; i++) {
      const t = args.tasks[i];
      if (!t.task || !t.status)
        return { toolCallId: toolCall.id, content: `Error: task at index ${i} is missing required fields (task, status)`, isError: true };
    }
  }
  if (args.budget) {
    if (!args.budget.total || !Array.isArray(args.budget.categories))
      return { toolCallId: toolCall.id, content: 'Error: budget must include total and categories array', isError: true };
    for (let i = 0; i < args.budget.categories.length; i++) {
      const c = args.budget.categories[i];
      if (!c.name || !c.allocated || !c.spent)
        return { toolCallId: toolCall.id, content: `Error: budget category at index ${i} is missing required fields (name, allocated, spent)`, isError: true };
    }
  }

  const fmt = args.format ?? 'markdown';
  const vendors = args.vendors ?? [];
  const tasks = args.tasks ?? [];
  const tasksCompleted = tasks.filter((t) => t.status === 'done').length;

  try {
    const formatted = fmt === 'html'
      ? formatHtml(args.event_name, args.event_type, args.date, args.venue, args.expected_guests, args.timeline, vendors, tasks, args.budget, args.notes)
      : formatMarkdown(args.event_name, args.event_type, args.date, args.venue, args.expected_guests, args.timeline, vendors, tasks, args.budget, args.notes);

    return {
      toolCallId: toolCall.id,
      content: JSON.stringify({
        success: true,
        message: `Event plan created: ${args.event_name} (${cap(args.event_type)})`,
        format: fmt,
        formatted_output: formatted,
        summary: {
          event_name: args.event_name, event_type: args.event_type, date: args.date,
          venue: args.venue ?? null, expected_guests: args.expected_guests ?? null,
          timeline_items: args.timeline.length, vendor_count: vendors.length,
          task_count: tasks.length, tasks_completed: tasksCompleted,
          budget_total: args.budget?.total ?? null,
        },
      }),
    };
  } catch (error) {
    return { toolCallId: toolCall.id, content: `Error generating event plan: ${(error as Error).message}`, isError: true };
  }
}

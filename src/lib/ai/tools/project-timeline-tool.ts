/**
 * PROJECT TIMELINE TOOL — Gantt chart and project plan generator.
 * Builds structured project plans with task tables, milestone markers,
 * and text-based or HTML Gantt charts.
 * No external dependencies. Created: 2026-03-19
 */
import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// TYPES
// ============================================================================

type TaskStatus = 'not_started' | 'in_progress' | 'completed' | 'blocked';

interface ProjectTask {
  name: string;
  start: string;
  end: string;
  assignee?: string;
  status?: TaskStatus;
  dependencies?: string;
  progress?: number;
  category?: string;
}

interface Milestone {
  name: string;
  date: string;
  status?: TaskStatus;
}

// ============================================================================
// HELPERS
// ============================================================================

function esc(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function daysBetween(a: string, b: string): number {
  return Math.max(1, Math.ceil((new Date(b).getTime() - new Date(a).getTime()) / 86400000));
}

function dayOffset(base: string, date: string): number {
  return Math.max(0, Math.floor((new Date(date).getTime() - new Date(base).getTime()) / 86400000));
}

function statusLabel(s: TaskStatus): string {
  const labels: Record<TaskStatus, string> = {
    not_started: 'Not Started', in_progress: 'In Progress', completed: 'Completed', blocked: 'Blocked',
  };
  return labels[s] ?? 'Not Started';
}

function isValidDate(d: string): boolean {
  return !isNaN(new Date(d).getTime());
}

// ============================================================================
// MARKDOWN FORMATTER
// ============================================================================

function formatMarkdown(
  name: string, startDate: string, endDate: string | undefined,
  tasks: ProjectTask[], milestones: Milestone[],
): string {
  const L: string[] = [];
  const projEnd = endDate ?? tasks.reduce((latest, t) => t.end > latest ? t.end : latest, tasks[0].end);
  const dur = daysBetween(startDate, projEnd);

  L.push(`# ${name}`, '', `**Start:** ${startDate}  `);
  L.push(`**End:** ${projEnd}  `);
  L.push(`**Duration:** ${dur} days`, '');

  // Task table
  L.push('## Tasks', '');
  L.push('| Task | Assignee | Start | End | Status | Progress |');
  L.push('|------|----------|-------|-----|--------|----------|');
  for (const t of tasks) {
    const assignee = t.assignee ?? '-';
    const status = statusLabel(t.status ?? 'not_started');
    const pct = t.progress ?? 0;
    L.push(`| ${t.name} | ${assignee} | ${t.start} | ${t.end} | ${status} | ${pct}% |`);
  }
  L.push('');

  // Milestones
  if (milestones.length > 0) {
    L.push('## Milestones', '');
    for (const m of milestones) {
      const icon = (m.status === 'completed') ? '✅' : '◇';
      L.push(`- ${icon} **${m.name}** — ${m.date}${m.status ? ` (${statusLabel(m.status)})` : ''}`);
    }
    L.push('');
  }

  // Text Gantt chart
  const chartWidth = 40;
  L.push('## Gantt Chart', '', '```');
  for (const t of tasks) {
    const tStart = dayOffset(startDate, t.start);
    const tLen = daysBetween(t.start, t.end);
    const barStart = Math.round((tStart / dur) * chartWidth);
    const barLen = Math.max(1, Math.round((tLen / dur) * chartWidth));
    const pct = t.progress ?? 0;
    const filled = Math.round(barLen * (pct / 100));
    const remaining = barLen - filled;
    const label = t.name.length > 20 ? t.name.slice(0, 17) + '...' : t.name.padEnd(20);
    let bar: string;
    if (t.status === 'completed') {
      bar = ' '.repeat(barStart) + '▓'.repeat(barLen);
    } else if (t.status === 'in_progress') {
      bar = ' '.repeat(barStart) + '█'.repeat(filled) + '░'.repeat(remaining);
    } else {
      bar = ' '.repeat(barStart) + '░'.repeat(barLen);
    }
    L.push(`${label} |${bar}`);
  }
  L.push('```', '');
  return L.join('\n');
}

// ============================================================================
// HTML FORMATTER
// ============================================================================

const STATUS_COLORS: Record<TaskStatus, string> = {
  completed: '#27ae60', in_progress: '#2980b9', not_started: '#e67e22', blocked: '#c0392b',
};

const CSS = [
  'body{font-family:system-ui,sans-serif;max-width:1000px;margin:0 auto;padding:20px;color:#1a1a1a}',
  'h1{color:#1a3a5c;border-bottom:2px solid #1a3a5c;padding-bottom:8px}',
  'h2{color:#1a3a5c;margin-top:28px}',
  '.meta{background:#e8f0fa;padding:12px 16px;border-radius:6px;margin-bottom:20px}',
  '.meta span{margin-right:20px}',
  'table{width:100%;border-collapse:collapse;margin:12px 0}',
  'th,td{border:1px solid #ddd;padding:8px 12px;text-align:left}',
  'th{background:#1a3a5c;color:#fff}',
  'tr:nth-child(even){background:#f5f8fc}',
  '.badge{display:inline-block;padding:2px 10px;border-radius:12px;color:#fff;font-size:.85em;font-weight:600}',
  '.gantt{position:relative;margin:20px 0}',
  '.gantt-row{display:flex;align-items:center;margin:4px 0;height:28px}',
  '.gantt-label{width:180px;font-size:.85em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex-shrink:0}',
  '.gantt-track{flex:1;position:relative;height:20px;background:#eee;border-radius:3px;overflow:hidden}',
  '.gantt-bar{position:absolute;height:100%;border-radius:3px;min-width:4px}',
  '.milestone-row{display:flex;align-items:center;gap:10px;margin:6px 0}',
  '.diamond{color:#1a3a5c;font-size:1.2em}',
  '@media print{body{padding:0}.gantt-row{break-inside:avoid}}',
].join('');

function formatHtml(
  name: string, startDate: string, endDate: string | undefined,
  tasks: ProjectTask[], milestones: Milestone[],
): string {
  const h: string[] = [];
  const projEnd = endDate ?? tasks.reduce((latest, t) => t.end > latest ? t.end : latest, tasks[0].end);
  const dur = daysBetween(startDate, projEnd);

  h.push(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>${esc(name)}</title>`);
  h.push(`<style>${CSS}</style></head><body>`);
  h.push(`<h1>${esc(name)}</h1>`);
  h.push(`<div class="meta"><span><strong>Start:</strong> ${esc(startDate)}</span>`);
  h.push(`<span><strong>End:</strong> ${esc(projEnd)}</span>`);
  h.push(`<span><strong>Duration:</strong> ${dur} days</span></div>`);

  // Task table
  h.push('<h2>Tasks</h2>');
  h.push('<table><thead><tr><th>Task</th><th>Assignee</th><th>Start</th><th>End</th><th>Status</th><th>Progress</th></tr></thead><tbody>');
  for (const t of tasks) {
    const status = t.status ?? 'not_started';
    const color = STATUS_COLORS[status];
    const pct = t.progress ?? 0;
    h.push(`<tr><td>${esc(t.name)}</td><td>${esc(t.assignee ?? '-')}</td>`);
    h.push(`<td>${esc(t.start)}</td><td>${esc(t.end)}</td>`);
    h.push(`<td><span class="badge" style="background:${color}">${statusLabel(status)}</span></td>`);
    h.push(`<td>${pct}%</td></tr>`);
  }
  h.push('</tbody></table>');

  // Gantt chart
  h.push('<h2>Gantt Chart</h2><div class="gantt">');
  for (const t of tasks) {
    const status = t.status ?? 'not_started';
    const tStart = dayOffset(startDate, t.start);
    const tLen = daysBetween(t.start, t.end);
    const leftPct = ((tStart / dur) * 100).toFixed(1);
    const widthPct = Math.max(1, (tLen / dur) * 100).toFixed(1);
    const color = STATUS_COLORS[status];
    const pct = t.progress ?? 0;
    h.push('<div class="gantt-row">');
    h.push(`<div class="gantt-label" title="${esc(t.name)}">${esc(t.name)}</div>`);
    h.push('<div class="gantt-track">');
    h.push(`<div class="gantt-bar" style="left:${leftPct}%;width:${widthPct}%;background:${color};opacity:0.3"></div>`);
    if (pct > 0) {
      const fillWidth = ((parseFloat(widthPct) * pct) / 100).toFixed(1);
      h.push(`<div class="gantt-bar" style="left:${leftPct}%;width:${fillWidth}%;background:${color}"></div>`);
    }
    h.push('</div></div>');
  }

  // Milestone markers
  for (const m of milestones) {
    const mOffset = dayOffset(startDate, m.date);
    const leftPct = ((mOffset / dur) * 100).toFixed(1);
    h.push('<div class="gantt-row">');
    h.push(`<div class="gantt-label" title="${esc(m.name)}">${esc(m.name)}</div>`);
    h.push('<div class="gantt-track">');
    h.push(`<div style="position:absolute;left:${leftPct}%;transform:translateX(-50%);font-size:1.2em" class="diamond">◆</div>`);
    h.push('</div></div>');
  }
  h.push('</div>');

  // Milestones section
  if (milestones.length > 0) {
    h.push('<h2>Milestones</h2>');
    for (const m of milestones) {
      const icon = (m.status === 'completed') ? '✅' : '◇';
      const label = m.status ? ` (${statusLabel(m.status)})` : '';
      h.push(`<div class="milestone-row"><span class="diamond">${icon}</span>`);
      h.push(`<strong>${esc(m.name)}</strong> &mdash; ${esc(m.date)}${esc(label)}</div>`);
    }
  }

  h.push('</body></html>');
  return h.join('\n');
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const projectTimelineTool: UnifiedTool = {
  name: 'project_timeline',
  description: `Generate project timelines and Gantt charts with task tracking, milestones, and progress visualization.

Use this when:
- User wants to create a project plan or timeline
- User needs a Gantt chart for tasks
- User wants to visualize project progress
- User is tracking milestones and deliverables

Returns a formatted project plan with task table, Gantt chart, and milestone markers — ready to print or share.`,
  parameters: {
    type: 'object',
    properties: {
      project_name: { type: 'string', description: 'Project name' },
      start_date: { type: 'string', description: 'Project start date (e.g., "2026-04-01")' },
      end_date: { type: 'string', description: 'Project end date (optional, inferred from tasks if omitted)' },
      tasks: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Task name' },
            start: { type: 'string', description: 'Task start date' },
            end: { type: 'string', description: 'Task end date' },
            assignee: { type: 'string', description: 'Person assigned to this task' },
            status: { type: 'string', enum: ['not_started', 'in_progress', 'completed', 'blocked'], description: 'Task status' },
            dependencies: { type: 'string', description: 'Names of tasks this depends on' },
            progress: { type: 'number', description: 'Completion percentage (0-100)' },
            category: { type: 'string', description: 'Task category or phase' },
          },
          required: ['name', 'start', 'end'],
        },
        description: 'Array of project tasks',
      },
      milestones: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Milestone name' },
            date: { type: 'string', description: 'Milestone date' },
            status: { type: 'string', enum: ['not_started', 'in_progress', 'completed', 'blocked'], description: 'Milestone status' },
          },
          required: ['name', 'date'],
        },
        description: 'Array of project milestones',
      },
      format: { type: 'string', enum: ['markdown', 'html'], description: 'Output format. Default: "markdown"' },
    },
    required: ['project_name', 'start_date', 'tasks'],
  },
};

// ============================================================================
// AVAILABILITY CHECK
// ============================================================================

export function isProjectTimelineAvailable(): boolean {
  return true;
}

// ============================================================================
// TOOL EXECUTOR
// ============================================================================

export async function executeProjectTimeline(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const args = toolCall.arguments as {
    project_name: string;
    start_date: string;
    end_date?: string;
    tasks: ProjectTask[];
    milestones?: Milestone[];
    format?: 'markdown' | 'html';
  };

  // Validate required fields
  if (!args.project_name?.trim()) {
    return { toolCallId: toolCall.id, content: 'Error: project_name is required', isError: true };
  }
  if (!args.start_date || !isValidDate(args.start_date)) {
    return { toolCallId: toolCall.id, content: 'Error: start_date is required and must be a valid date', isError: true };
  }
  if (args.end_date && !isValidDate(args.end_date)) {
    return { toolCallId: toolCall.id, content: 'Error: end_date must be a valid date', isError: true };
  }
  if (!Array.isArray(args.tasks) || args.tasks.length === 0) {
    return { toolCallId: toolCall.id, content: 'Error: tasks array is required and must not be empty', isError: true };
  }

  // Validate each task
  for (let i = 0; i < args.tasks.length; i++) {
    const t = args.tasks[i];
    if (!t.name?.trim()) {
      return { toolCallId: toolCall.id, content: `Error: task at index ${i} is missing required field "name"`, isError: true };
    }
    if (!t.start || !isValidDate(t.start)) {
      return { toolCallId: toolCall.id, content: `Error: task "${t.name}" has invalid start date`, isError: true };
    }
    if (!t.end || !isValidDate(t.end)) {
      return { toolCallId: toolCall.id, content: `Error: task "${t.name}" has invalid end date`, isError: true };
    }
    if (t.progress !== undefined && (t.progress < 0 || t.progress > 100)) {
      return { toolCallId: toolCall.id, content: `Error: task "${t.name}" progress must be between 0 and 100`, isError: true };
    }
  }

  // Validate milestones
  const milestones = args.milestones ?? [];
  for (let i = 0; i < milestones.length; i++) {
    const m = milestones[i];
    if (!m.name?.trim()) {
      return { toolCallId: toolCall.id, content: `Error: milestone at index ${i} is missing required field "name"`, isError: true };
    }
    if (!m.date || !isValidDate(m.date)) {
      return { toolCallId: toolCall.id, content: `Error: milestone "${m.name}" has invalid date`, isError: true };
    }
  }

  const fmt = args.format ?? 'markdown';
  const projEnd = args.end_date ?? args.tasks.reduce((latest, t) => t.end > latest ? t.end : latest, args.tasks[0].end);
  const dur = daysBetween(args.start_date, projEnd);
  const completed = args.tasks.filter((t) => t.status === 'completed').length;
  const inProgress = args.tasks.filter((t) => t.status === 'in_progress').length;
  const blocked = args.tasks.filter((t) => t.status === 'blocked').length;

  try {
    const formatted = fmt === 'html'
      ? formatHtml(args.project_name, args.start_date, args.end_date, args.tasks, milestones)
      : formatMarkdown(args.project_name, args.start_date, args.end_date, args.tasks, milestones);

    return {
      toolCallId: toolCall.id,
      content: JSON.stringify({
        success: true,
        message: `Project timeline created: ${args.project_name} (${dur} days, ${args.tasks.length} tasks)`,
        format: fmt,
        formatted_output: formatted,
        summary: {
          project_name: args.project_name,
          total_tasks: args.tasks.length,
          completed,
          in_progress: inProgress,
          blocked,
          milestones_count: milestones.length,
          duration_days: dur,
        },
      }),
    };
  } catch (error) {
    return {
      toolCallId: toolCall.id,
      content: `Error generating project timeline: ${(error as Error).message}`,
      isError: true,
    };
  }
}

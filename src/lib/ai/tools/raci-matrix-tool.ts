/**
 * RACI MATRIX TOOL — Generate RACI (Responsible, Accountable, Consulted, Informed)
 * matrices for project task assignment and accountability tracking.
 * No external dependencies. Created: 2026-03-19
 */
import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// TYPES
// ============================================================================

type RaciValue = 'R' | 'A' | 'C' | 'I' | '';

interface RaciAssignment {
  role: string;
  raci: RaciValue;
}

interface RaciTask {
  task: string;
  assignments: RaciAssignment[];
}

// ============================================================================
// HELPERS
// ============================================================================

function esc(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const RACI_LABELS: Record<string, string> = {
  R: 'Responsible — Does the work',
  A: 'Accountable — Owns the outcome',
  C: 'Consulted — Provides input',
  I: 'Informed — Kept up to date',
};

function countByType(tasks: RaciTask[]): Record<string, number> {
  const counts: Record<string, number> = { R: 0, A: 0, C: 0, I: 0 };
  for (const t of tasks) {
    for (const a of t.assignments) {
      if (a.raci && counts[a.raci] !== undefined) counts[a.raci]++;
    }
  }
  return counts;
}

function getAssignment(task: RaciTask, role: string): RaciValue {
  const found = task.assignments.find((a) => a.role === role);
  return found?.raci ?? '';
}

// ============================================================================
// MARKDOWN FORMATTER
// ============================================================================

function formatMarkdown(
  title: string, roles: string[], tasks: RaciTask[],
  project: string, preparedBy: string, date: string, notes: string,
): string {
  const L: string[] = [];
  L.push(`# RACI Matrix: ${title}`, '');
  if (project) L.push(`**Project:** ${project}`);
  if (preparedBy) L.push(`**Prepared by:** ${preparedBy}`);
  if (date) L.push(`**Date:** ${date}`);
  if (project || preparedBy || date) L.push('');

  // Build table header
  const header = ['Task', ...roles];
  L.push(`| ${header.join(' | ')} |`);
  L.push(`|${header.map(() => '------').join('|')}|`);

  // Build table rows
  for (const t of tasks) {
    const cells = [t.task, ...roles.map((r) => getAssignment(t, r) || '-')];
    L.push(`| ${cells.join(' | ')} |`);
  }
  L.push('');

  // Legend
  L.push('### Legend', '');
  L.push('| Letter | Meaning |', '|--------|---------|');
  for (const [letter, meaning] of Object.entries(RACI_LABELS)) {
    L.push(`| **${letter}** | ${meaning} |`);
  }
  L.push('');

  // Summary
  const counts = countByType(tasks);
  L.push('### Summary', '');
  L.push(`- **Tasks:** ${tasks.length}`);
  L.push(`- **Roles:** ${roles.length}`);
  L.push(`- **Responsible (R):** ${counts.R} assignments`);
  L.push(`- **Accountable (A):** ${counts.A} assignments`);
  L.push(`- **Consulted (C):** ${counts.C} assignments`);
  L.push(`- **Informed (I):** ${counts.I} assignments`);
  L.push('');

  if (notes) L.push('### Notes', '', notes, '');

  return L.join('\n');
}

// ============================================================================
// HTML FORMATTER
// ============================================================================

const CSS = [
  'body{font-family:system-ui,sans-serif;max-width:1000px;margin:0 auto;padding:20px;color:#e0e0e0;background:#121225}',
  'h1{color:#c0c8e0;border-bottom:3px solid #1a1a2e;padding-bottom:10px;text-align:center}',
  'h2{color:#a0b0d0;margin-top:28px;border-bottom:1px solid #2a2a4e;padding-bottom:6px}',
  '.meta{display:flex;flex-wrap:wrap;gap:8px 24px;background:#1a1a2e;padding:12px 16px;border-radius:8px;margin-bottom:24px}',
  '.meta span{color:#8090b0}.meta strong{color:#c0c8e0}',
  'table{width:100%;border-collapse:collapse;margin:12px 0}',
  'th,td{border:1px solid #2a2a4e;padding:10px 14px;text-align:center}',
  'th{background:#1a1a2e;color:#c0c8e0}',
  'td:first-child,th:first-child{text-align:left;font-weight:600}',
  'tr:nth-child(even){background:#16162a}',
  '.r-R{background:#1a3a6e;color:#7ab8ff;font-weight:700;font-size:1.1em}',
  '.r-A{background:#5a1a1a;color:#ff8a8a;font-weight:700;font-size:1.1em}',
  '.r-C{background:#1a4a2a;color:#7adf8a;font-weight:700;font-size:1.1em}',
  '.r-I{background:#4a4a1a;color:#e8e070;font-weight:700;font-size:1.1em}',
  '.r-empty{background:#1e1e30;color:#555}',
  '.legend{display:flex;gap:16px;flex-wrap:wrap;background:#1a1a2e;padding:12px 16px;border-radius:8px;margin:16px 0}',
  '.legend-item{display:flex;align-items:center;gap:8px}',
  '.legend-badge{width:32px;height:24px;border-radius:4px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:.9em}',
  '.summary{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin:16px 0}',
  '.summary-card{background:#1a1a2e;padding:12px;border-radius:8px;text-align:center}',
  '.summary-card .num{font-size:1.6em;font-weight:700;color:#c0c8e0}',
  '.summary-card .lbl{font-size:.85em;color:#8090b0;margin-top:4px}',
  '.notes{background:#1a1a2e;padding:12px 16px;border-radius:8px;border-left:4px solid #4a5a8a;margin-top:16px;color:#b0b8d0}',
  '@media print{body{background:#fff;color:#1a1a1a;padding:0}h1{color:#1a1a2e}',
  '.meta,.legend,.notes{background:#f5f5fa;border-color:#ccc}th{background:#1a1a2e;color:#fff}',
  '.r-R{background:#d0e0ff;color:#1a3a6e}.r-A{background:#ffd0d0;color:#5a1a1a}',
  '.r-C{background:#d0ffd8;color:#1a4a2a}.r-I{background:#ffffd0;color:#4a4a1a}}',
].join('');

function raciCellClass(val: RaciValue): string {
  return val ? `r-${val}` : 'r-empty';
}

function formatHtml(
  title: string, roles: string[], tasks: RaciTask[],
  project: string, preparedBy: string, date: string, notes: string,
): string {
  const h: string[] = [];
  h.push(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>RACI: ${esc(title)}</title>`);
  h.push(`<style>${CSS}</style></head><body>`);
  h.push(`<h1>RACI Matrix: ${esc(title)}</h1>`);

  if (project || preparedBy || date) {
    h.push('<div class="meta">');
    if (project) h.push(`<span><strong>Project:</strong> ${esc(project)}</span>`);
    if (preparedBy) h.push(`<span><strong>Prepared by:</strong> ${esc(preparedBy)}</span>`);
    if (date) h.push(`<span><strong>Date:</strong> ${esc(date)}</span>`);
    h.push('</div>');
  }

  // RACI table
  h.push('<h2>Assignment Matrix</h2>');
  h.push('<table><thead><tr><th>Task</th>');
  for (const r of roles) h.push(`<th>${esc(r)}</th>`);
  h.push('</tr></thead><tbody>');
  for (const t of tasks) {
    h.push(`<tr><td>${esc(t.task)}</td>`);
    for (const r of roles) {
      const val = getAssignment(t, r);
      const tooltip = val ? RACI_LABELS[val] : 'No assignment';
      h.push(`<td class="${raciCellClass(val)}" title="${esc(tooltip)}">${val || '&mdash;'}</td>`);
    }
    h.push('</tr>');
  }
  h.push('</tbody></table>');

  // Legend bar
  h.push('<div class="legend">');
  const legendColors: Record<string, string> = { R: '#1a3a6e', A: '#5a1a1a', C: '#1a4a2a', I: '#4a4a1a' };
  const legendTextColors: Record<string, string> = { R: '#7ab8ff', A: '#ff8a8a', C: '#7adf8a', I: '#e8e070' };
  for (const [letter, label] of Object.entries(RACI_LABELS)) {
    h.push(`<div class="legend-item"><span class="legend-badge" style="background:${legendColors[letter]};color:${legendTextColors[letter]}">${letter}</span>`);
    h.push(`<span style="color:#b0b8d0;font-size:.9em">${esc(label)}</span></div>`);
  }
  h.push('</div>');

  // Summary dashboard
  const counts = countByType(tasks);
  h.push('<h2>Summary</h2><div class="summary">');
  h.push(`<div class="summary-card"><div class="num">${tasks.length}</div><div class="lbl">Tasks</div></div>`);
  h.push(`<div class="summary-card"><div class="num">${roles.length}</div><div class="lbl">Roles</div></div>`);
  h.push(`<div class="summary-card"><div class="num">${counts.R}</div><div class="lbl">Responsible</div></div>`);
  h.push(`<div class="summary-card"><div class="num">${counts.A}</div><div class="lbl">Accountable</div></div>`);
  h.push(`<div class="summary-card"><div class="num">${counts.C}</div><div class="lbl">Consulted</div></div>`);
  h.push(`<div class="summary-card"><div class="num">${counts.I}</div><div class="lbl">Informed</div></div>`);
  h.push('</div>');

  if (notes) h.push(`<div class="notes"><strong>Notes:</strong> ${esc(notes)}</div>`);

  h.push('</body></html>');
  return h.join('\n');
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const raciMatrixTool: UnifiedTool = {
  name: 'create_raci_matrix',
  description: `Generate RACI matrices for project task assignment and accountability tracking.

Use this when:
- User needs to define roles and responsibilities for project tasks
- User wants to create a responsibility assignment matrix
- User asks about RACI, RASCI, or accountability charting
- User needs to clarify who is responsible, accountable, consulted, or informed

Returns a formatted RACI matrix with color-coded assignments, legend, and summary statistics.`,
  parameters: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Matrix title (e.g., "Website Redesign RACI")' },
      roles: {
        type: 'array',
        items: { type: 'string' },
        description: 'List of role names (column headers)',
      },
      tasks: {
        type: 'array',
        description: 'Tasks with RACI assignments per role',
        items: {
          type: 'object',
          required: ['task', 'assignments'],
          properties: {
            task: { type: 'string', description: 'Task or activity name' },
            assignments: {
              type: 'array',
              items: {
                type: 'object',
                required: ['role', 'raci'],
                properties: {
                  role: { type: 'string', description: 'Role name (must match a role in the roles array)' },
                  raci: { type: 'string', enum: ['R', 'A', 'C', 'I', ''], description: 'RACI assignment' },
                },
              },
            },
          },
        },
      },
      project: { type: 'string', description: 'Project name' },
      prepared_by: { type: 'string', description: 'Author of the matrix' },
      date: { type: 'string', description: 'Date of creation' },
      notes: { type: 'string', description: 'Additional notes or context' },
      format: { type: 'string', enum: ['markdown', 'html'], description: 'Output format. Default: "markdown"' },
    },
    required: ['title', 'roles', 'tasks'],
  },
};

// ============================================================================
// AVAILABILITY CHECK
// ============================================================================

export function isRaciMatrixAvailable(): boolean {
  return true;
}

// ============================================================================
// TOOL EXECUTOR
// ============================================================================

export async function executeRaciMatrix(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const args = toolCall.arguments as {
    title: string;
    roles: string[];
    tasks: RaciTask[];
    project?: string;
    prepared_by?: string;
    date?: string;
    notes?: string;
    format?: 'markdown' | 'html';
  };

  if (!args.title?.trim()) {
    return { toolCallId: toolCall.id, content: 'Error: title parameter is required', isError: true };
  }
  if (!Array.isArray(args.roles) || args.roles.length === 0) {
    return { toolCallId: toolCall.id, content: 'Error: roles array is required and must not be empty', isError: true };
  }
  if (!Array.isArray(args.tasks) || args.tasks.length === 0) {
    return { toolCallId: toolCall.id, content: 'Error: tasks array is required and must not be empty', isError: true };
  }

  for (let i = 0; i < args.tasks.length; i++) {
    const t = args.tasks[i];
    if (!t.task?.trim()) {
      return { toolCallId: toolCall.id, content: `Error: task at index ${i} is missing required field (task)`, isError: true };
    }
    if (!Array.isArray(t.assignments)) {
      return { toolCallId: toolCall.id, content: `Error: task at index ${i} is missing required field (assignments)`, isError: true };
    }
    for (let j = 0; j < t.assignments.length; j++) {
      const a = t.assignments[j];
      if (!a.role?.trim()) {
        return { toolCallId: toolCall.id, content: `Error: assignment at task[${i}].assignments[${j}] is missing role`, isError: true };
      }
      if (a.raci && !['R', 'A', 'C', 'I'].includes(a.raci)) {
        return { toolCallId: toolCall.id, content: `Error: invalid RACI value "${a.raci}" at task[${i}].assignments[${j}]. Must be R, A, C, I, or empty`, isError: true };
      }
    }
  }

  const fmt = args.format ?? 'markdown';
  const project = args.project ?? '';
  const preparedBy = args.prepared_by ?? '';
  const date = args.date ?? '';
  const notes = args.notes ?? '';
  const counts = countByType(args.tasks);

  try {
    const formatted = fmt === 'html'
      ? formatHtml(args.title, args.roles, args.tasks, project, preparedBy, date, notes)
      : formatMarkdown(args.title, args.roles, args.tasks, project, preparedBy, date, notes);

    return {
      toolCallId: toolCall.id,
      content: JSON.stringify({
        success: true,
        message: `RACI matrix created: ${args.title}`,
        format: fmt,
        formatted_output: formatted,
        summary: {
          title: args.title,
          project: project || null,
          total_tasks: args.tasks.length,
          total_roles: args.roles.length,
          responsible_count: counts.R,
          accountable_count: counts.A,
          consulted_count: counts.C,
          informed_count: counts.I,
        },
      }),
    };
  } catch (error) {
    return {
      toolCallId: toolCall.id,
      content: `Error generating RACI matrix: ${(error as Error).message}`,
      isError: true,
    };
  }
}

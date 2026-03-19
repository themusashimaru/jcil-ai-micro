/**
 * RUBRIC TOOL — Scoring rubric generator for assignments and assessments.
 * Produces professional rubric grids with criteria, performance levels,
 * and grade scales.
 * No external dependencies. Created: 2026-03-19
 */
import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// TYPES
// ============================================================================

interface PerformanceLevel {
  level: string;
  points: number;
  description: string;
}

interface Criterion {
  name: string;
  descriptions: PerformanceLevel[];
}

interface GradeEntry {
  grade: string;
  min_points: number;
  max_points: number;
}

// ============================================================================
// HELPERS
// ============================================================================

function esc(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function scoreColor(points: number, maxPoints: number): string {
  if (maxPoints === 0) return '#9090a0';
  const ratio = points / maxPoints;
  if (ratio >= 0.8) return '#27ae60';
  if (ratio >= 0.6) return '#f1c40f';
  if (ratio >= 0.4) return '#e67e22';
  return '#c0392b';
}

function getAllLevels(criteria: Criterion[]): string[] {
  const levelSet = new Map<string, number>();
  for (const c of criteria) {
    for (const d of c.descriptions) {
      if (!levelSet.has(d.level)) levelSet.set(d.level, d.points);
    }
  }
  return [...levelSet.entries()].sort((a, b) => b[1] - a[1]).map(([l]) => l);
}

function getMaxPoints(criteria: Criterion[]): number {
  let max = 0;
  for (const c of criteria) {
    for (const d of c.descriptions) {
      if (d.points > max) max = d.points;
    }
  }
  return max;
}

// ============================================================================
// MARKDOWN FORMATTER
// ============================================================================

function formatMarkdown(
  title: string, criteria: Criterion[], assignmentDesc: string,
  totalPoints: number | undefined, gradeScale: GradeEntry[],
  teacher: string, date: string, notes: string,
): string {
  const L: string[] = [];
  const levels = getAllLevels(criteria);

  L.push(`# ${title}`, '');
  if (assignmentDesc) L.push(`**Assignment:** ${assignmentDesc}`, '');
  if (teacher) L.push(`**Teacher:** ${teacher}`);
  if (date) L.push(`**Date:** ${date}`);
  if (totalPoints !== undefined) L.push(`**Total Points:** ${totalPoints}`);
  if (teacher || date || totalPoints !== undefined) L.push('');

  L.push('## Scoring Rubric', '');
  const header = `| Criteria | ${levels.join(' | ')} |`;
  const divider = `|----------|${levels.map(() => '----------').join('|')}|`;
  L.push(header, divider);

  for (const c of criteria) {
    const cells: string[] = [];
    for (const lvl of levels) {
      const desc = c.descriptions.find((d) => d.level === lvl);
      cells.push(desc ? `**${desc.points} pts** — ${desc.description}` : '—');
    }
    L.push(`| **${c.name}** | ${cells.join(' | ')} |`);
  }
  L.push('');

  if (gradeScale.length > 0) {
    L.push('## Grade Scale', '');
    L.push('| Grade | Points Range |', '|-------|-------------|');
    for (const g of gradeScale) L.push(`| ${g.grade} | ${g.min_points} – ${g.max_points} |`);
    L.push('');
  }

  if (notes) L.push('## Notes', '', notes, '');

  return L.join('\n');
}

// ============================================================================
// HTML FORMATTER
// ============================================================================

const CSS = [
  'body{font-family:system-ui,sans-serif;max-width:960px;margin:0 auto;padding:20px;color:#e0e0e0;background:#121225}',
  'h1{color:#c0c8e0;border-bottom:3px solid #1a1a2e;padding-bottom:10px;text-align:center}',
  'h2{color:#a0b0d0;margin-top:28px;border-bottom:1px solid #2a2a4e;padding-bottom:6px}',
  '.meta{display:grid;grid-template-columns:1fr 1fr;gap:8px 24px;background:#1a1a2e;padding:16px 20px;border-radius:8px;margin-bottom:24px}',
  '.meta-item{display:flex;gap:8px}.meta-label{font-weight:700;color:#8090b0;min-width:120px}',
  '.meta-value{color:#c0c8e0}',
  '.rubric-grid{width:100%;border-collapse:collapse;margin:16px 0}',
  '.rubric-grid th{background:#1a1a2e;color:#c0c8e0;padding:10px 14px;text-align:center;border:1px solid #2a2a4e;font-size:.95em}',
  '.rubric-grid th:first-child{text-align:left;min-width:140px}',
  '.rubric-grid td{border:1px solid #2a2a4e;padding:10px 14px;vertical-align:top;transition:background .15s}',
  '.rubric-grid td:first-child{font-weight:700;color:#c0c8e0;background:#16162a}',
  '.rubric-grid tr:hover td{background:#1e1e3a}',
  '.rubric-grid tr:hover td:first-child{background:#1a1a30}',
  '.cell-pts{display:inline-block;padding:2px 8px;border-radius:10px;font-weight:700;font-size:.85em;margin-bottom:4px;color:#fff}',
  '.cell-desc{color:#b0b8d0;font-size:.9em;line-height:1.4}',
  '.grade-table{border-collapse:collapse;margin:12px 0;min-width:300px}',
  '.grade-table th{background:#1a1a2e;color:#c0c8e0;padding:8px 16px;border:1px solid #2a2a4e}',
  '.grade-table td{border:1px solid #2a2a4e;padding:8px 16px;text-align:center;color:#c0c8e0}',
  '.grade-table tr:nth-child(even){background:#16162a}',
  '.grade-badge{font-weight:700;font-size:1.1em}',
  '.notes-box{background:#1a1a2e;padding:14px 20px;border-radius:8px;margin-top:20px;color:#b0b8d0;border-left:4px solid #4a5a8a}',
  '.total-pts{background:#1a1a2e;display:inline-block;padding:8px 18px;border-radius:8px;font-size:1.1em;font-weight:700;color:#c0c8e0;margin:8px 0}',
  '@media print{body{background:#fff;color:#1a1a1a;padding:0}h1{color:#1a1a2e}h2{color:#2a2a4e}',
  '.meta,.notes-box,.total-pts{background:#f5f5fa;border-color:#ccc;color:#1a1a1a}',
  '.rubric-grid th{background:#1a1a2e;color:#fff}.rubric-grid td:first-child{background:#f0f0f5}',
  '.rubric-grid td{border-color:#ccc}.rubric-grid tr:hover td{background:#f5f5fa}}',
].join('');

function formatHtml(
  title: string, criteria: Criterion[], assignmentDesc: string,
  totalPoints: number | undefined, gradeScale: GradeEntry[],
  teacher: string, date: string, notes: string,
): string {
  const h: string[] = [];
  const levels = getAllLevels(criteria);
  const maxPts = getMaxPoints(criteria);

  h.push(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>${esc(title)}</title>`);
  h.push(`<style>${CSS}</style></head><body>`);
  h.push(`<h1>${esc(title)}</h1>`);

  h.push('<div class="meta">');
  if (assignmentDesc) h.push(`<div class="meta-item" style="grid-column:1/-1"><span class="meta-label">Assignment:</span><span class="meta-value">${esc(assignmentDesc)}</span></div>`);
  if (teacher) h.push(`<div class="meta-item"><span class="meta-label">Teacher:</span><span class="meta-value">${esc(teacher)}</span></div>`);
  if (date) h.push(`<div class="meta-item"><span class="meta-label">Date:</span><span class="meta-value">${esc(date)}</span></div>`);
  h.push('</div>');

  if (totalPoints !== undefined) h.push(`<div class="total-pts">Total Points: ${totalPoints}</div>`);

  h.push('<h2>Scoring Rubric</h2>');
  h.push('<table class="rubric-grid"><thead><tr><th>Criteria</th>');
  for (const lvl of levels) h.push(`<th>${esc(lvl)}</th>`);
  h.push('</tr></thead><tbody>');

  for (const c of criteria) {
    h.push(`<tr><td>${esc(c.name)}</td>`);
    for (const lvl of levels) {
      const desc = c.descriptions.find((d) => d.level === lvl);
      if (desc) {
        const bg = scoreColor(desc.points, maxPts);
        h.push(`<td><span class="cell-pts" style="background:${bg}">${desc.points} pts</span>`);
        h.push(`<div class="cell-desc">${esc(desc.description)}</div></td>`);
      } else {
        h.push('<td style="color:#5a5a7a;text-align:center">&mdash;</td>');
      }
    }
    h.push('</tr>');
  }
  h.push('</tbody></table>');

  if (gradeScale.length > 0) {
    h.push('<h2>Grade Scale</h2>');
    h.push('<table class="grade-table"><thead><tr><th>Grade</th><th>Points Range</th></tr></thead><tbody>');
    for (const g of gradeScale) {
      h.push(`<tr><td><span class="grade-badge">${esc(g.grade)}</span></td><td>${g.min_points} &ndash; ${g.max_points}</td></tr>`);
    }
    h.push('</tbody></table>');
  }

  if (notes) h.push(`<div class="notes-box"><strong>Notes:</strong> ${esc(notes)}</div>`);

  h.push('</body></html>');
  return h.join('\n');
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const rubricTool: UnifiedTool = {
  name: 'create_rubric',
  description: `Create scoring rubrics with criteria, performance levels, and grade scales for any assignment type.
Use this when the user needs to create an assessment rubric, grading criteria, or scoring guide for assignments, projects, or presentations.
Returns a professional rubric grid with criteria rows, performance level columns, point values, and optional grade scale.`,
  parameters: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Rubric title (e.g., "Research Paper Rubric")' },
      criteria: {
        type: 'array', description: 'Scoring criteria with performance level descriptions',
        items: {
          type: 'object', required: ['name', 'descriptions'],
          properties: {
            name: { type: 'string', description: 'Criterion name (e.g., "Thesis Statement")' },
            descriptions: {
              type: 'array', description: 'Performance levels for this criterion',
              items: {
                type: 'object', required: ['level', 'points', 'description'],
                properties: {
                  level: { type: 'string', description: 'Performance level name (e.g., "Excellent")' },
                  points: { type: 'number', description: 'Points awarded at this level' },
                  description: { type: 'string', description: 'What this level looks like' },
                },
              },
            },
          },
        },
      },
      assignment_description: { type: 'string', description: 'Description of the assignment being assessed' },
      total_points: { type: 'number', description: 'Total possible points' },
      grade_scale: {
        type: 'array', description: 'Grade scale mapping points to letter grades',
        items: {
          type: 'object', required: ['grade', 'min_points', 'max_points'],
          properties: {
            grade: { type: 'string', description: 'Letter grade (e.g., "A")' },
            min_points: { type: 'number', description: 'Minimum points for this grade' },
            max_points: { type: 'number', description: 'Maximum points for this grade' },
          },
        },
      },
      teacher: { type: 'string', description: 'Teacher name' },
      date: { type: 'string', description: 'Date' },
      notes: { type: 'string', description: 'Additional notes or instructions' },
      format: { type: 'string', enum: ['markdown', 'html'], description: 'Output format. Default: "markdown"' },
    },
    required: ['title', 'criteria'],
  },
};

// ============================================================================
// AVAILABILITY CHECK
// ============================================================================

export function isRubricAvailable(): boolean {
  return true;
}

// ============================================================================
// TOOL EXECUTOR
// ============================================================================

export async function executeRubric(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const args = toolCall.arguments as {
    title: string;
    criteria: Criterion[];
    assignment_description?: string;
    total_points?: number;
    grade_scale?: GradeEntry[];
    teacher?: string;
    date?: string;
    notes?: string;
    format?: 'markdown' | 'html';
  };

  if (!args.title?.trim()) {
    return { toolCallId: toolCall.id, content: 'Error: title parameter is required', isError: true };
  }
  if (!Array.isArray(args.criteria) || args.criteria.length === 0) {
    return { toolCallId: toolCall.id, content: 'Error: criteria array is required and must not be empty', isError: true };
  }

  for (let i = 0; i < args.criteria.length; i++) {
    const c = args.criteria[i];
    if (!c.name?.trim()) {
      return { toolCallId: toolCall.id, content: `Error: criterion at index ${i} is missing required field (name)`, isError: true };
    }
    if (!Array.isArray(c.descriptions) || c.descriptions.length === 0) {
      return { toolCallId: toolCall.id, content: `Error: criterion "${c.name}" at index ${i} must have at least one performance level description`, isError: true };
    }
    for (let j = 0; j < c.descriptions.length; j++) {
      const d = c.descriptions[j];
      if (!d.level || typeof d.points !== 'number' || !d.description) {
        return {
          toolCallId: toolCall.id,
          content: `Error: description at index ${j} in criterion "${c.name}" is missing required fields (level, points, description)`,
          isError: true,
        };
      }
    }
  }

  if (args.grade_scale) {
    for (let i = 0; i < args.grade_scale.length; i++) {
      const g = args.grade_scale[i];
      if (!g.grade || typeof g.min_points !== 'number' || typeof g.max_points !== 'number') {
        return {
          toolCallId: toolCall.id,
          content: `Error: grade scale entry at index ${i} is missing required fields (grade, min_points, max_points)`,
          isError: true,
        };
      }
    }
  }

  const fmt = args.format ?? 'markdown';
  const assignmentDesc = args.assignment_description ?? '';
  const gradeScale = args.grade_scale ?? [];
  const teacher = args.teacher ?? '';
  const date = args.date ?? '';
  const notes = args.notes ?? '';
  const levels = getAllLevels(args.criteria);
  const maxPts = getMaxPoints(args.criteria);

  try {
    const formatted = fmt === 'html'
      ? formatHtml(args.title, args.criteria, assignmentDesc, args.total_points, gradeScale, teacher, date, notes)
      : formatMarkdown(args.title, args.criteria, assignmentDesc, args.total_points, gradeScale, teacher, date, notes);

    return {
      toolCallId: toolCall.id,
      content: JSON.stringify({
        success: true,
        message: `Rubric created: ${args.title}`,
        format: fmt,
        formatted_output: formatted,
        summary: {
          title: args.title,
          criteria_count: args.criteria.length,
          performance_levels: levels,
          max_points_per_criterion: maxPts,
          total_points: args.total_points ?? null,
          has_grade_scale: gradeScale.length > 0,
          grade_count: gradeScale.length,
        },
      }),
    };
  } catch (error) {
    return {
      toolCallId: toolCall.id,
      content: `Error generating rubric: ${(error as Error).message}`,
      isError: true,
    };
  }
}

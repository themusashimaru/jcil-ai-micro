/**
 * PERFORMANCE REVIEW TOOL — Employee performance review document generator.
 * Produces structured reviews with competency ratings, goals, strengths,
 * areas for improvement, and signature blocks.
 * No external dependencies. Created: 2026-03-19
 */
import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// TYPES
// ============================================================================

interface Competency {
  name: string;
  rating: number;
  comments: string;
}

interface Goal {
  goal: string;
  timeline: string;
  metrics?: string;
}

// ============================================================================
// HELPERS
// ============================================================================

function esc(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function stars(rating: number): string {
  const clamped = Math.max(1, Math.min(5, Math.round(rating)));
  return '\u2605'.repeat(clamped) + '\u2606'.repeat(5 - clamped);
}

function ratingLabel(rating: number): string {
  const labels: Record<number, string> = { 1: 'Needs Improvement', 2: 'Below Expectations', 3: 'Meets Expectations', 4: 'Exceeds Expectations', 5: 'Outstanding' };
  return labels[Math.max(1, Math.min(5, Math.round(rating)))] ?? 'N/A';
}

// ============================================================================
// MARKDOWN FORMATTER
// ============================================================================

function formatMarkdown(
  employeeName: string, reviewPeriod: string, competencies: Competency[],
  reviewerName: string, department: string, position: string,
  reviewDate: string, overallRating: number | undefined,
  strengths: string[], improvements: string[], goals: Goal[],
  employeeComments: string, managerComments: string, signatures: boolean,
): string {
  const L: string[] = [];
  L.push(`# Performance Review: ${employeeName}`, '');
  L.push('| Field | Value |', '|-------|-------|');
  L.push(`| **Employee** | ${employeeName} |`);
  L.push(`| **Review Period** | ${reviewPeriod} |`);
  if (department) L.push(`| **Department** | ${department} |`);
  if (position) L.push(`| **Position** | ${position} |`);
  if (reviewerName) L.push(`| **Reviewer** | ${reviewerName} |`);
  if (reviewDate) L.push(`| **Date** | ${reviewDate} |`);
  if (overallRating !== undefined) L.push(`| **Overall Rating** | ${stars(overallRating)} (${overallRating}/5 — ${ratingLabel(overallRating)}) |`);
  L.push('');

  L.push('## Competency Assessment', '', '| Competency | Rating | Comments |', '|------------|--------|----------|');
  for (const c of competencies) {
    L.push(`| ${c.name} | ${stars(c.rating)} ${c.rating}/5 | ${c.comments} |`);
  }
  L.push('');

  if (strengths.length > 0) {
    L.push('## Key Strengths', '');
    for (const s of strengths) L.push(`- ${s}`);
    L.push('');
  }

  if (improvements.length > 0) {
    L.push('## Areas for Improvement', '');
    for (const a of improvements) L.push(`- ${a}`);
    L.push('');
  }

  if (goals.length > 0) {
    L.push('## Development Goals', '', '| Goal | Timeline | Success Metrics |', '|------|----------|-----------------|');
    for (const g of goals) {
      L.push(`| ${g.goal} | ${g.timeline} | ${g.metrics ?? '—'} |`);
    }
    L.push('');
  }

  if (managerComments) L.push('## Manager Comments', '', managerComments, '');
  if (employeeComments) L.push('## Employee Comments', '', employeeComments, '');

  if (signatures) {
    L.push('## Signatures', '');
    L.push(`**Employee:** ____________________  Date: ________`);
    if (reviewerName) L.push(`**Reviewer (${reviewerName}):** ____________________  Date: ________`);
    else L.push(`**Reviewer:** ____________________  Date: ________`);
    L.push('');
  }

  return L.join('\n');
}

// ============================================================================
// HTML FORMATTER
// ============================================================================

const CSS = [
  'body{font-family:system-ui,sans-serif;max-width:900px;margin:0 auto;padding:20px;color:#e0e0e0;background:#121225}',
  'h1{color:#c0c8e0;border-bottom:3px solid #1a1a2e;padding-bottom:10px;text-align:center}',
  'h2{color:#a0b0d0;margin-top:28px;border-bottom:1px solid #2a2a4e;padding-bottom:6px}',
  '.meta{display:grid;grid-template-columns:1fr 1fr;gap:8px 24px;background:#1a1a2e;padding:16px 20px;border-radius:8px;margin-bottom:24px}',
  '.meta-item{display:flex;gap:8px}.meta-label{font-weight:700;color:#8090b0;min-width:120px}.meta-value{color:#c0c8e0}',
  '.overall{text-align:center;background:#1a1a2e;padding:16px;border-radius:8px;margin:16px 0}',
  '.overall .stars{font-size:2em;color:#f0c040;letter-spacing:4px}',
  '.overall .label{color:#a0b0d0;margin-top:4px}',
  '.comp-card{border:1px solid #2a2a4e;border-radius:8px;padding:14px 18px;margin:10px 0;background:#16162a}',
  '.comp-header{display:flex;justify-content:space-between;align-items:center}',
  '.comp-name{font-weight:700;color:#c0c8e0;font-size:1.05em}',
  '.comp-stars{color:#f0c040;font-size:1.2em;letter-spacing:2px}',
  '.comp-bar{height:8px;border-radius:4px;background:#2a2a4e;margin:8px 0}',
  '.comp-fill{height:100%;border-radius:4px;background:linear-gradient(90deg,#4a5a8a,#7090d0)}',
  '.comp-comments{color:#a0b0c0;font-size:.92em;margin-top:6px}',
  'ul.list{padding-left:20px}ul.list li{padding:4px 0;color:#b0b8d0}',
  'table{width:100%;border-collapse:collapse;margin:12px 0}',
  'th,td{border:1px solid #2a2a4e;padding:8px 12px;text-align:left}',
  'th{background:#1a1a2e;color:#c0c8e0}tr:nth-child(even){background:#16162a}',
  '.comments-box{background:#16162a;border:1px solid #2a2a4e;border-radius:8px;padding:14px 18px;margin:10px 0;color:#b0b8d0}',
  '.sig-block{background:#1a1a2e;padding:16px 20px;border-radius:8px;margin-top:24px}',
  '.sig-line{border-bottom:1px solid #4a4a6e;padding:14px 0;display:flex;justify-content:space-between;align-items:center}',
  '.sig-label{font-weight:700;color:#8090b0}.sig-blank{color:#4a4a6e;letter-spacing:2px}',
  '@media print{body{background:#fff;color:#1a1a1a;padding:0}h1{color:#1a1a2e}h2{color:#2a2a4e}',
  '.meta,.comp-card,.comments-box,.sig-block,.overall{background:#f5f5fa;border-color:#ccc}th{background:#1a1a2e;color:#fff}',
  '.comp-card{break-inside:avoid}}',
].join('');

function formatHtml(
  employeeName: string, reviewPeriod: string, competencies: Competency[],
  reviewerName: string, department: string, position: string,
  reviewDate: string, overallRating: number | undefined,
  strengths: string[], improvements: string[], goals: Goal[],
  employeeComments: string, managerComments: string, signatures: boolean,
): string {
  const h: string[] = [];
  h.push(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Performance Review — ${esc(employeeName)}</title>`);
  h.push(`<style>${CSS}</style></head><body>`);
  h.push(`<h1>Performance Review: ${esc(employeeName)}</h1>`);

  h.push('<div class="meta">');
  h.push(`<div class="meta-item"><span class="meta-label">Employee:</span><span class="meta-value">${esc(employeeName)}</span></div>`);
  h.push(`<div class="meta-item"><span class="meta-label">Review Period:</span><span class="meta-value">${esc(reviewPeriod)}</span></div>`);
  if (department) h.push(`<div class="meta-item"><span class="meta-label">Department:</span><span class="meta-value">${esc(department)}</span></div>`);
  if (position) h.push(`<div class="meta-item"><span class="meta-label">Position:</span><span class="meta-value">${esc(position)}</span></div>`);
  if (reviewerName) h.push(`<div class="meta-item"><span class="meta-label">Reviewer:</span><span class="meta-value">${esc(reviewerName)}</span></div>`);
  if (reviewDate) h.push(`<div class="meta-item"><span class="meta-label">Date:</span><span class="meta-value">${esc(reviewDate)}</span></div>`);
  h.push('</div>');

  if (overallRating !== undefined) {
    const pct = (Math.max(1, Math.min(5, overallRating)) / 5) * 100;
    h.push(`<div class="overall"><div class="stars">${stars(overallRating)}</div>`);
    h.push(`<div class="label">${esc(ratingLabel(overallRating))} (${overallRating}/5)</div>`);
    h.push(`<div class="comp-bar" style="max-width:300px;margin:8px auto 0"><div class="comp-fill" style="width:${pct}%"></div></div></div>`);
  }

  h.push('<h2>Competency Assessment</h2>');
  for (const c of competencies) {
    const pct = (Math.max(1, Math.min(5, c.rating)) / 5) * 100;
    h.push(`<div class="comp-card"><div class="comp-header"><span class="comp-name">${esc(c.name)}</span><span class="comp-stars">${stars(c.rating)} ${c.rating}/5</span></div>`);
    h.push(`<div class="comp-bar"><div class="comp-fill" style="width:${pct}%"></div></div>`);
    h.push(`<div class="comp-comments">${esc(c.comments)}</div></div>`);
  }

  if (strengths.length > 0) {
    h.push('<h2>Key Strengths</h2><ul class="list">');
    for (const s of strengths) h.push(`<li>${esc(s)}</li>`);
    h.push('</ul>');
  }

  if (improvements.length > 0) {
    h.push('<h2>Areas for Improvement</h2><ul class="list">');
    for (const a of improvements) h.push(`<li>${esc(a)}</li>`);
    h.push('</ul>');
  }

  if (goals.length > 0) {
    h.push('<h2>Development Goals</h2>');
    h.push('<table><thead><tr><th>Goal</th><th>Timeline</th><th>Success Metrics</th></tr></thead><tbody>');
    for (const g of goals) h.push(`<tr><td>${esc(g.goal)}</td><td>${esc(g.timeline)}</td><td>${g.metrics ? esc(g.metrics) : '&mdash;'}</td></tr>`);
    h.push('</tbody></table>');
  }

  if (managerComments) h.push(`<h2>Manager Comments</h2><div class="comments-box">${esc(managerComments)}</div>`);
  if (employeeComments) h.push(`<h2>Employee Comments</h2><div class="comments-box">${esc(employeeComments)}</div>`);

  if (signatures) {
    h.push('<div class="sig-block"><h2 style="margin-top:0">Signatures</h2>');
    h.push(`<div class="sig-line"><span class="sig-label">Employee (${esc(employeeName)}):</span><span class="sig-blank">____________________ Date: ________</span></div>`);
    const revLabel = reviewerName ? `Reviewer (${esc(reviewerName)})` : 'Reviewer';
    h.push(`<div class="sig-line"><span class="sig-label">${revLabel}:</span><span class="sig-blank">____________________ Date: ________</span></div>`);
    h.push('</div>');
  }

  h.push('</body></html>');
  return h.join('\n');
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const performanceReviewTool: UnifiedTool = {
  name: 'create_performance_review',
  description: `Generate employee performance reviews with competency ratings, goals, and development plans.
Use this when the user needs to create, draft, or generate an employee performance review document.
Returns a structured review with competency ratings, strengths, areas for improvement, SMART goals, comments, and signature blocks.`,
  parameters: {
    type: 'object',
    properties: {
      employee_name: { type: 'string', description: 'Full name of the employee being reviewed' },
      review_period: { type: 'string', description: 'Review period (e.g., "Q1 2026", "2025 Annual")' },
      competencies: {
        type: 'array', description: 'Competency ratings',
        items: {
          type: 'object', required: ['name', 'rating', 'comments'],
          properties: {
            name: { type: 'string', description: 'Competency name (e.g., "Communication")' },
            rating: { type: 'number', description: 'Rating from 1 (needs improvement) to 5 (outstanding)' },
            comments: { type: 'string', description: 'Comments on this competency' },
          },
        },
      },
      reviewer_name: { type: 'string', description: 'Name of the reviewer/manager' },
      department: { type: 'string', description: 'Employee department' },
      position: { type: 'string', description: 'Employee position/title' },
      review_date: { type: 'string', description: 'Date of the review' },
      overall_rating: { type: 'number', description: 'Overall rating from 1 to 5' },
      strengths: { type: 'array', items: { type: 'string' }, description: 'Key strengths observed' },
      areas_for_improvement: { type: 'array', items: { type: 'string' }, description: 'Areas needing improvement' },
      goals: {
        type: 'array', description: 'Development goals',
        items: {
          type: 'object', required: ['goal', 'timeline'],
          properties: {
            goal: { type: 'string', description: 'Goal description' },
            timeline: { type: 'string', description: 'Target completion timeline' },
            metrics: { type: 'string', description: 'How success will be measured' },
          },
        },
      },
      employee_comments: { type: 'string', description: 'Comments from the employee' },
      manager_comments: { type: 'string', description: 'Additional comments from the manager' },
      signatures: { type: 'boolean', description: 'Include signature block. Default: true' },
      format: { type: 'string', enum: ['markdown', 'html'], description: 'Output format. Default: "markdown"' },
    },
    required: ['employee_name', 'review_period', 'competencies'],
  },
};

// ============================================================================
// AVAILABILITY CHECK
// ============================================================================

export function isPerformanceReviewAvailable(): boolean {
  return true;
}

// ============================================================================
// TOOL EXECUTOR
// ============================================================================

export async function executePerformanceReview(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const args = toolCall.arguments as {
    employee_name: string;
    review_period: string;
    competencies: Competency[];
    reviewer_name?: string;
    department?: string;
    position?: string;
    review_date?: string;
    overall_rating?: number;
    strengths?: string[];
    areas_for_improvement?: string[];
    goals?: Goal[];
    employee_comments?: string;
    manager_comments?: string;
    signatures?: boolean;
    format?: 'markdown' | 'html';
  };

  if (!args.employee_name?.trim()) {
    return { toolCallId: toolCall.id, content: 'Error: employee_name parameter is required', isError: true };
  }
  if (!args.review_period?.trim()) {
    return { toolCallId: toolCall.id, content: 'Error: review_period parameter is required', isError: true };
  }
  if (!Array.isArray(args.competencies) || args.competencies.length === 0) {
    return { toolCallId: toolCall.id, content: 'Error: competencies array is required and must not be empty', isError: true };
  }

  for (let i = 0; i < args.competencies.length; i++) {
    const c = args.competencies[i];
    if (!c.name || typeof c.rating !== 'number' || !c.comments) {
      return {
        toolCallId: toolCall.id,
        content: `Error: competency at index ${i} is missing required fields (name, rating, comments)`,
        isError: true,
      };
    }
    if (c.rating < 1 || c.rating > 5) {
      return {
        toolCallId: toolCall.id,
        content: `Error: competency rating at index ${i} must be between 1 and 5`,
        isError: true,
      };
    }
  }

  if (args.overall_rating !== undefined && (args.overall_rating < 1 || args.overall_rating > 5)) {
    return { toolCallId: toolCall.id, content: 'Error: overall_rating must be between 1 and 5', isError: true };
  }

  if (args.goals) {
    for (let i = 0; i < args.goals.length; i++) {
      const g = args.goals[i];
      if (!g.goal || !g.timeline) {
        return {
          toolCallId: toolCall.id,
          content: `Error: goal at index ${i} is missing required fields (goal, timeline)`,
          isError: true,
        };
      }
    }
  }

  const fmt = args.format ?? 'markdown';
  const reviewerName = args.reviewer_name ?? '';
  const department = args.department ?? '';
  const position = args.position ?? '';
  const reviewDate = args.review_date ?? '';
  const strengths = args.strengths ?? [];
  const improvements = args.areas_for_improvement ?? [];
  const goals = args.goals ?? [];
  const employeeComments = args.employee_comments ?? '';
  const managerComments = args.manager_comments ?? '';
  const signatures = args.signatures !== false;
  const avgRating = args.competencies.reduce((sum, c) => sum + c.rating, 0) / args.competencies.length;

  try {
    const formatted = fmt === 'html'
      ? formatHtml(args.employee_name, args.review_period, args.competencies, reviewerName, department, position, reviewDate, args.overall_rating, strengths, improvements, goals, employeeComments, managerComments, signatures)
      : formatMarkdown(args.employee_name, args.review_period, args.competencies, reviewerName, department, position, reviewDate, args.overall_rating, strengths, improvements, goals, employeeComments, managerComments, signatures);

    return {
      toolCallId: toolCall.id,
      content: JSON.stringify({
        success: true,
        message: `Performance review created for ${args.employee_name} (${args.review_period})`,
        format: fmt,
        formatted_output: formatted,
        summary: {
          employee_name: args.employee_name,
          review_period: args.review_period,
          department: department || null,
          position: position || null,
          competencies_count: args.competencies.length,
          average_rating: Math.round(avgRating * 100) / 100,
          overall_rating: args.overall_rating ?? null,
          strengths_count: strengths.length,
          improvements_count: improvements.length,
          goals_count: goals.length,
          has_signatures: signatures,
        },
      }),
    };
  } catch (error) {
    return {
      toolCallId: toolCall.id,
      content: `Error generating performance review: ${(error as Error).message}`,
      isError: true,
    };
  }
}

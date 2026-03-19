/**
 * OKR PLANNER TOOL — Objectives & Key Results planning document generator.
 * Produces professional OKR documents with objectives, key results,
 * progress tracking, and alignment notes.
 * No external dependencies. Created: 2026-03-19
 */
import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// TYPES
// ============================================================================

interface KeyResult {
  description: string;
  target: string;
  current?: string;
  unit?: string;
}

interface Objective {
  objective: string;
  key_results: KeyResult[];
}

// ============================================================================
// HELPERS
// ============================================================================

function esc(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function calcProgress(kr: KeyResult): number {
  if (!kr.current || !kr.target) return 0;
  const current = parseFloat(kr.current);
  const target = parseFloat(kr.target);
  if (isNaN(current) || isNaN(target) || target === 0) return 0;
  return Math.min(100, Math.max(0, Math.round((current / target) * 100)));
}

function progressBar(pct: number): string {
  const filled = Math.round(pct / 5);
  const empty = 20 - filled;
  return `[${'█'.repeat(filled)}${'░'.repeat(empty)}] ${pct}%`;
}

function statusLabel(pct: number): string {
  if (pct >= 70) return 'On Track';
  if (pct >= 40) return 'At Risk';
  if (pct > 0) return 'Behind';
  return 'Not Started';
}

function statusColor(pct: number): string {
  if (pct >= 70) return '#6fcf97';
  if (pct >= 40) return '#f2c94c';
  if (pct > 0) return '#eb5757';
  return '#5a5a7a';
}

// ============================================================================
// MARKDOWN FORMATTER
// ============================================================================

function formatMarkdown(
  title: string, period: string, team: string, owner: string,
  alignmentNotes: string, objectives: Objective[],
): string {
  const L: string[] = [];
  L.push(`# OKR Plan: ${title}`, '');
  L.push('| Field | Value |', '|-------|-------|');
  L.push(`| **Period** | ${period} |`);
  if (team) L.push(`| **Team** | ${team} |`);
  if (owner) L.push(`| **Owner** | ${owner} |`);
  L.push('');

  if (alignmentNotes) {
    L.push('## Alignment', '', `> ${alignmentNotes}`, '');
  }

  L.push('## Objectives & Key Results', '');
  for (let i = 0; i < objectives.length; i++) {
    const obj = objectives[i];
    L.push(`### Objective ${i + 1}: ${obj.objective}`, '');
    if (obj.key_results.length > 0) {
      for (let j = 0; j < obj.key_results.length; j++) {
        const kr = obj.key_results[j];
        const pct = calcProgress(kr);
        const unit = kr.unit ? ` ${kr.unit}` : '';
        const current = kr.current ?? '0';
        L.push(`**KR ${i + 1}.${j + 1}:** ${kr.description}`);
        L.push(`- Target: ${kr.target}${unit} | Current: ${current}${unit}`);
        L.push(`- Progress: ${progressBar(pct)} — ${statusLabel(pct)}`);
        L.push('');
      }
    }
  }

  // Summary
  let totalKRs = 0;
  let totalProgress = 0;
  for (const obj of objectives) {
    for (const kr of obj.key_results) {
      totalKRs++;
      totalProgress += calcProgress(kr);
    }
  }
  const avgProgress = totalKRs > 0 ? Math.round(totalProgress / totalKRs) : 0;
  L.push('## Summary', '');
  L.push(`- **Objectives:** ${objectives.length}`);
  L.push(`- **Key Results:** ${totalKRs}`);
  L.push(`- **Overall Progress:** ${progressBar(avgProgress)}`);
  L.push(`- **Status:** ${statusLabel(avgProgress)}`);
  L.push('');

  return L.join('\n');
}

// ============================================================================
// HTML FORMATTER
// ============================================================================

const CSS = [
  'body{font-family:system-ui,sans-serif;max-width:960px;margin:0 auto;padding:20px;color:#e0e0e0;background:#121225}',
  'h1{color:#c0c8e0;border-bottom:3px solid #1a1a2e;padding-bottom:10px;text-align:center}',
  'h2{color:#a0b0d0;margin-top:28px;border-bottom:1px solid #2a2a4e;padding-bottom:6px}',
  '.meta{display:flex;gap:24px;justify-content:center;background:#1a1a2e;padding:12px 20px;border-radius:8px;margin-bottom:24px;flex-wrap:wrap}',
  '.meta-item{display:flex;gap:8px}.meta-label{font-weight:700;color:#8090b0}.meta-value{color:#c0c8e0}',
  '.alignment{background:#1a2030;border-left:4px solid #bb86fc;padding:12px 16px;border-radius:4px;margin-bottom:24px;color:#c0c8e0;line-height:1.6}',
  '.obj-card{border:1px solid #2a2a4e;border-radius:8px;padding:20px;margin:16px 0;background:#16162a}',
  '.obj-card h3{margin:0 0 16px 0;color:#c0c8e0;font-size:1.15em}',
  '.obj-num{display:inline-block;background:#1a1a2e;color:#bb86fc;border-radius:50%;width:28px;height:28px;text-align:center;line-height:28px;font-weight:700;margin-right:8px;font-size:.9em}',
  '.kr{background:#1a1a2e;border-radius:6px;padding:12px 16px;margin:10px 0}',
  '.kr-title{font-weight:600;color:#c0c8e0;margin-bottom:6px}',
  '.kr-meta{font-size:.9em;color:#7080a0;margin-bottom:8px}',
  '.bar-wrap{background:#2a2a4e;border-radius:10px;height:20px;overflow:hidden;position:relative}',
  '.bar-fill{height:100%;border-radius:10px;transition:width .3s}',
  '.bar-label{position:absolute;top:0;right:8px;line-height:20px;font-size:.8em;font-weight:700;color:#fff}',
  '.status{display:inline-block;padding:2px 10px;border-radius:12px;font-size:.8em;font-weight:700;margin-left:8px}',
  '.summary{background:#1a1a2e;border-radius:8px;padding:20px;margin-top:24px;text-align:center}',
  '.summary-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-top:12px}',
  '.summary-item{background:#16162a;border-radius:8px;padding:12px}',
  '.summary-val{font-size:1.8em;font-weight:700;color:#c0c8e0}.summary-lbl{font-size:.85em;color:#7080a0;margin-top:4px}',
  '@media print{body{background:#fff;color:#1a1a1a;padding:0}h1{color:#1a1a2e}',
  '.meta,.obj-card,.kr,.summary,.summary-item{background:#f5f5fa;border-color:#ccc}',
  '.bar-wrap{background:#ddd}.obj-card{break-inside:avoid}}',
].join('');

function formatHtml(
  title: string, period: string, team: string, owner: string,
  alignmentNotes: string, objectives: Objective[],
): string {
  const h: string[] = [];
  h.push(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>OKR Plan: ${esc(title)}</title>`);
  h.push(`<style>${CSS}</style></head><body>`);
  h.push(`<h1>OKR Plan: ${esc(title)}</h1>`);
  h.push('<div class="meta">');
  h.push(`<div class="meta-item"><span class="meta-label">Period:</span><span class="meta-value">${esc(period)}</span></div>`);
  if (team) h.push(`<div class="meta-item"><span class="meta-label">Team:</span><span class="meta-value">${esc(team)}</span></div>`);
  if (owner) h.push(`<div class="meta-item"><span class="meta-label">Owner:</span><span class="meta-value">${esc(owner)}</span></div>`);
  h.push('</div>');

  if (alignmentNotes) {
    h.push(`<div class="alignment"><strong>Alignment:</strong> ${esc(alignmentNotes)}</div>`);
  }

  h.push('<h2>Objectives &amp; Key Results</h2>');
  let totalKRs = 0;
  let totalProgress = 0;
  for (let i = 0; i < objectives.length; i++) {
    const obj = objectives[i];
    h.push(`<div class="obj-card"><h3><span class="obj-num">${i + 1}</span>${esc(obj.objective)}</h3>`);
    for (let j = 0; j < obj.key_results.length; j++) {
      const kr = obj.key_results[j];
      const pct = calcProgress(kr);
      const unit = kr.unit ? ` ${esc(kr.unit)}` : '';
      const current = kr.current ?? '0';
      const color = statusColor(pct);
      totalKRs++;
      totalProgress += pct;
      h.push(`<div class="kr"><div class="kr-title">KR ${i + 1}.${j + 1}: ${esc(kr.description)}</div>`);
      h.push(`<div class="kr-meta">Target: ${esc(kr.target)}${unit} &middot; Current: ${esc(current)}${unit}</div>`);
      h.push(`<div class="bar-wrap"><div class="bar-fill" style="width:${pct}%;background:${color}"></div><div class="bar-label">${pct}%</div></div>`);
      h.push(`<div style="margin-top:4px;font-size:.85em;color:#7080a0">Status: <span class="status" style="background:${color}22;color:${color}">${statusLabel(pct)}</span></div>`);
      h.push('</div>');
    }
    h.push('</div>');
  }

  const avgProgress = totalKRs > 0 ? Math.round(totalProgress / totalKRs) : 0;
  const avgColor = statusColor(avgProgress);
  h.push('<div class="summary"><h2 style="margin-top:0;border:none">Summary</h2>');
  h.push('<div class="summary-grid">');
  h.push(`<div class="summary-item"><div class="summary-val">${objectives.length}</div><div class="summary-lbl">Objectives</div></div>`);
  h.push(`<div class="summary-item"><div class="summary-val">${totalKRs}</div><div class="summary-lbl">Key Results</div></div>`);
  h.push(`<div class="summary-item"><div class="summary-val" style="color:${avgColor}">${avgProgress}%</div><div class="summary-lbl">Overall Progress</div></div>`);
  h.push(`<div class="summary-item"><div class="summary-val" style="color:${avgColor}">${statusLabel(avgProgress)}</div><div class="summary-lbl">Status</div></div>`);
  h.push('</div></div>');

  h.push('</body></html>');
  return h.join('\n');
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const okrPlannerTool: UnifiedTool = {
  name: 'create_okr_plan',
  description: `Create OKR plans with objectives, key results, targets, and progress tracking.
Use this when the user wants to define, plan, or track Objectives and Key Results for a team or organization.
Returns a complete OKR document with numbered objectives, measurable key results, progress bars, and status indicators.`,
  parameters: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Plan title (e.g., "Engineering OKRs")' },
      period: { type: 'string', description: 'Time period (e.g., "Q2 2026")' },
      objectives: {
        type: 'array', description: 'List of objectives with key results',
        items: {
          type: 'object', required: ['objective', 'key_results'],
          properties: {
            objective: { type: 'string', description: 'The objective statement' },
            key_results: {
              type: 'array', description: 'Measurable key results for this objective',
              items: {
                type: 'object', required: ['description', 'target'],
                properties: {
                  description: { type: 'string', description: 'Key result description' },
                  target: { type: 'string', description: 'Target value (e.g., "95")' },
                  current: { type: 'string', description: 'Current value (e.g., "60")' },
                  unit: { type: 'string', description: 'Unit of measurement (e.g., "%", "users", "$")' },
                },
              },
            },
          },
        },
      },
      team: { type: 'string', description: 'Team or department name' },
      owner: { type: 'string', description: 'Plan owner or responsible person' },
      alignment_notes: { type: 'string', description: 'How these OKRs align with company goals' },
      format: { type: 'string', enum: ['markdown', 'html'], description: 'Output format. Default: "markdown"' },
    },
    required: ['title', 'period', 'objectives'],
  },
};

// ============================================================================
// AVAILABILITY CHECK
// ============================================================================

export function isOkrPlannerAvailable(): boolean {
  return true;
}

// ============================================================================
// TOOL EXECUTOR
// ============================================================================

export async function executeOkrPlanner(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const args = toolCall.arguments as {
    title: string;
    period: string;
    objectives: Objective[];
    team?: string;
    owner?: string;
    alignment_notes?: string;
    format?: 'markdown' | 'html';
  };

  if (!args.title?.trim()) {
    return { toolCallId: toolCall.id, content: 'Error: title parameter is required', isError: true };
  }
  if (!args.period?.trim()) {
    return { toolCallId: toolCall.id, content: 'Error: period parameter is required', isError: true };
  }
  if (!Array.isArray(args.objectives) || args.objectives.length === 0) {
    return { toolCallId: toolCall.id, content: 'Error: objectives array is required and must not be empty', isError: true };
  }

  for (let i = 0; i < args.objectives.length; i++) {
    const obj = args.objectives[i];
    if (!obj.objective?.trim()) {
      return { toolCallId: toolCall.id, content: `Error: objective at index ${i} is missing the "objective" field`, isError: true };
    }
    if (!Array.isArray(obj.key_results) || obj.key_results.length === 0) {
      return { toolCallId: toolCall.id, content: `Error: objective at index ${i} must have at least one key result`, isError: true };
    }
    for (let j = 0; j < obj.key_results.length; j++) {
      const kr = obj.key_results[j];
      if (!kr.description?.trim()) {
        return { toolCallId: toolCall.id, content: `Error: key result at objective ${i}, index ${j} is missing "description"`, isError: true };
      }
      if (!kr.target?.trim()) {
        return { toolCallId: toolCall.id, content: `Error: key result at objective ${i}, index ${j} is missing "target"`, isError: true };
      }
    }
  }

  const fmt = args.format ?? 'markdown';
  const team = args.team ?? '';
  const owner = args.owner ?? '';
  const alignmentNotes = args.alignment_notes ?? '';
  let totalKRs = 0;
  let totalProgress = 0;
  for (const obj of args.objectives) {
    for (const kr of obj.key_results) {
      totalKRs++;
      totalProgress += calcProgress(kr);
    }
  }
  const avgProgress = totalKRs > 0 ? Math.round(totalProgress / totalKRs) : 0;

  try {
    const formatted = fmt === 'html'
      ? formatHtml(args.title, args.period, team, owner, alignmentNotes, args.objectives)
      : formatMarkdown(args.title, args.period, team, owner, alignmentNotes, args.objectives);

    return {
      toolCallId: toolCall.id,
      content: JSON.stringify({
        success: true,
        message: `OKR plan created: ${args.title} (${args.period})`,
        format: fmt,
        formatted_output: formatted,
        summary: {
          title: args.title,
          period: args.period,
          team: team || null,
          owner: owner || null,
          objectives_count: args.objectives.length,
          key_results_count: totalKRs,
          overall_progress: avgProgress,
          status: statusLabel(avgProgress),
        },
      }),
    };
  } catch (error) {
    return {
      toolCallId: toolCall.id,
      content: `Error generating OKR plan: ${(error as Error).message}`,
      isError: true,
    };
  }
}

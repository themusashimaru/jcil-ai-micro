/**
 * RISK ASSESSMENT TOOL — Generate risk assessment registers with likelihood/impact
 * scoring, heat maps, and mitigation tracking.
 * No external dependencies. Created: 2026-03-19
 */
import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// TYPES
// ============================================================================

type RiskStatus = 'open' | 'mitigated' | 'accepted' | 'closed';

interface Risk {
  name: string;
  description: string;
  likelihood: 1 | 2 | 3 | 4 | 5;
  impact: 1 | 2 | 3 | 4 | 5;
  category?: string;
  mitigation?: string;
  owner?: string;
  status?: RiskStatus;
}

type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

// ============================================================================
// HELPERS
// ============================================================================

function esc(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function riskScore(r: Risk): number {
  return r.likelihood * r.impact;
}

function riskLevel(score: number): RiskLevel {
  if (score >= 20) return 'critical';
  if (score >= 13) return 'high';
  if (score >= 6) return 'medium';
  return 'low';
}

function levelEmoji(level: RiskLevel): string {
  const map: Record<RiskLevel, string> = { critical: '!!!', high: '!!', medium: '!', low: '-' };
  return map[level];
}

function countByLevel(risks: Risk[]): Record<RiskLevel, number> {
  const counts: Record<RiskLevel, number> = { low: 0, medium: 0, high: 0, critical: 0 };
  for (const r of risks) counts[riskLevel(riskScore(r))]++;
  return counts;
}

// ============================================================================
// MARKDOWN FORMATTER
// ============================================================================

function formatMarkdown(
  title: string, risks: Risk[], project: string, preparedBy: string,
  date: string, riskAppetite: string,
): string {
  const L: string[] = [];
  L.push(`# Risk Assessment: ${title}`, '');
  if (project) L.push(`**Project:** ${project}`);
  if (preparedBy) L.push(`**Prepared by:** ${preparedBy}`);
  if (date) L.push(`**Date:** ${date}`);
  if (riskAppetite) L.push(`**Risk Appetite:** ${riskAppetite}`);
  if (project || preparedBy || date || riskAppetite) L.push('');

  // Summary
  const counts = countByLevel(risks);
  L.push('## Summary', '');
  L.push(`- **Total Risks:** ${risks.length}`);
  L.push(`- **Critical:** ${counts.critical}`);
  L.push(`- **High:** ${counts.high}`);
  L.push(`- **Medium:** ${counts.medium}`);
  L.push(`- **Low:** ${counts.low}`);
  L.push('');

  // Risk register table
  L.push('## Risk Register', '');
  L.push('| # | Risk | Category | L | I | Score | Level | Status | Owner |');
  L.push('|---|------|----------|---|---|-------|-------|--------|-------|');
  for (let i = 0; i < risks.length; i++) {
    const r = risks[i];
    const score = riskScore(r);
    const level = riskLevel(score);
    L.push(`| ${i + 1} | ${r.name} | ${r.category ?? '-'} | ${r.likelihood} | ${r.impact} | ${score} | ${level.toUpperCase()} ${levelEmoji(level)} | ${r.status ?? 'open'} | ${r.owner ?? '-'} |`);
  }
  L.push('');

  // Detail sections
  L.push('## Risk Details', '');
  for (let i = 0; i < risks.length; i++) {
    const r = risks[i];
    const score = riskScore(r);
    const level = riskLevel(score);
    L.push(`### ${i + 1}. ${r.name} [${level.toUpperCase()}]`, '');
    L.push(`**Description:** ${r.description}`);
    L.push(`**Likelihood:** ${r.likelihood}/5 | **Impact:** ${r.impact}/5 | **Score:** ${score}/25`);
    if (r.mitigation) L.push(`**Mitigation:** ${r.mitigation}`);
    if (r.owner) L.push(`**Owner:** ${r.owner}`);
    L.push(`**Status:** ${r.status ?? 'open'}`, '');
  }

  // Scoring legend
  L.push('## Scoring Guide', '');
  L.push('| Score Range | Level |', '|-------------|-------|');
  L.push('| 1-5 | Low |', '| 6-12 | Medium |', '| 13-19 | High |', '| 20-25 | Critical |');
  L.push('');

  return L.join('\n');
}

// ============================================================================
// HTML FORMATTER
// ============================================================================

const CSS = [
  'body{font-family:system-ui,sans-serif;max-width:1000px;margin:0 auto;padding:20px;color:#e0e0e0;background:#121225}',
  'h1{color:#c0c8e0;border-bottom:3px solid #1a1a2e;padding-bottom:10px;text-align:center}',
  'h2{color:#a0b0d0;margin-top:28px;border-bottom:1px solid #2a2a4e;padding-bottom:6px}',
  'h3{color:#8090b0;margin-top:16px}',
  '.meta{display:flex;flex-wrap:wrap;gap:8px 24px;background:#1a1a2e;padding:12px 16px;border-radius:8px;margin-bottom:24px}',
  '.meta span{color:#8090b0}.meta strong{color:#c0c8e0}',
  '.dashboard{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:12px;margin:16px 0}',
  '.dash-card{padding:14px;border-radius:8px;text-align:center}',
  '.dash-card .num{font-size:1.8em;font-weight:700}.dash-card .lbl{font-size:.85em;margin-top:4px}',
  '.dc-total{background:#1a1a2e}.dc-total .num{color:#c0c8e0}.dc-total .lbl{color:#8090b0}',
  '.dc-critical{background:#3a1010}.dc-critical .num{color:#ff6060}.dc-critical .lbl{color:#ff9090}',
  '.dc-high{background:#3a2010}.dc-high .num{color:#ff9040}.dc-high .lbl{color:#ffb070}',
  '.dc-medium{background:#3a3a10}.dc-medium .num{color:#e8e040}.dc-medium .lbl{color:#e8e080}',
  '.dc-low{background:#103a10}.dc-low .num{color:#60d060}.dc-low .lbl{color:#90e090}',
  '.risk-card{border:1px solid #2a2a4e;border-radius:8px;padding:16px;margin:12px 0;background:#16162a}',
  '.risk-card h3{margin:0 0 8px 0}',
  '.risk-card p{margin:6px 0;color:#b0b8d0}',
  '.risk-meta{font-size:.9em;color:#7080a0;margin:4px 0}',
  '.badge{display:inline-block;padding:2px 10px;border-radius:12px;font-size:.8em;font-weight:600}',
  '.b-critical{background:#5a1010;color:#ff6060}.b-high{background:#4a2510;color:#ff9040}',
  '.b-medium{background:#3a3a10;color:#e8e040}.b-low{background:#103a10;color:#60d060}',
  '.b-open{background:#1a2a4a;color:#70a0ff}.b-mitigated{background:#1a3a2a;color:#60d060}',
  '.b-accepted{background:#3a3a10;color:#e8e040}.b-closed{background:#2a2a3a;color:#8090b0}',
  '.score-bar{display:flex;align-items:center;gap:8px;margin:8px 0}',
  '.score-fill{height:8px;border-radius:4px}.score-num{font-weight:700;font-size:.9em}',
  '.heat-map{margin:16px 0}.heat-map table{width:auto;border-collapse:collapse}',
  '.heat-map th,.heat-map td{width:48px;height:40px;text-align:center;border:1px solid #2a2a4e;font-size:.85em}',
  '.heat-map th{background:#1a1a2e;color:#8090b0;font-weight:600}',
  '.hm-0{background:#1e1e30;color:#555}.hm-low{background:#103a10;color:#60d060}',
  '.hm-med{background:#3a3a10;color:#e8e040}.hm-high{background:#4a2510;color:#ff9040}',
  '.hm-crit{background:#5a1010;color:#ff6060}',
  '@media print{body{background:#fff;color:#1a1a1a;padding:0}h1{color:#1a1a2e}',
  '.meta,.dashboard,.risk-card{background:#f5f5fa;border-color:#ccc}th{background:#1a1a2e;color:#fff}}',
].join('');

function levelClass(level: RiskLevel): string {
  return `b-${level}`;
}

function scoreColor(level: RiskLevel): string {
  const map: Record<RiskLevel, string> = { critical: '#ff6060', high: '#ff9040', medium: '#e8e040', low: '#60d060' };
  return map[level];
}

function heatMapClass(score: number): string {
  if (score === 0) return 'hm-0';
  const level = riskLevel(score);
  const map: Record<RiskLevel, string> = { critical: 'hm-crit', high: 'hm-high', medium: 'hm-med', low: 'hm-low' };
  return map[level];
}

function buildHeatMap(risks: Risk[]): string {
  // 5x5 grid: rows = impact (5 top to 1 bottom), cols = likelihood (1 left to 5 right)
  const grid: number[][] = Array.from({ length: 5 }, () => Array(5).fill(0) as number[]);
  for (const r of risks) grid[5 - r.impact][r.likelihood - 1]++;

  const h: string[] = [];
  h.push('<div class="heat-map"><h3 style="color:#a0b0d0">Risk Heat Map</h3>');
  h.push('<table><thead><tr><th>Impact \\ Likelihood</th>');
  for (let l = 1; l <= 5; l++) h.push(`<th>${l}</th>`);
  h.push('</tr></thead><tbody>');
  for (let i = 5; i >= 1; i--) {
    h.push(`<tr><th>${i}</th>`);
    for (let l = 1; l <= 5; l++) {
      const count = grid[5 - i][l - 1];
      const score = i * l;
      h.push(`<td class="${heatMapClass(score)}">${count > 0 ? count : ''}</td>`);
    }
    h.push('</tr>');
  }
  h.push('</tbody></table></div>');
  return h.join('\n');
}

function formatHtml(
  title: string, risks: Risk[], project: string, preparedBy: string,
  date: string, riskAppetite: string,
): string {
  const h: string[] = [];
  h.push(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Risk: ${esc(title)}</title>`);
  h.push(`<style>${CSS}</style></head><body>`);
  h.push(`<h1>Risk Assessment: ${esc(title)}</h1>`);

  if (project || preparedBy || date || riskAppetite) {
    h.push('<div class="meta">');
    if (project) h.push(`<span><strong>Project:</strong> ${esc(project)}</span>`);
    if (preparedBy) h.push(`<span><strong>Prepared by:</strong> ${esc(preparedBy)}</span>`);
    if (date) h.push(`<span><strong>Date:</strong> ${esc(date)}</span>`);
    if (riskAppetite) h.push(`<span><strong>Risk Appetite:</strong> ${esc(riskAppetite)}</span>`);
    h.push('</div>');
  }

  // Dashboard
  const counts = countByLevel(risks);
  h.push('<h2>Summary Dashboard</h2><div class="dashboard">');
  h.push(`<div class="dash-card dc-total"><div class="num">${risks.length}</div><div class="lbl">Total Risks</div></div>`);
  h.push(`<div class="dash-card dc-critical"><div class="num">${counts.critical}</div><div class="lbl">Critical</div></div>`);
  h.push(`<div class="dash-card dc-high"><div class="num">${counts.high}</div><div class="lbl">High</div></div>`);
  h.push(`<div class="dash-card dc-medium"><div class="num">${counts.medium}</div><div class="lbl">Medium</div></div>`);
  h.push(`<div class="dash-card dc-low"><div class="num">${counts.low}</div><div class="lbl">Low</div></div>`);
  h.push('</div>');

  // Heat map
  h.push(buildHeatMap(risks));

  // Risk cards
  h.push('<h2>Risk Register</h2>');
  for (let i = 0; i < risks.length; i++) {
    const r = risks[i];
    const score = riskScore(r);
    const level = riskLevel(score);
    const status = r.status ?? 'open';
    const color = scoreColor(level);
    const pct = Math.round((score / 25) * 100);

    h.push(`<div class="risk-card" style="border-left:4px solid ${color}">`);
    h.push(`<h3>${i + 1}. ${esc(r.name)} <span class="badge ${levelClass(level)}">${level.toUpperCase()}</span>`);
    h.push(` <span class="badge b-${status}">${status}</span></h3>`);
    h.push(`<p>${esc(r.description)}</p>`);
    h.push('<div class="score-bar">');
    h.push(`<span class="score-num" style="color:${color}">${score}/25</span>`);
    h.push(`<div style="flex:1;background:#1a1a2e;border-radius:4px;height:8px"><div class="score-fill" style="width:${pct}%;background:${color}"></div></div>`);
    h.push('</div>');
    h.push(`<div class="risk-meta"><strong>Likelihood:</strong> ${r.likelihood}/5 | <strong>Impact:</strong> ${r.impact}/5`);
    if (r.category) h.push(` | <strong>Category:</strong> ${esc(r.category)}`);
    if (r.owner) h.push(` | <strong>Owner:</strong> ${esc(r.owner)}`);
    h.push('</div>');
    if (r.mitigation) h.push(`<div class="risk-meta"><strong>Mitigation:</strong> ${esc(r.mitigation)}</div>`);
    h.push('</div>');
  }

  h.push('</body></html>');
  return h.join('\n');
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const riskAssessmentTool: UnifiedTool = {
  name: 'create_risk_assessment',
  description: `Generate risk assessment registers with likelihood/impact scoring and heat maps.

Use this when:
- User needs to identify and document project risks
- User wants to create a risk register or risk matrix
- User needs likelihood and impact scoring for risks
- User asks about risk analysis, risk management, or risk mitigation

Returns a risk register with scored risks, heat map visualization, and summary dashboard.`,
  parameters: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Assessment title (e.g., "Q2 Product Launch Risk Assessment")' },
      risks: {
        type: 'array',
        description: 'List of risks to assess',
        items: {
          type: 'object',
          required: ['name', 'description', 'likelihood', 'impact'],
          properties: {
            name: { type: 'string', description: 'Short risk name' },
            description: { type: 'string', description: 'Detailed risk description' },
            likelihood: { type: 'number', description: 'Likelihood score: 1=rare, 2=unlikely, 3=possible, 4=likely, 5=almost certain' },
            impact: { type: 'number', description: 'Impact score: 1=negligible, 2=minor, 3=moderate, 4=major, 5=catastrophic' },
            category: { type: 'string', description: 'Risk category (e.g., "Technical", "Financial")' },
            mitigation: { type: 'string', description: 'Mitigation strategy' },
            owner: { type: 'string', description: 'Risk owner' },
            status: { type: 'string', enum: ['open', 'mitigated', 'accepted', 'closed'], description: 'Current status. Default: "open"' },
          },
        },
      },
      project: { type: 'string', description: 'Project name' },
      prepared_by: { type: 'string', description: 'Author of the assessment' },
      date: { type: 'string', description: 'Date of assessment' },
      risk_appetite: { type: 'string', description: 'Organization risk appetite statement' },
      format: { type: 'string', enum: ['markdown', 'html'], description: 'Output format. Default: "markdown"' },
    },
    required: ['title', 'risks'],
  },
};

// ============================================================================
// AVAILABILITY CHECK
// ============================================================================

export function isRiskAssessmentAvailable(): boolean {
  return true;
}

// ============================================================================
// TOOL EXECUTOR
// ============================================================================

export async function executeRiskAssessment(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const args = toolCall.arguments as {
    title: string;
    risks: Risk[];
    project?: string;
    prepared_by?: string;
    date?: string;
    risk_appetite?: string;
    format?: 'markdown' | 'html';
  };

  if (!args.title?.trim()) {
    return { toolCallId: toolCall.id, content: 'Error: title parameter is required', isError: true };
  }
  if (!Array.isArray(args.risks) || args.risks.length === 0) {
    return { toolCallId: toolCall.id, content: 'Error: risks array is required and must not be empty', isError: true };
  }

  for (let i = 0; i < args.risks.length; i++) {
    const r = args.risks[i];
    if (!r.name?.trim()) {
      return { toolCallId: toolCall.id, content: `Error: risk at index ${i} is missing required field (name)`, isError: true };
    }
    if (!r.description?.trim()) {
      return { toolCallId: toolCall.id, content: `Error: risk at index ${i} is missing required field (description)`, isError: true };
    }
    if (typeof r.likelihood !== 'number' || r.likelihood < 1 || r.likelihood > 5) {
      return { toolCallId: toolCall.id, content: `Error: risk at index ${i} has invalid likelihood (must be 1-5)`, isError: true };
    }
    if (typeof r.impact !== 'number' || r.impact < 1 || r.impact > 5) {
      return { toolCallId: toolCall.id, content: `Error: risk at index ${i} has invalid impact (must be 1-5)`, isError: true };
    }
    if (r.status && !['open', 'mitigated', 'accepted', 'closed'].includes(r.status)) {
      return { toolCallId: toolCall.id, content: `Error: risk at index ${i} has invalid status`, isError: true };
    }
  }

  const fmt = args.format ?? 'markdown';
  const project = args.project ?? '';
  const preparedBy = args.prepared_by ?? '';
  const date = args.date ?? '';
  const riskAppetite = args.risk_appetite ?? '';
  const counts = countByLevel(args.risks);
  const avgScore = args.risks.reduce((sum, r) => sum + riskScore(r), 0) / args.risks.length;

  try {
    const formatted = fmt === 'html'
      ? formatHtml(args.title, args.risks, project, preparedBy, date, riskAppetite)
      : formatMarkdown(args.title, args.risks, project, preparedBy, date, riskAppetite);

    return {
      toolCallId: toolCall.id,
      content: JSON.stringify({
        success: true,
        message: `Risk assessment created: ${args.title}`,
        format: fmt,
        formatted_output: formatted,
        summary: {
          title: args.title,
          project: project || null,
          total_risks: args.risks.length,
          critical_count: counts.critical,
          high_count: counts.high,
          medium_count: counts.medium,
          low_count: counts.low,
          average_score: Math.round(avgScore * 10) / 10,
        },
      }),
    };
  } catch (error) {
    return {
      toolCallId: toolCall.id,
      content: `Error generating risk assessment: ${(error as Error).message}`,
      isError: true,
    };
  }
}

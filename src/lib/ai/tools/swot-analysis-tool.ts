/**
 * SWOT ANALYSIS TOOL — Strategic SWOT analysis document generator.
 * Produces professional SWOT documents with strengths, weaknesses,
 * opportunities, threats, strategic recommendations, and action items.
 * No external dependencies. Created: 2026-03-19
 */
import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// TYPES
// ============================================================================

interface ActionItem {
  priority: 'high' | 'medium' | 'low';
  action: string;
  owner: string;
  deadline: string;
}

// ============================================================================
// HELPERS
// ============================================================================

function esc(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function priorityEmoji(p: string): string {
  if (p === 'high') return '🔴';
  if (p === 'medium') return '🟡';
  return '🟢';
}

// ============================================================================
// MARKDOWN FORMATTER
// ============================================================================

function formatMarkdown(
  title: string, company: string, industry: string, date: string, preparedBy: string,
  strengths: string[], weaknesses: string[], opportunities: string[], threats: string[],
  recommendations: string[], actionItems: ActionItem[],
): string {
  const L: string[] = [];
  L.push(`# SWOT Analysis: ${title}`, '');
  L.push('| Field | Value |', '|-------|-------|');
  L.push(`| **Company / Project** | ${company} |`);
  if (industry) L.push(`| **Industry** | ${industry} |`);
  if (date) L.push(`| **Date** | ${date} |`);
  if (preparedBy) L.push(`| **Prepared By** | ${preparedBy} |`);
  L.push('');

  L.push('## SWOT Matrix', '');
  L.push('### Internal Factors', '');
  L.push('| Strengths | Weaknesses |', '|-----------|------------|');
  for (let i = 0; i < Math.max(strengths.length, weaknesses.length); i++) {
    const s = i < strengths.length ? `✅ ${strengths[i]}` : '';
    const w = i < weaknesses.length ? `⚠️ ${weaknesses[i]}` : '';
    L.push(`| ${s} | ${w} |`);
  }
  L.push('');

  L.push('### External Factors', '');
  L.push('| Opportunities | Threats |', '|---------------|---------|');
  for (let i = 0; i < Math.max(opportunities.length, threats.length); i++) {
    const o = i < opportunities.length ? `🔵 ${opportunities[i]}` : '';
    const t = i < threats.length ? `🔴 ${threats[i]}` : '';
    L.push(`| ${o} | ${t} |`);
  }
  L.push('');

  if (recommendations.length > 0) {
    L.push('## Strategic Recommendations', '');
    for (let i = 0; i < recommendations.length; i++) {
      L.push(`${i + 1}. ${recommendations[i]}`);
    }
    L.push('');
  }

  if (actionItems.length > 0) {
    L.push('## Action Items', '');
    L.push('| Priority | Action | Owner | Deadline |', '|----------|--------|-------|----------|');
    for (const a of actionItems) {
      L.push(`| ${priorityEmoji(a.priority)} ${a.priority.toUpperCase()} | ${a.action} | ${a.owner} | ${a.deadline} |`);
    }
    L.push('');
  }

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
  '.meta-item{display:flex;gap:8px}.meta-label{font-weight:700;color:#8090b0;min-width:140px}.meta-value{color:#c0c8e0}',
  '.grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:16px 0}',
  '.quad{border-radius:8px;padding:16px;min-height:120px}',
  '.quad h3{margin:0 0 12px 0;font-size:1.1em;border-bottom:2px solid rgba(255,255,255,.15);padding-bottom:6px}',
  '.quad ul{margin:0;padding-left:20px;list-style:disc}',
  '.quad li{padding:3px 0;line-height:1.5}',
  '.s{background:#1a3a2a;border:1px solid #2a5a3a}.s h3{color:#6fcf97}',
  '.w{background:#3a3520;border:1px solid #5a5530}.w h3{color:#f2c94c}',
  '.o{background:#1a2a3a;border:1px solid #2a4a6a}.o h3{color:#56ccf2}',
  '.t{background:#3a1a1a;border:1px solid #5a2a2a}.t h3{color:#eb5757}',
  '.rec{background:#1a1a2e;border-radius:8px;padding:16px 20px;margin:12px 0}',
  '.rec ol{margin:0;padding-left:20px}.rec li{padding:4px 0;color:#c0c8e0;line-height:1.5}',
  'table{width:100%;border-collapse:collapse;margin:12px 0}',
  'th,td{border:1px solid #2a2a4e;padding:8px 12px;text-align:left}',
  'th{background:#1a1a2e;color:#c0c8e0}tr:nth-child(even){background:#16162a}',
  '.badge{display:inline-block;padding:2px 10px;border-radius:12px;font-size:.85em;font-weight:700;text-transform:uppercase}',
  '.badge-high{background:#5a1a1a;color:#eb5757}.badge-medium{background:#3a3520;color:#f2c94c}.badge-low{background:#1a3a2a;color:#6fcf97}',
  '@media print{body{background:#fff;color:#1a1a1a;padding:0}h1{color:#1a1a2e}',
  '.meta,.rec{background:#f5f5fa;border-color:#ccc}th{background:#1a1a2e;color:#fff}',
  '.s{background:#e8f5e9;border-color:#4caf50}.w{background:#fff8e1;border-color:#ff9800}',
  '.o{background:#e3f2fd;border-color:#2196f3}.t{background:#ffebee;border-color:#f44336}}',
].join('');

function formatHtml(
  title: string, company: string, industry: string, date: string, preparedBy: string,
  strengths: string[], weaknesses: string[], opportunities: string[], threats: string[],
  recommendations: string[], actionItems: ActionItem[],
): string {
  const h: string[] = [];
  h.push(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>SWOT Analysis: ${esc(title)}</title>`);
  h.push(`<style>${CSS}</style></head><body>`);
  h.push(`<h1>SWOT Analysis: ${esc(title)}</h1>`);
  h.push('<div class="meta">');
  h.push(`<div class="meta-item"><span class="meta-label">Company / Project:</span><span class="meta-value">${esc(company)}</span></div>`);
  if (industry) h.push(`<div class="meta-item"><span class="meta-label">Industry:</span><span class="meta-value">${esc(industry)}</span></div>`);
  if (date) h.push(`<div class="meta-item"><span class="meta-label">Date:</span><span class="meta-value">${esc(date)}</span></div>`);
  if (preparedBy) h.push(`<div class="meta-item"><span class="meta-label">Prepared By:</span><span class="meta-value">${esc(preparedBy)}</span></div>`);
  h.push('</div>');

  h.push('<h2>SWOT Matrix</h2>');
  h.push('<div class="grid">');
  h.push('<div class="quad s"><h3>Strengths</h3><ul>');
  for (const s of strengths) h.push(`<li>${esc(s)}</li>`);
  h.push('</ul></div>');
  h.push('<div class="quad w"><h3>Weaknesses</h3><ul>');
  for (const w of weaknesses) h.push(`<li>${esc(w)}</li>`);
  h.push('</ul></div>');
  h.push('<div class="quad o"><h3>Opportunities</h3><ul>');
  for (const o of opportunities) h.push(`<li>${esc(o)}</li>`);
  h.push('</ul></div>');
  h.push('<div class="quad t"><h3>Threats</h3><ul>');
  for (const t of threats) h.push(`<li>${esc(t)}</li>`);
  h.push('</ul></div>');
  h.push('</div>');

  if (recommendations.length > 0) {
    h.push('<h2>Strategic Recommendations</h2><div class="rec"><ol>');
    for (const r of recommendations) h.push(`<li>${esc(r)}</li>`);
    h.push('</ol></div>');
  }

  if (actionItems.length > 0) {
    h.push('<h2>Action Items</h2>');
    h.push('<table><thead><tr><th>Priority</th><th>Action</th><th>Owner</th><th>Deadline</th></tr></thead><tbody>');
    for (const a of actionItems) {
      const cls = `badge badge-${a.priority}`;
      h.push(`<tr><td><span class="${cls}">${esc(a.priority)}</span></td><td>${esc(a.action)}</td><td>${esc(a.owner)}</td><td>${esc(a.deadline)}</td></tr>`);
    }
    h.push('</tbody></table>');
  }

  h.push('</body></html>');
  return h.join('\n');
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const swotAnalysisTool: UnifiedTool = {
  name: 'create_swot_analysis',
  description: `Generate strategic SWOT analysis documents with strengths, weaknesses, opportunities, threats, and action plans.
Use this when the user wants to analyze a business, project, or strategy using the SWOT framework.
Returns a complete SWOT analysis with a 2x2 matrix, strategic recommendations, and prioritized action items.`,
  parameters: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Analysis title (e.g., "Q2 2026 Market Position")' },
      company_or_project: { type: 'string', description: 'Company or project being analyzed' },
      strengths: { type: 'array', items: { type: 'string' }, description: 'Internal strengths' },
      weaknesses: { type: 'array', items: { type: 'string' }, description: 'Internal weaknesses' },
      opportunities: { type: 'array', items: { type: 'string' }, description: 'External opportunities' },
      threats: { type: 'array', items: { type: 'string' }, description: 'External threats' },
      industry: { type: 'string', description: 'Industry or sector' },
      date: { type: 'string', description: 'Analysis date' },
      prepared_by: { type: 'string', description: 'Author of the analysis' },
      strategic_recommendations: { type: 'array', items: { type: 'string' }, description: 'Strategic recommendations based on SWOT findings' },
      action_items: {
        type: 'array', description: 'Prioritized action items',
        items: {
          type: 'object',
          properties: {
            priority: { type: 'string', enum: ['high', 'medium', 'low'], description: 'Priority level' },
            action: { type: 'string', description: 'Action to take' },
            owner: { type: 'string', description: 'Person or team responsible' },
            deadline: { type: 'string', description: 'Target deadline' },
          },
          required: ['priority', 'action', 'owner', 'deadline'],
        },
      },
      format: { type: 'string', enum: ['markdown', 'html'], description: 'Output format. Default: "markdown"' },
    },
    required: ['title', 'company_or_project', 'strengths', 'weaknesses', 'opportunities', 'threats'],
  },
};

// ============================================================================
// AVAILABILITY CHECK
// ============================================================================

export function isSwotAnalysisAvailable(): boolean {
  return true;
}

// ============================================================================
// TOOL EXECUTOR
// ============================================================================

export async function executeSwotAnalysis(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const args = toolCall.arguments as {
    title: string;
    company_or_project: string;
    strengths: string[];
    weaknesses: string[];
    opportunities: string[];
    threats: string[];
    industry?: string;
    date?: string;
    prepared_by?: string;
    strategic_recommendations?: string[];
    action_items?: ActionItem[];
    format?: 'markdown' | 'html';
  };

  if (!args.title?.trim()) {
    return { toolCallId: toolCall.id, content: 'Error: title parameter is required', isError: true };
  }
  if (!args.company_or_project?.trim()) {
    return { toolCallId: toolCall.id, content: 'Error: company_or_project parameter is required', isError: true };
  }
  if (!Array.isArray(args.strengths) || args.strengths.length === 0) {
    return { toolCallId: toolCall.id, content: 'Error: strengths array is required and must not be empty', isError: true };
  }
  if (!Array.isArray(args.weaknesses) || args.weaknesses.length === 0) {
    return { toolCallId: toolCall.id, content: 'Error: weaknesses array is required and must not be empty', isError: true };
  }
  if (!Array.isArray(args.opportunities) || args.opportunities.length === 0) {
    return { toolCallId: toolCall.id, content: 'Error: opportunities array is required and must not be empty', isError: true };
  }
  if (!Array.isArray(args.threats) || args.threats.length === 0) {
    return { toolCallId: toolCall.id, content: 'Error: threats array is required and must not be empty', isError: true };
  }

  if (args.action_items) {
    for (let i = 0; i < args.action_items.length; i++) {
      const a = args.action_items[i];
      if (!a.priority || !a.action || !a.owner || !a.deadline) {
        return {
          toolCallId: toolCall.id,
          content: `Error: action_items entry at index ${i} is missing required fields (priority, action, owner, deadline)`,
          isError: true,
        };
      }
      if (!['high', 'medium', 'low'].includes(a.priority)) {
        return {
          toolCallId: toolCall.id,
          content: `Error: action_items entry at index ${i} has invalid priority "${a.priority}" (must be high, medium, or low)`,
          isError: true,
        };
      }
    }
  }

  const fmt = args.format ?? 'markdown';
  const industry = args.industry ?? '';
  const date = args.date ?? '';
  const preparedBy = args.prepared_by ?? '';
  const recommendations = args.strategic_recommendations ?? [];
  const actionItems = args.action_items ?? [];

  try {
    const formatted = fmt === 'html'
      ? formatHtml(args.title, args.company_or_project, industry, date, preparedBy, args.strengths, args.weaknesses, args.opportunities, args.threats, recommendations, actionItems)
      : formatMarkdown(args.title, args.company_or_project, industry, date, preparedBy, args.strengths, args.weaknesses, args.opportunities, args.threats, recommendations, actionItems);

    return {
      toolCallId: toolCall.id,
      content: JSON.stringify({
        success: true,
        message: `SWOT analysis created: ${args.title}`,
        format: fmt,
        formatted_output: formatted,
        summary: {
          title: args.title,
          company_or_project: args.company_or_project,
          industry: industry || null,
          strengths_count: args.strengths.length,
          weaknesses_count: args.weaknesses.length,
          opportunities_count: args.opportunities.length,
          threats_count: args.threats.length,
          recommendations_count: recommendations.length,
          action_items_count: actionItems.length,
        },
      }),
    };
  } catch (error) {
    return {
      toolCallId: toolCall.id,
      content: `Error generating SWOT analysis: ${(error as Error).message}`,
      isError: true,
    };
  }
}

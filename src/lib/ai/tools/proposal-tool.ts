/**
 * PROPOSAL TOOL — Business proposal and RFP response generator.
 * Produces professional proposals with scope, pricing, timeline, and team.
 * No external dependencies. Created: 2026-03-19
 */
import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ── Types ───────────────────────────────────────────────────────────────────
interface ScopeItem { deliverable: string; description: string }
interface TimelinePhase { phase: string; duration: string; deliverables: string[] }
interface PricingItem { item: string; quantity?: number; unit_price?: string; total: string }
interface TeamMember { name: string; role: string; qualifications?: string }

// ── Helpers ─────────────────────────────────────────────────────────────────
function esc(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Markdown Formatter ──────────────────────────────────────────────────────
function formatMarkdown(
  title: string, clientName: string, execSummary: string, scope: ScopeItem[],
  companyName: string, preparedBy: string, date: string, validUntil: string,
  objectives: string[], timeline: TimelinePhase[], pricing: PricingItem[],
  totalPrice: string, terms: string[], team: TeamMember[],
  whyUs: string[], nextSteps: string[], signatures: boolean,
): string {
  const L: string[] = [];
  L.push(`# ${title}`, '', '---', '');
  const meta: string[] = [`**Prepared for:** ${clientName}`];
  if (companyName) meta.push(`**Prepared by:** ${companyName}`);
  if (preparedBy) meta.push(`**Author:** ${preparedBy}`);
  if (date) meta.push(`**Date:** ${date}`);
  if (validUntil) meta.push(`**Valid Until:** ${validUntil}`);
  L.push(meta.join('  \n'), '', '---', '', '## Executive Summary', '', execSummary, '');
  if (objectives.length > 0) {
    L.push('## Objectives', '');
    for (const o of objectives) L.push(`- ${o}`);
    L.push('');
  }
  L.push('## Scope of Work', '', '| Deliverable | Description |', '|-------------|-------------|');
  for (const s of scope) L.push(`| ${s.deliverable} | ${s.description} |`);
  L.push('');
  if (timeline.length > 0) {
    L.push('## Timeline', '');
    for (const t of timeline) {
      L.push(`### ${t.phase} (${t.duration})`, '');
      for (const d of t.deliverables) L.push(`- ${d}`);
      L.push('');
    }
  }
  if (pricing.length > 0) {
    L.push('## Pricing', '');
    const hasQty = pricing.some((p) => p.quantity != null);
    if (hasQty) {
      L.push('| Item | Qty | Unit Price | Total |', '|------|-----|------------|-------|');
      for (const p of pricing) L.push(`| ${p.item} | ${p.quantity ?? '-'} | ${p.unit_price ?? '-'} | ${p.total} |`);
    } else {
      L.push('| Item | Total |', '|------|-------|');
      for (const p of pricing) L.push(`| ${p.item} | ${p.total} |`);
    }
    if (totalPrice) L.push(`| **Total** | | | **${totalPrice}** |`);
    L.push('');
  }
  if (terms.length > 0) {
    L.push('## Terms & Conditions', '');
    for (let i = 0; i < terms.length; i++) L.push(`${i + 1}. ${terms[i]}`);
    L.push('');
  }
  if (team.length > 0) {
    L.push('## Project Team', '');
    for (const m of team) {
      L.push(`**${m.name}** — ${m.role}`);
      if (m.qualifications) L.push(`  ${m.qualifications}`);
      L.push('');
    }
  }
  if (whyUs.length > 0) {
    L.push('## Why Choose Us', '');
    for (const w of whyUs) L.push(`- ${w}`);
    L.push('');
  }
  if (nextSteps.length > 0) {
    L.push('## Next Steps', '');
    for (let i = 0; i < nextSteps.length; i++) L.push(`${i + 1}. ${nextSteps[i]}`);
    L.push('');
  }
  if (signatures) {
    L.push('---', '', '## Signatures', '');
    L.push(`**${companyName || 'Provider'}**`, '', 'Name: ____________________  Date: __________', '');
    L.push(`**${clientName}**`, '', 'Name: ____________________  Date: __________', '');
  }
  return L.join('\n');
}

// ── HTML Formatter ──────────────────────────────────────────────────────────
const CSS = [
  'body{font-family:system-ui,sans-serif;max-width:900px;margin:0 auto;padding:20px;color:#e0e0e0;background:#121225}',
  'h1{color:#c0c8e0;margin:0}h2{color:#a0b0d0;margin-top:28px;border-bottom:1px solid #2a2a4e;padding-bottom:6px}',
  '.cover{background:#1a1a2e;padding:32px;border-radius:10px;margin-bottom:28px;text-align:center}',
  '.cover h1{font-size:1.8em;margin-bottom:8px}.cover .meta{color:#8090b0;font-size:.95em;line-height:1.8}',
  '.summary-card{background:#16162a;border:1px solid #2a2a4e;border-radius:8px;padding:20px 24px;margin:12px 0;line-height:1.7;color:#b0b8d0}',
  '.objectives li{padding:4px 0;color:#b0b8d0}',
  '.scope-card{background:#16162a;border:1px solid #2a2a4e;border-radius:8px;padding:16px 20px;margin:10px 0}',
  '.scope-card h3{color:#c0c8e0;margin:0 0 6px;font-size:1em}.scope-card p{color:#8090b0;margin:0;font-size:.95em}',
  '.timeline-step{display:flex;gap:16px;margin:12px 0}',
  '.timeline-marker{display:flex;flex-direction:column;align-items:center;min-width:40px}',
  '.timeline-dot{width:14px;height:14px;background:#4a5a8a;border-radius:50%;margin-top:4px}.timeline-line{flex:1;width:2px;background:#2a2a4e}',
  '.timeline-body{flex:1;background:#16162a;border:1px solid #2a2a4e;border-radius:8px;padding:14px 18px;margin-bottom:4px}',
  '.timeline-body h3{color:#c0c8e0;margin:0 0 4px;font-size:.95em}.timeline-body .dur{color:#7080a0;font-size:.85em;margin-bottom:8px}',
  '.timeline-body li{color:#b0b8d0;padding:2px 0;font-size:.9em}',
  'table{width:100%;border-collapse:collapse;margin:12px 0}th,td{border:1px solid #2a2a4e;padding:10px 14px;text-align:left}',
  'th{background:#1a1a2e;color:#c0c8e0}tr:nth-child(even){background:#16162a}.total-row{font-weight:700;background:#1a1a2e !important}',
  '.team-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:14px;margin-top:12px}',
  '.team-card{background:#16162a;border:1px solid #2a2a4e;border-radius:8px;padding:16px;text-align:center}',
  '.team-card .name{color:#c0c8e0;font-weight:700;font-size:1.05em}',
  '.team-card .role{display:inline-block;background:#2a2a4e;color:#8090b0;padding:3px 10px;border-radius:12px;font-size:.8em;margin:6px 0}',
  '.team-card .quals{color:#7080a0;font-size:.85em;margin-top:6px}.why-us li{padding:4px 0;color:#b0b8d0}',
  '.cta{text-align:center;margin:32px 0;padding:24px;background:#1a1a2e;border-radius:10px}.cta h2{margin:0 0 12px;border:none}',
  '.cta ol{display:inline-block;text-align:left;color:#b0b8d0}',
  '.sig-block{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:16px}',
  '.sig-box{background:#16162a;border:1px solid #2a2a4e;border-radius:8px;padding:20px;text-align:center}',
  '.sig-box .label{color:#8090b0;font-weight:700;margin-bottom:12px}.sig-line{border-bottom:1px solid #4a4a6e;margin:16px 0;height:40px}',
  '.sig-box .date-line{color:#7080a0;font-size:.85em}',
  '@media print{body{background:#fff;color:#1a1a1a;padding:0}h1{color:#1a1a2e}h2{color:#2a2a4e}',
  '.cover,.summary-card,.scope-card,.timeline-body,.team-card,.sig-box{background:#f5f5fa;border-color:#ddd}th{background:#1a1a2e;color:#fff}}',
].join('');

function formatHtml(
  title: string, clientName: string, execSummary: string, scope: ScopeItem[],
  companyName: string, preparedBy: string, date: string, validUntil: string,
  objectives: string[], timeline: TimelinePhase[], pricing: PricingItem[],
  totalPrice: string, terms: string[], team: TeamMember[],
  whyUs: string[], nextSteps: string[], signatures: boolean,
): string {
  const h: string[] = [];
  h.push(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>${esc(title)}</title>`);
  h.push(`<style>${CSS}</style></head><body>`);
  h.push(`<div class="cover"><h1>${esc(title)}</h1><div class="meta">`);
  h.push(`Prepared for <strong>${esc(clientName)}</strong>`);
  if (companyName) h.push(`<br>By <strong>${esc(companyName)}</strong>`);
  if (preparedBy) h.push(`<br>Author: ${esc(preparedBy)}`);
  if (date) h.push(`<br>Date: ${esc(date)}`);
  if (validUntil) h.push(`<br>Valid Until: ${esc(validUntil)}`);
  h.push('</div></div>');
  h.push(`<h2>Executive Summary</h2><div class="summary-card">${esc(execSummary)}</div>`);
  if (objectives.length > 0) {
    h.push('<h2>Objectives</h2><ul class="objectives">');
    for (const o of objectives) h.push(`<li>${esc(o)}</li>`);
    h.push('</ul>');
  }
  h.push('<h2>Scope of Work</h2>');
  for (const s of scope) h.push(`<div class="scope-card"><h3>${esc(s.deliverable)}</h3><p>${esc(s.description)}</p></div>`);
  if (timeline.length > 0) {
    h.push('<h2>Timeline</h2>');
    for (const t of timeline) {
      h.push('<div class="timeline-step"><div class="timeline-marker"><div class="timeline-dot"></div><div class="timeline-line"></div></div>');
      h.push(`<div class="timeline-body"><h3>${esc(t.phase)}</h3><div class="dur">${esc(t.duration)}</div><ul>`);
      for (const d of t.deliverables) h.push(`<li>${esc(d)}</li>`);
      h.push('</ul></div></div>');
    }
  }
  if (pricing.length > 0) {
    const hasQty = pricing.some((p) => p.quantity != null);
    h.push('<h2>Pricing</h2><table><thead><tr>');
    h.push(hasQty ? '<th>Item</th><th>Qty</th><th>Unit Price</th><th>Total</th>' : '<th>Item</th><th>Total</th>');
    h.push('</tr></thead><tbody>');
    for (const p of pricing) {
      h.push(hasQty
        ? `<tr><td>${esc(p.item)}</td><td>${p.quantity ?? '-'}</td><td>${esc(p.unit_price ?? '-')}</td><td>${esc(p.total)}</td></tr>`
        : `<tr><td>${esc(p.item)}</td><td>${esc(p.total)}</td></tr>`);
    }
    if (totalPrice) h.push(`<tr class="total-row"><td colspan="${hasQty ? 3 : 1}"><strong>Total</strong></td><td><strong>${esc(totalPrice)}</strong></td></tr>`);
    h.push('</tbody></table>');
  }
  if (terms.length > 0) {
    h.push('<h2>Terms &amp; Conditions</h2><ol>');
    for (const t of terms) h.push(`<li>${esc(t)}</li>`);
    h.push('</ol>');
  }
  if (team.length > 0) {
    h.push('<h2>Project Team</h2><div class="team-grid">');
    for (const m of team) {
      h.push(`<div class="team-card"><div class="name">${esc(m.name)}</div><div class="role">${esc(m.role)}</div>`);
      if (m.qualifications) h.push(`<div class="quals">${esc(m.qualifications)}</div>`);
      h.push('</div>');
    }
    h.push('</div>');
  }
  if (whyUs.length > 0) {
    h.push('<h2>Why Choose Us</h2><ul class="why-us">');
    for (const w of whyUs) h.push(`<li>${esc(w)}</li>`);
    h.push('</ul>');
  }
  if (nextSteps.length > 0) {
    h.push('<div class="cta"><h2>Next Steps</h2><ol>');
    for (const s of nextSteps) h.push(`<li>${esc(s)}</li>`);
    h.push('</ol></div>');
  }
  if (signatures) {
    h.push('<h2>Signatures</h2><div class="sig-block">');
    h.push(`<div class="sig-box"><div class="label">${esc(companyName || 'Provider')}</div><div class="sig-line"></div><div class="date-line">Date: __________</div></div>`);
    h.push(`<div class="sig-box"><div class="label">${esc(clientName)}</div><div class="sig-line"></div><div class="date-line">Date: __________</div></div>`);
    h.push('</div>');
  }
  h.push('</body></html>');
  return h.join('\n');
}

// ── Tool Definition ─────────────────────────────────────────────────────────
export const proposalTool: UnifiedTool = {
  name: 'create_proposal',
  description: `Generate business proposals and RFP responses with scope, pricing, timeline, and team.

Use this when:
- User needs to create a business proposal
- User wants to respond to an RFP or RFQ
- User asks for a project proposal with pricing
- User needs a formal quote or bid document

Returns a complete proposal with executive summary, scope of work, timeline, pricing, team, and signature blocks.`,
  parameters: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Proposal title (e.g., "Website Redesign Proposal")' },
      client_name: { type: 'string', description: 'Client or recipient name' },
      executive_summary: { type: 'string', description: 'Executive summary paragraph' },
      scope_of_work: {
        type: 'array', description: 'Deliverables and descriptions',
        items: {
          type: 'object', required: ['deliverable', 'description'],
          properties: { deliverable: { type: 'string' }, description: { type: 'string' } },
        },
      },
      company_name: { type: 'string', description: 'Your company name' },
      prepared_by: { type: 'string', description: 'Author name' },
      date: { type: 'string', description: 'Proposal date' },
      valid_until: { type: 'string', description: 'Proposal validity date' },
      objectives: { type: 'array', items: { type: 'string' }, description: 'Project objectives' },
      timeline: {
        type: 'array', description: 'Project phases',
        items: {
          type: 'object',
          properties: { phase: { type: 'string' }, duration: { type: 'string' }, deliverables: { type: 'array', items: { type: 'string' } } },
        },
      },
      pricing: {
        type: 'array', description: 'Pricing line items',
        items: {
          type: 'object', required: ['item', 'total'],
          properties: { item: { type: 'string' }, quantity: { type: 'number' }, unit_price: { type: 'string' }, total: { type: 'string' } },
        },
      },
      total_price: { type: 'string', description: 'Total project price' },
      terms: { type: 'array', items: { type: 'string' }, description: 'Terms and conditions' },
      team: {
        type: 'array', description: 'Project team members',
        items: {
          type: 'object', required: ['name', 'role'],
          properties: { name: { type: 'string' }, role: { type: 'string' }, qualifications: { type: 'string' } },
        },
      },
      why_us: { type: 'array', items: { type: 'string' }, description: 'Reasons to choose your company' },
      next_steps: { type: 'array', items: { type: 'string' }, description: 'Next steps to proceed' },
      signatures: { type: 'boolean', description: 'Include signature blocks. Default: true' },
      format: { type: 'string', enum: ['markdown', 'html'], description: 'Output format. Default: "markdown"' },
    },
    required: ['title', 'client_name', 'executive_summary', 'scope_of_work'],
  },
};

// ── Availability Check ──────────────────────────────────────────────────────
export function isProposalAvailable(): boolean { return true; }

// ── Tool Executor ───────────────────────────────────────────────────────────
export async function executeProposal(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const args = toolCall.arguments as {
    title: string; client_name: string; executive_summary: string; scope_of_work: ScopeItem[];
    company_name?: string; prepared_by?: string; date?: string; valid_until?: string;
    objectives?: string[]; timeline?: TimelinePhase[]; pricing?: PricingItem[];
    total_price?: string; terms?: string[]; team?: TeamMember[];
    why_us?: string[]; next_steps?: string[]; signatures?: boolean; format?: 'markdown' | 'html';
  };

  if (!args.title?.trim()) return { toolCallId: toolCall.id, content: 'Error: title parameter is required', isError: true };
  if (!args.client_name?.trim()) return { toolCallId: toolCall.id, content: 'Error: client_name parameter is required', isError: true };
  if (!args.executive_summary?.trim()) return { toolCallId: toolCall.id, content: 'Error: executive_summary parameter is required', isError: true };
  if (!Array.isArray(args.scope_of_work) || args.scope_of_work.length === 0) {
    return { toolCallId: toolCall.id, content: 'Error: scope_of_work array is required and must not be empty', isError: true };
  }
  for (let i = 0; i < args.scope_of_work.length; i++) {
    const s = args.scope_of_work[i];
    if (!s.deliverable || !s.description) {
      return { toolCallId: toolCall.id, content: `Error: scope_of_work item at index ${i} is missing required fields (deliverable, description)`, isError: true };
    }
  }
  if (args.pricing) {
    for (let i = 0; i < args.pricing.length; i++) {
      if (!args.pricing[i].item || !args.pricing[i].total) {
        return { toolCallId: toolCall.id, content: `Error: pricing item at index ${i} is missing required fields (item, total)`, isError: true };
      }
    }
  }
  if (args.team) {
    for (let i = 0; i < args.team.length; i++) {
      if (!args.team[i].name || !args.team[i].role) {
        return { toolCallId: toolCall.id, content: `Error: team member at index ${i} is missing required fields (name, role)`, isError: true };
      }
    }
  }

  const fmt = args.format ?? 'markdown';
  const signatures = args.signatures !== false;
  const companyName = args.company_name ?? '', preparedBy = args.prepared_by ?? '';
  const date = args.date ?? '', validUntil = args.valid_until ?? '';
  const objectives = args.objectives ?? [], timeline = args.timeline ?? [];
  const pricing = args.pricing ?? [], totalPrice = args.total_price ?? '';
  const terms = args.terms ?? [], team = args.team ?? [];
  const whyUs = args.why_us ?? [], nextSteps = args.next_steps ?? [];

  try {
    const formatted = fmt === 'html'
      ? formatHtml(args.title, args.client_name, args.executive_summary, args.scope_of_work, companyName, preparedBy, date, validUntil, objectives, timeline, pricing, totalPrice, terms, team, whyUs, nextSteps, signatures)
      : formatMarkdown(args.title, args.client_name, args.executive_summary, args.scope_of_work, companyName, preparedBy, date, validUntil, objectives, timeline, pricing, totalPrice, terms, team, whyUs, nextSteps, signatures);
    return {
      toolCallId: toolCall.id,
      content: JSON.stringify({
        success: true, message: `Proposal created: ${args.title}`, format: fmt, formatted_output: formatted,
        summary: {
          title: args.title, client_name: args.client_name, company_name: companyName || null,
          deliverables_count: args.scope_of_work.length, phases_count: timeline.length,
          pricing_items_count: pricing.length, total_price: totalPrice || null,
          team_members_count: team.length, has_signatures: signatures,
        },
      }),
    };
  } catch (error) {
    return { toolCallId: toolCall.id, content: `Error generating proposal: ${(error as Error).message}`, isError: true };
  }
}

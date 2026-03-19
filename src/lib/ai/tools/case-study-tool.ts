/**
 * CASE STUDY TOOL — Customer success / case study document generator.
 * Produces marketing-style case studies with challenge, solution, results,
 * metrics comparison, testimonials, and calls to action.
 * No external dependencies. Created: 2026-03-19
 */
import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// TYPES
// ============================================================================

interface Metric {
  label: string;
  before: string;
  after: string;
}

interface Testimonial {
  quote: string;
  name: string;
  title: string;
}

// ============================================================================
// HELPERS
// ============================================================================

function esc(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ============================================================================
// MARKDOWN FORMATTER
// ============================================================================

function formatMarkdown(
  title: string, clientName: string, challenge: string, solution: string,
  results: string[], industry: string, companySize: string, duration: string,
  productsUsed: string[], metrics: Metric[], testimonial: Testimonial | undefined,
  keyTakeaways: string[], callToAction: string, preparedBy: string, date: string,
): string {
  const L: string[] = [];
  L.push(`# ${title}`, '');

  L.push('> **Executive Summary**');
  L.push(`> Client: ${clientName}`);
  if (industry) L.push(`> Industry: ${industry}`);
  if (companySize) L.push(`> Company Size: ${companySize}`);
  if (duration) L.push(`> Engagement Duration: ${duration}`);
  if (productsUsed.length > 0) L.push(`> Products Used: ${productsUsed.join(', ')}`);
  L.push('');

  L.push('## The Challenge', '', challenge, '');
  L.push('## The Solution', '', solution, '');

  L.push('## Results', '');
  for (const r of results) L.push(`- ${r}`);
  L.push('');

  if (metrics.length > 0) {
    L.push('## Key Metrics', '', '| Metric | Before | After |', '|--------|--------|-------|');
    for (const m of metrics) L.push(`| ${m.label} | ${m.before} | ${m.after} |`);
    L.push('');
  }

  if (testimonial) {
    L.push('## Client Testimonial', '');
    L.push(`> "${testimonial.quote}"`);
    L.push(`> — **${testimonial.name}**, ${testimonial.title}`, '');
  }

  if (keyTakeaways.length > 0) {
    L.push('## Key Takeaways', '');
    for (let i = 0; i < keyTakeaways.length; i++) L.push(`${i + 1}. ${keyTakeaways[i]}`);
    L.push('');
  }

  if (callToAction) L.push('---', '', `**${callToAction}**`, '');

  if (preparedBy || date) {
    L.push('---', '');
    if (preparedBy) L.push(`*Prepared by: ${preparedBy}*`);
    if (date) L.push(`*Date: ${date}*`);
    L.push('');
  }

  return L.join('\n');
}

// ============================================================================
// HTML FORMATTER
// ============================================================================

const CSS = [
  'body{font-family:system-ui,sans-serif;max-width:900px;margin:0 auto;padding:20px;color:#e0e0e0;background:#121225;line-height:1.6}',
  'h1{color:#c0c8e0;font-size:1.9em;text-align:center;margin-bottom:4px}',
  'h2{color:#a0b0d0;margin-top:28px;border-bottom:1px solid #2a2a4e;padding-bottom:6px}',
  '.hero{background:linear-gradient(135deg,#1a1a2e,#16162a);border:1px solid #2a2a4e;border-radius:10px;padding:24px;margin-bottom:28px;text-align:center}',
  '.hero h1{margin:0 0 12px}',
  '.hero-meta{display:flex;flex-wrap:wrap;justify-content:center;gap:12px 24px;margin-top:12px}',
  '.hero-tag{background:#2a2a4e;color:#a0b0d0;padding:4px 12px;border-radius:12px;font-size:.85em}',
  '.section-card{border:1px solid #2a2a4e;border-radius:8px;padding:18px 22px;margin:14px 0;background:#16162a}',
  '.section-card h2{margin-top:0;border:none;padding:0}',
  '.section-card p{color:#b0b8d0;margin:10px 0 0}',
  '.results-list{list-style:none;padding:0}.results-list li{padding:8px 0;color:#b0b8d0;display:flex;align-items:flex-start;gap:10px}',
  '.results-list li::before{content:"\\2713";color:#40c080;font-weight:700;font-size:1.1em;flex-shrink:0}',
  '.metrics-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px;margin:14px 0}',
  '.metric-card{background:#1a1a2e;border:1px solid #2a2a4e;border-radius:8px;padding:16px;text-align:center}',
  '.metric-label{color:#8090b0;font-size:.85em;margin-bottom:10px;font-weight:600}',
  '.metric-compare{display:flex;justify-content:center;align-items:center;gap:12px}',
  '.metric-val{font-size:1.1em;font-weight:700}.metric-before{color:#c07070}.metric-after{color:#40c080}',
  '.metric-arrow{color:#6070a0;font-size:1.2em}',
  '.metric-bar{height:6px;border-radius:3px;margin-top:8px;background:#2a2a4e;overflow:hidden}',
  '.metric-bar-fill{height:100%;border-radius:3px;background:linear-gradient(90deg,#c07070,#40c080)}',
  '.testimonial{background:#1a1a2e;border-left:4px solid #4a5a8a;border-radius:0 8px 8px 0;padding:20px 24px;margin:18px 0}',
  '.testimonial .quote{font-style:italic;font-size:1.1em;color:#d0d8e8;line-height:1.6}',
  '.testimonial .attr{color:#8090b0;margin-top:10px;font-size:.92em}',
  '.testimonial .avatar{width:48px;height:48px;border-radius:50%;background:#2a2a4e;display:inline-flex;align-items:center;justify-content:center;color:#6070a0;font-size:1.2em;margin-right:12px;vertical-align:middle}',
  '.takeaways{counter-reset:tk}',
  '.takeaway{display:flex;gap:12px;padding:10px 0;color:#b0b8d0;align-items:flex-start}',
  '.takeaway::before{counter-increment:tk;content:counter(tk);background:#2a2a4e;color:#a0b0d0;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:.85em;font-weight:700;flex-shrink:0}',
  '.cta{text-align:center;margin:28px 0}',
  '.cta-btn{display:inline-block;background:linear-gradient(135deg,#4a5a8a,#6070a0);color:#fff;padding:12px 32px;border-radius:6px;font-size:1.05em;font-weight:600;text-decoration:none}',
  '.footer{text-align:center;color:#6070a0;font-size:.85em;margin-top:28px;padding-top:14px;border-top:1px solid #2a2a4e}',
  '@media print{body{background:#fff;color:#1a1a1a;padding:0}h1{color:#1a1a2e}h2{color:#2a2a4e}',
  '.hero,.section-card,.metric-card,.testimonial{background:#f5f5fa;border-color:#ccc}',
  '.hero-tag{background:#e0e0ea}.cta-btn{background:#1a1a2e}}',
].join('');

function formatHtml(
  title: string, clientName: string, challenge: string, solution: string,
  results: string[], industry: string, companySize: string, duration: string,
  productsUsed: string[], metrics: Metric[], testimonial: Testimonial | undefined,
  keyTakeaways: string[], callToAction: string, preparedBy: string, date: string,
): string {
  const h: string[] = [];
  h.push(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>${esc(title)}</title>`);
  h.push(`<style>${CSS}</style></head><body>`);

  h.push('<div class="hero">');
  h.push(`<h1>${esc(title)}</h1>`);
  h.push(`<div style="color:#8090b0;font-size:1.05em">Client: ${esc(clientName)}</div>`);
  h.push('<div class="hero-meta">');
  if (industry) h.push(`<span class="hero-tag">${esc(industry)}</span>`);
  if (companySize) h.push(`<span class="hero-tag">${esc(companySize)}</span>`);
  if (duration) h.push(`<span class="hero-tag">${esc(duration)}</span>`);
  for (const p of productsUsed) h.push(`<span class="hero-tag">${esc(p)}</span>`);
  h.push('</div></div>');

  h.push('<div class="section-card"><h2>The Challenge</h2>');
  h.push(`<p>${esc(challenge)}</p></div>`);

  h.push('<div class="section-card"><h2>The Solution</h2>');
  h.push(`<p>${esc(solution)}</p></div>`);

  h.push('<div class="section-card"><h2>Results</h2>');
  h.push('<ul class="results-list">');
  for (const r of results) h.push(`<li>${esc(r)}</li>`);
  h.push('</ul></div>');

  if (metrics.length > 0) {
    h.push('<h2>Key Metrics</h2><div class="metrics-grid">');
    for (const m of metrics) {
      h.push('<div class="metric-card">');
      h.push(`<div class="metric-label">${esc(m.label)}</div>`);
      h.push('<div class="metric-compare">');
      h.push(`<span class="metric-val metric-before">${esc(m.before)}</span>`);
      h.push('<span class="metric-arrow">&rarr;</span>');
      h.push(`<span class="metric-val metric-after">${esc(m.after)}</span>`);
      h.push('</div>');
      h.push('<div class="metric-bar"><div class="metric-bar-fill" style="width:100%"></div></div>');
      h.push('</div>');
    }
    h.push('</div>');
  }

  if (testimonial) {
    const initials = testimonial.name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
    h.push('<div class="testimonial">');
    h.push(`<div class="quote">&ldquo;${esc(testimonial.quote)}&rdquo;</div>`);
    h.push(`<div class="attr"><span class="avatar">${esc(initials)}</span><strong>${esc(testimonial.name)}</strong>, ${esc(testimonial.title)}</div>`);
    h.push('</div>');
  }

  if (keyTakeaways.length > 0) {
    h.push('<h2>Key Takeaways</h2><div class="takeaways">');
    for (const t of keyTakeaways) h.push(`<div class="takeaway"><span>${esc(t)}</span></div>`);
    h.push('</div>');
  }

  if (callToAction) {
    h.push(`<div class="cta"><span class="cta-btn">${esc(callToAction)}</span></div>`);
  }

  if (preparedBy || date) {
    const parts: string[] = [];
    if (preparedBy) parts.push(`Prepared by: ${esc(preparedBy)}`);
    if (date) parts.push(esc(date));
    h.push(`<div class="footer">${parts.join(' &bull; ')}</div>`);
  }

  h.push('</body></html>');
  return h.join('\n');
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const caseStudyTool: UnifiedTool = {
  name: 'create_case_study',
  description: `Generate customer success case studies with challenges, solutions, metrics, and testimonials.
Use this when the user needs to create a case study, customer success story, or client showcase document.
Returns a marketing-style document with executive summary, challenge/solution/results, metrics comparison, testimonial, and call to action.`,
  parameters: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Case study title' },
      client_name: { type: 'string', description: 'Client or company name' },
      challenge: { type: 'string', description: 'Description of the challenge or problem faced' },
      solution: { type: 'string', description: 'Description of the solution provided' },
      results: {
        type: 'array', items: { type: 'string' },
        description: 'Key results achieved (list of outcome statements)',
      },
      industry: { type: 'string', description: 'Client industry' },
      company_size: { type: 'string', description: 'Client company size (e.g., "500+ employees")' },
      duration: { type: 'string', description: 'Engagement duration (e.g., "6 months")' },
      products_used: { type: 'array', items: { type: 'string' }, description: 'Products or services used' },
      metrics: {
        type: 'array', description: 'Before/after metrics comparison',
        items: {
          type: 'object', required: ['label', 'before', 'after'],
          properties: {
            label: { type: 'string', description: 'Metric name' },
            before: { type: 'string', description: 'Value before engagement' },
            after: { type: 'string', description: 'Value after engagement' },
          },
        },
      },
      testimonial: {
        type: 'object', description: 'Client testimonial quote',
        properties: {
          quote: { type: 'string', description: 'Testimonial text' },
          name: { type: 'string', description: 'Person quoted' },
          title: { type: 'string', description: 'Title of person quoted' },
        },
        required: ['quote', 'name', 'title'],
      },
      key_takeaways: { type: 'array', items: { type: 'string' }, description: 'Key takeaway points' },
      call_to_action: { type: 'string', description: 'Call-to-action text (e.g., "Get Started Today")' },
      prepared_by: { type: 'string', description: 'Author or team name' },
      date: { type: 'string', description: 'Publication date' },
      format: { type: 'string', enum: ['markdown', 'html'], description: 'Output format. Default: "markdown"' },
    },
    required: ['title', 'client_name', 'challenge', 'solution', 'results'],
  },
};

// ============================================================================
// AVAILABILITY CHECK
// ============================================================================

export function isCaseStudyAvailable(): boolean {
  return true;
}

// ============================================================================
// TOOL EXECUTOR
// ============================================================================

export async function executeCaseStudy(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const args = toolCall.arguments as {
    title: string;
    client_name: string;
    challenge: string;
    solution: string;
    results: string[];
    industry?: string;
    company_size?: string;
    duration?: string;
    products_used?: string[];
    metrics?: Metric[];
    testimonial?: Testimonial;
    key_takeaways?: string[];
    call_to_action?: string;
    prepared_by?: string;
    date?: string;
    format?: 'markdown' | 'html';
  };

  if (!args.title?.trim()) {
    return { toolCallId: toolCall.id, content: 'Error: title parameter is required', isError: true };
  }
  if (!args.client_name?.trim()) {
    return { toolCallId: toolCall.id, content: 'Error: client_name parameter is required', isError: true };
  }
  if (!args.challenge?.trim()) {
    return { toolCallId: toolCall.id, content: 'Error: challenge parameter is required', isError: true };
  }
  if (!args.solution?.trim()) {
    return { toolCallId: toolCall.id, content: 'Error: solution parameter is required', isError: true };
  }
  if (!Array.isArray(args.results) || args.results.length === 0) {
    return { toolCallId: toolCall.id, content: 'Error: results array is required and must not be empty', isError: true };
  }

  if (args.metrics) {
    for (let i = 0; i < args.metrics.length; i++) {
      const m = args.metrics[i];
      if (!m.label || !m.before || !m.after) {
        return {
          toolCallId: toolCall.id,
          content: `Error: metric at index ${i} is missing required fields (label, before, after)`,
          isError: true,
        };
      }
    }
  }

  if (args.testimonial) {
    const t = args.testimonial;
    if (!t.quote || !t.name || !t.title) {
      return {
        toolCallId: toolCall.id,
        content: 'Error: testimonial is missing required fields (quote, name, title)',
        isError: true,
      };
    }
  }

  const fmt = args.format ?? 'markdown';
  const industry = args.industry ?? '';
  const companySize = args.company_size ?? '';
  const duration = args.duration ?? '';
  const productsUsed = args.products_used ?? [];
  const metrics = args.metrics ?? [];
  const keyTakeaways = args.key_takeaways ?? [];
  const callToAction = args.call_to_action ?? '';
  const preparedBy = args.prepared_by ?? '';
  const date = args.date ?? '';

  try {
    const formatted = fmt === 'html'
      ? formatHtml(args.title, args.client_name, args.challenge, args.solution, args.results, industry, companySize, duration, productsUsed, metrics, args.testimonial, keyTakeaways, callToAction, preparedBy, date)
      : formatMarkdown(args.title, args.client_name, args.challenge, args.solution, args.results, industry, companySize, duration, productsUsed, metrics, args.testimonial, keyTakeaways, callToAction, preparedBy, date);

    return {
      toolCallId: toolCall.id,
      content: JSON.stringify({
        success: true,
        message: `Case study created: ${args.title}`,
        format: fmt,
        formatted_output: formatted,
        summary: {
          title: args.title,
          client_name: args.client_name,
          industry: industry || null,
          results_count: args.results.length,
          metrics_count: metrics.length,
          has_testimonial: !!args.testimonial,
          takeaways_count: keyTakeaways.length,
          has_cta: !!callToAction,
          products_used: productsUsed.length,
        },
      }),
    };
  } catch (error) {
    return {
      toolCallId: toolCall.id,
      content: `Error generating case study: ${(error as Error).message}`,
      isError: true,
    };
  }
}

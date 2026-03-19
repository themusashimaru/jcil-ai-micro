/**
 * BUSINESS CANVAS TOOL — Business Model Canvas document generator.
 * Produces professional Business Model Canvas documents with all 9 building blocks.
 * No external dependencies. Created: 2026-03-19
 */
import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

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
  name: string, preparedBy: string, date: string, notes: string,
  valueProps: string[], segments: string[], channels: string[],
  relationships: string[], revenue: string[], resources: string[],
  activities: string[], partnerships: string[], costs: string[],
): string {
  const L: string[] = [];
  L.push(`# Business Model Canvas: ${name}`, '');
  L.push('| Field | Value |', '|-------|-------|');
  L.push(`| **Business** | ${name} |`);
  if (preparedBy) L.push(`| **Prepared By** | ${preparedBy} |`);
  if (date) L.push(`| **Date** | ${date} |`);
  L.push('');

  const block = (title: string, items: string[]) => {
    L.push(`## ${title}`, '');
    if (items.length > 0) {
      for (const item of items) L.push(`- ${item}`);
    } else {
      L.push('_Not yet defined_');
    }
    L.push('');
  };

  block('Key Partnerships', partnerships);
  block('Key Activities', activities);
  block('Key Resources', resources);
  block('Value Propositions', valueProps);
  block('Customer Relationships', relationships);
  block('Channels', channels);
  block('Customer Segments', segments);
  block('Cost Structure', costs);
  block('Revenue Streams', revenue);

  if (notes) {
    L.push('## Notes', '', notes, '');
  }

  return L.join('\n');
}

// ============================================================================
// HTML FORMATTER
// ============================================================================

const CSS = [
  'body{font-family:system-ui,sans-serif;max-width:1100px;margin:0 auto;padding:20px;color:#e0e0e0;background:#121225}',
  'h1{color:#c0c8e0;border-bottom:3px solid #1a1a2e;padding-bottom:10px;text-align:center}',
  'h2{color:#a0b0d0;margin-top:28px;border-bottom:1px solid #2a2a4e;padding-bottom:6px}',
  '.meta{display:flex;gap:24px;justify-content:center;background:#1a1a2e;padding:12px 20px;border-radius:8px;margin-bottom:24px;flex-wrap:wrap}',
  '.meta-item{display:flex;gap:8px}.meta-label{font-weight:700;color:#8090b0}.meta-value{color:#c0c8e0}',
  '.canvas{display:grid;grid-template-columns:1fr 1fr 1fr 1fr 1fr;grid-template-rows:auto auto auto;gap:0;border:2px solid #2a2a4e;border-radius:8px;overflow:hidden;margin:16px 0}',
  '.block{padding:12px;border:1px solid #2a2a4e;min-height:100px}',
  '.block h3{margin:0 0 8px 0;font-size:.95em;padding-bottom:4px;border-bottom:2px solid rgba(255,255,255,.15)}',
  '.block ul{margin:0;padding-left:16px;list-style:disc;font-size:.9em}.block li{padding:2px 0;line-height:1.4}',
  '.empty{color:#5a5a7a;font-style:italic;font-size:.85em}',
  '.kp{grid-column:1/2;grid-row:1/3;background:#1a2030}.kp h3{color:#bb86fc}',
  '.ka{grid-column:2/3;grid-row:1/2;background:#1a2530}.ka h3{color:#56ccf2}',
  '.kr{grid-column:2/3;grid-row:2/3;background:#1a2530}.kr h3{color:#56ccf2}',
  '.vp{grid-column:3/4;grid-row:1/3;background:#1a3020}.vp h3{color:#6fcf97}',
  '.cr{grid-column:4/5;grid-row:1/2;background:#302a1a}.cr h3{color:#f2c94c}',
  '.ch{grid-column:4/5;grid-row:2/3;background:#302a1a}.ch h3{color:#f2c94c}',
  '.cs{grid-column:5/6;grid-row:1/3;background:#301a1a}.cs h3{color:#eb5757}',
  '.cost{grid-column:1/3;grid-row:3/4;background:#1a1a2e}.cost h3{color:#a0b0d0}',
  '.rev{grid-column:3/6;grid-row:3/4;background:#1a1a2e}.rev h3{color:#a0b0d0}',
  '.notes{background:#1a1a2e;padding:16px 20px;border-radius:8px;margin-top:20px;color:#b0b8d0;line-height:1.6}',
  '@media print{body{background:#fff;color:#1a1a1a;padding:0}h1{color:#1a1a2e}',
  '.meta,.notes{background:#f5f5fa;border-color:#ccc}.block{background:#fafafa !important;border-color:#ccc}',
  '.block h3{color:#1a1a2e !important}}',
].join('');

function formatHtml(
  name: string, preparedBy: string, date: string, notes: string,
  valueProps: string[], segments: string[], channels: string[],
  relationships: string[], revenue: string[], resources: string[],
  activities: string[], partnerships: string[], costs: string[],
): string {
  const h: string[] = [];
  h.push(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Business Model Canvas: ${esc(name)}</title>`);
  h.push(`<style>${CSS}</style></head><body>`);
  h.push(`<h1>Business Model Canvas: ${esc(name)}</h1>`);
  h.push('<div class="meta">');
  h.push(`<div class="meta-item"><span class="meta-label">Business:</span><span class="meta-value">${esc(name)}</span></div>`);
  if (preparedBy) h.push(`<div class="meta-item"><span class="meta-label">Prepared By:</span><span class="meta-value">${esc(preparedBy)}</span></div>`);
  if (date) h.push(`<div class="meta-item"><span class="meta-label">Date:</span><span class="meta-value">${esc(date)}</span></div>`);
  h.push('</div>');

  const renderBlock = (cls: string, title: string, items: string[]) => {
    h.push(`<div class="block ${cls}"><h3>${title}</h3>`);
    if (items.length > 0) {
      h.push('<ul>');
      for (const item of items) h.push(`<li>${esc(item)}</li>`);
      h.push('</ul>');
    } else {
      h.push('<div class="empty">Not yet defined</div>');
    }
    h.push('</div>');
  };

  h.push('<div class="canvas">');
  renderBlock('kp', 'Key Partnerships', partnerships);
  renderBlock('ka', 'Key Activities', activities);
  renderBlock('vp', 'Value Propositions', valueProps);
  renderBlock('cr', 'Customer Relationships', relationships);
  renderBlock('cs', 'Customer Segments', segments);
  renderBlock('kr', 'Key Resources', resources);
  renderBlock('ch', 'Channels', channels);
  renderBlock('cost', 'Cost Structure', costs);
  renderBlock('rev', 'Revenue Streams', revenue);
  h.push('</div>');

  if (notes) {
    h.push(`<div class="notes"><strong>Notes:</strong> ${esc(notes)}</div>`);
  }

  h.push('</body></html>');
  return h.join('\n');
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const businessCanvasTool: UnifiedTool = {
  name: 'create_business_canvas',
  description: `Generate Business Model Canvas with all 9 building blocks for business planning.
Use this when the user wants to create, visualize, or document a business model.
Returns a complete Business Model Canvas with key partnerships, activities, resources, value propositions, customer relationships, channels, customer segments, cost structure, and revenue streams.`,
  parameters: {
    type: 'object',
    properties: {
      business_name: { type: 'string', description: 'Name of the business or venture' },
      value_propositions: { type: 'array', items: { type: 'string' }, description: 'Core value propositions offered' },
      customer_segments: { type: 'array', items: { type: 'string' }, description: 'Target customer segments' },
      channels: { type: 'array', items: { type: 'string' }, description: 'Distribution and communication channels' },
      customer_relationships: { type: 'array', items: { type: 'string' }, description: 'Types of customer relationships' },
      revenue_streams: { type: 'array', items: { type: 'string' }, description: 'Revenue sources and pricing models' },
      key_resources: { type: 'array', items: { type: 'string' }, description: 'Key resources required' },
      key_activities: { type: 'array', items: { type: 'string' }, description: 'Key activities performed' },
      key_partnerships: { type: 'array', items: { type: 'string' }, description: 'Key partners and suppliers' },
      cost_structure: { type: 'array', items: { type: 'string' }, description: 'Major cost drivers' },
      prepared_by: { type: 'string', description: 'Author of the canvas' },
      date: { type: 'string', description: 'Date of creation' },
      notes: { type: 'string', description: 'Additional notes or context' },
      format: { type: 'string', enum: ['markdown', 'html'], description: 'Output format. Default: "markdown"' },
    },
    required: ['business_name', 'value_propositions'],
  },
};

// ============================================================================
// AVAILABILITY CHECK
// ============================================================================

export function isBusinessCanvasAvailable(): boolean {
  return true;
}

// ============================================================================
// TOOL EXECUTOR
// ============================================================================

export async function executeBusinessCanvas(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const args = toolCall.arguments as {
    business_name: string;
    value_propositions: string[];
    customer_segments?: string[];
    channels?: string[];
    customer_relationships?: string[];
    revenue_streams?: string[];
    key_resources?: string[];
    key_activities?: string[];
    key_partnerships?: string[];
    cost_structure?: string[];
    prepared_by?: string;
    date?: string;
    notes?: string;
    format?: 'markdown' | 'html';
  };

  if (!args.business_name?.trim()) {
    return { toolCallId: toolCall.id, content: 'Error: business_name parameter is required', isError: true };
  }
  if (!Array.isArray(args.value_propositions) || args.value_propositions.length === 0) {
    return { toolCallId: toolCall.id, content: 'Error: value_propositions array is required and must not be empty', isError: true };
  }

  const fmt = args.format ?? 'markdown';
  const valueProps = args.value_propositions;
  const segments = args.customer_segments ?? [];
  const channels = args.channels ?? [];
  const relationships = args.customer_relationships ?? [];
  const revenue = args.revenue_streams ?? [];
  const resources = args.key_resources ?? [];
  const activities = args.key_activities ?? [];
  const partnerships = args.key_partnerships ?? [];
  const costs = args.cost_structure ?? [];
  const preparedBy = args.prepared_by ?? '';
  const date = args.date ?? '';
  const notes = args.notes ?? '';
  const filledBlocks = [valueProps, segments, channels, relationships, revenue, resources, activities, partnerships, costs].filter((b) => b.length > 0).length;

  try {
    const formatted = fmt === 'html'
      ? formatHtml(args.business_name, preparedBy, date, notes, valueProps, segments, channels, relationships, revenue, resources, activities, partnerships, costs)
      : formatMarkdown(args.business_name, preparedBy, date, notes, valueProps, segments, channels, relationships, revenue, resources, activities, partnerships, costs);

    return {
      toolCallId: toolCall.id,
      content: JSON.stringify({
        success: true,
        message: `Business Model Canvas created: ${args.business_name}`,
        format: fmt,
        formatted_output: formatted,
        summary: {
          business_name: args.business_name,
          filled_blocks: filledBlocks,
          total_blocks: 9,
          value_propositions_count: valueProps.length,
          customer_segments_count: segments.length,
          channels_count: channels.length,
          relationships_count: relationships.length,
          revenue_streams_count: revenue.length,
          key_resources_count: resources.length,
          key_activities_count: activities.length,
          key_partnerships_count: partnerships.length,
          cost_items_count: costs.length,
        },
      }),
    };
  } catch (error) {
    return {
      toolCallId: toolCall.id,
      content: `Error generating Business Model Canvas: ${(error as Error).message}`,
      isError: true,
    };
  }
}

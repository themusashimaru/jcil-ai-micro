/**
 * PRESS RELEASE TOOL — AP-style press release document generator.
 * Produces professional press releases with datelines, quotes,
 * boilerplate, and media contact blocks.
 * No external dependencies. Created: 2026-03-19
 */
import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// TYPES
// ============================================================================

interface Quote {
  text: string;
  attribution: string;
  title?: string;
}

// ============================================================================
// HELPERS
// ============================================================================

function esc(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function buildDateline(city: string, state: string, releaseDate: string): string {
  const parts: string[] = [];
  if (city) parts.push(city.toUpperCase());
  if (state) parts.push(state);
  const loc = parts.join(', ');
  if (loc && releaseDate) return `${loc} — ${releaseDate} —`;
  if (loc) return `${loc} —`;
  if (releaseDate) return `${releaseDate} —`;
  return '';
}

// ============================================================================
// MARKDOWN FORMATTER
// ============================================================================

function formatMarkdown(
  headline: string, subheadline: string, bodyParagraphs: string[],
  organization: string, city: string, state: string,
  releaseDate: string, releaseType: string, embargoDate: string,
  contactName: string, contactEmail: string, contactPhone: string,
  boilerplate: string, quotes: Quote[],
): string {
  const L: string[] = [];

  if (releaseType === 'embargoed' && embargoDate) {
    L.push(`**EMBARGOED UNTIL ${embargoDate.toUpperCase()}**`, '');
  } else {
    L.push('**FOR IMMEDIATE RELEASE**', '');
  }

  L.push(`# ${headline}`, '', `### ${subheadline}`, '');

  const dateline = buildDateline(city, state, releaseDate);
  const firstPara = bodyParagraphs[0] ?? '';
  if (dateline) {
    L.push(`${dateline} ${firstPara}`, '');
  } else if (firstPara) {
    L.push(firstPara, '');
  }

  for (let i = 1; i < bodyParagraphs.length; i++) {
    L.push(bodyParagraphs[i], '');
  }

  if (quotes.length > 0) {
    for (const q of quotes) {
      const attr = q.title ? `— ${q.attribution}, ${q.title}` : `— ${q.attribution}`;
      L.push(`> "${q.text}"`, `>`, `> ${attr}`, '');
    }
  }

  if (boilerplate) {
    L.push('---', '', `**About ${organization || 'the Organization'}**`, '', boilerplate, '');
  }

  L.push('###', '');

  if (contactName || contactEmail || contactPhone) {
    L.push('**Media Contact:**', '');
    if (contactName) L.push(`**Name:** ${contactName}`);
    if (contactEmail) L.push(`**Email:** ${contactEmail}`);
    if (contactPhone) L.push(`**Phone:** ${contactPhone}`);
    L.push('');
  }

  return L.join('\n');
}

// ============================================================================
// HTML FORMATTER
// ============================================================================

const CSS = [
  'body{font-family:Georgia,"Times New Roman",serif;max-width:800px;margin:0 auto;padding:24px 32px;color:#e0e0e0;background:#121225;line-height:1.7}',
  'h1{color:#c0c8e0;font-size:1.8em;line-height:1.25;margin-bottom:4px;text-align:center}',
  '.subheadline{color:#a0b0d0;font-size:1.15em;text-align:center;font-style:italic;margin-bottom:24px}',
  '.release-tag{text-align:center;font-family:system-ui,sans-serif;font-weight:700;font-size:.85em;letter-spacing:2px;color:#d0a040;margin-bottom:16px}',
  '.dateline{font-weight:700;color:#c0c8e0}',
  'p{margin:0 0 14px;color:#c0c8d0}',
  'blockquote{border-left:4px solid #4a5a8a;margin:20px 0;padding:16px 20px;background:#16162a;border-radius:0 8px 8px 0}',
  'blockquote .quote-text{font-style:italic;color:#d0d8e8;font-size:1.05em;line-height:1.6}',
  'blockquote .quote-attr{color:#8090b0;font-size:.92em;margin-top:8px;font-style:normal}',
  '.boilerplate{border-top:2px solid #2a2a4e;margin-top:28px;padding-top:16px}',
  '.boilerplate h3{color:#a0b0d0;margin:0 0 8px;font-size:1em}',
  '.boilerplate p{color:#9098b0;font-size:.95em}',
  '.end-mark{text-align:center;font-size:1.4em;color:#6070a0;letter-spacing:8px;margin:28px 0}',
  '.contact-card{background:#1a1a2e;padding:16px 20px;border-radius:8px;margin-top:20px;font-family:system-ui,sans-serif}',
  '.contact-card h3{color:#a0b0d0;margin:0 0 10px;font-size:.95em;letter-spacing:1px}',
  '.contact-item{color:#b0b8d0;font-size:.92em;padding:3px 0}',
  '.contact-item strong{color:#8090b0}',
  '@media print{body{background:#fff;color:#1a1a1a;padding:0}h1{color:#1a1a2e}',
  '.subheadline{color:#444}.release-tag{color:#333}p{color:#1a1a1a}',
  'blockquote{background:#f5f5fa;border-color:#1a1a2e}.contact-card{background:#f5f5fa;border:1px solid #ccc}}',
].join('');

function formatHtml(
  headline: string, subheadline: string, bodyParagraphs: string[],
  organization: string, city: string, state: string,
  releaseDate: string, releaseType: string, embargoDate: string,
  contactName: string, contactEmail: string, contactPhone: string,
  boilerplate: string, quotes: Quote[],
): string {
  const h: string[] = [];
  h.push(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>${esc(headline)}</title>`);
  h.push(`<style>${CSS}</style></head><body>`);

  if (releaseType === 'embargoed' && embargoDate) {
    h.push(`<div class="release-tag">EMBARGOED UNTIL ${esc(embargoDate.toUpperCase())}</div>`);
  } else {
    h.push('<div class="release-tag">FOR IMMEDIATE RELEASE</div>');
  }

  h.push(`<h1>${esc(headline)}</h1>`);
  h.push(`<div class="subheadline">${esc(subheadline)}</div>`);

  const dateline = buildDateline(city, state, releaseDate);
  const firstPara = bodyParagraphs[0] ?? '';
  if (dateline) {
    h.push(`<p><span class="dateline">${esc(dateline)}</span> ${esc(firstPara)}</p>`);
  } else if (firstPara) {
    h.push(`<p>${esc(firstPara)}</p>`);
  }

  for (let i = 1; i < bodyParagraphs.length; i++) {
    h.push(`<p>${esc(bodyParagraphs[i])}</p>`);
  }

  for (const q of quotes) {
    const attr = q.title ? `${esc(q.attribution)}, ${esc(q.title)}` : esc(q.attribution);
    h.push(`<blockquote><div class="quote-text">&ldquo;${esc(q.text)}&rdquo;</div>`);
    h.push(`<div class="quote-attr">&mdash; ${attr}</div></blockquote>`);
  }

  if (boilerplate) {
    const orgName = organization ? `About ${esc(organization)}` : 'About the Organization';
    h.push(`<div class="boilerplate"><h3>${orgName}</h3><p>${esc(boilerplate)}</p></div>`);
  }

  h.push('<div class="end-mark">###</div>');

  if (contactName || contactEmail || contactPhone) {
    h.push('<div class="contact-card"><h3>MEDIA CONTACT</h3>');
    if (contactName) h.push(`<div class="contact-item"><strong>Name:</strong> ${esc(contactName)}</div>`);
    if (contactEmail) h.push(`<div class="contact-item"><strong>Email:</strong> ${esc(contactEmail)}</div>`);
    if (contactPhone) h.push(`<div class="contact-item"><strong>Phone:</strong> ${esc(contactPhone)}</div>`);
    h.push('</div>');
  }

  h.push('</body></html>');
  return h.join('\n');
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const pressReleaseTool: UnifiedTool = {
  name: 'create_press_release',
  description: `Generate AP-style press releases with datelines, quotes, boilerplate, and media contacts.
Use this when the user needs to draft a press release, media announcement, or public statement.
Returns a professionally formatted press release with proper dateline, body, quotes, boilerplate, and contact information.`,
  parameters: {
    type: 'object',
    properties: {
      headline: { type: 'string', description: 'Main headline for the press release' },
      subheadline: { type: 'string', description: 'Secondary headline or summary line' },
      body_paragraphs: {
        type: 'array', items: { type: 'string' },
        description: 'Body paragraphs in order (first paragraph includes the lead)',
      },
      organization: { type: 'string', description: 'Name of the issuing organization' },
      city: { type: 'string', description: 'City for the dateline' },
      state: { type: 'string', description: 'State for the dateline' },
      release_date: { type: 'string', description: 'Release date (e.g., "March 19, 2026")' },
      release_type: {
        type: 'string', enum: ['immediate', 'embargoed'],
        description: 'Release type. Default: "immediate"',
      },
      embargo_date: { type: 'string', description: 'Embargo lift date (only used when release_type is "embargoed")' },
      contact_name: { type: 'string', description: 'Media contact name' },
      contact_email: { type: 'string', description: 'Media contact email' },
      contact_phone: { type: 'string', description: 'Media contact phone number' },
      boilerplate: { type: 'string', description: 'About the organization boilerplate text' },
      quotes: {
        type: 'array', description: 'Attributed quotes to include',
        items: {
          type: 'object', required: ['text', 'attribution'],
          properties: {
            text: { type: 'string', description: 'Quote text' },
            attribution: { type: 'string', description: 'Person being quoted' },
            title: { type: 'string', description: 'Title of the person quoted' },
          },
        },
      },
      format: { type: 'string', enum: ['markdown', 'html'], description: 'Output format. Default: "markdown"' },
    },
    required: ['headline', 'subheadline', 'body_paragraphs'],
  },
};

// ============================================================================
// AVAILABILITY CHECK
// ============================================================================

export function isPressReleaseAvailable(): boolean {
  return true;
}

// ============================================================================
// TOOL EXECUTOR
// ============================================================================

export async function executePressRelease(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const args = toolCall.arguments as {
    headline: string;
    subheadline: string;
    body_paragraphs: string[];
    organization?: string;
    city?: string;
    state?: string;
    release_date?: string;
    release_type?: 'immediate' | 'embargoed';
    embargo_date?: string;
    contact_name?: string;
    contact_email?: string;
    contact_phone?: string;
    boilerplate?: string;
    quotes?: Quote[];
    format?: 'markdown' | 'html';
  };

  if (!args.headline?.trim()) {
    return { toolCallId: toolCall.id, content: 'Error: headline parameter is required', isError: true };
  }
  if (!args.subheadline?.trim()) {
    return { toolCallId: toolCall.id, content: 'Error: subheadline parameter is required', isError: true };
  }
  if (!Array.isArray(args.body_paragraphs) || args.body_paragraphs.length === 0) {
    return { toolCallId: toolCall.id, content: 'Error: body_paragraphs array is required and must not be empty', isError: true };
  }

  if (args.quotes) {
    for (let i = 0; i < args.quotes.length; i++) {
      const q = args.quotes[i];
      if (!q.text || !q.attribution) {
        return {
          toolCallId: toolCall.id,
          content: `Error: quote at index ${i} is missing required fields (text, attribution)`,
          isError: true,
        };
      }
    }
  }

  if (args.release_type === 'embargoed' && !args.embargo_date) {
    return { toolCallId: toolCall.id, content: 'Error: embargo_date is required when release_type is "embargoed"', isError: true };
  }

  const fmt = args.format ?? 'markdown';
  const organization = args.organization ?? '';
  const city = args.city ?? '';
  const state = args.state ?? '';
  const releaseDate = args.release_date ?? '';
  const releaseType = args.release_type ?? 'immediate';
  const embargoDate = args.embargo_date ?? '';
  const contactName = args.contact_name ?? '';
  const contactEmail = args.contact_email ?? '';
  const contactPhone = args.contact_phone ?? '';
  const boilerplate = args.boilerplate ?? '';
  const quotes = args.quotes ?? [];

  try {
    const formatted = fmt === 'html'
      ? formatHtml(args.headline, args.subheadline, args.body_paragraphs, organization, city, state, releaseDate, releaseType, embargoDate, contactName, contactEmail, contactPhone, boilerplate, quotes)
      : formatMarkdown(args.headline, args.subheadline, args.body_paragraphs, organization, city, state, releaseDate, releaseType, embargoDate, contactName, contactEmail, contactPhone, boilerplate, quotes);

    return {
      toolCallId: toolCall.id,
      content: JSON.stringify({
        success: true,
        message: `Press release created: ${args.headline}`,
        format: fmt,
        formatted_output: formatted,
        summary: {
          headline: args.headline,
          organization: organization || null,
          release_type: releaseType,
          dateline: buildDateline(city, state, releaseDate) || null,
          paragraph_count: args.body_paragraphs.length,
          quote_count: quotes.length,
          has_boilerplate: !!boilerplate,
          has_contact: !!(contactName || contactEmail || contactPhone),
        },
      }),
    };
  } catch (error) {
    return {
      toolCallId: toolCall.id,
      content: `Error generating press release: ${(error as Error).message}`,
      isError: true,
    };
  }
}

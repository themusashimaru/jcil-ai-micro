/**
 * POLICY DOCUMENT TOOL — Company policy document generator for AUP, privacy,
 * code of conduct, and other corporate policies with sections, definitions,
 * and acknowledgment forms.
 * No external dependencies. Created: 2026-03-19
 */
import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// TYPES
// ============================================================================

type PolicyType = 'acceptable_use' | 'privacy' | 'code_of_conduct' | 'data_retention' | 'remote_work' | 'social_media' | 'general';

interface Subsection {
  heading: string;
  content: string;
}

interface Section {
  heading: string;
  content: string;
  subsections?: Subsection[];
}

interface Definition {
  term: string;
  definition: string;
}

// ============================================================================
// HELPERS
// ============================================================================

function esc(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const TYPE_LABELS: Record<PolicyType, string> = {
  acceptable_use: 'Acceptable Use Policy',
  privacy: 'Privacy Policy',
  code_of_conduct: 'Code of Conduct',
  data_retention: 'Data Retention Policy',
  remote_work: 'Remote Work Policy',
  social_media: 'Social Media Policy',
  general: 'Company Policy',
};

// ============================================================================
// MARKDOWN FORMATTER
// ============================================================================

function formatMarkdown(
  title: string, policyType: PolicyType, organization: string,
  effectiveDate: string, version: string, reviewDate: string,
  approvedBy: string, scope: string, definitions: Definition[],
  sections: Section[], violations: string, acknowledgment: boolean,
): string {
  const L: string[] = [];
  L.push(`# ${title}`, '');
  L.push('| Field | Value |', '|-------|-------|');
  L.push(`| **Policy Type** | ${TYPE_LABELS[policyType]} |`);
  if (organization) L.push(`| **Organization** | ${organization} |`);
  if (version) L.push(`| **Version** | ${version} |`);
  if (effectiveDate) L.push(`| **Effective Date** | ${effectiveDate} |`);
  if (reviewDate) L.push(`| **Review Date** | ${reviewDate} |`);
  if (approvedBy) L.push(`| **Approved By** | ${approvedBy} |`);
  L.push('');

  if (scope) L.push('## 1. Scope', '', scope, '');

  if (definitions.length > 0) {
    L.push('## 2. Definitions', '', '| Term | Definition |', '|------|------------|');
    for (const d of definitions) L.push(`| **${d.term}** | ${d.definition} |`);
    L.push('');
  }

  const startNum = 1 + (scope ? 1 : 0) + (definitions.length > 0 ? 1 : 0);
  for (let i = 0; i < sections.length; i++) {
    const s = sections[i];
    const num = startNum + i;
    L.push(`## ${num}. ${s.heading}`, '', s.content, '');
    if (s.subsections && s.subsections.length > 0) {
      for (let j = 0; j < s.subsections.length; j++) {
        const sub = s.subsections[j];
        L.push(`### ${num}.${j + 1} ${sub.heading}`, '', sub.content, '');
      }
    }
  }

  if (violations) {
    const vNum = startNum + sections.length;
    L.push(`## ${vNum}. Violations and Consequences`, '', violations, '');
  }

  if (acknowledgment) {
    L.push('---', '', '## Acknowledgment', '');
    L.push('I have read, understand, and agree to comply with this policy.', '');
    L.push('**Employee Name:** ____________________________  ');
    L.push('**Signature:** ____________________________  ');
    L.push('**Date:** ____________________________  ');
    if (organization) L.push(`**Department:** ____________________________  `);
    L.push('');
  }
  return L.join('\n');
}

// ============================================================================
// HTML FORMATTER
// ============================================================================

const CSS = [
  'body{font-family:system-ui,sans-serif;max-width:900px;margin:0 auto;padding:20px;color:#e0e0e0;background:#121225;line-height:1.6}',
  'h1{color:#c0c8e0;border-bottom:3px solid #1a1a2e;padding-bottom:10px;text-align:center}',
  'h2{color:#a0b0d0;margin-top:28px;border-bottom:1px solid #2a2a4e;padding-bottom:6px}',
  'h3{color:#8898b8;margin-top:16px}',
  '.meta{display:grid;grid-template-columns:1fr 1fr;gap:8px 24px;background:#1a1a2e;padding:16px 20px;border-radius:8px;margin-bottom:24px}',
  '.meta-item{display:flex;gap:8px}.meta-label{font-weight:700;color:#8090b0;min-width:130px}.meta-value{color:#c0c8e0}',
  '.scope{background:#1e1e38;border-left:4px solid #4a5a8a;padding:12px 16px;border-radius:4px;margin-bottom:20px;color:#c0c8e0}',
  '.defs{background:#1a1a2e;border-radius:8px;padding:16px 20px;margin:16px 0}',
  '.defs h2{margin-top:0;border:none}',
  '.def-item{padding:8px 0;border-bottom:1px solid #2a2a4e}.def-item:last-child{border:none}',
  '.def-term{font-weight:700;color:#c0c8e0}.def-text{color:#9098b0;margin-top:2px;font-size:.95em}',
  '.section{border:1px solid #2a2a4e;border-radius:8px;padding:16px 20px;margin:12px 0;background:#16162a}',
  '.section h2{margin-top:0;color:#c0c8e0;border:none}',
  '.section p{color:#b0b8d0;text-align:justify}',
  '.subsection{margin-left:16px;padding-left:16px;border-left:2px solid #2a2a4e;margin-top:12px}',
  '.subsection h3{margin-top:0}',
  '.violations{background:#2a1a1a;border-left:4px solid #d04040;padding:16px 20px;border-radius:4px;margin:20px 0}',
  '.violations h2{color:#e08080;margin-top:0;border:none}',
  '.violations p{color:#d0b0b0}',
  '.ack{background:#1a1a2e;border:2px solid #2a2a4e;border-radius:8px;padding:24px;margin-top:32px}',
  '.ack h2{text-align:center;margin-top:0;color:#c0c8e0;border:none}',
  '.ack p{color:#b0b8d0;text-align:center;margin-bottom:20px}',
  '.ack-field{display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #4a4a6e;padding:12px 0;margin:8px 0}',
  '.ack-label{font-weight:700;color:#8090b0;min-width:140px}.ack-line{flex:1;border-bottom:1px solid #6a6a8e;margin-left:16px;min-height:20px}',
  '@media print{body{background:#fff;color:#1a1a1a;padding:0}h1{color:#1a1a2e}h2{color:#2a2a4e}',
  '.meta,.section,.defs,.ack{background:#f5f5fa;border-color:#ccc;color:#1a1a1a}',
  '.section p,.def-text,.ack p{color:#1a1a1a}.section{break-inside:avoid}',
  '.violations{background:#fff0f0;border-color:#cc0000}.ack{page-break-before:always}}',
].join('');

function formatHtml(
  title: string, policyType: PolicyType, organization: string,
  effectiveDate: string, version: string, reviewDate: string,
  approvedBy: string, scope: string, definitions: Definition[],
  sections: Section[], violations: string, acknowledgment: boolean,
): string {
  const h: string[] = [];
  h.push(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>${esc(title)}</title>`);
  h.push(`<style>${CSS}</style></head><body>`);
  h.push(`<h1>${esc(title)}</h1>`);
  h.push('<div class="meta">');
  h.push(`<div class="meta-item"><span class="meta-label">Policy Type:</span><span class="meta-value">${TYPE_LABELS[policyType]}</span></div>`);
  if (organization) h.push(`<div class="meta-item"><span class="meta-label">Organization:</span><span class="meta-value">${esc(organization)}</span></div>`);
  if (version) h.push(`<div class="meta-item"><span class="meta-label">Version:</span><span class="meta-value">${esc(version)}</span></div>`);
  if (effectiveDate) h.push(`<div class="meta-item"><span class="meta-label">Effective Date:</span><span class="meta-value">${esc(effectiveDate)}</span></div>`);
  if (reviewDate) h.push(`<div class="meta-item"><span class="meta-label">Review Date:</span><span class="meta-value">${esc(reviewDate)}</span></div>`);
  if (approvedBy) h.push(`<div class="meta-item"><span class="meta-label">Approved By:</span><span class="meta-value">${esc(approvedBy)}</span></div>`);
  h.push('</div>');

  if (scope) h.push(`<div class="scope"><strong>Scope:</strong> ${esc(scope)}</div>`);

  if (definitions.length > 0) {
    h.push('<div class="defs"><h2>Definitions</h2>');
    for (const d of definitions) {
      h.push(`<div class="def-item"><div class="def-term">${esc(d.term)}</div><div class="def-text">${esc(d.definition)}</div></div>`);
    }
    h.push('</div>');
  }

  const startNum = 1 + (scope ? 1 : 0) + (definitions.length > 0 ? 1 : 0);
  for (let i = 0; i < sections.length; i++) {
    const s = sections[i];
    const num = startNum + i;
    h.push(`<div class="section"><h2>${num}. ${esc(s.heading)}</h2><p>${esc(s.content)}</p>`);
    if (s.subsections && s.subsections.length > 0) {
      for (let j = 0; j < s.subsections.length; j++) {
        const sub = s.subsections[j];
        h.push(`<div class="subsection"><h3>${num}.${j + 1} ${esc(sub.heading)}</h3><p>${esc(sub.content)}</p></div>`);
      }
    }
    h.push('</div>');
  }

  if (violations) {
    h.push(`<div class="violations"><h2>Violations and Consequences</h2><p>${esc(violations)}</p></div>`);
  }

  if (acknowledgment) {
    h.push('<div class="ack"><h2>Acknowledgment</h2>');
    h.push('<p>I have read, understand, and agree to comply with this policy.</p>');
    h.push('<div class="ack-field"><span class="ack-label">Employee Name:</span><span class="ack-line"></span></div>');
    h.push('<div class="ack-field"><span class="ack-label">Signature:</span><span class="ack-line"></span></div>');
    h.push('<div class="ack-field"><span class="ack-label">Date:</span><span class="ack-line"></span></div>');
    if (organization) h.push('<div class="ack-field"><span class="ack-label">Department:</span><span class="ack-line"></span></div>');
    h.push('</div>');
  }

  h.push('</body></html>');
  return h.join('\n');
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const policyDocumentTool: UnifiedTool = {
  name: 'create_policy_document',
  description: `Generate company policy documents (AUP, privacy, code of conduct) with sections, definitions, and acknowledgment.
Use this when the user needs to create corporate policies, acceptable use policies, privacy policies, or codes of conduct.
Returns a complete policy document with numbered sections, subsections, definitions, violation consequences, and optional acknowledgment form.`,
  parameters: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Policy title (e.g., "Acceptable Use Policy")' },
      policy_type: { type: 'string', enum: ['acceptable_use', 'privacy', 'code_of_conduct', 'data_retention', 'remote_work', 'social_media', 'general'], description: 'Type of policy document' },
      sections: {
        type: 'array', description: 'Policy sections with optional subsections',
        items: {
          type: 'object', required: ['heading', 'content'],
          properties: {
            heading: { type: 'string', description: 'Section heading' },
            content: { type: 'string', description: 'Section content' },
            subsections: {
              type: 'array', description: 'Subsections within this section',
              items: {
                type: 'object', required: ['heading', 'content'],
                properties: { heading: { type: 'string' }, content: { type: 'string' } },
              },
            },
          },
        },
      },
      organization: { type: 'string', description: 'Organization name' },
      effective_date: { type: 'string', description: 'Policy effective date' },
      version: { type: 'string', description: 'Policy version (e.g., "1.0")' },
      review_date: { type: 'string', description: 'Next review date' },
      approved_by: { type: 'string', description: 'Person who approved this policy' },
      scope: { type: 'string', description: 'Who this policy applies to' },
      definitions: {
        type: 'array', description: 'Key terms and definitions',
        items: { type: 'object', properties: { term: { type: 'string' }, definition: { type: 'string' } }, required: ['term', 'definition'] },
      },
      violations: { type: 'string', description: 'Consequences for policy violations' },
      acknowledgment: { type: 'boolean', description: 'Include acknowledgment form. Default: false' },
      format: { type: 'string', enum: ['markdown', 'html'], description: 'Output format. Default: "markdown"' },
    },
    required: ['title', 'policy_type', 'sections'],
  },
};

// ============================================================================
// AVAILABILITY CHECK
// ============================================================================

export function isPolicyDocumentAvailable(): boolean {
  return true;
}

// ============================================================================
// TOOL EXECUTOR
// ============================================================================

export async function executePolicyDocument(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const args = toolCall.arguments as {
    title: string;
    policy_type: PolicyType;
    sections: Section[];
    organization?: string;
    effective_date?: string;
    version?: string;
    review_date?: string;
    approved_by?: string;
    scope?: string;
    definitions?: Definition[];
    violations?: string;
    acknowledgment?: boolean;
    format?: 'markdown' | 'html';
  };

  if (!args.title?.trim()) {
    return { toolCallId: toolCall.id, content: 'Error: title parameter is required', isError: true };
  }
  const validTypes: PolicyType[] = ['acceptable_use', 'privacy', 'code_of_conduct', 'data_retention', 'remote_work', 'social_media', 'general'];
  if (!validTypes.includes(args.policy_type)) {
    return { toolCallId: toolCall.id, content: `Error: policy_type must be one of: ${validTypes.join(', ')}`, isError: true };
  }
  if (!Array.isArray(args.sections) || args.sections.length === 0) {
    return { toolCallId: toolCall.id, content: 'Error: sections array is required and must not be empty', isError: true };
  }
  for (let i = 0; i < args.sections.length; i++) {
    const s = args.sections[i];
    if (!s.heading?.trim() || !s.content?.trim()) {
      return { toolCallId: toolCall.id, content: `Error: section at index ${i} is missing required fields (heading, content)`, isError: true };
    }
    if (s.subsections) {
      for (let j = 0; j < s.subsections.length; j++) {
        const sub = s.subsections[j];
        if (!sub.heading?.trim() || !sub.content?.trim()) {
          return { toolCallId: toolCall.id, content: `Error: subsection at index ${j} in section "${s.heading}" is missing required fields (heading, content)`, isError: true };
        }
      }
    }
  }
  if (args.definitions) {
    for (let i = 0; i < args.definitions.length; i++) {
      const d = args.definitions[i];
      if (!d.term?.trim() || !d.definition?.trim()) {
        return { toolCallId: toolCall.id, content: `Error: definition at index ${i} is missing required fields (term, definition)`, isError: true };
      }
    }
  }

  const fmt = args.format ?? 'markdown';
  const organization = args.organization ?? '';
  const effectiveDate = args.effective_date ?? '';
  const version = args.version ?? '';
  const reviewDate = args.review_date ?? '';
  const approvedBy = args.approved_by ?? '';
  const scope = args.scope ?? '';
  const definitions = args.definitions ?? [];
  const violations = args.violations ?? '';
  const acknowledgment = args.acknowledgment ?? false;
  const totalSubsections = args.sections.reduce((sum, s) => sum + (s.subsections?.length ?? 0), 0);

  try {
    const formatted = fmt === 'html'
      ? formatHtml(args.title, args.policy_type, organization, effectiveDate, version, reviewDate, approvedBy, scope, definitions, args.sections, violations, acknowledgment)
      : formatMarkdown(args.title, args.policy_type, organization, effectiveDate, version, reviewDate, approvedBy, scope, definitions, args.sections, violations, acknowledgment);

    return {
      toolCallId: toolCall.id,
      content: JSON.stringify({
        success: true,
        message: `Policy document created: ${args.title} (${TYPE_LABELS[args.policy_type]})`,
        format: fmt,
        formatted_output: formatted,
        summary: {
          title: args.title,
          policy_type: args.policy_type,
          organization: organization || null,
          version: version || null,
          total_sections: args.sections.length,
          total_subsections: totalSubsections,
          definitions_count: definitions.length,
          has_violations: !!violations,
          has_acknowledgment: acknowledgment,
        },
      }),
    };
  } catch (error) {
    return {
      toolCallId: toolCall.id,
      content: `Error generating policy document: ${(error as Error).message}`,
      isError: true,
    };
  }
}

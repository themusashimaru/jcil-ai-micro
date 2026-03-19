/**
 * SOP TOOL — Standard Operating Procedure document generator.
 * Produces professional SOP documents with procedures, checklists,
 * safety notes, responsibilities, and revision history.
 * No external dependencies. Created: 2026-03-19
 */
import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// TYPES
// ============================================================================

interface Responsibility {
  role: string;
  duties: string;
}

interface Definition {
  term: string;
  definition: string;
}

interface Procedure {
  step_number: number;
  title: string;
  description: string;
  substeps?: string[];
  responsible?: string;
  time_estimate?: string;
  safety_note?: string;
}

interface RevisionEntry {
  version: string;
  date: string;
  author: string;
  changes: string;
}

interface Approval {
  prepared_by: string;
  reviewed_by: string;
  approved_by: string;
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
  title: string, sopNumber: string, department: string, version: string,
  effectiveDate: string, purpose: string, scope: string,
  responsibilities: Responsibility[], definitions: Definition[],
  procedures: Procedure[], references: string[],
  revisionHistory: RevisionEntry[], approval: Approval | undefined,
): string {
  const L: string[] = [];
  L.push(`# ${title}`, '');
  L.push('| Field | Value |', '|-------|-------|');
  if (sopNumber) L.push(`| **SOP Number** | ${sopNumber} |`);
  if (department) L.push(`| **Department** | ${department} |`);
  L.push(`| **Version** | ${version} |`);
  if (effectiveDate) L.push(`| **Effective Date** | ${effectiveDate} |`);
  L.push('');

  L.push('## 1. Purpose', '', purpose, '');

  if (scope) L.push('## 2. Scope', '', scope, '');

  if (responsibilities.length > 0) {
    L.push('## 3. Responsibilities', '', '| Role | Duties |', '|------|--------|');
    for (const r of responsibilities) L.push(`| ${r.role} | ${r.duties} |`);
    L.push('');
  }

  if (definitions.length > 0) {
    L.push('## 4. Definitions', '', '| Term | Definition |', '|------|------------|');
    for (const d of definitions) L.push(`| ${d.term} | ${d.definition} |`);
    L.push('');
  }

  L.push('## 5. Procedures', '');
  for (const p of procedures) {
    L.push(`### Step ${p.step_number}: ${p.title}`, '', p.description, '');
    if (p.responsible) L.push(`**Responsible:** ${p.responsible}`);
    if (p.time_estimate) L.push(`**Time Estimate:** ${p.time_estimate}`);
    if (p.substeps && p.substeps.length > 0) {
      L.push('');
      for (const s of p.substeps) L.push(`- [ ] ${s}`);
    }
    if (p.safety_note) L.push('', `> **WARNING:** ${p.safety_note}`);
    L.push('');
  }

  if (references.length > 0) {
    L.push('## 6. References', '');
    for (const ref of references) L.push(`- ${ref}`);
    L.push('');
  }

  if (revisionHistory.length > 0) {
    L.push('## 7. Revision History', '', '| Version | Date | Author | Changes |',
      '|---------|------|--------|---------|');
    for (const r of revisionHistory) L.push(`| ${r.version} | ${r.date} | ${r.author} | ${r.changes} |`);
    L.push('');
  }

  if (approval) {
    L.push('## 8. Approval', '',
      `**Prepared by:** ${approval.prepared_by}`,
      `**Reviewed by:** ${approval.reviewed_by}`,
      `**Approved by:** ${approval.approved_by}`, '');
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
  'h3{color:#8090b0;margin-top:16px}',
  '.meta{display:grid;grid-template-columns:1fr 1fr;gap:8px 24px;background:#1a1a2e;padding:16px 20px;border-radius:8px;margin-bottom:24px}',
  '.meta-item{display:flex;gap:8px}.meta-label{font-weight:700;color:#8090b0;min-width:120px}',
  '.meta-value{color:#c0c8e0}',
  'table{width:100%;border-collapse:collapse;margin:12px 0}',
  'th,td{border:1px solid #2a2a4e;padding:8px 12px;text-align:left}',
  'th{background:#1a1a2e;color:#c0c8e0}tr:nth-child(even){background:#16162a}',
  '.step-card{border:1px solid #2a2a4e;border-radius:8px;padding:16px;margin:12px 0;background:#16162a;counter-increment:step}',
  '.step-card h3{margin-top:0;color:#c0c8e0}',
  '.step-meta{font-size:.9em;color:#7080a0;margin:4px 0}',
  '.substeps{list-style:none;padding:0;margin:8px 0}',
  '.substeps li{padding:4px 0;display:flex;align-items:center;gap:8px;color:#b0b8d0}',
  '.substeps input[type=checkbox]{width:18px;height:18px;accent-color:#4a5a8a}',
  '.warning{background:#3a3520;border-left:4px solid #d4a017;padding:10px 14px;border-radius:4px;margin:8px 0;color:#e8d080}',
  '.approval{background:#1a1a2e;padding:16px 20px;border-radius:8px;margin-top:24px}',
  '.sig-line{border-bottom:1px solid #4a4a6e;padding:12px 0;margin:8px 0;display:flex;justify-content:space-between}',
  '.sig-label{font-weight:700;color:#8090b0}.sig-value{color:#c0c8e0}',
  '@media print{body{background:#fff;color:#1a1a1a;padding:0}h1{color:#1a1a2e}h2{color:#2a2a4e}',
  '.meta,.step-card,.approval{background:#f5f5fa;border-color:#ccc}th{background:#1a1a2e;color:#fff}',
  '.step-card{break-inside:avoid}thead{display:table-header-group}}',
].join('');

function formatHtml(
  title: string, sopNumber: string, department: string, version: string,
  effectiveDate: string, purpose: string, scope: string,
  responsibilities: Responsibility[], definitions: Definition[],
  procedures: Procedure[], references: string[],
  revisionHistory: RevisionEntry[], approval: Approval | undefined,
): string {
  const h: string[] = [];
  h.push(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>${esc(title)}</title>`);
  h.push(`<style>${CSS}</style></head><body>`);
  h.push(`<h1>${esc(title)}</h1>`);
  h.push('<div class="meta">');
  if (sopNumber) h.push(`<div class="meta-item"><span class="meta-label">SOP Number:</span><span class="meta-value">${esc(sopNumber)}</span></div>`);
  if (department) h.push(`<div class="meta-item"><span class="meta-label">Department:</span><span class="meta-value">${esc(department)}</span></div>`);
  h.push(`<div class="meta-item"><span class="meta-label">Version:</span><span class="meta-value">${esc(version)}</span></div>`);
  if (effectiveDate) h.push(`<div class="meta-item"><span class="meta-label">Effective Date:</span><span class="meta-value">${esc(effectiveDate)}</span></div>`);
  h.push('</div>');

  h.push(`<h2>1. Purpose</h2><p>${esc(purpose)}</p>`);
  if (scope) h.push(`<h2>2. Scope</h2><p>${esc(scope)}</p>`);

  if (responsibilities.length > 0) {
    h.push('<h2>3. Responsibilities</h2>');
    h.push('<table><thead><tr><th>Role</th><th>Duties</th></tr></thead><tbody>');
    for (const r of responsibilities) h.push(`<tr><td>${esc(r.role)}</td><td>${esc(r.duties)}</td></tr>`);
    h.push('</tbody></table>');
  }

  if (definitions.length > 0) {
    h.push('<h2>4. Definitions</h2>');
    h.push('<table><thead><tr><th>Term</th><th>Definition</th></tr></thead><tbody>');
    for (const d of definitions) h.push(`<tr><td>${esc(d.term)}</td><td>${esc(d.definition)}</td></tr>`);
    h.push('</tbody></table>');
  }

  h.push('<h2>5. Procedures</h2>');
  for (const p of procedures) {
    h.push(`<div class="step-card"><h3>Step ${p.step_number}: ${esc(p.title)}</h3>`);
    h.push(`<p>${esc(p.description)}</p>`);
    if (p.responsible) h.push(`<div class="step-meta"><strong>Responsible:</strong> ${esc(p.responsible)}</div>`);
    if (p.time_estimate) h.push(`<div class="step-meta"><strong>Time Estimate:</strong> ${esc(p.time_estimate)}</div>`);
    if (p.substeps && p.substeps.length > 0) {
      h.push('<ul class="substeps">');
      for (const s of p.substeps) h.push(`<li><input type="checkbox"><span>${esc(s)}</span></li>`);
      h.push('</ul>');
    }
    if (p.safety_note) h.push(`<div class="warning"><strong>WARNING:</strong> ${esc(p.safety_note)}</div>`);
    h.push('</div>');
  }

  if (references.length > 0) {
    h.push('<h2>6. References</h2><ul>');
    for (const ref of references) h.push(`<li>${esc(ref)}</li>`);
    h.push('</ul>');
  }

  if (revisionHistory.length > 0) {
    h.push('<h2>7. Revision History</h2>');
    h.push('<table><thead><tr><th>Version</th><th>Date</th><th>Author</th><th>Changes</th></tr></thead><tbody>');
    for (const r of revisionHistory) h.push(`<tr><td>${esc(r.version)}</td><td>${esc(r.date)}</td><td>${esc(r.author)}</td><td>${esc(r.changes)}</td></tr>`);
    h.push('</tbody></table>');
  }

  if (approval) {
    h.push('<div class="approval"><h2 style="margin-top:0">8. Approval</h2>');
    h.push(`<div class="sig-line"><span class="sig-label">Prepared by:</span><span class="sig-value">${esc(approval.prepared_by)} ____________________</span></div>`);
    h.push(`<div class="sig-line"><span class="sig-label">Reviewed by:</span><span class="sig-value">${esc(approval.reviewed_by)} ____________________</span></div>`);
    h.push(`<div class="sig-line"><span class="sig-label">Approved by:</span><span class="sig-value">${esc(approval.approved_by)} ____________________</span></div>`);
    h.push('</div>');
  }

  h.push('</body></html>');
  return h.join('\n');
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const sopTool: UnifiedTool = {
  name: 'create_sop',
  description: `Generate professional Standard Operating Procedure (SOP) documents for businesses.
Use this when the user needs to create, document, or formalize a business process or procedure.
Returns a complete SOP with purpose, scope, responsibilities, numbered procedures with checklists, safety notes, and revision history.`,
  parameters: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'SOP title (e.g., "Employee Onboarding Process")' },
      sop_number: { type: 'string', description: 'SOP document number (e.g., "SOP-HR-001")' },
      department: { type: 'string', description: 'Department or team' },
      version: { type: 'string', description: 'Version number. Default: "1.0"' },
      effective_date: { type: 'string', description: 'When this SOP takes effect' },
      purpose: { type: 'string', description: 'Why this SOP exists' },
      scope: { type: 'string', description: 'Who or what this SOP applies to' },
      responsibilities: {
        type: 'array', description: 'Roles and their duties',
        items: { type: 'object', properties: { role: { type: 'string' }, duties: { type: 'string' } }, required: ['role', 'duties'] },
      },
      definitions: {
        type: 'array', description: 'Key terms and definitions',
        items: { type: 'object', properties: { term: { type: 'string' }, definition: { type: 'string' } } },
      },
      procedures: {
        type: 'array', description: 'Ordered procedure steps',
        items: {
          type: 'object', required: ['step_number', 'title', 'description'],
          properties: {
            step_number: { type: 'number', description: 'Step number (1, 2, 3...)' },
            title: { type: 'string', description: 'Step title' },
            description: { type: 'string', description: 'Detailed step description' },
            substeps: { type: 'array', items: { type: 'string' }, description: 'Checklist substeps' },
            responsible: { type: 'string', description: 'Person or role responsible' },
            time_estimate: { type: 'string', description: 'Estimated time for this step' },
            safety_note: { type: 'string', description: 'Safety warning for this step' },
          },
        },
      },
      references: { type: 'array', items: { type: 'string' }, description: 'Related documents or resources' },
      revision_history: {
        type: 'array', description: 'Document revision history',
        items: { type: 'object', properties: { version: { type: 'string' }, date: { type: 'string' }, author: { type: 'string' }, changes: { type: 'string' } } },
      },
      approval: {
        type: 'object', description: 'Approval signature block',
        properties: { prepared_by: { type: 'string' }, reviewed_by: { type: 'string' }, approved_by: { type: 'string' } },
      },
      format: { type: 'string', enum: ['markdown', 'html'], description: 'Output format. Default: "markdown"' },
    },
    required: ['title', 'purpose', 'procedures'],
  },
};

// ============================================================================
// AVAILABILITY CHECK
// ============================================================================

export function isSopAvailable(): boolean {
  return true;
}

// ============================================================================
// TOOL EXECUTOR
// ============================================================================

export async function executeSop(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const args = toolCall.arguments as {
    title: string;
    sop_number?: string;
    department?: string;
    version?: string;
    effective_date?: string;
    purpose: string;
    scope?: string;
    responsibilities?: Responsibility[];
    definitions?: Definition[];
    procedures: Procedure[];
    references?: string[];
    revision_history?: RevisionEntry[];
    approval?: Approval;
    format?: 'markdown' | 'html';
  };

  if (!args.title?.trim()) {
    return { toolCallId: toolCall.id, content: 'Error: title parameter is required', isError: true };
  }
  if (!args.purpose?.trim()) {
    return { toolCallId: toolCall.id, content: 'Error: purpose parameter is required', isError: true };
  }
  if (!Array.isArray(args.procedures) || args.procedures.length === 0) {
    return { toolCallId: toolCall.id, content: 'Error: procedures array is required and must not be empty', isError: true };
  }

  for (let i = 0; i < args.procedures.length; i++) {
    const p = args.procedures[i];
    if (typeof p.step_number !== 'number' || !p.title || !p.description) {
      return {
        toolCallId: toolCall.id,
        content: `Error: procedure at index ${i} is missing required fields (step_number, title, description)`,
        isError: true,
      };
    }
  }

  if (args.responsibilities) {
    for (let i = 0; i < args.responsibilities.length; i++) {
      const r = args.responsibilities[i];
      if (!r.role || !r.duties) {
        return {
          toolCallId: toolCall.id,
          content: `Error: responsibility at index ${i} is missing required fields (role, duties)`,
          isError: true,
        };
      }
    }
  }

  const fmt = args.format ?? 'markdown';
  const ver = args.version ?? '1.0';
  const sopNumber = args.sop_number ?? '';
  const department = args.department ?? '';
  const effectiveDate = args.effective_date ?? '';
  const scope = args.scope ?? '';
  const responsibilities = args.responsibilities ?? [];
  const definitions = args.definitions ?? [];
  const references = args.references ?? [];
  const revisionHistory = args.revision_history ?? [];
  const totalSubsteps = args.procedures.reduce((sum, p) => sum + (p.substeps?.length ?? 0), 0);
  const hasSafetyNotes = args.procedures.some((p) => !!p.safety_note);

  try {
    const formatted = fmt === 'html'
      ? formatHtml(args.title, sopNumber, department, ver, effectiveDate, args.purpose, scope, responsibilities, definitions, args.procedures, references, revisionHistory, args.approval)
      : formatMarkdown(args.title, sopNumber, department, ver, effectiveDate, args.purpose, scope, responsibilities, definitions, args.procedures, references, revisionHistory, args.approval);

    return {
      toolCallId: toolCall.id,
      content: JSON.stringify({
        success: true,
        message: `SOP created: ${args.title}`,
        format: fmt,
        formatted_output: formatted,
        summary: {
          title: args.title,
          sop_number: sopNumber || null,
          department: department || null,
          version: ver,
          total_steps: args.procedures.length,
          total_substeps: totalSubsteps,
          roles_count: responsibilities.length,
          has_safety_notes: hasSafetyNotes,
          references_count: references.length,
        },
      }),
    };
  } catch (error) {
    return {
      toolCallId: toolCall.id,
      content: `Error generating SOP: ${(error as Error).message}`,
      isError: true,
    };
  }
}

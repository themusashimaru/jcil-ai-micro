/**
 * BUSINESS DOCUMENT TEMPLATES TOOL
 *
 * Pre-built professional document templates that the AI can fill with user data.
 * Returns structured markdown that can be fed into create_document or mail_merge.
 *
 * Templates:
 * - Invoice
 * - Contract / Agreement
 * - Proposal / Quote
 * - Resume / CV
 * - Employee Onboarding Packet
 * - Meeting Minutes
 * - Project Status Report
 * - Non-Disclosure Agreement (NDA)
 * - Receipt
 * - Certificate
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';
import { logger } from '@/lib/logger';

const log = logger('DocumentTemplates');

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const documentTemplatesTool: UnifiedTool = {
  name: 'document_template',
  description: `Fill a professional business document template with provided data. Use this when:
- User needs an invoice, contract, proposal, resume, NDA, certificate, receipt, or report
- User says "create an invoice for...", "generate a contract between...", "make a resume for..."
- User needs a pre-formatted business document quickly

Available templates: invoice, contract, proposal, resume, onboarding, meeting_minutes, status_report, nda, receipt, certificate

Returns formatted markdown ready for create_document tool to render as PDF/DOCX.`,
  parameters: {
    type: 'object',
    properties: {
      template_type: {
        type: 'string',
        description:
          'Template to use: "invoice", "contract", "proposal", "resume", "onboarding", "meeting_minutes", "status_report", "nda", "receipt", "certificate"',
      },
      data: {
        type: 'object',
        description: `Data to fill the template. Each template uses different fields:

INVOICE: { company, company_address, client, client_address, invoice_number, date, due_date, items: [{description, quantity, rate}], tax_rate, notes, payment_terms }

CONTRACT: { party_a, party_a_address, party_b, party_b_address, effective_date, term, scope, compensation, termination_clause, governing_law }

PROPOSAL: { company, client, project_name, date, summary, scope_items: [string], timeline, budget, terms }

RESUME: { name, title, email, phone, location, summary, experience: [{company, role, dates, achievements: [string]}], education: [{school, degree, dates}], skills: [string] }

ONBOARDING: { company, employee_name, role, department, start_date, manager, buddy, items: [{task, due, responsible}], policies: [string] }

MEETING_MINUTES: { title, date, attendees: [string], agenda_items: [{topic, discussion, action, owner}], next_meeting }

STATUS_REPORT: { project_name, date, author, period, accomplishments: [string], in_progress: [string], blockers: [string], next_steps: [string], metrics: [{name, value}] }

NDA: { party_a, party_b, effective_date, duration, purpose, governing_law }

RECEIPT: { business_name, business_address, customer, date, receipt_number, items: [{description, amount}], payment_method, notes }

CERTIFICATE: { title, recipient, description, date, issuer, signature_name }`,
      },
    },
    required: ['template_type', 'data'],
  },
};

// ============================================================================
// TEMPLATE GENERATORS
// ============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function generateInvoice(d: any): string {
  const items = d.items || [];
  let subtotal = 0;
  const itemRows = items
    .map((item: { description: string; quantity: number; rate: number }) => {
      const amount = (item.quantity || 1) * (item.rate || 0);
      subtotal += amount;
      return `| ${item.description} | ${item.quantity || 1} | $${(item.rate || 0).toFixed(2)} | $${amount.toFixed(2)} |`;
    })
    .join('\n');

  const taxRate = d.tax_rate || 0;
  const tax = subtotal * (taxRate / 100);
  const total = subtotal + tax;

  return `# INVOICE

**${d.company || 'Company Name'}**
${d.company_address || ''}

---

**Bill To:**
${d.client || 'Client Name'}
${d.client_address || ''}

| | |
|---|---|
| **Invoice #** | ${d.invoice_number || 'INV-001'} |
| **Date** | ${d.date || new Date().toLocaleDateString()} |
| **Due Date** | ${d.due_date || 'Upon Receipt'} |

---

## Items

| Description | Qty | Rate | Amount |
|-------------|-----|------|--------|
${itemRows}

---

| | |
|---|---|
| **Subtotal** | $${subtotal.toFixed(2)} |
${taxRate > 0 ? `| **Tax (${taxRate}%)** | $${tax.toFixed(2)} |` : ''}
| **Total Due** | **$${total.toFixed(2)}** |

---

${d.payment_terms ? `**Payment Terms:** ${d.payment_terms}` : ''}
${d.notes ? `\n**Notes:** ${d.notes}` : ''}

*Thank you for your business!*`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function generateContract(d: any): string {
  return `# SERVICE AGREEMENT

**This Agreement** is entered into as of **${d.effective_date || new Date().toLocaleDateString()}** (the "Effective Date")

**Between:**

**${d.party_a || 'Party A'}** ${d.party_a_address ? `\n${d.party_a_address}` : ''}
(hereinafter referred to as "Provider")

**And:**

**${d.party_b || 'Party B'}** ${d.party_b_address ? `\n${d.party_b_address}` : ''}
(hereinafter referred to as "Client")

---

## 1. Term

This Agreement shall commence on the Effective Date and continue for a period of **${d.term || '12 months'}** unless terminated earlier in accordance with Section 5.

## 2. Scope of Services

${d.scope || 'The Provider agrees to perform the services as described in this agreement.'}

## 3. Compensation

${d.compensation || 'Compensation terms to be determined by mutual agreement.'}

## 4. Confidentiality

Both parties agree to maintain the confidentiality of any proprietary information exchanged during the term of this Agreement.

## 5. Termination

${d.termination_clause || 'Either party may terminate this Agreement with 30 days written notice.'}

## 6. Governing Law

This Agreement shall be governed by the laws of **${d.governing_law || 'the State of New York'}**.

## 7. Entire Agreement

This Agreement constitutes the entire agreement between the parties and supersedes all prior negotiations, representations, or agreements.

---

**AGREED AND ACCEPTED:**

[SIGNATURE]

**${d.party_a || 'Party A'}**
Date: _______________

[SIGNATURE]

**${d.party_b || 'Party B'}**
Date: _______________`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function generateProposal(d: any): string {
  const scopeItems = (d.scope_items || []).map((item: string) => `- ${item}`).join('\n');

  return `# PROJECT PROPOSAL

**${d.company || 'Company Name'}**

---

**Prepared for:** ${d.client || 'Client Name'}
**Project:** ${d.project_name || 'Project Name'}
**Date:** ${d.date || new Date().toLocaleDateString()}

---

## Executive Summary

${d.summary || 'A brief overview of the proposed project and its objectives.'}

## Scope of Work

${scopeItems || '- To be defined'}

## Timeline

${d.timeline || 'Timeline to be determined based on project scope.'}

## Budget

${d.budget || 'Budget to be determined.'}

## Terms & Conditions

${d.terms || 'Standard terms and conditions apply. Payment due within 30 days of invoice.'}

---

*We look forward to working with you on this project.*

[SIGNATURE]

**${d.company || 'Company Name'}**`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function generateResume(d: any): string {
  const experience = (d.experience || [])
    .map((exp: { company: string; role: string; dates: string; achievements: string[] }) => {
      const achievements = (exp.achievements || []).map((a: string) => `- ${a}`).join('\n');
      return `### ${exp.role} | ${exp.company}
*${exp.dates || ''}*
${achievements}`;
    })
    .join('\n\n');

  const education = (d.education || [])
    .map((edu: { school: string; degree: string; dates: string }) => {
      return `### ${edu.degree} | ${edu.school}
*${edu.dates || ''}*`;
    })
    .join('\n\n');

  const skills = (d.skills || []).join(' | ');

  return `# ${d.name || 'Full Name'}
### ${d.title || 'Professional Title'}

${d.email || ''} | ${d.phone || ''} | ${d.location || ''}

---

## Professional Summary

${d.summary || 'Experienced professional with a track record of delivering results.'}

---

## Experience

${experience || 'Experience details to be added.'}

---

## Education

${education || 'Education details to be added.'}

---

## Skills

${skills || 'Skills to be added.'}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function generateOnboarding(d: any): string {
  const taskRows = (d.items || [])
    .map(
      (item: { task: string; due: string; responsible: string }) =>
        `| ${item.task} | ${item.due || 'Week 1'} | ${item.responsible || 'Manager'} |`
    )
    .join('\n');

  const policies = (d.policies || []).map((p: string) => `- ${p}`).join('\n');

  return `# EMPLOYEE ONBOARDING PACKET

**${d.company || 'Company Name'}**

---

## Welcome, ${d.employee_name || 'New Employee'}!

We are thrilled to have you join our team as **${d.role || 'Team Member'}** in the **${d.department || 'Department'}** department.

| | |
|---|---|
| **Start Date** | ${d.start_date || 'TBD'} |
| **Manager** | ${d.manager || 'TBD'} |
| **Onboarding Buddy** | ${d.buddy || 'TBD'} |

---

## Onboarding Checklist

| Task | Due | Responsible |
|------|-----|-------------|
${taskRows || '| Complete paperwork | Day 1 | HR |'}

---

## Company Policies

Please review the following:

${policies || '- Employee Handbook\n- Code of Conduct\n- IT Security Policy'}

---

## First Week Schedule

### Day 1
- Welcome & introductions
- IT setup & equipment
- HR paperwork & benefits enrollment

### Day 2-3
- Department orientation
- Team meetings & project overview
- Tool & system training

### Day 4-5
- Shadow team members
- First assignment kickoff
- End-of-week check-in with manager

---

*Welcome aboard! We're excited to have you on the team.*`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function generateMeetingMinutes(d: any): string {
  const attendees = (d.attendees || []).map((a: string) => `- ${a}`).join('\n');
  const agendaItems = (d.agenda_items || [])
    .map(
      (item: { topic: string; discussion: string; action: string; owner: string }, idx: number) =>
        `### ${idx + 1}. ${item.topic}

**Discussion:** ${item.discussion || 'N/A'}

**Action Item:** ${item.action || 'None'}
**Owner:** ${item.owner || 'TBD'}`
    )
    .join('\n\n');

  return `# MEETING MINUTES

**${d.title || 'Team Meeting'}**
**Date:** ${d.date || new Date().toLocaleDateString()}

---

## Attendees

${attendees || '- TBD'}

---

## Agenda & Discussion

${agendaItems || 'No agenda items recorded.'}

---

## Next Meeting

${d.next_meeting || 'To be scheduled.'}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function generateStatusReport(d: any): string {
  const accomplishments = (d.accomplishments || []).map((a: string) => `- ${a}`).join('\n');
  const inProgress = (d.in_progress || []).map((a: string) => `- ${a}`).join('\n');
  const blockers = (d.blockers || []).map((a: string) => `- ${a}`).join('\n');
  const nextSteps = (d.next_steps || []).map((a: string) => `- ${a}`).join('\n');
  const metricRows = (d.metrics || [])
    .map((m: { name: string; value: string }) => `| ${m.name} | ${m.value} |`)
    .join('\n');

  return `# PROJECT STATUS REPORT

**Project:** ${d.project_name || 'Project Name'}
**Date:** ${d.date || new Date().toLocaleDateString()}
**Author:** ${d.author || 'Author'}
**Period:** ${d.period || 'This Week'}

---

## Accomplishments

${accomplishments || '- No accomplishments to report.'}

## In Progress

${inProgress || '- Nothing currently in progress.'}

## Blockers / Risks

${blockers || '- No blockers at this time.'}

## Next Steps

${nextSteps || '- To be determined.'}

${
  metricRows
    ? `## Key Metrics

| Metric | Value |
|--------|-------|
${metricRows}`
    : ''
}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function generateNDA(d: any): string {
  return `# NON-DISCLOSURE AGREEMENT

**This Non-Disclosure Agreement** (the "Agreement") is entered into as of **${d.effective_date || new Date().toLocaleDateString()}** by and between:

**${d.party_a || 'Disclosing Party'}** ("Disclosing Party")

and

**${d.party_b || 'Receiving Party'}** ("Receiving Party")

---

## 1. Purpose

The parties wish to explore a potential business relationship (the "${d.purpose || 'Purpose'}") and in connection therewith, the Disclosing Party may disclose certain confidential information to the Receiving Party.

## 2. Definition of Confidential Information

"Confidential Information" means any and all non-public information disclosed by the Disclosing Party, including but not limited to: trade secrets, business plans, financial information, customer lists, technical data, inventions, processes, and strategies.

## 3. Obligations of Receiving Party

The Receiving Party agrees to:
- Hold all Confidential Information in strict confidence
- Not disclose Confidential Information to any third party without prior written consent
- Use Confidential Information solely for the Purpose
- Take reasonable precautions to prevent unauthorized disclosure

## 4. Exclusions

This Agreement does not apply to information that:
- Is or becomes publicly available through no fault of the Receiving Party
- Was known to the Receiving Party prior to disclosure
- Is independently developed without use of Confidential Information
- Is received from a third party without breach of any obligation of confidentiality

## 5. Term

This Agreement shall remain in effect for **${d.duration || '2 years'}** from the Effective Date.

## 6. Return of Materials

Upon termination, the Receiving Party shall promptly return or destroy all Confidential Information and any copies thereof.

## 7. Governing Law

This Agreement shall be governed by the laws of **${d.governing_law || 'the State of New York'}**.

---

**AGREED AND ACCEPTED:**

[SIGNATURE]

**${d.party_a || 'Disclosing Party'}**
Date: _______________

[SIGNATURE]

**${d.party_b || 'Receiving Party'}**
Date: _______________`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function generateReceipt(d: any): string {
  const items = d.items || [];
  let total = 0;
  const itemRows = items
    .map((item: { description: string; amount: number }) => {
      total += item.amount || 0;
      return `| ${item.description} | $${(item.amount || 0).toFixed(2)} |`;
    })
    .join('\n');

  return `# RECEIPT

**${d.business_name || 'Business Name'}**
${d.business_address || ''}

---

**Customer:** ${d.customer || ''}
**Date:** ${d.date || new Date().toLocaleDateString()}
**Receipt #:** ${d.receipt_number || `REC-${Date.now().toString().slice(-6)}`}

---

| Description | Amount |
|-------------|--------|
${itemRows}
| **Total** | **$${total.toFixed(2)}** |

---

**Payment Method:** ${d.payment_method || 'N/A'}

${d.notes ? `**Notes:** ${d.notes}` : ''}

*Thank you for your purchase!*`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function generateCertificate(d: any): string {
  return `# ${d.title || 'CERTIFICATE OF COMPLETION'}

---

*This is to certify that*

## ${d.recipient || 'Recipient Name'}

*${d.description || 'has successfully completed the requirements set forth.'}*

**Date:** ${d.date || new Date().toLocaleDateString()}

**Issued by:** ${d.issuer || 'Organization'}

---

[SIGNATURE]

${d.signature_name || 'Authorized Signature'}`;
}

// ============================================================================
// TEMPLATE MAP
// ============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const TEMPLATE_MAP: Record<string, (data: any) => string> = {
  invoice: generateInvoice,
  contract: generateContract,
  proposal: generateProposal,
  resume: generateResume,
  onboarding: generateOnboarding,
  meeting_minutes: generateMeetingMinutes,
  status_report: generateStatusReport,
  nda: generateNDA,
  receipt: generateReceipt,
  certificate: generateCertificate,
};

// ============================================================================
// EXECUTOR
// ============================================================================

export async function executeDocumentTemplate(
  toolCall: UnifiedToolCall
): Promise<UnifiedToolResult> {
  const { id, name, arguments: rawArgs } = toolCall;

  if (name !== 'document_template') {
    return { toolCallId: id, content: `Unknown tool: ${name}`, isError: true };
  }

  const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;

  if (!args.template_type) {
    return {
      toolCallId: id,
      content: `Template type is required. Available: ${Object.keys(TEMPLATE_MAP).join(', ')}`,
      isError: true,
    };
  }

  const generator = TEMPLATE_MAP[args.template_type];
  if (!generator) {
    return {
      toolCallId: id,
      content: `Unknown template: ${args.template_type}. Available: ${Object.keys(TEMPLATE_MAP).join(', ')}`,
      isError: true,
    };
  }

  if (!args.data || typeof args.data !== 'object') {
    return { toolCallId: id, content: 'Template data object is required', isError: true };
  }

  log.info('Generating document template', { type: args.template_type });

  try {
    const markdown = generator(args.data);

    const content = JSON.stringify({
      success: true,
      template_type: args.template_type,
      markdown,
      instructions:
        'This markdown is ready to be passed to the create_document tool to generate a PDF or DOCX. You can also modify it before generating.',
    });

    return { toolCallId: id, content, isError: false };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    log.error('Template generation failed', { error: msg });
    return { toolCallId: id, content: `Template generation failed: ${msg}`, isError: true };
  }
}

// ============================================================================
// AVAILABILITY
// ============================================================================

export function isDocumentTemplateAvailable(): boolean {
  return true; // Pure string templates, no dependencies
}

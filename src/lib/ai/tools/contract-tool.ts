/**
 * CONTRACT TOOL — Contract and NDA document generator with customizable
 * clauses, party identification, and signature blocks.
 * No external dependencies. Created: 2026-03-19
 */
import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// TYPES
// ============================================================================

type ContractType = 'nda' | 'service_agreement' | 'employment' | 'freelance' | 'general';

interface Party {
  name: string;
  role: string;
  address?: string;
}

interface Clause {
  title: string;
  content: string;
}

// ============================================================================
// HELPERS
// ============================================================================

function esc(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const TYPE_LABELS: Record<ContractType, string> = {
  nda: 'Non-Disclosure Agreement',
  service_agreement: 'Service Agreement',
  employment: 'Employment Agreement',
  freelance: 'Freelance Contract',
  general: 'General Contract',
};

// ============================================================================
// MARKDOWN FORMATTER
// ============================================================================

function formatMarkdown(
  title: string, contractType: ContractType, parties: Party[],
  effectiveDate: string, term: string, clauses: Clause[],
  confidentiality: string, termination: string, governingLaw: string,
  disputeResolution: string, compensation: string, nonCompete: string,
  signatures: boolean,
): string {
  const L: string[] = [];
  L.push(`# ${title}`, '', `**Type:** ${TYPE_LABELS[contractType]}  `);
  if (effectiveDate) L.push(`**Effective Date:** ${effectiveDate}  `);
  if (term) L.push(`**Term:** ${term}  `);
  L.push('', '---', '');

  // Recitals
  L.push('## RECITALS', '');
  L.push('This agreement ("Agreement") is entered into by and between:', '');
  for (let i = 0; i < parties.length; i++) {
    const p = parties[i];
    L.push(`**${p.role}:** ${p.name}${p.address ? `, with an address at ${p.address}` : ''}`);
    if (i < parties.length - 1) L.push('');
    L.push('and', '');
  }
  // Remove trailing "and"
  L.pop(); L.pop();
  L.push('', 'WHEREAS, the parties wish to enter into this Agreement under the terms and conditions set forth herein.', '');
  L.push('NOW, THEREFORE, in consideration of the mutual covenants contained herein, the parties agree as follows:', '', '---', '');

  let articleNum = 1;

  // Standard clauses by type
  if (confidentiality) {
    L.push(`## Article ${articleNum}. Confidentiality`, '', confidentiality, '');
    articleNum++;
  }
  if (compensation) {
    L.push(`## Article ${articleNum}. Compensation`, '', compensation, '');
    articleNum++;
  }
  if (nonCompete) {
    L.push(`## Article ${articleNum}. Non-Compete`, '', nonCompete, '');
    articleNum++;
  }
  if (termination) {
    L.push(`## Article ${articleNum}. Termination`, '', termination, '');
    articleNum++;
  }

  // Custom clauses
  for (const clause of clauses) {
    L.push(`## Article ${articleNum}. ${clause.title}`, '', clause.content, '');
    articleNum++;
  }

  if (governingLaw) {
    L.push(`## Article ${articleNum}. Governing Law`, '', `This Agreement shall be governed by and construed in accordance with the laws of the ${governingLaw}.`, '');
    articleNum++;
  }
  if (disputeResolution) {
    L.push(`## Article ${articleNum}. Dispute Resolution`, '', disputeResolution, '');
    articleNum++;
  }

  L.push(`## Article ${articleNum}. Entire Agreement`, '', 'This Agreement constitutes the entire agreement between the parties and supersedes all prior agreements, representations, and understandings.', '');

  if (signatures) {
    L.push('---', '', '## SIGNATURES', '', 'IN WITNESS WHEREOF, the parties have executed this Agreement as of the date first written above.', '');
    for (const p of parties) {
      L.push(`**${p.role}:**`, '', `Name: ${p.name}  `, 'Signature: ____________________________  ', 'Date: ____________________________', '');
    }
  }
  return L.join('\n');
}

// ============================================================================
// HTML FORMATTER
// ============================================================================

const CSS = [
  'body{font-family:Georgia,"Times New Roman",serif;max-width:900px;margin:0 auto;padding:40px;color:#e0e0e0;background:#121225;line-height:1.6}',
  'h1{color:#c0c8e0;text-align:center;border-bottom:3px double #1a1a2e;padding-bottom:12px;font-size:1.6em;text-transform:uppercase;letter-spacing:2px}',
  'h2{color:#a0b0d0;margin-top:28px;font-size:1.1em}',
  '.type-badge{text-align:center;color:#8090b0;font-size:.95em;margin-bottom:20px}',
  '.meta{text-align:center;color:#8090b0;margin-bottom:24px;font-size:.95em}',
  '.recitals{background:#1a1a2e;padding:20px 24px;border-radius:8px;margin:20px 0;color:#b0b8d0}',
  '.recitals p{margin:8px 0}',
  '.party{font-weight:700;color:#c0c8e0}',
  '.whereas{font-style:italic;color:#9098b0;margin-top:16px}',
  '.article{margin:20px 0;padding:16px 20px;border-left:3px solid #2a2a4e}',
  '.article h2{margin-top:0;color:#c0c8e0}',
  '.article p{color:#b0b8d0;text-indent:2em;text-align:justify}',
  '.signatures{background:#1a1a2e;padding:24px;border-radius:8px;margin-top:32px}',
  '.signatures h2{text-align:center;margin-top:0;color:#c0c8e0}',
  '.sig-witness{text-align:center;color:#8090b0;font-style:italic;margin-bottom:20px}',
  '.sig-block{display:flex;justify-content:space-between;flex-wrap:wrap;gap:24px}',
  '.sig-party{flex:1;min-width:280px;border:1px solid #2a2a4e;border-radius:8px;padding:20px}',
  '.sig-role{font-weight:700;color:#8090b0;margin-bottom:12px;font-size:.9em;text-transform:uppercase}',
  '.sig-name{color:#c0c8e0;margin-bottom:16px}',
  '.sig-line{border-bottom:1px solid #4a4a6e;padding:10px 0;margin:6px 0;color:#8090b0;font-size:.9em}',
  '@media print{body{background:#fff;color:#1a1a1a;padding:20px}h1{color:#1a1a2e;border-color:#1a1a2e}',
  'h2{color:#2a2a4e}.recitals,.signatures,.article{background:#f8f8fc;border-color:#ccc;color:#1a1a1a}',
  '.recitals p,.article p,.sig-name{color:#1a1a1a}.sig-block{break-inside:avoid}}',
].join('');

function formatHtml(
  title: string, contractType: ContractType, parties: Party[],
  effectiveDate: string, term: string, clauses: Clause[],
  confidentiality: string, termination: string, governingLaw: string,
  disputeResolution: string, compensation: string, nonCompete: string,
  signatures: boolean,
): string {
  const h: string[] = [];
  h.push(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>${esc(title)}</title>`);
  h.push(`<style>${CSS}</style></head><body>`);
  h.push(`<h1>${esc(title)}</h1>`);
  h.push(`<div class="type-badge">${TYPE_LABELS[contractType]}</div>`);
  const metaParts: string[] = [];
  if (effectiveDate) metaParts.push(`<strong>Effective Date:</strong> ${esc(effectiveDate)}`);
  if (term) metaParts.push(`<strong>Term:</strong> ${esc(term)}`);
  if (metaParts.length > 0) h.push(`<div class="meta">${metaParts.join(' &nbsp;|&nbsp; ')}</div>`);

  // Recitals
  h.push('<div class="recitals">');
  h.push('<p>This Agreement is entered into by and between:</p>');
  for (let i = 0; i < parties.length; i++) {
    const p = parties[i];
    h.push(`<p><span class="party">${esc(p.role)}:</span> ${esc(p.name)}${p.address ? `, with an address at ${esc(p.address)}` : ''}`);
    if (i < parties.length - 1) h.push(' (hereinafter referred to as the "' + esc(p.role) + '")');
    h.push('</p>');
  }
  h.push('<p class="whereas">WHEREAS, the parties wish to enter into this Agreement under the terms and conditions set forth herein.</p>');
  h.push('<p>NOW, THEREFORE, in consideration of the mutual covenants contained herein, the parties agree as follows:</p>');
  h.push('</div>');

  let articleNum = 1;

  const addArticle = (num: number, heading: string, content: string) => {
    h.push(`<div class="article"><h2>Article ${num}. ${esc(heading)}</h2><p>${esc(content)}</p></div>`);
  };

  if (confidentiality) { addArticle(articleNum, 'Confidentiality', confidentiality); articleNum++; }
  if (compensation) { addArticle(articleNum, 'Compensation', compensation); articleNum++; }
  if (nonCompete) { addArticle(articleNum, 'Non-Compete', nonCompete); articleNum++; }
  if (termination) { addArticle(articleNum, 'Termination', termination); articleNum++; }

  for (const clause of clauses) {
    addArticle(articleNum, clause.title, clause.content);
    articleNum++;
  }

  if (governingLaw) {
    addArticle(articleNum, 'Governing Law', `This Agreement shall be governed by and construed in accordance with the laws of the ${governingLaw}.`);
    articleNum++;
  }
  if (disputeResolution) { addArticle(articleNum, 'Dispute Resolution', disputeResolution); articleNum++; }
  addArticle(articleNum, 'Entire Agreement', 'This Agreement constitutes the entire agreement between the parties and supersedes all prior agreements, representations, and understandings.');

  if (signatures) {
    h.push('<div class="signatures"><h2>SIGNATURES</h2>');
    h.push('<p class="sig-witness">IN WITNESS WHEREOF, the parties have executed this Agreement as of the date first written above.</p>');
    h.push('<div class="sig-block">');
    for (const p of parties) {
      h.push('<div class="sig-party">');
      h.push(`<div class="sig-role">${esc(p.role)}</div>`);
      h.push(`<div class="sig-name">${esc(p.name)}</div>`);
      h.push('<div class="sig-line">Signature: ____________________________</div>');
      h.push('<div class="sig-line">Date: ____________________________</div>');
      h.push('</div>');
    }
    h.push('</div></div>');
  }

  h.push('</body></html>');
  return h.join('\n');
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const contractTool: UnifiedTool = {
  name: 'create_contract',
  description: `Generate contracts and NDAs with customizable clauses, terms, and signature blocks.
Use this when the user needs to draft a contract, NDA, service agreement, employment agreement, or freelance contract.
Returns a complete legal document with party identification, recitals, numbered articles, and signature blocks — ready to print or share.`,
  parameters: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Contract title (e.g., "Mutual Non-Disclosure Agreement")' },
      contract_type: { type: 'string', enum: ['nda', 'service_agreement', 'employment', 'freelance', 'general'], description: 'Type of contract' },
      parties: {
        type: 'array', description: 'Parties to the contract',
        items: {
          type: 'object', required: ['name', 'role'],
          properties: {
            name: { type: 'string', description: 'Party full name or entity name' },
            role: { type: 'string', description: 'Party role (e.g., "Disclosing Party", "Employer")' },
            address: { type: 'string', description: 'Party address' },
          },
        },
      },
      effective_date: { type: 'string', description: 'Contract effective date' },
      term: { type: 'string', description: 'Contract term (e.g., "12 months")' },
      clauses: {
        type: 'array', description: 'Custom contract clauses',
        items: {
          type: 'object', properties: { title: { type: 'string' }, content: { type: 'string' } }, required: ['title', 'content'],
        },
      },
      confidentiality_terms: { type: 'string', description: 'Confidentiality clause content' },
      termination_terms: { type: 'string', description: 'Termination clause content' },
      governing_law: { type: 'string', description: 'Governing jurisdiction (e.g., "State of California")' },
      dispute_resolution: { type: 'string', description: 'Dispute resolution terms' },
      compensation: { type: 'string', description: 'Compensation terms' },
      non_compete: { type: 'string', description: 'Non-compete clause content' },
      signatures: { type: 'boolean', description: 'Include signature block. Default: true' },
      format: { type: 'string', enum: ['markdown', 'html'], description: 'Output format. Default: "markdown"' },
    },
    required: ['title', 'contract_type', 'parties'],
  },
};

// ============================================================================
// AVAILABILITY CHECK
// ============================================================================

export function isContractAvailable(): boolean {
  return true;
}

// ============================================================================
// TOOL EXECUTOR
// ============================================================================

export async function executeContract(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const args = toolCall.arguments as {
    title: string;
    contract_type: ContractType;
    parties: Party[];
    effective_date?: string;
    term?: string;
    clauses?: Clause[];
    confidentiality_terms?: string;
    termination_terms?: string;
    governing_law?: string;
    dispute_resolution?: string;
    compensation?: string;
    non_compete?: string;
    signatures?: boolean;
    format?: 'markdown' | 'html';
  };

  if (!args.title?.trim()) {
    return { toolCallId: toolCall.id, content: 'Error: title parameter is required', isError: true };
  }
  const validTypes: ContractType[] = ['nda', 'service_agreement', 'employment', 'freelance', 'general'];
  if (!validTypes.includes(args.contract_type)) {
    return { toolCallId: toolCall.id, content: `Error: contract_type must be one of: ${validTypes.join(', ')}`, isError: true };
  }
  if (!Array.isArray(args.parties) || args.parties.length < 2) {
    return { toolCallId: toolCall.id, content: 'Error: parties array is required and must have at least 2 parties', isError: true };
  }
  for (let i = 0; i < args.parties.length; i++) {
    const p = args.parties[i];
    if (!p.name?.trim() || !p.role?.trim()) {
      return { toolCallId: toolCall.id, content: `Error: party at index ${i} is missing required fields (name, role)`, isError: true };
    }
  }
  if (args.clauses) {
    for (let i = 0; i < args.clauses.length; i++) {
      const c = args.clauses[i];
      if (!c.title?.trim() || !c.content?.trim()) {
        return { toolCallId: toolCall.id, content: `Error: clause at index ${i} is missing required fields (title, content)`, isError: true };
      }
    }
  }

  const fmt = args.format ?? 'markdown';
  const sigs = args.signatures !== false;
  const clauses = args.clauses ?? [];
  const confidentiality = args.confidentiality_terms ?? '';
  const termination = args.termination_terms ?? '';
  const governingLaw = args.governing_law ?? '';
  const disputeResolution = args.dispute_resolution ?? '';
  const compensation = args.compensation ?? '';
  const nonCompete = args.non_compete ?? '';
  const effectiveDate = args.effective_date ?? '';
  const term = args.term ?? '';

  try {
    const formatted = fmt === 'html'
      ? formatHtml(args.title, args.contract_type, args.parties, effectiveDate, term, clauses, confidentiality, termination, governingLaw, disputeResolution, compensation, nonCompete, sigs)
      : formatMarkdown(args.title, args.contract_type, args.parties, effectiveDate, term, clauses, confidentiality, termination, governingLaw, disputeResolution, compensation, nonCompete, sigs);

    const totalArticles = [confidentiality, compensation, nonCompete, termination].filter(Boolean).length + clauses.length + (governingLaw ? 1 : 0) + (disputeResolution ? 1 : 0) + 1;

    return {
      toolCallId: toolCall.id,
      content: JSON.stringify({
        success: true,
        message: `Contract created: ${args.title} (${TYPE_LABELS[args.contract_type]})`,
        format: fmt,
        formatted_output: formatted,
        summary: {
          title: args.title,
          contract_type: args.contract_type,
          parties: args.parties.map((p) => ({ name: p.name, role: p.role })),
          effective_date: effectiveDate || null,
          term: term || null,
          total_articles: totalArticles,
          custom_clauses: clauses.length,
          has_signatures: sigs,
          governing_law: governingLaw || null,
        },
      }),
    };
  } catch (error) {
    return {
      toolCallId: toolCall.id,
      content: `Error generating contract: ${(error as Error).message}`,
      isError: true,
    };
  }
}

/**
 * GRANT PROPOSAL TOOL — Grant proposal document generator for nonprofits/institutions.
 * No external dependencies. Created: 2026-03-19
 */
import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// TYPES
// ============================================================================

interface GoalObjective {
  goal: string;
  objectives: string[];
}

interface TimelinePhase {
  phase: string;
  duration: string;
  activities: string[];
}

interface BudgetItem {
  category: string;
  amount: string;
  justification: string;
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
  projectTitle: string, organization: string, executiveSummary: string,
  budgetTotal: string, grantProgram: string, submissionDate: string,
  projectPeriod: string, pi: string, statementOfNeed: string,
  goals: GoalObjective[], methodology: string, timeline: TimelinePhase[],
  budgetItems: BudgetItem[], evaluationPlan: string,
  sustainabilityPlan: string, orgCapacity: string,
): string {
  const L: string[] = [];
  L.push(`# Grant Proposal: ${projectTitle}`, '');
  L.push('| Field | Value |', '|-------|-------|');
  L.push(`| **Organization** | ${organization} |`);
  if (grantProgram) L.push(`| **Grant Program** | ${grantProgram} |`);
  if (submissionDate) L.push(`| **Submission Date** | ${submissionDate} |`);
  if (projectPeriod) L.push(`| **Project Period** | ${projectPeriod} |`);
  if (pi) L.push(`| **Principal Investigator** | ${pi} |`);
  L.push(`| **Total Budget** | ${budgetTotal} |`);
  L.push('');

  L.push('## 1. Executive Summary', '', executiveSummary, '');

  if (statementOfNeed) L.push('## 2. Statement of Need', '', statementOfNeed, '');

  if (goals.length > 0) {
    L.push('## 3. Goals and Objectives', '');
    for (let i = 0; i < goals.length; i++) {
      L.push(`### Goal ${i + 1}: ${goals[i].goal}`, '');
      if (goals[i].objectives.length > 0) {
        for (let j = 0; j < goals[i].objectives.length; j++) {
          L.push(`${j + 1}. ${goals[i].objectives[j]}`);
        }
        L.push('');
      }
    }
  }

  if (methodology) L.push('## 4. Methodology', '', methodology, '');

  if (timeline.length > 0) {
    L.push('## 5. Timeline', '', '| Phase | Duration | Activities |', '|-------|----------|------------|');
    for (const t of timeline) {
      const acts = t.activities.join('; ');
      L.push(`| ${t.phase} | ${t.duration} | ${acts} |`);
    }
    L.push('');
  }

  L.push('## 6. Budget', '', '| Category | Amount | Justification |',
    '|----------|--------|---------------|');
  for (const b of budgetItems) {
    L.push(`| ${b.category} | ${b.amount} | ${b.justification} |`);
  }
  L.push(`| **Total** | **${budgetTotal}** | |`, '');

  if (evaluationPlan) L.push('## 7. Evaluation Plan', '', evaluationPlan, '');
  if (sustainabilityPlan) L.push('## 8. Sustainability Plan', '', sustainabilityPlan, '');
  if (orgCapacity) L.push('## 9. Organizational Capacity', '', orgCapacity, '');

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
  '.meta-item{display:flex;gap:8px}.meta-label{font-weight:700;color:#8090b0;min-width:140px}',
  '.meta-value{color:#c0c8e0}',
  'table{width:100%;border-collapse:collapse;margin:12px 0}',
  'th,td{border:1px solid #2a2a4e;padding:8px 12px;text-align:left}',
  'th{background:#1a1a2e;color:#c0c8e0}tr:nth-child(even){background:#16162a}',
  '.total-row{font-weight:700;background:#1a1a2e !important}',
  '.goal-card{border:1px solid #2a2a4e;border-radius:8px;padding:16px;margin:12px 0;background:#16162a}',
  '.goal-card h3{margin-top:0;color:#c0c8e0}',
  '.goal-card ol{color:#b0b8d0;padding-left:20px}',
  '.timeline-card{display:flex;gap:16px;border-left:3px solid #4a5a8a;padding:12px 16px;margin:10px 0;background:#16162a;border-radius:0 8px 8px 0}',
  '.timeline-phase{font-weight:700;color:#c0c8e0;min-width:120px}',
  '.timeline-dur{color:#8090b0;font-size:.9em;min-width:100px}',
  '.timeline-acts{color:#b0b8d0}',
  '.budget-bar{height:20px;border-radius:4px;margin:4px 0}',
  'p{color:#b0b8d0;line-height:1.6}',
  '.nav{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:20px}',
  '.nav a{background:#1a1a2e;color:#8090b0;padding:6px 12px;border-radius:4px;text-decoration:none;font-size:.85em}',
  '.nav a:hover{background:#2a2a4e;color:#c0c8e0}',
  '@media print{body{background:#fff;color:#1a1a1a;padding:0}h1{color:#1a1a2e}h2{color:#2a2a4e}',
  '.meta,.goal-card{background:#f5f5fa;border-color:#ccc}th{background:#1a1a2e;color:#fff}}',
].join('');

function formatHtml(
  projectTitle: string, organization: string, executiveSummary: string,
  budgetTotal: string, grantProgram: string, submissionDate: string,
  projectPeriod: string, pi: string, statementOfNeed: string,
  goals: GoalObjective[], methodology: string, timeline: TimelinePhase[],
  budgetItems: BudgetItem[], evaluationPlan: string,
  sustainabilityPlan: string, orgCapacity: string,
): string {
  const h: string[] = [];
  h.push(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Grant Proposal: ${esc(projectTitle)}</title>`);
  h.push(`<style>${CSS}</style></head><body>`);
  h.push(`<h1>Grant Proposal: ${esc(projectTitle)}</h1>`);

  // Section navigation
  h.push('<div class="nav">');
  h.push('<a href="#summary">Executive Summary</a>');
  if (statementOfNeed) h.push('<a href="#need">Statement of Need</a>');
  if (goals.length > 0) h.push('<a href="#goals">Goals</a>');
  if (methodology) h.push('<a href="#methodology">Methodology</a>');
  if (timeline.length > 0) h.push('<a href="#timeline">Timeline</a>');
  h.push('<a href="#budget">Budget</a>');
  if (evaluationPlan) h.push('<a href="#evaluation">Evaluation</a>');
  if (sustainabilityPlan) h.push('<a href="#sustainability">Sustainability</a>');
  h.push('</div>');

  // Meta
  h.push('<div class="meta">');
  h.push(`<div class="meta-item"><span class="meta-label">Organization:</span><span class="meta-value">${esc(organization)}</span></div>`);
  if (grantProgram) h.push(`<div class="meta-item"><span class="meta-label">Grant Program:</span><span class="meta-value">${esc(grantProgram)}</span></div>`);
  if (submissionDate) h.push(`<div class="meta-item"><span class="meta-label">Submission Date:</span><span class="meta-value">${esc(submissionDate)}</span></div>`);
  if (projectPeriod) h.push(`<div class="meta-item"><span class="meta-label">Project Period:</span><span class="meta-value">${esc(projectPeriod)}</span></div>`);
  if (pi) h.push(`<div class="meta-item"><span class="meta-label">Principal Investigator:</span><span class="meta-value">${esc(pi)}</span></div>`);
  h.push(`<div class="meta-item"><span class="meta-label">Total Budget:</span><span class="meta-value">${esc(budgetTotal)}</span></div>`);
  h.push('</div>');

  h.push(`<h2 id="summary">1. Executive Summary</h2><p>${esc(executiveSummary)}</p>`);

  if (statementOfNeed) h.push(`<h2 id="need">2. Statement of Need</h2><p>${esc(statementOfNeed)}</p>`);

  if (goals.length > 0) {
    h.push('<h2 id="goals">3. Goals and Objectives</h2>');
    for (let i = 0; i < goals.length; i++) {
      h.push(`<div class="goal-card"><h3>Goal ${i + 1}: ${esc(goals[i].goal)}</h3>`);
      if (goals[i].objectives.length > 0) {
        h.push('<ol>');
        for (const obj of goals[i].objectives) h.push(`<li>${esc(obj)}</li>`);
        h.push('</ol>');
      }
      h.push('</div>');
    }
  }

  if (methodology) h.push(`<h2 id="methodology">4. Methodology</h2><p>${esc(methodology)}</p>`);

  if (timeline.length > 0) {
    h.push('<h2 id="timeline">5. Timeline</h2>');
    for (const t of timeline) {
      h.push('<div class="timeline-card">');
      h.push(`<div class="timeline-phase">${esc(t.phase)}</div>`);
      h.push(`<div class="timeline-dur">${esc(t.duration)}</div>`);
      h.push(`<div class="timeline-acts">${t.activities.map((a) => esc(a)).join('; ')}</div>`);
      h.push('</div>');
    }
  }

  h.push('<h2 id="budget">6. Budget</h2>');
  h.push('<table><thead><tr><th>Category</th><th>Amount</th><th>Justification</th></tr></thead><tbody>');
  for (const b of budgetItems) {
    h.push(`<tr><td>${esc(b.category)}</td><td>${esc(b.amount)}</td><td>${esc(b.justification)}</td></tr>`);
  }
  h.push(`<tr class="total-row"><td><strong>Total</strong></td><td><strong>${esc(budgetTotal)}</strong></td><td></td></tr>`);
  h.push('</tbody></table>');

  if (evaluationPlan) h.push(`<h2 id="evaluation">7. Evaluation Plan</h2><p>${esc(evaluationPlan)}</p>`);
  if (sustainabilityPlan) h.push(`<h2 id="sustainability">8. Sustainability Plan</h2><p>${esc(sustainabilityPlan)}</p>`);
  if (orgCapacity) h.push(`<h2>9. Organizational Capacity</h2><p>${esc(orgCapacity)}</p>`);

  h.push('</body></html>');
  return h.join('\n');
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const grantProposalTool: UnifiedTool = {
  name: 'create_grant_proposal',
  description: `Generate grant proposals with executive summary, budget, timeline, and evaluation plans.
Use this when the user needs to create a grant proposal for a nonprofit, research institution, or community organization.
Returns a complete proposal document with numbered sections, budget table, timeline, and goals hierarchy.`,
  parameters: {
    type: 'object',
    properties: {
      project_title: { type: 'string', description: 'Title of the proposed project' },
      organization: { type: 'string', description: 'Name of the applying organization' },
      executive_summary: { type: 'string', description: 'Brief overview of the project and funding request' },
      budget_total: { type: 'string', description: 'Total budget amount (e.g., "$150,000")' },
      grant_program: { type: 'string', description: 'Name of the grant program being applied to' },
      submission_date: { type: 'string', description: 'Proposal submission date' },
      project_period: { type: 'string', description: 'Project duration (e.g., "January 2027 - December 2028")' },
      principal_investigator: { type: 'string', description: 'Lead researcher or project director' },
      statement_of_need: { type: 'string', description: 'Description of the problem or need being addressed' },
      goals_and_objectives: {
        type: 'array', description: 'Project goals with measurable objectives',
        items: {
          type: 'object', required: ['goal', 'objectives'],
          properties: {
            goal: { type: 'string', description: 'High-level goal statement' },
            objectives: { type: 'array', items: { type: 'string' }, description: 'Measurable objectives under this goal' },
          },
        },
      },
      methodology: { type: 'string', description: 'Approach and methods to achieve goals' },
      timeline: {
        type: 'array', description: 'Project phases with durations and activities',
        items: {
          type: 'object', required: ['phase', 'duration', 'activities'],
          properties: {
            phase: { type: 'string', description: 'Phase name' },
            duration: { type: 'string', description: 'Phase duration (e.g., "Months 1-3")' },
            activities: { type: 'array', items: { type: 'string' }, description: 'Activities in this phase' },
          },
        },
      },
      budget_items: {
        type: 'array', description: 'Itemized budget with justifications',
        items: {
          type: 'object', required: ['category', 'amount', 'justification'],
          properties: {
            category: { type: 'string', description: 'Budget category' },
            amount: { type: 'string', description: 'Amount for this category' },
            justification: { type: 'string', description: 'Why this expense is necessary' },
          },
        },
      },
      evaluation_plan: { type: 'string', description: 'How project success will be measured' },
      sustainability_plan: { type: 'string', description: 'How the project will continue after funding ends' },
      organizational_capacity: { type: 'string', description: 'Organization qualifications and track record' },
      format: { type: 'string', enum: ['markdown', 'html'], description: 'Output format. Default: "markdown"' },
    },
    required: ['project_title', 'organization', 'executive_summary', 'budget_total'],
  },
};

// ============================================================================
// AVAILABILITY CHECK
// ============================================================================

export function isGrantProposalAvailable(): boolean {
  return true;
}

// ============================================================================
// TOOL EXECUTOR
// ============================================================================

export async function executeGrantProposal(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const args = toolCall.arguments as {
    project_title: string;
    organization: string;
    executive_summary: string;
    budget_total: string;
    grant_program?: string;
    submission_date?: string;
    project_period?: string;
    principal_investigator?: string;
    statement_of_need?: string;
    goals_and_objectives?: GoalObjective[];
    methodology?: string;
    timeline?: TimelinePhase[];
    budget_items?: BudgetItem[];
    evaluation_plan?: string;
    sustainability_plan?: string;
    organizational_capacity?: string;
    format?: 'markdown' | 'html';
  };

  if (!args.project_title?.trim()) {
    return { toolCallId: toolCall.id, content: 'Error: project_title parameter is required', isError: true };
  }
  if (!args.organization?.trim()) {
    return { toolCallId: toolCall.id, content: 'Error: organization parameter is required', isError: true };
  }
  if (!args.executive_summary?.trim()) {
    return { toolCallId: toolCall.id, content: 'Error: executive_summary parameter is required', isError: true };
  }
  if (!args.budget_total?.trim()) {
    return { toolCallId: toolCall.id, content: 'Error: budget_total parameter is required', isError: true };
  }

  if (args.goals_and_objectives) {
    for (let i = 0; i < args.goals_and_objectives.length; i++) {
      const g = args.goals_and_objectives[i];
      if (!g.goal || !Array.isArray(g.objectives)) {
        return {
          toolCallId: toolCall.id,
          content: `Error: goals_and_objectives entry at index ${i} is missing required fields (goal, objectives)`,
          isError: true,
        };
      }
    }
  }

  if (args.timeline) {
    for (let i = 0; i < args.timeline.length; i++) {
      const t = args.timeline[i];
      if (!t.phase || !t.duration || !Array.isArray(t.activities)) {
        return {
          toolCallId: toolCall.id,
          content: `Error: timeline entry at index ${i} is missing required fields (phase, duration, activities)`,
          isError: true,
        };
      }
    }
  }

  if (args.budget_items) {
    for (let i = 0; i < args.budget_items.length; i++) {
      const b = args.budget_items[i];
      if (!b.category || !b.amount || !b.justification) {
        return {
          toolCallId: toolCall.id,
          content: `Error: budget_items entry at index ${i} is missing required fields (category, amount, justification)`,
          isError: true,
        };
      }
    }
  }

  const fmt = args.format ?? 'markdown';
  const goals = args.goals_and_objectives ?? [];
  const timeline = args.timeline ?? [];
  const budgetItems = args.budget_items ?? [];

  try {
    const formatted = fmt === 'html'
      ? formatHtml(args.project_title, args.organization, args.executive_summary, args.budget_total, args.grant_program ?? '', args.submission_date ?? '', args.project_period ?? '', args.principal_investigator ?? '', args.statement_of_need ?? '', goals, args.methodology ?? '', timeline, budgetItems, args.evaluation_plan ?? '', args.sustainability_plan ?? '', args.organizational_capacity ?? '')
      : formatMarkdown(args.project_title, args.organization, args.executive_summary, args.budget_total, args.grant_program ?? '', args.submission_date ?? '', args.project_period ?? '', args.principal_investigator ?? '', args.statement_of_need ?? '', goals, args.methodology ?? '', timeline, budgetItems, args.evaluation_plan ?? '', args.sustainability_plan ?? '', args.organizational_capacity ?? '');

    return {
      toolCallId: toolCall.id,
      content: JSON.stringify({
        success: true,
        message: `Grant proposal created: ${args.project_title}`,
        format: fmt,
        formatted_output: formatted,
        summary: {
          project_title: args.project_title,
          organization: args.organization,
          budget_total: args.budget_total,
          grant_program: args.grant_program ?? null,
          goals_count: goals.length,
          timeline_phases: timeline.length,
          budget_line_items: budgetItems.length,
          has_evaluation_plan: !!args.evaluation_plan,
          has_sustainability_plan: !!args.sustainability_plan,
        },
      }),
    };
  } catch (error) {
    return {
      toolCallId: toolCall.id,
      content: `Error generating grant proposal: ${(error as Error).message}`,
      isError: true,
    };
  }
}

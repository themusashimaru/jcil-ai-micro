/**
 * DECISION MATRIX TOOL — Weighted comparison for structured decision-making.
 * Scores options against weighted criteria, calculates totals, and ranks them.
 * No external dependencies. Created: 2026-03-19
 */
import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// --- TYPES ---

interface Criterion { name: string; weight: number; description?: string }
interface Score { option: string; criterion: string; score: number; notes?: string }

interface RankedOption {
  option: string; weightedTotal: number; percentage: number; rank: number;
  scores: Map<string, { score: number; weighted: number; notes?: string }>;
  pros: string[]; cons: string[];
}

// --- HELPERS ---

function esc(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function buildMatrix(
  options: string[],
  criteria: Criterion[],
  scores: Score[],
): RankedOption[] {
  const maxPossible = criteria.reduce((sum, c) => sum + c.weight * 10, 0);
  const scoreMap = new Map<string, Map<string, { score: number; notes?: string }>>();

  for (const opt of options) scoreMap.set(opt, new Map());
  for (const s of scores) {
    const optMap = scoreMap.get(s.option);
    if (optMap) optMap.set(s.criterion, { score: s.score, notes: s.notes });
  }

  const ranked: RankedOption[] = options.map((opt) => {
    const optScores = scoreMap.get(opt)!;
    let weightedTotal = 0;
    const detailedScores = new Map<string, { score: number; weighted: number; notes?: string }>();

    for (const c of criteria) {
      const entry = optScores.get(c.name);
      const raw = entry?.score ?? 0;
      const weighted = raw * c.weight;
      weightedTotal += weighted;
      detailedScores.set(c.name, { score: raw, weighted, notes: entry?.notes });
    }

    const percentage = maxPossible > 0 ? Math.round((weightedTotal / maxPossible) * 100) : 0;

    // Derive pros (score >= 8) and cons (score <= 4) from top-weighted criteria
    const sortedCriteria = [...criteria].sort((a, b) => b.weight - a.weight);
    const pros: string[] = [];
    const cons: string[] = [];
    for (const c of sortedCriteria) {
      const entry = detailedScores.get(c.name);
      if (!entry) continue;
      if (entry.score >= 8 && pros.length < 3) pros.push(`Strong ${c.name} (${entry.score}/10)`);
      if (entry.score <= 4 && cons.length < 3) cons.push(`Weak ${c.name} (${entry.score}/10)`);
    }

    return { option: opt, weightedTotal, percentage, rank: 0, scores: detailedScores, pros, cons };
  });

  ranked.sort((a, b) => b.weightedTotal - a.weightedTotal);
  ranked.forEach((r, i) => { r.rank = i + 1; });
  return ranked;
}

// --- MARKDOWN FORMATTER ---

function formatMarkdown(
  question: string, criteria: Criterion[], ranked: RankedOption[], recommendation?: string,
): string {
  const L: string[] = [];
  L.push(`# Decision Matrix: ${question}`, '');

  // Criteria table
  L.push('## Criteria', '', '| Criterion | Weight | Description |', '|-----------|--------|-------------|');
  for (const c of criteria) {
    L.push(`| ${c.name} | ${c.weight} | ${c.description ?? '-'} |`);
  }
  L.push('');

  // Scoring matrix header
  const header = ['| Option', ...criteria.map((c) => c.name), 'Weighted Total', 'Rank |'].join(' | ');
  const divider = '|' + Array(criteria.length + 3).fill('---').join('|') + '|';
  L.push('## Scoring Matrix', '', header, divider);

  for (const r of ranked) {
    const cells = [r.option];
    for (const c of criteria) {
      const entry = r.scores.get(c.name);
      cells.push(entry ? `${entry.score}` : '-');
    }
    cells.push(`**${r.weightedTotal}**`, `#${r.rank}`);
    L.push('| ' + cells.join(' | ') + ' |');
  }
  L.push('');

  // Winner
  const winner = ranked[0];
  L.push(`## Winner: ${winner.option}`, '',
    `**Score:** ${winner.weightedTotal} (${winner.percentage}%)`, '');

  // Pros/cons per option
  L.push('## Analysis', '');
  for (const r of ranked) {
    L.push(`### #${r.rank} ${r.option} (${r.percentage}%)`, '');
    if (r.pros.length > 0) {
      L.push('**Strengths:**');
      for (const p of r.pros) L.push(`- ${p}`);
    }
    if (r.cons.length > 0) {
      L.push('**Weaknesses:**');
      for (const c of r.cons) L.push(`- ${c}`);
    }
    L.push('');
  }

  if (recommendation) {
    L.push('## Recommendation', '', recommendation, '');
  }
  return L.join('\n');
}

// --- HTML FORMATTER ---

const CSS = [
  'body{font-family:system-ui,sans-serif;max-width:960px;margin:0 auto;padding:20px;color:#1a1a1a}',
  'h1{color:#2d5016;border-bottom:2px solid #2d5016;padding-bottom:8px}',
  'h2{color:#3a6b1e;margin-top:28px}h3{color:#4a7c2e;margin-top:18px}',
  'table{width:100%;border-collapse:collapse;margin:12px 0}',
  'th,td{border:1px solid #ddd;padding:8px 12px;text-align:center}',
  'th{background:#2d5016;color:#fff}',
  'td:first-child{text-align:left;font-weight:600}',
  'tr:nth-child(even){background:#f8f8f8}',
  '.winner{background:#f0f7e6;border:2px solid #2d5016;border-radius:8px;padding:16px;margin:16px 0}',
  '.winner h2{margin-top:0;color:#2d5016}',
  '.bar-container{background:#e0e0e0;border-radius:4px;height:24px;margin:4px 0;position:relative}',
  '.bar{height:100%;border-radius:4px;background:#2d5016;display:flex;align-items:center;padding-left:8px;color:#fff;font-size:13px;font-weight:600;min-width:30px}',
  '.score-low{background-color:#d9534f;color:#fff}',
  '.score-mid{background-color:#f0ad4e;color:#1a1a1a}',
  '.score-high{background-color:#2d5016;color:#fff}',
  '.analysis{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:16px;margin-top:12px}',
  '.option-card{border:1px solid #ddd;border-radius:8px;padding:12px 16px}',
  '.option-card h3{margin-top:0}.pro{color:#2d5016}.con{color:#b94a48}',
  '.rec{background:#f0f7e6;padding:12px 16px;border-radius:6px;border-left:4px solid #2d5016;margin-top:16px}',
  '@media print{body{padding:0}.option-card{break-inside:avoid}}',
].join('');

function heatClass(score: number): string {
  if (score <= 4) return 'score-low';
  if (score <= 6) return 'score-mid';
  return 'score-high';
}

function formatHtml(
  question: string, criteria: Criterion[], ranked: RankedOption[], recommendation?: string,
): string {
  const h: string[] = [];
  h.push(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>${esc(question)}</title>`);
  h.push(`<style>${CSS}</style></head><body>`);
  h.push(`<h1>Decision Matrix: ${esc(question)}</h1>`);

  // Criteria table
  h.push('<h2>Criteria</h2>');
  h.push('<table><thead><tr><th>Criterion</th><th>Weight</th><th>Description</th></tr></thead><tbody>');
  for (const c of criteria) {
    h.push(`<tr><td>${esc(c.name)}</td><td>${c.weight}</td><td>${esc(c.description ?? '-')}</td></tr>`);
  }
  h.push('</tbody></table>');

  // Scoring matrix with heat-map
  h.push('<h2>Scoring Matrix</h2>');
  h.push('<table><thead><tr><th>Option</th>');
  for (const c of criteria) h.push(`<th>${esc(c.name)}</th>`);
  h.push('<th>Weighted Total</th><th>Rank</th></tr></thead><tbody>');
  for (const r of ranked) {
    h.push('<tr>');
    h.push(`<td>${esc(r.option)}</td>`);
    for (const c of criteria) {
      const entry = r.scores.get(c.name);
      const sc = entry?.score ?? 0;
      h.push(`<td class="${heatClass(sc)}">${sc}</td>`);
    }
    h.push(`<td><strong>${r.weightedTotal}</strong></td><td>#${r.rank}</td>`);
    h.push('</tr>');
  }
  h.push('</tbody></table>');

  // Winner
  const winner = ranked[0];
  h.push('<div class="winner">');
  h.push(`<h2>[TROPHY] Winner: ${esc(winner.option)}</h2>`);
  h.push(`<p><strong>Score:</strong> ${winner.weightedTotal} (${winner.percentage}%)</p>`);
  h.push('</div>');

  // Bar chart
  h.push('<h2>Score Comparison</h2>');
  for (const r of ranked) {
    h.push(`<div style="margin:8px 0"><strong>${esc(r.option)}</strong>`);
    h.push(`<div class="bar-container"><div class="bar" style="width:${Math.max(r.percentage, 5)}%">${r.percentage}%</div></div></div>`);
  }

  // Analysis cards
  h.push('<h2>Analysis</h2><div class="analysis">');
  for (const r of ranked) {
    h.push(`<div class="option-card"><h3>#${r.rank} ${esc(r.option)} (${r.percentage}%)</h3>`);
    if (r.pros.length > 0) {
      h.push('<p><strong>Strengths:</strong></p><ul>');
      for (const p of r.pros) h.push(`<li class="pro">${esc(p)}</li>`);
      h.push('</ul>');
    }
    if (r.cons.length > 0) {
      h.push('<p><strong>Weaknesses:</strong></p><ul>');
      for (const c of r.cons) h.push(`<li class="con">${esc(c)}</li>`);
      h.push('</ul>');
    }
    h.push('</div>');
  }
  h.push('</div>');

  if (recommendation) {
    h.push(`<div class="rec"><strong>Recommendation:</strong> ${esc(recommendation)}</div>`);
  }

  h.push('</body></html>');
  return h.join('\n');
}

// --- TOOL DEFINITION ---

export const decisionMatrixTool: UnifiedTool = {
  name: 'decision_matrix',
  description: `Build weighted decision matrices to compare options against scored criteria.

Use this when:
- User is comparing multiple options (products, vendors, job offers, apartments)
- User wants a structured pros/cons analysis with weighting
- User needs to make a data-driven decision between alternatives
- User asks for a comparison table or ranking

Returns a scored matrix with weighted totals, rankings, pros/cons analysis, and winner — ready to print or share.`,
  parameters: {
    type: 'object',
    properties: {
      question: { type: 'string', description: 'The decision being made (e.g., "Which CRM should we use?")' },
      options: {
        type: 'array',
        items: { type: 'string' },
        description: 'The choices being compared',
      },
      criteria: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Criterion name' },
            weight: { type: 'number', description: 'Importance weight (1-10)' },
            description: { type: 'string', description: 'What this criterion measures' },
          },
          required: ['name', 'weight'],
        },
        description: 'Weighted evaluation criteria',
      },
      scores: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            option: { type: 'string', description: 'Which option this score is for' },
            criterion: { type: 'string', description: 'Which criterion this score is for' },
            score: { type: 'number', description: 'Score (1-10)' },
            notes: { type: 'string', description: 'Justification for the score' },
          },
          required: ['option', 'criterion', 'score'],
        },
        description: 'Scores for each option-criterion pair',
      },
      recommendation: { type: 'string', description: 'AI recommendation summary' },
      format: {
        type: 'string',
        enum: ['markdown', 'html'],
        description: 'Output format. Default: "markdown"',
      },
    },
    required: ['question', 'options', 'criteria', 'scores'],
  },
};

// --- AVAILABILITY CHECK ---

export function isDecisionMatrixAvailable(): boolean {
  return true;
}

// --- TOOL EXECUTOR ---

export async function executeDecisionMatrix(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const args = toolCall.arguments as {
    question: string;
    options: string[];
    criteria: Criterion[];
    scores: Score[];
    recommendation?: string;
    format?: 'markdown' | 'html';
  };

  // Validate required parameters
  if (!args.question?.trim()) {
    return { toolCallId: toolCall.id, content: 'Error: question parameter is required', isError: true };
  }
  if (!Array.isArray(args.options) || args.options.length < 2) {
    return { toolCallId: toolCall.id, content: 'Error: at least 2 options are required', isError: true };
  }
  if (!Array.isArray(args.criteria) || args.criteria.length === 0) {
    return { toolCallId: toolCall.id, content: 'Error: at least 1 criterion is required', isError: true };
  }
  if (!Array.isArray(args.scores) || args.scores.length === 0) {
    return { toolCallId: toolCall.id, content: 'Error: scores array is required and must not be empty', isError: true };
  }

  // Validate criteria
  const criteriaNames = new Set<string>();
  for (let i = 0; i < args.criteria.length; i++) {
    const c = args.criteria[i];
    if (!c.name?.trim()) {
      return { toolCallId: toolCall.id, content: `Error: criterion at index ${i} is missing name`, isError: true };
    }
    if (typeof c.weight !== 'number' || c.weight < 1 || c.weight > 10) {
      return { toolCallId: toolCall.id, content: `Error: criterion "${c.name}" weight must be 1-10`, isError: true };
    }
    criteriaNames.add(c.name);
  }

  // Validate scores reference valid options and criteria
  const optionSet = new Set(args.options);
  for (let i = 0; i < args.scores.length; i++) {
    const s = args.scores[i];
    if (!s.option || !s.criterion || typeof s.score !== 'number') {
      return { toolCallId: toolCall.id, content: `Error: score at index ${i} missing required fields (option, criterion, score)`, isError: true };
    }
    if (!optionSet.has(s.option)) {
      return { toolCallId: toolCall.id, content: `Error: score references unknown option "${s.option}"`, isError: true };
    }
    if (!criteriaNames.has(s.criterion)) {
      return { toolCallId: toolCall.id, content: `Error: score references unknown criterion "${s.criterion}"`, isError: true };
    }
    if (s.score < 1 || s.score > 10) {
      return { toolCallId: toolCall.id, content: `Error: score for "${s.option}" / "${s.criterion}" must be 1-10`, isError: true };
    }
  }

  const fmt = args.format ?? 'markdown';

  try {
    const ranked = buildMatrix(args.options, args.criteria, args.scores);
    const winner = ranked[0];

    const formatted = fmt === 'html'
      ? formatHtml(args.question, args.criteria, ranked, args.recommendation)
      : formatMarkdown(args.question, args.criteria, ranked, args.recommendation);

    return {
      toolCallId: toolCall.id,
      content: JSON.stringify({
        success: true,
        message: `Decision matrix created: "${args.question}" — ${args.options.length} options, ${args.criteria.length} criteria`,
        format: fmt,
        formatted_output: formatted,
        summary: {
          question: args.question,
          options_count: args.options.length,
          criteria_count: args.criteria.length,
          winner: winner.option,
          winner_score: winner.weightedTotal,
          winner_percentage: winner.percentage,
          rankings: ranked.map((r) => ({ option: r.option, score: r.weightedTotal, rank: r.rank })),
        },
      }),
    };
  } catch (error) {
    return {
      toolCallId: toolCall.id,
      content: `Error generating decision matrix: ${(error as Error).message}`,
      isError: true,
    };
  }
}

/**
 * TRAINING MANUAL TOOL — Employee training manual and guide generator.
 * Produces professional training documents with modules, exercises,
 * glossary, assessments, and learning objectives.
 * No external dependencies. Created: 2026-03-19
 */
import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// --- TYPES ---

interface TrainingModule {
  title: string;
  objective: string;
  content: string;
  key_points?: string[];
  exercises?: string[];
  duration?: string;
}

interface GlossaryEntry { term: string; definition: string }
interface AssessmentQuestion { question: string; answer: string }

// --- HELPERS ---

function esc(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// --- MARKDOWN FORMATTER ---

function formatMarkdown(
  title: string, organization: string, department: string, version: string,
  author: string, date: string, prerequisites: string[],
  learningObjectives: string[], modules: TrainingModule[],
  glossary: GlossaryEntry[], assessmentQuestions: AssessmentQuestion[],
  resources: string[],
): string {
  const L: string[] = [];
  L.push(`# ${title}`, '');
  if (organization || department || version || author || date) {
    L.push('| Field | Value |', '|-------|-------|');
    const fields = [['Organization', organization], ['Department', department], ['Version', version], ['Author', author], ['Date', date]] as const;
    for (const [label, val] of fields) if (val) L.push(`| **${label}** | ${val} |`);
    L.push('');
  }

  // Table of Contents
  L.push('## Table of Contents', '');
  if (prerequisites.length > 0) L.push('- Prerequisites');
  if (learningObjectives.length > 0) L.push('- Learning Objectives');
  for (let i = 0; i < modules.length; i++) L.push(`- Module ${i + 1}: ${modules[i].title}`);
  if (glossary.length > 0) L.push('- Glossary');
  if (assessmentQuestions.length > 0) L.push('- Assessment');
  if (resources.length > 0) L.push('- Resources');
  L.push('');

  if (prerequisites.length > 0) {
    L.push('## Prerequisites', '');
    for (const p of prerequisites) L.push(`- ${p}`);
    L.push('');
  }

  if (learningObjectives.length > 0) {
    L.push('## Learning Objectives', '');
    for (const obj of learningObjectives) L.push(`- ${obj}`);
    L.push('');
  }

  for (let i = 0; i < modules.length; i++) {
    const m = modules[i];
    L.push(`## Module ${i + 1}: ${m.title}`, '');
    L.push(`**Objective:** ${m.objective}`);
    if (m.duration) L.push(`**Duration:** ${m.duration}`);
    L.push('', m.content, '');
    if (m.key_points && m.key_points.length > 0) {
      L.push('### Key Points', '');
      for (const kp of m.key_points) L.push(`- ${kp}`);
      L.push('');
    }
    if (m.exercises && m.exercises.length > 0) {
      L.push('### Exercises', '');
      for (let j = 0; j < m.exercises.length; j++) L.push(`${j + 1}. ${m.exercises[j]}`);
      L.push('');
    }
  }

  if (glossary.length > 0) {
    L.push('## Glossary', '', '| Term | Definition |', '|------|------------|');
    for (const g of glossary) L.push(`| ${g.term} | ${g.definition} |`);
    L.push('');
  }

  if (assessmentQuestions.length > 0) {
    L.push('## Assessment', '');
    for (let i = 0; i < assessmentQuestions.length; i++) {
      const q = assessmentQuestions[i];
      L.push(`**Q${i + 1}: ${q.question}**`, '', `> **Answer:** ${q.answer}`, '');
    }
  }

  if (resources.length > 0) {
    L.push('## Resources', '');
    for (const r of resources) L.push(`- ${r}`);
    L.push('');
  }

  return L.join('\n');
}

// --- HTML FORMATTER ---

const CSS = [
  'body{font-family:system-ui,sans-serif;max-width:900px;margin:0 auto;padding:20px;color:#e0e0e0;background:#121225}',
  'h1{color:#c0c8e0;border-bottom:3px solid #1a1a2e;padding-bottom:10px;text-align:center}',
  'h2{color:#a0b0d0;margin-top:28px;border-bottom:1px solid #2a2a4e;padding-bottom:6px}',
  'h3{color:#8090b0;margin-top:16px}',
  '.meta{display:grid;grid-template-columns:1fr 1fr;gap:8px 24px;background:#1a1a2e;padding:16px 20px;border-radius:8px;margin-bottom:24px}',
  '.meta-item{display:flex;gap:8px}.meta-label{font-weight:700;color:#8090b0;min-width:120px}.meta-value{color:#c0c8e0}',
  '.toc{background:#1a1a2e;padding:16px 20px;border-radius:8px;margin-bottom:24px}',
  '.toc ul{list-style:none;padding:0;margin:0}.toc li{padding:4px 0}.toc a{color:#7090c0;text-decoration:none}.toc a:hover{text-decoration:underline}',
  '.sidebar{display:flex;gap:20px;margin-bottom:12px}',
  '.progress{background:#2a2a4e;border-radius:8px;padding:12px 16px;min-width:200px}',
  '.progress-item{display:flex;align-items:center;gap:8px;padding:4px 0;color:#8090b0;font-size:.9em}',
  '.progress-item.active{color:#c0c8e0;font-weight:700}.progress-dot{width:10px;height:10px;border-radius:50%;background:#3a3a5e}',
  '.progress-item.active .progress-dot{background:#5080c0}',
  '.module{border:1px solid #2a2a4e;border-radius:8px;padding:16px;margin:12px 0;background:#16162a}',
  '.module h2{margin-top:0;border:none;padding:0}',
  '.module-meta{font-size:.9em;color:#7080a0;margin:4px 0}',
  '.key-point{background:#1a2a1a;border-left:4px solid #2d8040;padding:10px 14px;border-radius:4px;margin:8px 0;color:#90c890}',
  '.exercise-box{background:#2a2020;border-left:4px solid #c06040;padding:10px 14px;border-radius:4px;margin:8px 0;color:#e0b0a0}',
  '.exercise-box strong{color:#e08060}',
  'table{width:100%;border-collapse:collapse;margin:12px 0}',
  'th,td{border:1px solid #2a2a4e;padding:8px 12px;text-align:left}',
  'th{background:#1a1a2e;color:#c0c8e0}tr:nth-child(even){background:#16162a}',
  '.accordion{border:1px solid #2a2a4e;border-radius:8px;margin:6px 0;overflow:hidden}',
  '.accordion summary{padding:10px 14px;cursor:pointer;background:#1a1a2e;color:#c0c8e0;font-weight:600}',
  '.accordion summary:hover{background:#22224a}.accordion-body{padding:10px 14px;color:#b0b8d0}',
  '.qa{background:#16162a;border:1px solid #2a2a4e;border-radius:8px;padding:14px;margin:10px 0}',
  '.qa-q{color:#c0c8e0;font-weight:700;margin-bottom:8px}',
  '.reveal-btn{display:none}.reveal-label{cursor:pointer;background:#2a2a4e;color:#8090b0;padding:6px 14px;border-radius:4px;display:inline-block;font-size:.9em}',
  '.reveal-label:hover{background:#3a3a5e}.reveal-btn:checked~.qa-a{display:block}.reveal-btn:checked~.reveal-label{display:none}',
  '.qa-a{display:none;margin-top:8px;padding:10px;background:#1a2a1a;border-radius:4px;color:#90c890}',
  '@media print{body{background:#fff;color:#1a1a1a;padding:0}h1{color:#1a1a2e}h2{color:#2a2a4e}',
  '.meta,.module,.toc,.qa{background:#f5f5fa;border-color:#ccc}th{background:#1a1a2e;color:#fff}',
  '.module{break-inside:avoid}thead{display:table-header-group}.qa-a{display:block}.reveal-label{display:none}}',
].join('');

function formatHtml(
  title: string, organization: string, department: string, version: string,
  author: string, date: string, prerequisites: string[],
  learningObjectives: string[], modules: TrainingModule[],
  glossary: GlossaryEntry[], assessmentQuestions: AssessmentQuestion[],
  resources: string[],
): string {
  const h: string[] = [];
  h.push(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>${esc(title)}</title>`);
  h.push(`<style>${CSS}</style></head><body>`);
  h.push(`<h1>${esc(title)}</h1>`);

  if (organization || department || version || author || date) {
    h.push('<div class="meta">');
    const metaFields = [['Organization', organization], ['Department', department], ['Version', version], ['Author', author], ['Date', date]] as const;
    for (const [label, val] of metaFields) if (val) h.push(`<div class="meta-item"><span class="meta-label">${label}:</span><span class="meta-value">${esc(val)}</span></div>`);
    h.push('</div>');
  }

  // Progress indicator sidebar
  h.push('<div class="sidebar"><div class="progress"><strong style="color:#a0b0d0">Modules</strong>');
  for (let i = 0; i < modules.length; i++) {
    h.push(`<div class="progress-item"><span class="progress-dot"></span> Module ${i + 1}: ${esc(modules[i].title)}</div>`);
  }
  h.push('</div></div>');

  // Table of Contents
  h.push('<div class="toc"><h2 style="margin-top:0;border:none">Table of Contents</h2><ul>');
  if (prerequisites.length > 0) h.push('<li><a href="#prereqs">Prerequisites</a></li>');
  if (learningObjectives.length > 0) h.push('<li><a href="#objectives">Learning Objectives</a></li>');
  for (let i = 0; i < modules.length; i++) h.push(`<li><a href="#module-${i + 1}">Module ${i + 1}: ${esc(modules[i].title)}</a></li>`);
  if (glossary.length > 0) h.push('<li><a href="#glossary">Glossary</a></li>');
  if (assessmentQuestions.length > 0) h.push('<li><a href="#assessment">Assessment</a></li>');
  if (resources.length > 0) h.push('<li><a href="#resources">Resources</a></li>');
  h.push('</ul></div>');

  if (prerequisites.length > 0) {
    h.push('<h2 id="prereqs">Prerequisites</h2><ul>');
    for (const p of prerequisites) h.push(`<li>${esc(p)}</li>`);
    h.push('</ul>');
  }

  if (learningObjectives.length > 0) {
    h.push('<h2 id="objectives">Learning Objectives</h2><ul>');
    for (const obj of learningObjectives) h.push(`<li>${esc(obj)}</li>`);
    h.push('</ul>');
  }

  for (let i = 0; i < modules.length; i++) {
    const m = modules[i];
    h.push(`<div class="module" id="module-${i + 1}"><h2>Module ${i + 1}: ${esc(m.title)}</h2>`);
    h.push(`<div class="module-meta"><strong>Objective:</strong> ${esc(m.objective)}</div>`);
    if (m.duration) h.push(`<div class="module-meta"><strong>Duration:</strong> ${esc(m.duration)}</div>`);
    h.push(`<p>${esc(m.content)}</p>`);
    if (m.key_points && m.key_points.length > 0) {
      h.push('<h3>Key Points</h3>');
      for (const kp of m.key_points) h.push(`<div class="key-point">${esc(kp)}</div>`);
    }
    if (m.exercises && m.exercises.length > 0) {
      h.push('<h3>Exercises</h3>');
      for (let j = 0; j < m.exercises.length; j++) h.push(`<div class="exercise-box"><strong>Exercise ${j + 1}:</strong> ${esc(m.exercises[j])}</div>`);
    }
    h.push('</div>');
  }

  if (glossary.length > 0) {
    h.push('<h2 id="glossary">Glossary</h2>');
    for (const g of glossary) h.push(`<details class="accordion"><summary>${esc(g.term)}</summary><div class="accordion-body">${esc(g.definition)}</div></details>`);
  }

  if (assessmentQuestions.length > 0) {
    h.push('<h2 id="assessment">Assessment</h2>');
    for (let i = 0; i < assessmentQuestions.length; i++) {
      const q = assessmentQuestions[i], id = `qa-${i}`;
      h.push(`<div class="qa"><div class="qa-q">Q${i + 1}: ${esc(q.question)}</div><input type="checkbox" class="reveal-btn" id="${id}"><label class="reveal-label" for="${id}">Reveal Answer</label><div class="qa-a"><strong>Answer:</strong> ${esc(q.answer)}</div></div>`);
    }
  }

  if (resources.length > 0) {
    h.push('<h2 id="resources">Resources</h2><ul>');
    for (const r of resources) h.push(`<li>${esc(r)}</li>`);
    h.push('</ul>');
  }

  h.push('</body></html>');
  return h.join('\n');
}

// --- TOOL DEFINITION ---

export const trainingManualTool: UnifiedTool = {
  name: 'create_training_manual',
  description: `Generate employee training manuals with modules, exercises, glossary, and assessments.

Use this when:
- User needs to create a training manual or employee guide
- User wants to document a training program with modules and exercises
- User needs onboarding documentation with assessments
- User wants to build a structured learning curriculum

Returns a complete training manual with table of contents, modules, exercises, glossary, assessment Q&A, and resources — ready to print or share.`,
  parameters: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Training manual title (e.g., "New Employee Onboarding Guide")' },
      modules: {
        type: 'array', description: 'Training modules',
        items: {
          type: 'object', required: ['title', 'objective', 'content'],
          properties: {
            title: { type: 'string', description: 'Module title' },
            objective: { type: 'string', description: 'Module learning objective' },
            content: { type: 'string', description: 'Module content/body text' },
            key_points: { type: 'array', items: { type: 'string' }, description: 'Key takeaway points' },
            exercises: { type: 'array', items: { type: 'string' }, description: 'Practice exercises' },
            duration: { type: 'string', description: 'Estimated module duration (e.g., "30 minutes")' },
          },
        },
      },
      organization: { type: 'string', description: 'Organization name' },
      department: { type: 'string', description: 'Department or team' },
      version: { type: 'string', description: 'Document version. Default: "1.0"' },
      author: { type: 'string', description: 'Author name' },
      date: { type: 'string', description: 'Document date' },
      prerequisites: { type: 'array', items: { type: 'string' }, description: 'Prerequisites for this training' },
      learning_objectives: { type: 'array', items: { type: 'string' }, description: 'Overall learning objectives' },
      glossary: {
        type: 'array', description: 'Glossary of terms',
        items: { type: 'object', properties: { term: { type: 'string' }, definition: { type: 'string' } }, required: ['term', 'definition'] },
      },
      assessment_questions: {
        type: 'array', description: 'Assessment questions with answers',
        items: { type: 'object', properties: { question: { type: 'string' }, answer: { type: 'string' } }, required: ['question', 'answer'] },
      },
      resources: { type: 'array', items: { type: 'string' }, description: 'Additional resources and references' },
      format: { type: 'string', enum: ['markdown', 'html'], description: 'Output format. Default: "markdown"' },
    },
    required: ['title', 'modules'],
  },
};

// --- AVAILABILITY CHECK ---

export function isTrainingManualAvailable(): boolean {
  return true;
}

// --- TOOL EXECUTOR ---

export async function executeTrainingManual(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const args = toolCall.arguments as {
    title: string;
    modules: TrainingModule[];
    organization?: string;
    department?: string;
    version?: string;
    author?: string;
    date?: string;
    prerequisites?: string[];
    learning_objectives?: string[];
    glossary?: GlossaryEntry[];
    assessment_questions?: AssessmentQuestion[];
    resources?: string[];
    format?: 'markdown' | 'html';
  };

  if (!args.title?.trim()) {
    return { toolCallId: toolCall.id, content: 'Error: title parameter is required', isError: true };
  }
  if (!Array.isArray(args.modules) || args.modules.length === 0) {
    return { toolCallId: toolCall.id, content: 'Error: modules array is required and must not be empty', isError: true };
  }

  for (let i = 0; i < args.modules.length; i++) {
    const m = args.modules[i];
    if (!m.title || !m.objective || !m.content) {
      return {
        toolCallId: toolCall.id,
        content: `Error: module at index ${i} is missing required fields (title, objective, content)`,
        isError: true,
      };
    }
  }

  if (args.glossary) {
    for (let i = 0; i < args.glossary.length; i++) {
      const g = args.glossary[i];
      if (!g.term || !g.definition) {
        return {
          toolCallId: toolCall.id,
          content: `Error: glossary entry at index ${i} is missing required fields (term, definition)`,
          isError: true,
        };
      }
    }
  }

  if (args.assessment_questions) {
    for (let i = 0; i < args.assessment_questions.length; i++) {
      const q = args.assessment_questions[i];
      if (!q.question || !q.answer) {
        return {
          toolCallId: toolCall.id,
          content: `Error: assessment question at index ${i} is missing required fields (question, answer)`,
          isError: true,
        };
      }
    }
  }

  const fmt = args.format ?? 'markdown', organization = args.organization ?? '', department = args.department ?? '';
  const version = args.version ?? '1.0', author = args.author ?? '', date = args.date ?? '';
  const prerequisites = args.prerequisites ?? [], learningObjectives = args.learning_objectives ?? [];
  const glossary = args.glossary ?? [], assessmentQuestions = args.assessment_questions ?? [];
  const resources = args.resources ?? [];
  const totalExercises = args.modules.reduce((sum, m) => sum + (m.exercises?.length ?? 0), 0);
  const totalKeyPoints = args.modules.reduce((sum, m) => sum + (m.key_points?.length ?? 0), 0);

  try {
    const formatted = fmt === 'html'
      ? formatHtml(args.title, organization, department, version, author, date, prerequisites, learningObjectives, args.modules, glossary, assessmentQuestions, resources)
      : formatMarkdown(args.title, organization, department, version, author, date, prerequisites, learningObjectives, args.modules, glossary, assessmentQuestions, resources);

    return {
      toolCallId: toolCall.id,
      content: JSON.stringify({
        success: true,
        message: `Training manual created: ${args.title}`,
        format: fmt,
        formatted_output: formatted,
        summary: {
          title: args.title,
          organization: organization || null,
          department: department || null,
          version,
          total_modules: args.modules.length,
          total_exercises: totalExercises,
          total_key_points: totalKeyPoints,
          glossary_terms: glossary.length,
          assessment_questions: assessmentQuestions.length,
          resources_count: resources.length,
        },
      }),
    };
  } catch (error) {
    return {
      toolCallId: toolCall.id,
      content: `Error generating training manual: ${(error as Error).message}`,
      isError: true,
    };
  }
}

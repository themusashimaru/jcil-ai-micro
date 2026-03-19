/**
 * QUIZ TOOL — Quiz and assessment generator with multiple question types,
 * answer keys, and print-friendly formatting.
 * No external dependencies. Created: 2026-03-19
 */
import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// TYPES
// ============================================================================

type QuestionType = 'multiple_choice' | 'short_answer' | 'true_false' | 'essay';

interface Question {
  question: string;
  type: QuestionType;
  options?: string[];
  correct_answer?: string;
  points?: number;
  explanation?: string;
}

// ============================================================================
// HELPERS
// ============================================================================

function esc(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function computeTotal(questions: Question[], providedTotal?: number): number {
  if (providedTotal && providedTotal > 0) return providedTotal;
  return questions.reduce((sum, q) => sum + (q.points ?? 1), 0);
}

const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

// ============================================================================
// MARKDOWN FORMATTER
// ============================================================================

function formatMarkdown(
  title: string, subject: string, gradeLevel: string, teacher: string,
  date: string, instructions: string, timeLimit: string, totalPts: number,
  questions: Question[], includeKey: boolean,
): string {
  const L: string[] = [];
  L.push(`# ${title}`, '');
  if (subject) L.push(`**Subject:** ${subject}  `);
  if (gradeLevel) L.push(`**Grade Level:** ${gradeLevel}  `);
  if (teacher) L.push(`**Teacher:** ${teacher}  `);
  if (date) L.push(`**Date:** ${date}  `);
  L.push(`**Total Points:** ${totalPts}  `);
  if (timeLimit) L.push(`**Time Limit:** ${timeLimit}  `);
  L.push('');
  if (instructions) L.push('---', '', `**Instructions:** ${instructions}`, '');
  L.push('---', '');

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const pts = q.points ?? 1;
    L.push(`**${i + 1}.** ${q.question} *(${pts} pt${pts !== 1 ? 's' : ''})*`, '');
    if (q.type === 'multiple_choice' && q.options) {
      for (let j = 0; j < q.options.length; j++) {
        L.push(`   ${OPTION_LABELS[j] ?? String(j + 1)}. ${q.options[j]}`);
      }
      L.push('');
    } else if (q.type === 'true_false') {
      L.push('   ○ True', '   ○ False', '');
    } else if (q.type === 'short_answer') {
      L.push('   Answer: ________________________________________', '');
    } else if (q.type === 'essay') {
      L.push('   *(Write your answer below)*', '', '   _', '   _', '   _', '');
    }
  }

  if (includeKey) {
    L.push('---', '', '## Answer Key', '');
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (q.correct_answer) {
        L.push(`**${i + 1}.** ${q.correct_answer}`);
        if (q.explanation) L.push(`   *Explanation:* ${q.explanation}`);
        L.push('');
      }
    }
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
  '.header{background:#1a1a2e;padding:16px 20px;border-radius:8px;margin-bottom:24px;display:grid;grid-template-columns:1fr 1fr;gap:6px 24px}',
  '.header-item{color:#b0b8d0;font-size:.95em}.header-item strong{color:#8090b0}',
  '.instructions{background:#1e1e38;border-left:4px solid #4a5a8a;padding:12px 16px;border-radius:4px;margin-bottom:20px;color:#c0c8e0;font-style:italic}',
  '.question-card{border:1px solid #2a2a4e;border-radius:8px;padding:16px;margin:12px 0;background:#16162a}',
  '.q-header{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:10px}',
  '.q-number{font-weight:700;color:#c0c8e0;font-size:1.05em}.q-points{color:#8090b0;font-size:.85em}',
  '.q-text{color:#d0d8e8;margin-bottom:12px;line-height:1.5}',
  '.options{list-style:none;padding:0;margin:0}.options li{padding:6px 0;display:flex;align-items:center;gap:10px;color:#b0b8d0}',
  '.options input[type=radio]{width:18px;height:18px;accent-color:#4a5a8a}',
  '.tf-group{display:flex;gap:24px;margin-top:4px}',
  '.tf-group label{display:flex;align-items:center;gap:8px;color:#b0b8d0;cursor:pointer}',
  'textarea{width:100%;min-height:80px;background:#1a1a2e;border:1px solid #2a2a4e;border-radius:4px;color:#c0c8e0;padding:8px;font-family:inherit;resize:vertical}',
  '.short-input{width:100%;background:#1a1a2e;border:none;border-bottom:2px solid #4a5a8a;color:#c0c8e0;padding:8px 4px;font-size:1em}',
  '.answer-key{background:#1a1a2e;border-radius:8px;padding:20px;margin-top:28px}',
  '.answer-key h2{margin-top:0;border:none}',
  '.ak-item{padding:8px 0;border-bottom:1px solid #2a2a4e}.ak-item:last-child{border:none}',
  '.ak-num{font-weight:700;color:#c0c8e0}.ak-ans{color:#80d080;margin-left:8px}',
  '.ak-explain{color:#8090b0;font-size:.9em;margin-top:4px;font-style:italic}',
  '@media print{body{background:#fff;color:#1a1a1a;padding:0}h1{color:#1a1a2e}',
  '.header,.question-card,.answer-key{background:#f5f5fa;border-color:#ccc;color:#1a1a1a}',
  '.q-text,.options li,.tf-group label,textarea,.short-input{color:#1a1a1a}',
  '.answer-key{page-break-before:always}.question-card{break-inside:avoid}}',
].join('');

function formatHtml(
  title: string, subject: string, gradeLevel: string, teacher: string,
  date: string, instructions: string, timeLimit: string, totalPts: number,
  questions: Question[], includeKey: boolean,
): string {
  const h: string[] = [];
  h.push(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>${esc(title)}</title>`);
  h.push(`<style>${CSS}</style></head><body>`);
  h.push(`<h1>${esc(title)}</h1>`);
  h.push('<div class="header">');
  if (subject) h.push(`<div class="header-item"><strong>Subject:</strong> ${esc(subject)}</div>`);
  if (gradeLevel) h.push(`<div class="header-item"><strong>Grade Level:</strong> ${esc(gradeLevel)}</div>`);
  if (teacher) h.push(`<div class="header-item"><strong>Teacher:</strong> ${esc(teacher)}</div>`);
  if (date) h.push(`<div class="header-item"><strong>Date:</strong> ${esc(date)}</div>`);
  h.push(`<div class="header-item"><strong>Total Points:</strong> ${totalPts}</div>`);
  if (timeLimit) h.push(`<div class="header-item"><strong>Time Limit:</strong> ${esc(timeLimit)}</div>`);
  h.push('</div>');
  if (instructions) h.push(`<div class="instructions">${esc(instructions)}</div>`);

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const pts = q.points ?? 1;
    const name = `q${i + 1}`;
    h.push('<div class="question-card">');
    h.push(`<div class="q-header"><span class="q-number">${i + 1}.</span><span class="q-points">${pts} pt${pts !== 1 ? 's' : ''}</span></div>`);
    h.push(`<div class="q-text">${esc(q.question)}</div>`);
    if (q.type === 'multiple_choice' && q.options) {
      h.push('<ul class="options">');
      for (let j = 0; j < q.options.length; j++) {
        h.push(`<li><input type="radio" name="${name}" id="${name}_${j}"><label for="${name}_${j}">${OPTION_LABELS[j] ?? String(j + 1)}. ${esc(q.options[j])}</label></li>`);
      }
      h.push('</ul>');
    } else if (q.type === 'true_false') {
      h.push('<div class="tf-group">');
      h.push(`<label><input type="radio" name="${name}"> True</label>`);
      h.push(`<label><input type="radio" name="${name}"> False</label>`);
      h.push('</div>');
    } else if (q.type === 'short_answer') {
      h.push(`<input type="text" class="short-input" placeholder="Your answer...">`);
    } else if (q.type === 'essay') {
      h.push('<textarea placeholder="Write your answer here..."></textarea>');
    }
    h.push('</div>');
  }

  if (includeKey) {
    h.push('<div class="answer-key"><h2>Answer Key</h2>');
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (q.correct_answer) {
        h.push('<div class="ak-item">');
        h.push(`<span class="ak-num">${i + 1}.</span><span class="ak-ans">${esc(q.correct_answer)}</span>`);
        if (q.explanation) h.push(`<div class="ak-explain">${esc(q.explanation)}</div>`);
        h.push('</div>');
      }
    }
    h.push('</div>');
  }

  h.push('</body></html>');
  return h.join('\n');
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const quizTool: UnifiedTool = {
  name: 'create_quiz',
  description: `Generate quizzes with multiple choice, short answer, true/false, and essay questions with answer keys.
Use this when the user needs to create a quiz, test, exam, or assessment for students.
Returns a complete quiz with questions, answer options, point values, and an optional answer key — ready to print or share.`,
  parameters: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Quiz title (e.g., "Chapter 5 Biology Quiz")' },
      questions: {
        type: 'array', description: 'Array of quiz questions',
        items: {
          type: 'object', required: ['question', 'type'],
          properties: {
            question: { type: 'string', description: 'The question text' },
            type: { type: 'string', enum: ['multiple_choice', 'short_answer', 'true_false', 'essay'], description: 'Question type' },
            options: { type: 'array', items: { type: 'string' }, description: 'Answer options for multiple choice' },
            correct_answer: { type: 'string', description: 'The correct answer' },
            points: { type: 'number', description: 'Point value. Default: 1' },
            explanation: { type: 'string', description: 'Explanation for the answer key' },
          },
        },
      },
      subject: { type: 'string', description: 'Subject area (e.g., "Biology")' },
      grade_level: { type: 'string', description: 'Grade level (e.g., "10th Grade")' },
      instructions: { type: 'string', description: 'Quiz instructions for students' },
      time_limit: { type: 'string', description: 'Time limit (e.g., "45 minutes")' },
      total_points: { type: 'number', description: 'Total points (auto-calculated if omitted)' },
      include_answer_key: { type: 'boolean', description: 'Include answer key section. Default: true' },
      teacher: { type: 'string', description: 'Teacher name' },
      date: { type: 'string', description: 'Quiz date' },
      format: { type: 'string', enum: ['markdown', 'html'], description: 'Output format. Default: "markdown"' },
    },
    required: ['title', 'questions'],
  },
};

// ============================================================================
// AVAILABILITY CHECK
// ============================================================================

export function isQuizAvailable(): boolean {
  return true;
}

// ============================================================================
// TOOL EXECUTOR
// ============================================================================

export async function executeQuiz(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const args = toolCall.arguments as {
    title: string;
    questions: Question[];
    subject?: string;
    grade_level?: string;
    instructions?: string;
    time_limit?: string;
    total_points?: number;
    include_answer_key?: boolean;
    teacher?: string;
    date?: string;
    format?: 'markdown' | 'html';
  };

  if (!args.title?.trim()) {
    return { toolCallId: toolCall.id, content: 'Error: title parameter is required', isError: true };
  }
  if (!Array.isArray(args.questions) || args.questions.length === 0) {
    return { toolCallId: toolCall.id, content: 'Error: questions array is required and must not be empty', isError: true };
  }

  const validTypes: QuestionType[] = ['multiple_choice', 'short_answer', 'true_false', 'essay'];
  for (let i = 0; i < args.questions.length; i++) {
    const q = args.questions[i];
    if (!q.question?.trim()) {
      return { toolCallId: toolCall.id, content: `Error: question at index ${i} is missing the question text`, isError: true };
    }
    if (!validTypes.includes(q.type)) {
      return { toolCallId: toolCall.id, content: `Error: question at index ${i} has invalid type "${q.type}". Must be one of: ${validTypes.join(', ')}`, isError: true };
    }
    if (q.type === 'multiple_choice' && (!Array.isArray(q.options) || q.options.length < 2)) {
      return { toolCallId: toolCall.id, content: `Error: multiple_choice question at index ${i} must have at least 2 options`, isError: true };
    }
  }

  const fmt = args.format ?? 'markdown';
  const includeKey = args.include_answer_key !== false;
  const subject = args.subject ?? '';
  const gradeLevel = args.grade_level ?? '';
  const teacher = args.teacher ?? '';
  const date = args.date ?? '';
  const instructions = args.instructions ?? '';
  const timeLimit = args.time_limit ?? '';
  const totalPts = computeTotal(args.questions, args.total_points);
  const mcCount = args.questions.filter((q) => q.type === 'multiple_choice').length;
  const tfCount = args.questions.filter((q) => q.type === 'true_false').length;
  const saCount = args.questions.filter((q) => q.type === 'short_answer').length;
  const essayCount = args.questions.filter((q) => q.type === 'essay').length;

  try {
    const formatted = fmt === 'html'
      ? formatHtml(args.title, subject, gradeLevel, teacher, date, instructions, timeLimit, totalPts, args.questions, includeKey)
      : formatMarkdown(args.title, subject, gradeLevel, teacher, date, instructions, timeLimit, totalPts, args.questions, includeKey);

    return {
      toolCallId: toolCall.id,
      content: JSON.stringify({
        success: true,
        message: `Quiz created: ${args.title} (${args.questions.length} questions, ${totalPts} points)`,
        format: fmt,
        formatted_output: formatted,
        summary: {
          title: args.title,
          subject: subject || null,
          grade_level: gradeLevel || null,
          total_questions: args.questions.length,
          total_points: totalPts,
          question_types: { multiple_choice: mcCount, true_false: tfCount, short_answer: saCount, essay: essayCount },
          has_answer_key: includeKey,
          time_limit: timeLimit || null,
        },
      }),
    };
  } catch (error) {
    return {
      toolCallId: toolCall.id,
      content: `Error generating quiz: ${(error as Error).message}`,
      isError: true,
    };
  }
}

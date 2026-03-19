/**
 * LESSON PLAN TOOL — Educational lesson plan generator aligned to Bloom's taxonomy.
 * Produces structured lesson plans with objectives, activities, assessments,
 * and differentiation strategies.
 * No external dependencies. Created: 2026-03-19
 */
import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// TYPES
// ============================================================================

type BloomsLevel = 'remember' | 'understand' | 'apply' | 'analyze' | 'evaluate' | 'create';

interface Activity {
  name: string;
  duration: string;
  description: string;
  blooms_level?: BloomsLevel;
}

interface Differentiation {
  advanced?: string;
  struggling?: string;
  ell?: string;
}

// ============================================================================
// HELPERS
// ============================================================================

function esc(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const BLOOMS_LABELS: Record<BloomsLevel, string> = {
  remember: 'Remember', understand: 'Understand', apply: 'Apply',
  analyze: 'Analyze', evaluate: 'Evaluate', create: 'Create',
};

const BLOOMS_COLORS: Record<BloomsLevel, string> = {
  remember: '#c0392b', understand: '#e67e22', apply: '#f1c40f',
  analyze: '#27ae60', evaluate: '#2980b9', create: '#8e44ad',
};

// ============================================================================
// MARKDOWN FORMATTER
// ============================================================================

function formatMarkdown(
  title: string, subject: string, gradeLevel: string, objectives: string[],
  duration: string, standards: string[], materials: string[], vocabulary: string[],
  activities: Activity[], assessment: string, differentiation: Differentiation | undefined,
  homework: string, reflection: string, teacher: string, date: string,
): string {
  const L: string[] = [];
  L.push(`# ${title}`, '');
  L.push('| Field | Value |', '|-------|-------|');
  L.push(`| **Subject** | ${subject} |`);
  L.push(`| **Grade Level** | ${gradeLevel} |`);
  if (duration) L.push(`| **Duration** | ${duration} |`);
  if (teacher) L.push(`| **Teacher** | ${teacher} |`);
  if (date) L.push(`| **Date** | ${date} |`);
  L.push('');

  L.push('## Learning Objectives', '');
  for (const obj of objectives) L.push(`- ${obj}`);
  L.push('');

  if (standards.length > 0) {
    L.push('## Standards Alignment', '');
    for (const s of standards) L.push(`- ${s}`);
    L.push('');
  }

  if (materials.length > 0) {
    L.push('## Materials Needed', '');
    for (const m of materials) L.push(`- [ ] ${m}`);
    L.push('');
  }

  if (vocabulary.length > 0) {
    L.push('## Key Vocabulary', '');
    for (const v of vocabulary) L.push(`- **${v}**`);
    L.push('');
  }

  if (activities.length > 0) {
    L.push('## Activity Timeline', '');
    L.push('| Activity | Duration | Bloom\'s Level | Description |',
      '|----------|----------|---------------|-------------|');
    for (const a of activities) {
      const bl = a.blooms_level ? BLOOMS_LABELS[a.blooms_level] : '—';
      L.push(`| ${a.name} | ${a.duration} | ${bl} | ${a.description} |`);
    }
    L.push('');
  }

  if (assessment) L.push('## Assessment', '', assessment, '');

  if (differentiation) {
    L.push('## Differentiation Strategies', '');
    if (differentiation.advanced) L.push(`- **Advanced Learners:** ${differentiation.advanced}`);
    if (differentiation.struggling) L.push(`- **Struggling Learners:** ${differentiation.struggling}`);
    if (differentiation.ell) L.push(`- **English Language Learners:** ${differentiation.ell}`);
    L.push('');
  }

  if (homework) L.push('## Homework', '', homework, '');
  if (reflection) L.push('## Teacher Reflection', '', reflection, '');

  return L.join('\n');
}

// ============================================================================
// HTML FORMATTER
// ============================================================================

const CSS = [
  'body{font-family:system-ui,sans-serif;max-width:900px;margin:0 auto;padding:20px;color:#e0e0e0;background:#121225}',
  'h1{color:#c0c8e0;border-bottom:3px solid #1a1a2e;padding-bottom:10px;text-align:center}',
  'h2{color:#a0b0d0;margin-top:28px;border-bottom:1px solid #2a2a4e;padding-bottom:6px}',
  '.meta{display:grid;grid-template-columns:1fr 1fr;gap:8px 24px;background:#1a1a2e;padding:16px 20px;border-radius:8px;margin-bottom:24px}',
  '.meta-item{display:flex;gap:8px}.meta-label{font-weight:700;color:#8090b0;min-width:120px}',
  '.meta-value{color:#c0c8e0}',
  '.obj-list{list-style:none;padding:0}.obj-list li{padding:6px 0 6px 24px;position:relative;color:#c0c8e0}',
  '.obj-list li::before{content:"\\2713";position:absolute;left:0;color:#27ae60;font-weight:700}',
  '.materials{list-style:none;padding:0}.materials li{padding:4px 0;display:flex;align-items:center;gap:8px;color:#b0b8d0}',
  '.materials input[type=checkbox]{width:18px;height:18px;accent-color:#4a5a8a}',
  '.vocab{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}',
  '.vocab-tag{background:#1a1a2e;color:#c0c8e0;padding:6px 14px;border-radius:20px;font-size:.9em;border:1px solid #2a2a4e}',
  '.activity-card{border:1px solid #2a2a4e;border-radius:8px;padding:16px;margin:12px 0;background:#16162a;display:flex;gap:16px}',
  '.activity-bloom{writing-mode:vertical-lr;text-orientation:mixed;padding:8px 6px;border-radius:6px;color:#fff;font-weight:700;font-size:.8em;text-align:center;min-width:28px;letter-spacing:1px}',
  '.activity-body{flex:1}.activity-body h3{margin:0 0 4px;color:#c0c8e0}',
  '.activity-dur{font-size:.85em;color:#7080a0;margin-bottom:8px}',
  '.activity-desc{color:#b0b8d0}',
  '.diff-card{border:1px solid #2a2a4e;border-radius:8px;padding:14px 18px;margin:8px 0;background:#16162a}',
  '.diff-label{font-weight:700;color:#8090b0;margin-bottom:4px}.diff-text{color:#b0b8d0}',
  '.section-box{background:#1a1a2e;padding:14px 20px;border-radius:8px;margin-top:16px;color:#c0c8e0;border-left:4px solid #4a5a8a}',
  'table{width:100%;border-collapse:collapse;margin:12px 0}',
  'th,td{border:1px solid #2a2a4e;padding:8px 12px;text-align:left}',
  'th{background:#1a1a2e;color:#c0c8e0}tr:nth-child(even){background:#16162a}',
  '@media print{body{background:#fff;color:#1a1a1a;padding:0}h1{color:#1a1a2e}h2{color:#2a2a4e}',
  '.meta,.activity-card,.diff-card,.section-box{background:#f5f5fa;border-color:#ccc;color:#1a1a1a}',
  '.vocab-tag{background:#e8e8f0;color:#1a1a2e;border-color:#ccc}th{background:#1a1a2e;color:#fff}}',
].join('');

function formatHtml(
  title: string, subject: string, gradeLevel: string, objectives: string[],
  duration: string, standards: string[], materials: string[], vocabulary: string[],
  activities: Activity[], assessment: string, differentiation: Differentiation | undefined,
  homework: string, reflection: string, teacher: string, date: string,
): string {
  const h: string[] = [];
  h.push(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>${esc(title)}</title>`);
  h.push(`<style>${CSS}</style></head><body>`);
  h.push(`<h1>${esc(title)}</h1>`);

  h.push('<div class="meta">');
  h.push(`<div class="meta-item"><span class="meta-label">Subject:</span><span class="meta-value">${esc(subject)}</span></div>`);
  h.push(`<div class="meta-item"><span class="meta-label">Grade Level:</span><span class="meta-value">${esc(gradeLevel)}</span></div>`);
  if (duration) h.push(`<div class="meta-item"><span class="meta-label">Duration:</span><span class="meta-value">${esc(duration)}</span></div>`);
  if (teacher) h.push(`<div class="meta-item"><span class="meta-label">Teacher:</span><span class="meta-value">${esc(teacher)}</span></div>`);
  if (date) h.push(`<div class="meta-item"><span class="meta-label">Date:</span><span class="meta-value">${esc(date)}</span></div>`);
  h.push('</div>');

  h.push('<h2>Learning Objectives</h2><ul class="obj-list">');
  for (const obj of objectives) h.push(`<li>${esc(obj)}</li>`);
  h.push('</ul>');

  if (standards.length > 0) {
    h.push('<h2>Standards Alignment</h2><ul>');
    for (const s of standards) h.push(`<li style="color:#b0b8d0">${esc(s)}</li>`);
    h.push('</ul>');
  }

  if (materials.length > 0) {
    h.push('<h2>Materials Needed</h2><ul class="materials">');
    for (const m of materials) h.push(`<li><input type="checkbox"><span>${esc(m)}</span></li>`);
    h.push('</ul>');
  }

  if (vocabulary.length > 0) {
    h.push('<h2>Key Vocabulary</h2><div class="vocab">');
    for (const v of vocabulary) h.push(`<span class="vocab-tag">${esc(v)}</span>`);
    h.push('</div>');
  }

  if (activities.length > 0) {
    h.push('<h2>Activity Timeline</h2>');
    for (const a of activities) {
      const bl = a.blooms_level ?? 'remember';
      const color = BLOOMS_COLORS[bl];
      const label = BLOOMS_LABELS[bl];
      h.push(`<div class="activity-card">`);
      if (a.blooms_level) h.push(`<div class="activity-bloom" style="background:${color}">${esc(label)}</div>`);
      h.push(`<div class="activity-body"><h3>${esc(a.name)}</h3>`);
      h.push(`<div class="activity-dur">${esc(a.duration)}</div>`);
      h.push(`<div class="activity-desc">${esc(a.description)}</div></div></div>`);
    }
  }

  if (assessment) h.push(`<h2>Assessment</h2><div class="section-box">${esc(assessment)}</div>`);

  if (differentiation) {
    h.push('<h2>Differentiation Strategies</h2>');
    if (differentiation.advanced) h.push(`<div class="diff-card"><div class="diff-label">Advanced Learners</div><div class="diff-text">${esc(differentiation.advanced)}</div></div>`);
    if (differentiation.struggling) h.push(`<div class="diff-card"><div class="diff-label">Struggling Learners</div><div class="diff-text">${esc(differentiation.struggling)}</div></div>`);
    if (differentiation.ell) h.push(`<div class="diff-card"><div class="diff-label">English Language Learners</div><div class="diff-text">${esc(differentiation.ell)}</div></div>`);
  }

  if (homework) h.push(`<h2>Homework</h2><div class="section-box">${esc(homework)}</div>`);
  if (reflection) h.push(`<h2>Teacher Reflection</h2><div class="section-box" style="border-left-color:#8e44ad">${esc(reflection)}</div>`);

  h.push('</body></html>');
  return h.join('\n');
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const lessonPlanTool: UnifiedTool = {
  name: 'create_lesson_plan',
  description: `Create Bloom's taxonomy-aligned lesson plans with activities, assessments, and differentiation strategies.
Use this when the user needs to plan a lesson, design curriculum, or create educational content for a specific grade level and subject.
Returns a structured lesson plan with objectives, materials, activity timeline, assessment, and differentiation.`,
  parameters: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Lesson title (e.g., "Introduction to Fractions")' },
      subject: { type: 'string', description: 'Subject area (e.g., "Mathematics", "Science")' },
      grade_level: { type: 'string', description: 'Grade level (e.g., "4th Grade", "High School")' },
      objectives: { type: 'array', items: { type: 'string' }, description: 'Learning objectives for the lesson' },
      duration: { type: 'string', description: 'Lesson duration (e.g., "45 minutes")' },
      standards: { type: 'array', items: { type: 'string' }, description: 'Curriculum standards alignment' },
      materials: { type: 'array', items: { type: 'string' }, description: 'Required materials and resources' },
      vocabulary: { type: 'array', items: { type: 'string' }, description: 'Key vocabulary terms' },
      activities: {
        type: 'array', description: 'Lesson activities with Bloom\'s taxonomy levels',
        items: {
          type: 'object', required: ['name', 'duration', 'description'],
          properties: {
            name: { type: 'string', description: 'Activity name' },
            duration: { type: 'string', description: 'Activity duration' },
            description: { type: 'string', description: 'Activity description' },
            blooms_level: {
              type: 'string', description: 'Bloom\'s taxonomy level',
              enum: ['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'],
            },
          },
        },
      },
      assessment: { type: 'string', description: 'How students will be assessed' },
      differentiation: {
        type: 'object', description: 'Differentiation strategies for diverse learners',
        properties: {
          advanced: { type: 'string', description: 'Strategies for advanced learners' },
          struggling: { type: 'string', description: 'Strategies for struggling learners' },
          ell: { type: 'string', description: 'Strategies for English language learners' },
        },
      },
      homework: { type: 'string', description: 'Homework assignment' },
      reflection: { type: 'string', description: 'Teacher reflection notes' },
      teacher: { type: 'string', description: 'Teacher name' },
      date: { type: 'string', description: 'Lesson date' },
      format: { type: 'string', enum: ['markdown', 'html'], description: 'Output format. Default: "markdown"' },
    },
    required: ['title', 'subject', 'grade_level', 'objectives'],
  },
};

// ============================================================================
// AVAILABILITY CHECK
// ============================================================================

export function isLessonPlanAvailable(): boolean {
  return true;
}

// ============================================================================
// TOOL EXECUTOR
// ============================================================================

export async function executeLessonPlan(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const args = toolCall.arguments as {
    title: string;
    subject: string;
    grade_level: string;
    objectives: string[];
    duration?: string;
    standards?: string[];
    materials?: string[];
    vocabulary?: string[];
    activities?: Activity[];
    assessment?: string;
    differentiation?: Differentiation;
    homework?: string;
    reflection?: string;
    teacher?: string;
    date?: string;
    format?: 'markdown' | 'html';
  };

  if (!args.title?.trim()) {
    return { toolCallId: toolCall.id, content: 'Error: title parameter is required', isError: true };
  }
  if (!args.subject?.trim()) {
    return { toolCallId: toolCall.id, content: 'Error: subject parameter is required', isError: true };
  }
  if (!args.grade_level?.trim()) {
    return { toolCallId: toolCall.id, content: 'Error: grade_level parameter is required', isError: true };
  }
  if (!Array.isArray(args.objectives) || args.objectives.length === 0) {
    return { toolCallId: toolCall.id, content: 'Error: objectives array is required and must not be empty', isError: true };
  }

  if (args.activities) {
    for (let i = 0; i < args.activities.length; i++) {
      const a = args.activities[i];
      if (!a.name || !a.duration || !a.description) {
        return {
          toolCallId: toolCall.id,
          content: `Error: activity at index ${i} is missing required fields (name, duration, description)`,
          isError: true,
        };
      }
    }
  }

  const fmt = args.format ?? 'markdown';
  const dur = args.duration ?? '';
  const standards = args.standards ?? [];
  const materials = args.materials ?? [];
  const vocabulary = args.vocabulary ?? [];
  const activities = args.activities ?? [];
  const assessment = args.assessment ?? '';
  const homework = args.homework ?? '';
  const reflection = args.reflection ?? '';
  const teacher = args.teacher ?? '';
  const date = args.date ?? '';
  const bloomsUsed = [...new Set(activities.filter((a) => a.blooms_level).map((a) => a.blooms_level as string))];

  try {
    const formatted = fmt === 'html'
      ? formatHtml(args.title, args.subject, args.grade_level, args.objectives, dur, standards, materials, vocabulary, activities, assessment, args.differentiation, homework, reflection, teacher, date)
      : formatMarkdown(args.title, args.subject, args.grade_level, args.objectives, dur, standards, materials, vocabulary, activities, assessment, args.differentiation, homework, reflection, teacher, date);

    return {
      toolCallId: toolCall.id,
      content: JSON.stringify({
        success: true,
        message: `Lesson plan created: ${args.title}`,
        format: fmt,
        formatted_output: formatted,
        summary: {
          title: args.title,
          subject: args.subject,
          grade_level: args.grade_level,
          objective_count: args.objectives.length,
          activity_count: activities.length,
          materials_count: materials.length,
          blooms_levels_covered: bloomsUsed,
          has_differentiation: !!args.differentiation,
          has_assessment: !!assessment,
        },
      }),
    };
  } catch (error) {
    return {
      toolCallId: toolCall.id,
      content: `Error generating lesson plan: ${(error as Error).message}`,
      isError: true,
    };
  }
}

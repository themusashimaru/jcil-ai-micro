/** CARE PLAN TOOL — Patient care plan generator. No external dependencies. Created: 2026-03-19 */
import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// TYPES
// ============================================================================

interface CareGoal {
  goal: string;
  target_date: string;
  interventions: string[];
}

interface CareTeamMember {
  role: string;
  name: string;
}

interface Medication {
  name: string;
  dosage: string;
  frequency: string;
}

// ============================================================================
// HELPERS
// ============================================================================

function esc(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const DISCLAIMER = 'DISCLAIMER: This is a template only. It does not constitute medical advice. This care plan must be reviewed and approved by a licensed healthcare provider before implementation.';

// ============================================================================
// MARKDOWN FORMATTER
// ============================================================================

function formatMarkdown(
  patientId: string, diagnosis: string, goals: CareGoal[],
  careTeam: CareTeamMember[], assessment: string, allergies: string[],
  medications: Medication[], vitalSigns: string[], diet: string,
  activityLevel: string, educationNeeds: string[],
  dischargeCriteria: string[], followUp: string, reviewDate: string,
): string {
  const L: string[] = [];

  L.push(`> **${DISCLAIMER}**`, '');
  L.push('# Patient Care Plan', '');
  L.push('| Field | Value |', '|-------|-------|');
  L.push(`| **Patient ID** | ${patientId} |`);
  L.push(`| **Primary Diagnosis** | ${diagnosis} |`);
  if (reviewDate) L.push(`| **Review Date** | ${reviewDate} |`);
  L.push('');

  if (assessment) L.push('## Assessment', '', assessment, '');

  if (allergies.length > 0) {
    L.push('## Allergies', '');
    for (const a of allergies) L.push(`- **${a}**`);
    L.push('');
  }

  L.push('## Goals and Interventions', '');
  for (let i = 0; i < goals.length; i++) {
    const g = goals[i];
    L.push(`### Goal ${i + 1}: ${g.goal}`, '', `**Target Date:** ${g.target_date}`, '');
    if (g.interventions.length > 0) {
      L.push('**Interventions:**', '');
      for (const intv of g.interventions) L.push(`- [ ] ${intv}`);
      L.push('');
    }
  }

  if (medications.length > 0) {
    L.push('## Medications', '', '| Medication | Dosage | Frequency |',
      '|------------|--------|-----------|');
    for (const m of medications) L.push(`| ${m.name} | ${m.dosage} | ${m.frequency} |`);
    L.push('');
  }

  if (vitalSigns.length > 0) {
    L.push('## Vital Signs Monitoring', '');
    for (const v of vitalSigns) L.push(`- ${v}`);
    L.push('');
  }

  if (diet) L.push('## Diet', '', diet, '');
  if (activityLevel) L.push('## Activity Level', '', activityLevel, '');

  if (educationNeeds.length > 0) {
    L.push('## Patient Education', '');
    for (const e of educationNeeds) L.push(`- ${e}`);
    L.push('');
  }

  if (careTeam.length > 0) {
    L.push('## Care Team', '', '| Role | Name |', '|------|------|');
    for (const c of careTeam) L.push(`| ${c.role} | ${c.name} |`);
    L.push('');
  }

  if (dischargeCriteria.length > 0) {
    L.push('## Discharge Criteria', '');
    for (const d of dischargeCriteria) L.push(`- [ ] ${d}`);
    L.push('');
  }

  if (followUp) L.push('## Follow-Up', '', followUp, '');

  L.push('---', '', `*${DISCLAIMER}*`);
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
  '.disclaimer{background:#4a1a1a;border:2px solid #d04040;border-radius:8px;padding:14px 18px;margin-bottom:20px;color:#f0a0a0;font-weight:600;text-align:center;font-size:.95em}',
  '.meta{display:grid;grid-template-columns:1fr 1fr;gap:8px 24px;background:#1a1a2e;padding:16px 20px;border-radius:8px;margin-bottom:24px}',
  '.meta-item{display:flex;gap:8px}.meta-label{font-weight:700;color:#8090b0;min-width:140px}',
  '.meta-value{color:#c0c8e0}',
  '.allergies{background:#3a2a10;border-left:4px solid #d4a017;padding:10px 14px;border-radius:4px;margin:12px 0;color:#e8d080}',
  '.allergies strong{color:#f0c040}',
  '.goal-card{border:1px solid #2a2a4e;border-radius:8px;padding:16px;margin:12px 0;background:#16162a}',
  '.goal-card h3{margin-top:0;color:#c0c8e0}',
  '.goal-date{font-size:.9em;color:#8090b0;margin-bottom:8px}',
  '.interventions{list-style:none;padding:0;margin:8px 0}',
  '.interventions li{padding:4px 0;display:flex;align-items:center;gap:8px;color:#b0b8d0}',
  '.interventions input[type=checkbox]{width:18px;height:18px;accent-color:#4a5a8a}',
  'table{width:100%;border-collapse:collapse;margin:12px 0}',
  'th,td{border:1px solid #2a2a4e;padding:8px 12px;text-align:left}',
  'th{background:#1a1a2e;color:#c0c8e0}tr:nth-child(even){background:#16162a}',
  '.care-team{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:12px 0}',
  '.team-member{background:#1a1a2e;padding:10px 14px;border-radius:6px;display:flex;gap:12px;align-items:center}',
  '.team-role{font-weight:700;color:#8090b0;min-width:100px}.team-name{color:#c0c8e0}',
  '.checklist{list-style:none;padding:0}.checklist li{padding:6px 0;display:flex;align-items:center;gap:8px;color:#b0b8d0}',
  '.checklist input[type=checkbox]{width:18px;height:18px;accent-color:#4a5a8a}',
  'p{color:#b0b8d0;line-height:1.6}',
  '.section-card{background:#16162a;padding:14px 18px;border-radius:8px;border-left:3px solid #4a5a8a;margin:12px 0;color:#b0b8d0}',
  '@media print{body{background:#fff;color:#1a1a1a;padding:0}h1{color:#1a1a2e}h2{color:#2a2a4e}',
  '.disclaimer{background:#fff0f0;border-color:#d04040;color:#a02020}',
  '.meta,.goal-card,.team-member,.section-card{background:#f5f5fa;border-color:#ccc}th{background:#1a1a2e;color:#fff}}',
].join('');

function formatHtml(
  patientId: string, diagnosis: string, goals: CareGoal[],
  careTeam: CareTeamMember[], assessment: string, allergies: string[],
  medications: Medication[], vitalSigns: string[], diet: string,
  activityLevel: string, educationNeeds: string[],
  dischargeCriteria: string[], followUp: string, reviewDate: string,
): string {
  const h: string[] = [];
  h.push(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Care Plan: ${esc(patientId)}</title>`);
  h.push(`<style>${CSS}</style></head><body>`);

  h.push(`<div class="disclaimer">${esc(DISCLAIMER)}</div>`);
  h.push('<h1>Patient Care Plan</h1>');

  h.push('<div class="meta">');
  h.push(`<div class="meta-item"><span class="meta-label">Patient ID:</span><span class="meta-value">${esc(patientId)}</span></div>`);
  h.push(`<div class="meta-item"><span class="meta-label">Primary Diagnosis:</span><span class="meta-value">${esc(diagnosis)}</span></div>`);
  if (reviewDate) h.push(`<div class="meta-item"><span class="meta-label">Review Date:</span><span class="meta-value">${esc(reviewDate)}</span></div>`);
  h.push('</div>');

  if (assessment) h.push(`<h2>Assessment</h2><div class="section-card">${esc(assessment)}</div>`);

  if (allergies.length > 0) {
    h.push('<div class="allergies"><strong>Allergies:</strong> ');
    h.push(allergies.map((a) => esc(a)).join(', '));
    h.push('</div>');
  }

  h.push('<h2>Goals and Interventions</h2>');
  for (let i = 0; i < goals.length; i++) {
    const g = goals[i];
    h.push(`<div class="goal-card"><h3>Goal ${i + 1}: ${esc(g.goal)}</h3>`);
    h.push(`<div class="goal-date">Target Date: ${esc(g.target_date)}</div>`);
    if (g.interventions.length > 0) {
      h.push('<ul class="interventions">');
      for (const intv of g.interventions) h.push(`<li><input type="checkbox"><span>${esc(intv)}</span></li>`);
      h.push('</ul>');
    }
    h.push('</div>');
  }

  if (medications.length > 0) {
    h.push('<h2>Medications</h2>');
    h.push('<table><thead><tr><th>Medication</th><th>Dosage</th><th>Frequency</th></tr></thead><tbody>');
    for (const m of medications) h.push(`<tr><td>${esc(m.name)}</td><td>${esc(m.dosage)}</td><td>${esc(m.frequency)}</td></tr>`);
    h.push('</tbody></table>');
  }

  if (vitalSigns.length > 0) {
    h.push('<h2>Vital Signs Monitoring</h2><ul>');
    for (const v of vitalSigns) h.push(`<li style="color:#b0b8d0">${esc(v)}</li>`);
    h.push('</ul>');
  }

  if (diet) h.push(`<h2>Diet</h2><div class="section-card">${esc(diet)}</div>`);
  if (activityLevel) h.push(`<h2>Activity Level</h2><div class="section-card">${esc(activityLevel)}</div>`);

  if (educationNeeds.length > 0) {
    h.push('<h2>Patient Education</h2><ul>');
    for (const e of educationNeeds) h.push(`<li style="color:#b0b8d0">${esc(e)}</li>`);
    h.push('</ul>');
  }

  if (careTeam.length > 0) {
    h.push('<h2>Care Team</h2><div class="care-team">');
    for (const c of careTeam) {
      h.push(`<div class="team-member"><span class="team-role">${esc(c.role)}</span><span class="team-name">${esc(c.name)}</span></div>`);
    }
    h.push('</div>');
  }

  if (dischargeCriteria.length > 0) {
    h.push('<h2>Discharge Criteria</h2><ul class="checklist">');
    for (const d of dischargeCriteria) h.push(`<li><input type="checkbox"><span>${esc(d)}</span></li>`);
    h.push('</ul>');
  }

  if (followUp) h.push(`<h2>Follow-Up</h2><div class="section-card">${esc(followUp)}</div>`);

  h.push(`<div class="disclaimer" style="margin-top:24px">${esc(DISCLAIMER)}</div>`);
  h.push('</body></html>');
  return h.join('\n');
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const carePlanTool: UnifiedTool = {
  name: 'create_care_plan',
  description: `Generate patient care plans with goals, interventions, medications, and discharge criteria.
Use this when the user needs to create a care plan template for patient management.
Returns a clinical-styled document with goals, intervention checklists, medication table, and care team information.
Includes a mandatory medical disclaimer.`,
  parameters: {
    type: 'object',
    properties: {
      patient_id: { type: 'string', description: 'Anonymized patient identifier' },
      diagnosis: { type: 'string', description: 'Primary diagnosis' },
      goals: {
        type: 'array', description: 'Care goals with interventions',
        items: {
          type: 'object', required: ['goal', 'target_date', 'interventions'],
          properties: {
            goal: { type: 'string', description: 'Goal statement' },
            target_date: { type: 'string', description: 'Target completion date' },
            interventions: { type: 'array', items: { type: 'string' }, description: 'Interventions for this goal' },
          },
        },
      },
      care_team: {
        type: 'array', description: 'Care team members',
        items: {
          type: 'object', required: ['role', 'name'],
          properties: {
            role: { type: 'string', description: 'Team member role' },
            name: { type: 'string', description: 'Team member name' },
          },
        },
      },
      assessment: { type: 'string', description: 'Patient assessment summary' },
      allergies: { type: 'array', items: { type: 'string' }, description: 'Known allergies' },
      medications: {
        type: 'array', description: 'Current medications',
        items: {
          type: 'object', required: ['name', 'dosage', 'frequency'],
          properties: {
            name: { type: 'string', description: 'Medication name' },
            dosage: { type: 'string', description: 'Dosage (e.g., "500mg")' },
            frequency: { type: 'string', description: 'Frequency (e.g., "twice daily")' },
          },
        },
      },
      vital_signs_schedule: { type: 'array', items: { type: 'string' }, description: 'Vital signs monitoring schedule' },
      diet: { type: 'string', description: 'Dietary requirements or restrictions' },
      activity_level: { type: 'string', description: 'Activity level and restrictions' },
      education_needs: { type: 'array', items: { type: 'string' }, description: 'Patient education topics' },
      discharge_criteria: { type: 'array', items: { type: 'string' }, description: 'Criteria for discharge' },
      follow_up: { type: 'string', description: 'Follow-up care instructions' },
      review_date: { type: 'string', description: 'Care plan review date' },
      format: { type: 'string', enum: ['markdown', 'html'], description: 'Output format. Default: "markdown"' },
    },
    required: ['patient_id', 'diagnosis', 'goals'],
  },
};

// ============================================================================
// AVAILABILITY CHECK
// ============================================================================

export function isCarePlanAvailable(): boolean {
  return true;
}

// ============================================================================
// TOOL EXECUTOR
// ============================================================================

export async function executeCarePlan(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const args = toolCall.arguments as {
    patient_id: string; diagnosis: string; goals: CareGoal[];
    care_team?: CareTeamMember[]; assessment?: string; allergies?: string[];
    medications?: Medication[]; vital_signs_schedule?: string[];
    diet?: string; activity_level?: string; education_needs?: string[];
    discharge_criteria?: string[]; follow_up?: string; review_date?: string;
    format?: 'markdown' | 'html';
  };

  if (!args.patient_id?.trim()) {
    return { toolCallId: toolCall.id, content: 'Error: patient_id parameter is required', isError: true };
  }
  if (!args.diagnosis?.trim()) {
    return { toolCallId: toolCall.id, content: 'Error: diagnosis parameter is required', isError: true };
  }
  if (!Array.isArray(args.goals) || args.goals.length === 0) {
    return { toolCallId: toolCall.id, content: 'Error: goals array is required and must not be empty', isError: true };
  }

  for (let i = 0; i < args.goals.length; i++) {
    const g = args.goals[i];
    if (!g.goal || !g.target_date || !Array.isArray(g.interventions)) {
      return {
        toolCallId: toolCall.id,
        content: `Error: goal at index ${i} is missing required fields (goal, target_date, interventions)`,
        isError: true,
      };
    }
  }

  if (args.care_team) {
    for (let i = 0; i < args.care_team.length; i++) {
      const c = args.care_team[i];
      if (!c.role || !c.name) {
        return { toolCallId: toolCall.id, content: `Error: care_team member at index ${i} is missing required fields (role, name)`, isError: true };
      }
    }
  }

  if (args.medications) {
    for (let i = 0; i < args.medications.length; i++) {
      const m = args.medications[i];
      if (!m.name || !m.dosage || !m.frequency) {
        return { toolCallId: toolCall.id, content: `Error: medication at index ${i} is missing required fields (name, dosage, frequency)`, isError: true };
      }
    }
  }

  const fmt = args.format ?? 'markdown';
  const careTeam = args.care_team ?? [];
  const allergies = args.allergies ?? [];
  const medications = args.medications ?? [];
  const vitalSigns = args.vital_signs_schedule ?? [];
  const educationNeeds = args.education_needs ?? [];
  const dischargeCriteria = args.discharge_criteria ?? [];
  const totalInterventions = args.goals.reduce((sum, g) => sum + g.interventions.length, 0);

  try {
    const formatted = fmt === 'html'
      ? formatHtml(args.patient_id, args.diagnosis, args.goals, careTeam, args.assessment ?? '', allergies, medications, vitalSigns, args.diet ?? '', args.activity_level ?? '', educationNeeds, dischargeCriteria, args.follow_up ?? '', args.review_date ?? '')
      : formatMarkdown(args.patient_id, args.diagnosis, args.goals, careTeam, args.assessment ?? '', allergies, medications, vitalSigns, args.diet ?? '', args.activity_level ?? '', educationNeeds, dischargeCriteria, args.follow_up ?? '', args.review_date ?? '');

    return {
      toolCallId: toolCall.id,
      content: JSON.stringify({
        success: true,
        message: `Care plan created for patient ${args.patient_id}`,
        format: fmt,
        formatted_output: formatted,
        summary: {
          patient_id: args.patient_id,
          diagnosis: args.diagnosis,
          goals_count: args.goals.length,
          total_interventions: totalInterventions,
          medications_count: medications.length,
          care_team_size: careTeam.length,
          has_allergies: allergies.length > 0,
          discharge_criteria_count: dischargeCriteria.length,
          has_disclaimer: true,
        },
      }),
    };
  } catch (error) {
    return {
      toolCallId: toolCall.id,
      content: `Error generating care plan: ${(error as Error).message}`,
      isError: true,
    };
  }
}

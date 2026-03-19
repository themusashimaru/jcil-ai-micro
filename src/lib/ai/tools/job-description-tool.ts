/**
 * JOB DESCRIPTION TOOL — Professional job description generator for recruiting.
 * Produces formatted JDs with qualifications, benefits, and EEO statements.
 * No external dependencies. Created: 2026-03-19
 */
import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// TYPES
// ============================================================================

type EmploymentType = 'full_time' | 'part_time' | 'contract' | 'internship';
type ExperienceLevel = 'entry' | 'mid' | 'senior' | 'lead' | 'executive';
type RemotePolicy = 'onsite' | 'hybrid' | 'remote';

const EMPLOYMENT_LABELS: Record<EmploymentType, string> = {
  full_time: 'Full-Time', part_time: 'Part-Time', contract: 'Contract', internship: 'Internship',
};
const EXPERIENCE_LABELS: Record<ExperienceLevel, string> = {
  entry: 'Entry Level', mid: 'Mid Level', senior: 'Senior', lead: 'Lead', executive: 'Executive',
};
const REMOTE_LABELS: Record<RemotePolicy, string> = {
  onsite: 'On-Site', hybrid: 'Hybrid', remote: 'Remote',
};

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
  title: string, dept: string, responsibilities: string[],
  company: string, location: string, empType: EmploymentType, expLevel: ExperienceLevel,
  salary: string, reqQuals: string[], prefQuals: string[], benefits: string[],
  skills: string[], aboutCompany: string, reportsTo: string, directReports: number,
  travel: string, remotePolicy: RemotePolicy, deadline: string, eeo: boolean,
): string {
  const L: string[] = [];
  L.push(`# ${title}`, '');
  if (company) L.push(`**${company}**`, '');
  const info: string[] = [];
  if (dept) info.push(`**Department:** ${dept}`);
  if (location) info.push(`**Location:** ${location}`);
  info.push(`**Type:** ${EMPLOYMENT_LABELS[empType]}`);
  info.push(`**Level:** ${EXPERIENCE_LABELS[expLevel]}`);
  if (remotePolicy) info.push(`**Remote Policy:** ${REMOTE_LABELS[remotePolicy]}`);
  if (salary) info.push(`**Salary Range:** ${salary}`);
  if (reportsTo) info.push(`**Reports To:** ${reportsTo}`);
  if (directReports > 0) info.push(`**Direct Reports:** ${directReports}`);
  if (travel) info.push(`**Travel:** ${travel}`);
  if (deadline) info.push(`**Application Deadline:** ${deadline}`);
  L.push(info.join('  \n'), '');

  L.push('## Overview', '');
  L.push(`We are looking for a talented **${title}** to join our ${dept ? dept + ' ' : ''}team${company ? ' at ' + company : ''}.`, '');

  L.push('## Responsibilities', '');
  for (const r of responsibilities) L.push(`- ${r}`);
  L.push('');

  if (reqQuals.length > 0) {
    L.push('## Required Qualifications', '');
    for (const q of reqQuals) L.push(`- ${q}`);
    L.push('');
  }
  if (prefQuals.length > 0) {
    L.push('## Preferred Qualifications', '');
    for (const q of prefQuals) L.push(`- ${q}`);
    L.push('');
  }
  if (skills.length > 0) {
    L.push('## Skills', '');
    L.push(skills.map((s) => `\`${s}\``).join(' | '), '');
  }
  if (benefits.length > 0) {
    L.push('## Benefits', '');
    for (const b of benefits) L.push(`- ${b}`);
    L.push('');
  }
  if (aboutCompany) {
    L.push('## About the Company', '', aboutCompany, '');
  }
  if (eeo) {
    L.push('---', '', '*We are an equal opportunity employer. All qualified applicants will receive consideration for employment without regard to race, color, religion, sex, sexual orientation, gender identity, national origin, disability, or veteran status.*', '');
  }
  return L.join('\n');
}

// ============================================================================
// HTML FORMATTER
// ============================================================================

const CSS = [
  'body{font-family:system-ui,sans-serif;max-width:900px;margin:0 auto;padding:20px;color:#e0e0e0;background:#121225}',
  'h1{color:#c0c8e0;margin:0 0 4px}h2{color:#a0b0d0;margin-top:28px;border-bottom:1px solid #2a2a4e;padding-bottom:6px}',
  '.header{background:#1a1a2e;padding:24px;border-radius:10px;margin-bottom:24px}',
  '.company{color:#8090b0;font-size:1.1em;margin-bottom:12px}',
  '.badges{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}',
  '.badge{background:#2a2a4e;color:#c0c8e0;padding:6px 14px;border-radius:20px;font-size:.85em;display:inline-flex;align-items:center;gap:6px}',
  '.badge strong{color:#8090b0}',
  '.resp-list{list-style:none;padding:0}.resp-list li{padding:10px 0;border-bottom:1px solid #1a1a2e;display:flex;gap:10px}',
  '.resp-list li::before{content:"\\2022";color:#4a6a9a;font-size:1.4em;line-height:1}',
  '.qual-section{display:grid;grid-template-columns:1fr 1fr;gap:20px}',
  '.qual-card{background:#16162a;border:1px solid #2a2a4e;border-radius:8px;padding:16px}',
  '.qual-card h3{color:#a0b0d0;margin:0 0 12px;font-size:1em}',
  '.qual-card ul{margin:0;padding-left:20px}.qual-card li{padding:4px 0;color:#b0b8d0}',
  '.skills{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}',
  '.skill-tag{background:#1a1a2e;color:#c0c8e0;padding:5px 12px;border-radius:16px;font-size:.85em;border:1px solid #3a3a5e}',
  '.benefits-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px;margin-top:12px}',
  '.benefit-card{background:#16162a;border:1px solid #2a2a4e;border-radius:8px;padding:12px 16px;color:#b0b8d0;font-size:.95em}',
  '.about{background:#16162a;border:1px solid #2a2a4e;border-radius:8px;padding:16px 20px;margin-top:12px;color:#b0b8d0;line-height:1.6}',
  '.cta{text-align:center;margin-top:32px}',
  '.cta-btn{display:inline-block;background:#4a5a8a;color:#fff;padding:14px 40px;border-radius:8px;font-size:1.1em;text-decoration:none;font-weight:700;letter-spacing:.5px}',
  '.cta-btn:hover{background:#5a6a9a}',
  '.eeo{margin-top:24px;padding:12px 16px;background:#1a1a2e;border-radius:6px;font-size:.85em;color:#7080a0;font-style:italic}',
  '@media print{body{background:#fff;color:#1a1a1a;padding:0}h1{color:#1a1a2e}h2{color:#2a2a4e}',
  '.header{background:#f5f5fa;border-color:#ccc}.badge{background:#eee;color:#333}',
  '.qual-card,.benefit-card,.about{background:#f9f9fc;border-color:#ddd}}',
].join('');

function formatHtml(
  title: string, dept: string, responsibilities: string[],
  company: string, location: string, empType: EmploymentType, expLevel: ExperienceLevel,
  salary: string, reqQuals: string[], prefQuals: string[], benefits: string[],
  skills: string[], aboutCompany: string, reportsTo: string, directReports: number,
  travel: string, remotePolicy: RemotePolicy, deadline: string, eeo: boolean,
): string {
  const h: string[] = [];
  h.push(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>${esc(title)}</title>`);
  h.push(`<style>${CSS}</style></head><body>`);
  h.push('<div class="header">');
  if (company) h.push(`<div class="company">${esc(company)}</div>`);
  h.push(`<h1>${esc(title)}</h1>`);
  h.push('<div class="badges">');
  if (dept) h.push(`<span class="badge"><strong>Dept:</strong> ${esc(dept)}</span>`);
  if (location) h.push(`<span class="badge"><strong>Location:</strong> ${esc(location)}</span>`);
  h.push(`<span class="badge"><strong>Type:</strong> ${esc(EMPLOYMENT_LABELS[empType])}</span>`);
  h.push(`<span class="badge"><strong>Level:</strong> ${esc(EXPERIENCE_LABELS[expLevel])}</span>`);
  if (remotePolicy) h.push(`<span class="badge"><strong>Policy:</strong> ${esc(REMOTE_LABELS[remotePolicy])}</span>`);
  if (salary) h.push(`<span class="badge"><strong>Salary:</strong> ${esc(salary)}</span>`);
  if (reportsTo) h.push(`<span class="badge"><strong>Reports To:</strong> ${esc(reportsTo)}</span>`);
  if (directReports > 0) h.push(`<span class="badge"><strong>Direct Reports:</strong> ${directReports}</span>`);
  if (travel) h.push(`<span class="badge"><strong>Travel:</strong> ${esc(travel)}</span>`);
  if (deadline) h.push(`<span class="badge"><strong>Deadline:</strong> ${esc(deadline)}</span>`);
  h.push('</div></div>');

  h.push(`<h2>Overview</h2><p>We are looking for a talented <strong>${esc(title)}</strong> to join our ${dept ? esc(dept) + ' ' : ''}team${company ? ' at ' + esc(company) : ''}.</p>`);

  h.push('<h2>Responsibilities</h2><ul class="resp-list">');
  for (const r of responsibilities) h.push(`<li>${esc(r)}</li>`);
  h.push('</ul>');

  if (reqQuals.length > 0 || prefQuals.length > 0) {
    h.push('<h2>Qualifications</h2><div class="qual-section">');
    if (reqQuals.length > 0) {
      h.push('<div class="qual-card"><h3>Required</h3><ul>');
      for (const q of reqQuals) h.push(`<li>${esc(q)}</li>`);
      h.push('</ul></div>');
    }
    if (prefQuals.length > 0) {
      h.push('<div class="qual-card"><h3>Preferred</h3><ul>');
      for (const q of prefQuals) h.push(`<li>${esc(q)}</li>`);
      h.push('</ul></div>');
    }
    h.push('</div>');
  }

  if (skills.length > 0) {
    h.push('<h2>Skills</h2><div class="skills">');
    for (const s of skills) h.push(`<span class="skill-tag">${esc(s)}</span>`);
    h.push('</div>');
  }

  if (benefits.length > 0) {
    h.push('<h2>Benefits</h2><div class="benefits-grid">');
    for (const b of benefits) h.push(`<div class="benefit-card">${esc(b)}</div>`);
    h.push('</div>');
  }

  if (aboutCompany) {
    h.push(`<h2>About the Company</h2><div class="about">${esc(aboutCompany)}</div>`);
  }

  h.push('<div class="cta"><a class="cta-btn" href="#">Apply Now</a></div>');

  if (eeo) {
    h.push('<div class="eeo">We are an equal opportunity employer. All qualified applicants will receive consideration for employment without regard to race, color, religion, sex, sexual orientation, gender identity, national origin, disability, or veteran status.</div>');
  }

  h.push('</body></html>');
  return h.join('\n');
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const jobDescriptionTool: UnifiedTool = {
  name: 'create_job_description',
  description: `Generate professional job descriptions with qualifications, benefits, and EEO statements.

Use this when:
- User needs to create a job posting or listing
- User wants to write a job description for recruiting
- User asks for help drafting a role description
- User needs a formatted JD with requirements and benefits

Returns a complete job description with overview, responsibilities, qualifications, skills, benefits, and optional EEO statement.`,
  parameters: {
    type: 'object',
    properties: {
      job_title: { type: 'string', description: 'Job title (e.g., "Senior Software Engineer")' },
      department: { type: 'string', description: 'Department (e.g., "Engineering")' },
      responsibilities: { type: 'array', items: { type: 'string' }, description: 'List of key responsibilities' },
      company: { type: 'string', description: 'Company name' },
      location: { type: 'string', description: 'Job location (e.g., "San Francisco, CA")' },
      employment_type: { type: 'string', enum: ['full_time', 'part_time', 'contract', 'internship'], description: 'Employment type. Default: "full_time"' },
      experience_level: { type: 'string', enum: ['entry', 'mid', 'senior', 'lead', 'executive'], description: 'Experience level. Default: "mid"' },
      salary_range: { type: 'string', description: 'Salary range (e.g., "$120,000 - $160,000")' },
      required_qualifications: { type: 'array', items: { type: 'string' }, description: 'Required qualifications' },
      preferred_qualifications: { type: 'array', items: { type: 'string' }, description: 'Preferred qualifications' },
      benefits: { type: 'array', items: { type: 'string' }, description: 'Benefits and perks' },
      skills: { type: 'array', items: { type: 'string' }, description: 'Key skills and technologies' },
      about_company: { type: 'string', description: 'About the company paragraph' },
      reports_to: { type: 'string', description: 'Who this role reports to' },
      direct_reports: { type: 'number', description: 'Number of direct reports' },
      travel: { type: 'string', description: 'Travel requirements (e.g., "Up to 25%")' },
      remote_policy: { type: 'string', enum: ['onsite', 'hybrid', 'remote'], description: 'Remote work policy. Default: "onsite"' },
      application_deadline: { type: 'string', description: 'Application deadline date' },
      equal_opportunity: { type: 'boolean', description: 'Include EEO statement. Default: true' },
      format: { type: 'string', enum: ['markdown', 'html'], description: 'Output format. Default: "markdown"' },
    },
    required: ['job_title', 'department', 'responsibilities'],
  },
};

// ============================================================================
// AVAILABILITY CHECK
// ============================================================================

export function isJobDescriptionAvailable(): boolean {
  return true;
}

// ============================================================================
// TOOL EXECUTOR
// ============================================================================

export async function executeJobDescription(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const args = toolCall.arguments as {
    job_title: string;
    department: string;
    responsibilities: string[];
    company?: string;
    location?: string;
    employment_type?: EmploymentType;
    experience_level?: ExperienceLevel;
    salary_range?: string;
    required_qualifications?: string[];
    preferred_qualifications?: string[];
    benefits?: string[];
    skills?: string[];
    about_company?: string;
    reports_to?: string;
    direct_reports?: number;
    travel?: string;
    remote_policy?: RemotePolicy;
    application_deadline?: string;
    equal_opportunity?: boolean;
    format?: 'markdown' | 'html';
  };

  if (!args.job_title?.trim()) {
    return { toolCallId: toolCall.id, content: 'Error: job_title parameter is required', isError: true };
  }
  if (!args.department?.trim()) {
    return { toolCallId: toolCall.id, content: 'Error: department parameter is required', isError: true };
  }
  if (!Array.isArray(args.responsibilities) || args.responsibilities.length === 0) {
    return { toolCallId: toolCall.id, content: 'Error: responsibilities array is required and must not be empty', isError: true };
  }

  const fmt = args.format ?? 'markdown';
  const empType = args.employment_type ?? 'full_time';
  const expLevel = args.experience_level ?? 'mid';
  const remotePolicy = args.remote_policy ?? 'onsite';
  const eeo = args.equal_opportunity !== false;
  const company = args.company ?? '';
  const location = args.location ?? '';
  const salary = args.salary_range ?? '';
  const reqQuals = args.required_qualifications ?? [];
  const prefQuals = args.preferred_qualifications ?? [];
  const benefits = args.benefits ?? [];
  const skills = args.skills ?? [];
  const aboutCompany = args.about_company ?? '';
  const reportsTo = args.reports_to ?? '';
  const directReports = args.direct_reports ?? 0;
  const travel = args.travel ?? '';
  const deadline = args.application_deadline ?? '';

  try {
    const formatted = fmt === 'html'
      ? formatHtml(args.job_title, args.department, args.responsibilities, company, location, empType, expLevel, salary, reqQuals, prefQuals, benefits, skills, aboutCompany, reportsTo, directReports, travel, remotePolicy, deadline, eeo)
      : formatMarkdown(args.job_title, args.department, args.responsibilities, company, location, empType, expLevel, salary, reqQuals, prefQuals, benefits, skills, aboutCompany, reportsTo, directReports, travel, remotePolicy, deadline, eeo);

    return {
      toolCallId: toolCall.id,
      content: JSON.stringify({
        success: true,
        message: `Job description created: ${args.job_title}`,
        format: fmt,
        formatted_output: formatted,
        summary: {
          job_title: args.job_title,
          department: args.department,
          company: company || null,
          location: location || null,
          employment_type: empType,
          experience_level: expLevel,
          remote_policy: remotePolicy,
          responsibilities_count: args.responsibilities.length,
          required_qualifications_count: reqQuals.length,
          preferred_qualifications_count: prefQuals.length,
          skills_count: skills.length,
          benefits_count: benefits.length,
          has_eeo_statement: eeo,
        },
      }),
    };
  } catch (error) {
    return {
      toolCallId: toolCall.id,
      content: `Error generating job description: ${(error as Error).message}`,
      isError: true,
    };
  }
}

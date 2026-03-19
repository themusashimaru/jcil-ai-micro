/**
 * RESUME / COVER LETTER BUILDER TOOL
 *
 * Structured resume and cover letter builder. Opus fills structured data,
 * tool formats into clean, ATS-friendly output.
 *
 * Created: 2026-03-19
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

interface ExperienceEntry {
  company: string;
  title: string;
  start_date: string;
  end_date: string;
  highlights: string[];
}

interface EducationEntry {
  institution: string;
  degree: string;
  field: string;
  graduation_date: string;
  gpa?: string;
}

type ResumeArgs = {
  type: 'resume' | 'cover_letter';
  full_name: string;
  contact_email?: string;
  contact_phone?: string;
  location?: string;
  linkedin_url?: string;
  summary?: string;
  experience?: ExperienceEntry[];
  education?: EducationEntry[];
  skills?: string[];
  certifications?: string[];
  format?: string;
  target_role?: string;
  target_company?: string;
  cover_letter_body?: string;
};

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const resumeTool: UnifiedTool = {
  name: 'build_resume',
  description: `Build professional resumes and cover letters in clean, ATS-friendly formats.

Use this when:
- User wants help creating or formatting a resume/CV
- User needs a cover letter for a job application
- User wants to restructure their professional experience

Returns formatted document in Markdown, HTML, or plain text — ready to copy, print, or convert to PDF.`,
  parameters: {
    type: 'object',
    properties: {
      type: { type: 'string', enum: ['resume', 'cover_letter'], description: 'Document type' },
      full_name: { type: 'string', description: 'Full name' },
      contact_email: { type: 'string', description: 'Email address' },
      contact_phone: { type: 'string', description: 'Phone number' },
      location: { type: 'string', description: 'City, State' },
      linkedin_url: { type: 'string', description: 'LinkedIn profile URL' },
      summary: { type: 'string', description: 'Professional summary (2-3 sentences)' },
      experience: {
        type: 'array', description: 'Work experience entries',
        items: { type: 'object', properties: {
          company: { type: 'string' }, title: { type: 'string' },
          start_date: { type: 'string' }, end_date: { type: 'string' },
          highlights: { type: 'array', items: { type: 'string' } },
        }},
      },
      education: {
        type: 'array', description: 'Education entries',
        items: { type: 'object', properties: {
          institution: { type: 'string' }, degree: { type: 'string' },
          field: { type: 'string' }, graduation_date: { type: 'string' },
          gpa: { type: 'string' },
        }},
      },
      skills: { type: 'array', description: 'Skill keywords', items: { type: 'string' } },
      certifications: { type: 'array', description: 'Certifications', items: { type: 'string' } },
      format: { type: 'string', enum: ['markdown', 'html', 'plain_text'], description: 'Output format. Default: markdown' },
      target_role: { type: 'string', description: 'For cover letters — the target role' },
      target_company: { type: 'string', description: 'For cover letters — the company' },
      cover_letter_body: { type: 'string', description: 'For cover letters — body content' },
    },
    required: ['type', 'full_name'],
  },
};

export function isResumeAvailable(): boolean {
  return true;
}

// ============================================================================
// HELPERS
// ============================================================================

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function contactParts(a: ResumeArgs, html = false): string[] {
  const p: string[] = [];
  if (a.contact_email) p.push(html ? esc(a.contact_email) : a.contact_email);
  if (a.contact_phone) p.push(html ? esc(a.contact_phone) : a.contact_phone);
  if (a.location) p.push(html ? esc(a.location) : a.location);
  if (a.linkedin_url) p.push(html ? `<a href="${esc(a.linkedin_url)}" style="color:#2563eb;">LinkedIn</a>` : `[LinkedIn](${a.linkedin_url})`);
  return p;
}

// ============================================================================
// RESUME FORMATTERS
// ============================================================================

function resumeMarkdown(a: ResumeArgs): string {
  const l: string[] = [`# ${a.full_name}`];
  const c = contactParts(a);
  if (c.length) l.push(c.join(' | '));
  l.push('');
  if (a.summary) { l.push('## Professional Summary', a.summary, ''); }
  if (a.experience?.length) {
    l.push('## Experience');
    for (const e of a.experience as ExperienceEntry[]) {
      l.push(`### ${e.title} — ${e.company}`, `*${e.start_date} – ${e.end_date}*`);
      if (e.highlights?.length) for (const h of e.highlights) l.push(`- ${h}`);
      l.push('');
    }
  }
  if (a.education?.length) {
    l.push('## Education');
    for (const e of a.education as EducationEntry[]) {
      l.push(`**${e.degree} in ${e.field}** — ${e.institution}`);
      l.push(e.gpa ? `${e.graduation_date} | GPA: ${e.gpa}` : e.graduation_date, '');
    }
  }
  if (a.skills?.length) l.push('## Skills', a.skills.join(' · '), '');
  if (a.certifications?.length) { l.push('## Certifications'); for (const c of a.certifications) l.push(`- ${c}`); l.push(''); }
  return l.join('\n');
}

function resumePlainText(a: ResumeArgs): string {
  const l: string[] = [a.full_name.toUpperCase()];
  const c = contactParts(a);
  if (c.length) l.push(c.join(' | '));
  l.push('='.repeat(60));
  if (a.summary) l.push('', 'PROFESSIONAL SUMMARY', '-'.repeat(40), a.summary);
  if (a.experience?.length) {
    l.push('', 'EXPERIENCE', '-'.repeat(40));
    for (const e of a.experience as ExperienceEntry[]) {
      l.push(`${e.title} — ${e.company}`, `${e.start_date} – ${e.end_date}`);
      if (e.highlights?.length) for (const h of e.highlights) l.push(`  * ${h}`);
      l.push('');
    }
  }
  if (a.education?.length) {
    l.push('EDUCATION', '-'.repeat(40));
    for (const e of a.education as EducationEntry[]) {
      l.push(`${e.degree} in ${e.field} — ${e.institution}`);
      l.push(e.gpa ? `${e.graduation_date} | GPA: ${e.gpa}` : e.graduation_date, '');
    }
  }
  if (a.skills?.length) l.push('SKILLS', '-'.repeat(40), a.skills.join(', '), '');
  if (a.certifications?.length) { l.push('CERTIFICATIONS', '-'.repeat(40)); for (const c of a.certifications) l.push(`  * ${c}`); l.push(''); }
  return l.join('\n');
}

function resumeHtml(a: ResumeArgs): string {
  const s: string[] = [];
  const h2 = (t: string) => `<h2 style="font-size:16px;color:#1a1a1a;margin:16px 0 8px 0;text-transform:uppercase;letter-spacing:1px;">${t}</h2>`;
  s.push(`<h1 style="margin:0 0 4px 0;font-size:24px;color:#1a1a1a;">${esc(a.full_name)}</h1>`);
  const c = contactParts(a, true);
  if (c.length) s.push(`<p style="margin:0 0 16px 0;color:#555;font-size:14px;">${c.join(' &middot; ')}</p>`);
  s.push('<hr style="border:none;border-top:2px solid #1a1a1a;margin:8px 0 16px 0;">');
  if (a.summary) { s.push(h2('Professional Summary'), `<p style="margin:0 0 16px 0;line-height:1.5;">${esc(a.summary)}</p>`); }
  if (a.experience?.length) {
    s.push(h2('Experience'));
    for (const e of a.experience as ExperienceEntry[]) {
      s.push('<div style="margin-bottom:12px;">');
      s.push(`<p style="margin:0;font-weight:600;">${esc(e.title)} — ${esc(e.company)}</p>`);
      s.push(`<p style="margin:0 0 4px 0;color:#666;font-size:13px;">${esc(e.start_date)} – ${esc(e.end_date)}</p>`);
      if (e.highlights?.length) { s.push('<ul style="margin:4px 0 0 0;padding-left:20px;">'); for (const h of e.highlights) s.push(`<li style="margin-bottom:2px;">${esc(h)}</li>`); s.push('</ul>'); }
      s.push('</div>');
    }
  }
  if (a.education?.length) {
    s.push(h2('Education'));
    for (const e of a.education as EducationEntry[]) {
      s.push(`<p style="margin:0;font-weight:600;">${esc(e.degree)} in ${esc(e.field)} — ${esc(e.institution)}</p>`);
      s.push(`<p style="margin:0 0 8px 0;color:#666;font-size:13px;">${esc(e.graduation_date)}${e.gpa ? ` | GPA: ${esc(e.gpa)}` : ''}</p>`);
    }
  }
  if (a.skills?.length) { s.push(h2('Skills'), `<p style="margin:0 0 16px 0;">${a.skills.map(sk => esc(sk)).join(' &middot; ')}</p>`); }
  if (a.certifications?.length) { s.push(h2('Certifications'), '<ul style="margin:0;padding-left:20px;">'); for (const ct of a.certifications) s.push(`<li>${esc(ct)}</li>`); s.push('</ul>'); }
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:15px;color:#1a1a1a;max-width:700px;padding:24px;">\n${s.join('\n')}\n</div>`;
}

// ============================================================================
// COVER LETTER FORMATTERS
// ============================================================================

function coverLetterText(a: ResumeArgs, html: boolean): string {
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const paras = (a.cover_letter_body || '').split(/\n\n+/).filter(p => p.trim());

  if (html) {
    const s: string[] = [];
    s.push(`<p style="margin:0 0 16px 0;">${esc(today)}</p>`);
    if (a.target_company) s.push(`<p style="margin:0 0 16px 0;font-weight:600;">${esc(a.target_company)}</p>`);
    s.push('<p style="margin:0 0 16px 0;">Dear Hiring Manager,</p>');
    for (const p of paras) s.push(`<p style="margin:0 0 16px 0;line-height:1.6;">${esc(p)}</p>`);
    s.push(`<p style="margin:16px 0 4px 0;">Sincerely,</p>`);
    s.push(`<p style="margin:0;font-weight:600;">${esc(a.full_name)}</p>`);
    const cp = contactParts(a, true).slice(0, 2);
    if (cp.length) s.push(`<p style="margin:4px 0 0 0;color:#555;font-size:13px;">${cp.join(' &middot; ')}</p>`);
    return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:15px;color:#1a1a1a;max-width:700px;padding:24px;">\n${s.join('\n')}\n</div>`;
  }

  const l: string[] = [today, ''];
  if (a.target_company) l.push(a.target_company, '');
  l.push('Dear Hiring Manager,', '', paras.join('\n\n'), '', 'Sincerely,', a.full_name);
  const c = contactParts(a);
  if (c.length) l.push(c.join(' | '));
  return l.join('\n');
}

// ============================================================================
// TOOL EXECUTOR
// ============================================================================

export async function executeResume(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const args = toolCall.arguments as ResumeArgs;

  if (!args.type || !args.full_name) {
    return { toolCallId: toolCall.id, content: 'Error: Both type and full_name are required', isError: true };
  }

  try {
    const format = args.format || 'markdown';
    let document: string;

    if (args.type === 'resume') {
      document = format === 'html' ? resumeHtml(args) : format === 'plain_text' ? resumePlainText(args) : resumeMarkdown(args);
    } else {
      document = coverLetterText(args, format === 'html');
    }

    return {
      toolCallId: toolCall.id,
      content: JSON.stringify({
        success: true,
        documentType: args.type,
        format,
        document,
        metadata: {
          fullName: args.full_name,
          targetRole: args.target_role || null,
          targetCompany: args.target_company || null,
          experienceCount: args.experience?.length || 0,
          educationCount: args.education?.length || 0,
          skillCount: args.skills?.length || 0,
        },
      }),
    };
  } catch (error) {
    return { toolCallId: toolCall.id, content: `Error building ${args.type}: ${(error as Error).message}`, isError: true };
  }
}

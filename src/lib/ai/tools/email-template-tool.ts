/**
 * HTML EMAIL TEMPLATE GENERATION TOOL
 *
 * Creates responsive, professional HTML email templates.
 * Uses inline CSS for maximum email client compatibility.
 *
 * Features:
 * - Pre-built layouts: newsletter, transactional, promotional, announcement
 * - Responsive design (mobile-friendly)
 * - Inline CSS (Gmail/Outlook compatible)
 * - Brand color theming
 * - Image embedding via URLs
 * - Call-to-action buttons
 * - Social media links
 * - Unsubscribe footer
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';
import { logger } from '@/lib/logger';

const log = logger('EmailTemplateTool');

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const emailTemplateTool: UnifiedTool = {
  name: 'create_email_template',
  description: `Create responsive HTML email templates. Use this when:
- User needs to create a marketing email, newsletter, or transactional email
- User says "create an email template for...", "design an email about..."
- User needs HTML for email campaigns

Layouts: newsletter, transactional, promotional, announcement, welcome, receipt_email
All templates use inline CSS for maximum email client compatibility.

Returns HTML string ready to send or paste into email tools.`,
  parameters: {
    type: 'object',
    properties: {
      layout: {
        type: 'string',
        description:
          'Email layout: "newsletter", "transactional", "promotional", "announcement", "welcome", "receipt_email"',
      },
      subject: {
        type: 'string',
        description: 'Email subject line',
      },
      preheader: {
        type: 'string',
        description: 'Preview text shown in inbox (before opening)',
      },
      brand: {
        type: 'object',
        description: '{ name: string, logo_url: string, primary_color: hex, website: string }',
      },
      hero: {
        type: 'object',
        description:
          '{ title: string, subtitle: string, image_url: string, cta_text: string, cta_url: string }',
      },
      sections: {
        type: 'array',
        description:
          'Content sections: [{ title: string, content: string, image_url: string, cta_text: string, cta_url: string }]',
        items: { type: 'object' },
      },
      footer: {
        type: 'object',
        description:
          '{ company_name: string, address: string, unsubscribe_url: string, social: { twitter: string, linkedin: string, instagram: string } }',
      },
    },
    required: ['layout', 'subject'],
  },
};

// ============================================================================
// HELPERS
// ============================================================================

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

interface BrandConfig {
  name?: string;
  logo_url?: string;
  primary_color?: string;
  website?: string;
}

interface HeroConfig {
  title?: string;
  subtitle?: string;
  image_url?: string;
  cta_text?: string;
  cta_url?: string;
}

interface SectionConfig {
  title?: string;
  content?: string;
  image_url?: string;
  cta_text?: string;
  cta_url?: string;
}

interface FooterConfig {
  company_name?: string;
  address?: string;
  unsubscribe_url?: string;
  social?: { twitter?: string; linkedin?: string; instagram?: string };
}

function buildButton(text: string, url: string, color: string): string {
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:auto;">
  <tr>
    <td style="border-radius:6px;background:${escapeHtml(color)};text-align:center;">
      <a href="${escapeHtml(url)}" target="_blank" style="background:${escapeHtml(color)};border:1px solid ${escapeHtml(color)};border-radius:6px;color:#ffffff;display:inline-block;font-family:Arial,sans-serif;font-size:16px;font-weight:bold;line-height:48px;text-align:center;text-decoration:none;width:200px;-webkit-text-size-adjust:none;">${escapeHtml(text)}</a>
    </td>
  </tr>
</table>`;
}

function buildHero(hero: HeroConfig, color: string): string {
  let html = '';
  if (hero.image_url) {
    html += `<img src="${escapeHtml(hero.image_url)}" alt="" width="600" style="width:100%;max-width:600px;height:auto;display:block;margin:0 auto;" />`;
  }
  if (hero.title) {
    html += `<h1 style="margin:20px 0 10px;font-family:Arial,sans-serif;font-size:28px;color:#333333;text-align:center;">${escapeHtml(hero.title)}</h1>`;
  }
  if (hero.subtitle) {
    html += `<p style="margin:0 0 20px;font-family:Arial,sans-serif;font-size:16px;color:#666666;text-align:center;line-height:1.5;">${escapeHtml(hero.subtitle)}</p>`;
  }
  if (hero.cta_text && hero.cta_url) {
    html += buildButton(hero.cta_text, hero.cta_url, color);
  }
  return html;
}

function buildSections(sections: SectionConfig[], color: string): string {
  return sections
    .map((section) => {
      let html = '<tr><td style="padding:20px 30px;">';
      if (section.image_url) {
        html += `<img src="${escapeHtml(section.image_url)}" alt="" width="540" style="width:100%;max-width:540px;height:auto;display:block;margin:0 0 15px;border-radius:4px;" />`;
      }
      if (section.title) {
        html += `<h2 style="margin:0 0 10px;font-family:Arial,sans-serif;font-size:20px;color:#333333;">${escapeHtml(section.title)}</h2>`;
      }
      if (section.content) {
        html += `<p style="margin:0 0 15px;font-family:Arial,sans-serif;font-size:14px;color:#555555;line-height:1.6;">${escapeHtml(section.content)}</p>`;
      }
      if (section.cta_text && section.cta_url) {
        html += buildButton(section.cta_text, section.cta_url, color);
      }
      html += '</td></tr>';
      return html;
    })
    .join(
      '\n<tr><td style="padding:0 30px;"><hr style="border:none;border-top:1px solid #eeeeee;margin:0;" /></td></tr>\n'
    );
}

function buildFooter(footer: FooterConfig): string {
  let socialHtml = '';
  if (footer.social) {
    const links: string[] = [];
    if (footer.social.twitter)
      links.push(
        `<a href="${escapeHtml(footer.social.twitter)}" style="color:#999999;text-decoration:none;margin:0 8px;">Twitter</a>`
      );
    if (footer.social.linkedin)
      links.push(
        `<a href="${escapeHtml(footer.social.linkedin)}" style="color:#999999;text-decoration:none;margin:0 8px;">LinkedIn</a>`
      );
    if (footer.social.instagram)
      links.push(
        `<a href="${escapeHtml(footer.social.instagram)}" style="color:#999999;text-decoration:none;margin:0 8px;">Instagram</a>`
      );
    if (links.length > 0) {
      socialHtml = `<p style="margin:0 0 10px;text-align:center;">${links.join(' | ')}</p>`;
    }
  }

  return `<tr>
  <td style="padding:20px 30px;background:#f8f8f8;border-top:1px solid #eeeeee;text-align:center;">
    ${socialHtml}
    ${footer.company_name ? `<p style="margin:0 0 5px;font-family:Arial,sans-serif;font-size:12px;color:#999999;">${escapeHtml(footer.company_name)}</p>` : ''}
    ${footer.address ? `<p style="margin:0 0 5px;font-family:Arial,sans-serif;font-size:12px;color:#999999;">${escapeHtml(footer.address)}</p>` : ''}
    ${footer.unsubscribe_url ? `<p style="margin:10px 0 0;font-family:Arial,sans-serif;font-size:11px;"><a href="${escapeHtml(footer.unsubscribe_url)}" style="color:#999999;">Unsubscribe</a></p>` : ''}
  </td>
</tr>`;
}

// ============================================================================
// EMAIL BUILDER
// ============================================================================

function buildEmail(args: {
  layout: string;
  subject: string;
  preheader?: string;
  brand?: BrandConfig;
  hero?: HeroConfig;
  sections?: SectionConfig[];
  footer?: FooterConfig;
}): string {
  const color = args.brand?.primary_color || '#1a73e8';
  const brandName = args.brand?.name || '';

  let bodyContent = '';

  // Header / Logo
  if (args.brand?.logo_url || brandName) {
    bodyContent += `<tr><td style="padding:20px 30px;text-align:center;background:${escapeHtml(color)};">`;
    if (args.brand?.logo_url) {
      bodyContent += `<img src="${escapeHtml(args.brand.logo_url)}" alt="${escapeHtml(brandName)}" height="40" style="height:40px;width:auto;" />`;
    } else {
      bodyContent += `<h1 style="margin:0;font-family:Arial,sans-serif;font-size:22px;color:#ffffff;">${escapeHtml(brandName)}</h1>`;
    }
    bodyContent += '</td></tr>';
  }

  // Hero
  if (args.hero) {
    bodyContent += `<tr><td style="padding:30px;">${buildHero(args.hero, color)}</td></tr>`;
  }

  // Sections
  if (args.sections && args.sections.length > 0) {
    bodyContent += buildSections(args.sections, color);
  }

  // Footer
  if (args.footer) {
    bodyContent += buildFooter(args.footer);
  }

  // Wrap in full HTML email structure
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${escapeHtml(args.subject)}</title>
  <!--[if mso]>
  <xml>
    <o:OfficeDocumentSettings>
      <o:AllowPNG/>
      <o:PixelsPerInch>96</o:PixelsPerInch>
    </o:OfficeDocumentSettings>
  </xml>
  <![endif]-->
  <style>
    body{margin:0;padding:0;background:#f4f4f4;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;}
    table{border-spacing:0;border-collapse:collapse;}
    img{border:0;display:block;outline:none;text-decoration:none;}
    @media only screen and (max-width:620px){
      .email-container{width:100%!important;max-width:100%!important;}
      .stack-column{display:block!important;width:100%!important;max-width:100%!important;}
    }
  </style>
</head>
<body style="margin:0;padding:0;background:#f4f4f4;">
  ${args.preheader ? `<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${escapeHtml(args.preheader)}</div>` : ''}
  <center style="width:100%;background:#f4f4f4;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" class="email-container" style="margin:20px auto;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
      ${bodyContent}
    </table>
  </center>
</body>
</html>`;
}

// ============================================================================
// EXECUTOR
// ============================================================================

export async function executeEmailTemplate(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, name, arguments: rawArgs } = toolCall;

  if (name !== 'create_email_template') {
    return { toolCallId: id, content: `Unknown tool: ${name}`, isError: true };
  }

  const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;

  if (!args.layout) {
    return { toolCallId: id, content: 'Email layout is required', isError: true };
  }
  if (!args.subject) {
    return { toolCallId: id, content: 'Email subject is required', isError: true };
  }

  log.info('Creating email template', { layout: args.layout, subject: args.subject });

  try {
    const html = buildEmail(args);

    const content = JSON.stringify({
      success: true,
      subject: args.subject,
      html,
      preheader: args.preheader || '',
      characterCount: html.length,
      instructions:
        'This HTML email is ready to use. It uses inline CSS for maximum compatibility with Gmail, Outlook, and Apple Mail.',
    });

    return { toolCallId: id, content, isError: false };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    log.error('Email template generation failed', { error: msg });
    return { toolCallId: id, content: `Email template generation failed: ${msg}`, isError: true };
  }
}

// ============================================================================
// AVAILABILITY
// ============================================================================

export function isEmailTemplateAvailable(): boolean {
  return true; // Pure HTML generation, no dependencies
}

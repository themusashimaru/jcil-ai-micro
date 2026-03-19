/**
 * EMAIL DRAFT TOOL
 *
 * AI-structured email composition. Opus fills in the content via tool arguments,
 * the tool formats it cleanly with proper greeting, body, and sign-off based on tone.
 *
 * Supported tones: professional, casual, formal, friendly, follow_up, apologetic
 * Output formats: plain_text, html
 *
 * No external dependencies.
 *
 * Created: 2026-03-19
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// TONE CONFIGURATION
// ============================================================================

type Tone = 'professional' | 'casual' | 'formal' | 'friendly' | 'follow_up' | 'apologetic';

interface ToneConfig {
  greeting: (name?: string) => string;
  signOff: string;
}

const TONE_CONFIGS: Record<Tone, ToneConfig> = {
  professional: {
    greeting: (name) => (name ? `Dear ${name},` : 'Hello,'),
    signOff: 'Best regards,',
  },
  casual: {
    greeting: (name) => (name ? `Hey ${name},` : 'Hey,'),
    signOff: 'Cheers,',
  },
  formal: {
    greeting: (name) => (name ? `Dear ${name},` : 'Dear Sir or Madam,'),
    signOff: 'Sincerely,',
  },
  friendly: {
    greeting: (name) => (name ? `Hi ${name}!` : 'Hi there!'),
    signOff: 'All the best,',
  },
  follow_up: {
    greeting: (name) => (name ? `Hi ${name},` : 'Hi,'),
    signOff: 'Looking forward to hearing from you,',
  },
  apologetic: {
    greeting: (name) => (name ? `Dear ${name},` : 'Hello,'),
    signOff: 'With sincere apologies,',
  },
};

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const emailDraftTool: UnifiedTool = {
  name: 'draft_email',
  description: `Draft and format professional emails with tone control. Produces ready-to-send email text.

Use this when:
- User asks to write, draft, or compose an email
- User needs help with email wording or tone
- User wants a follow-up, apology, or formal business email

Returns formatted email text ready to copy into any email client.`,
  parameters: {
    type: 'object',
    properties: {
      subject: {
        type: 'string',
        description: 'Email subject line',
      },
      body: {
        type: 'string',
        description: 'The email body content',
      },
      tone: {
        type: 'string',
        enum: ['professional', 'casual', 'formal', 'friendly', 'follow_up', 'apologetic'],
        description: 'Tone of the email. Default: "professional"',
      },
      recipient_name: {
        type: 'string',
        description: "Recipient's name for the greeting",
      },
      sender_name: {
        type: 'string',
        description: "Sender's name for the sign-off",
      },
      format: {
        type: 'string',
        enum: ['plain_text', 'html'],
        description: 'Output format. Default: "plain_text"',
      },
      include_signature: {
        type: 'boolean',
        description: 'Whether to add a signature block. Default: true',
      },
    },
    required: ['subject', 'body'],
  },
};

// ============================================================================
// AVAILABILITY CHECK
// ============================================================================

export function isEmailDraftAvailable(): boolean {
  return true;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatBodyParagraphs(body: string): string[] {
  return body
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

function buildPlainText(params: {
  subject: string;
  greeting: string;
  paragraphs: string[];
  signOff: string;
  senderName?: string;
  includeSignature: boolean;
}): string {
  const lines: string[] = [];

  lines.push(`Subject: ${params.subject}`);
  lines.push('');
  lines.push(params.greeting);
  lines.push('');

  for (const paragraph of params.paragraphs) {
    lines.push(paragraph);
    lines.push('');
  }

  lines.push(params.signOff);
  if (params.senderName && params.includeSignature) {
    lines.push(params.senderName);
  }

  return lines.join('\n');
}

function buildHtml(params: {
  subject: string;
  greeting: string;
  paragraphs: string[];
  signOff: string;
  senderName?: string;
  includeSignature: boolean;
}): string {
  const bodyHtml = params.paragraphs
    .map((p) => `  <p style="margin: 0 0 16px 0; line-height: 1.6;">${escapeHtml(p)}</p>`)
    .join('\n');

  const signatureBlock = params.senderName && params.includeSignature
    ? `\n  <p style="margin: 16px 0 0 0; font-weight: 600;">${escapeHtml(params.senderName)}</p>`
    : '';

  return `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 15px; color: #1a1a1a; max-width: 600px;">
  <p style="margin: 0 0 16px 0; line-height: 1.6;">${escapeHtml(params.greeting)}</p>
${bodyHtml}
  <p style="margin: 16px 0 4px 0; line-height: 1.6;">${escapeHtml(params.signOff)}</p>${signatureBlock}
</div>`;
}

// ============================================================================
// TOOL EXECUTOR
// ============================================================================

export async function executeEmailDraft(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const args = toolCall.arguments as {
    subject: string;
    body: string;
    tone?: string;
    recipient_name?: string;
    sender_name?: string;
    format?: string;
    include_signature?: boolean;
  };

  // Validate required parameters
  if (!args.subject || !args.body) {
    return {
      toolCallId: toolCall.id,
      content: 'Error: Both subject and body are required',
      isError: true,
    };
  }

  try {
    const tone: Tone = (args.tone as Tone) || 'professional';
    const format = args.format || 'plain_text';
    const includeSignature = args.include_signature !== false;

    const toneConfig = TONE_CONFIGS[tone];
    if (!toneConfig) {
      return {
        toolCallId: toolCall.id,
        content: `Error: Invalid tone "${args.tone}". Valid tones: ${Object.keys(TONE_CONFIGS).join(', ')}`,
        isError: true,
      };
    }

    const greeting = toneConfig.greeting(args.recipient_name);
    const paragraphs = formatBodyParagraphs(args.body);
    const signOff = toneConfig.signOff;

    const formatParams = {
      subject: args.subject,
      greeting,
      paragraphs,
      signOff,
      senderName: args.sender_name,
      includeSignature,
    };

    const formattedEmail =
      format === 'html' ? buildHtml(formatParams) : buildPlainText(formatParams);

    return {
      toolCallId: toolCall.id,
      content: JSON.stringify({
        success: true,
        subject: args.subject,
        tone,
        format,
        email: formattedEmail,
        metadata: {
          recipientName: args.recipient_name || null,
          senderName: args.sender_name || null,
          includeSignature,
          paragraphCount: paragraphs.length,
        },
      }),
    };
  } catch (error) {
    return {
      toolCallId: toolCall.id,
      content: `Error drafting email: ${(error as Error).message}`,
      isError: true,
    };
  }
}

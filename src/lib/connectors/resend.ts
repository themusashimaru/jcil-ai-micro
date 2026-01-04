/**
 * RESEND EMAIL CONNECTOR
 * =======================
 *
 * Integration with Resend email API for:
 * - Transactional emails (magic links, password reset)
 * - Custom SMTP for Supabase Auth
 * - Marketing emails (newsletters, announcements)
 * - Email templates with React components
 *
 * Resend is a modern email API for developers with:
 * - 3,000 free emails/month
 * - React Email templates
 * - Webhooks for delivery status
 * - Custom domains
 *
 * @see https://resend.com/docs
 */

import type { Connector } from './types';

// ============================================================================
// TYPES
// ============================================================================

export interface ResendConnector extends Connector {
  type: 'resend';
  metadata?: {
    email?: string;
    domain?: string;
    verified?: boolean;
  };
}

export interface ResendEmailOptions {
  from: string;          // Sender email (must be verified domain)
  to: string | string[]; // Recipient(s)
  subject: string;
  html?: string;         // HTML content
  text?: string;         // Plain text content
  replyTo?: string;
  cc?: string | string[];
  bcc?: string | string[];
  attachments?: ResendAttachment[];
  tags?: { name: string; value: string }[];
}

export interface ResendAttachment {
  filename: string;
  content: string;      // Base64 encoded content
  path?: string;        // URL to attachment
}

export interface ResendEmailResult {
  success: boolean;
  id?: string;          // Email ID for tracking
  error?: string;
}

export interface ResendDomain {
  id: string;
  name: string;
  status: 'pending' | 'verified' | 'failed';
  createdAt: string;
  region: string;
}

export interface ResendApiKey {
  id: string;
  name: string;
  createdAt: string;
  permission: 'full_access' | 'sending_access';
}

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Get Resend API key from environment
 */
function getResendApiKey(): string | null {
  return process.env.RESEND_API_KEY || null;
}

/**
 * Check if Resend is configured
 */
export function isResendConfigured(): boolean {
  return !!getResendApiKey();
}

/**
 * Get default sender email from environment
 */
function getDefaultSender(): string {
  return process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Send an email using Resend API
 */
export async function sendEmail(options: ResendEmailOptions): Promise<ResendEmailResult> {
  const apiKey = getResendApiKey();
  if (!apiKey) {
    return {
      success: false,
      error: 'Resend API key not configured. Set RESEND_API_KEY environment variable.',
    };
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: options.from || getDefaultSender(),
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
        reply_to: options.replyTo,
        cc: options.cc,
        bcc: options.bcc,
        attachments: options.attachments,
        tags: options.tags,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.message || `Resend API error: ${response.status}`,
      };
    }

    return {
      success: true,
      id: data.id,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send email',
    };
  }
}

/**
 * Send a magic link email
 */
export async function sendMagicLinkEmail(
  to: string,
  magicLink: string,
  businessName: string = 'Your App'
): Promise<ResendEmailResult> {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sign in to ${businessName}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; width: 100%; border-collapse: collapse;">
          <tr>
            <td style="background: linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(6, 182, 212, 0.1) 100%); border-radius: 16px; padding: 40px;">
              <h1 style="color: #f1f5f9; font-size: 24px; font-weight: 600; margin: 0 0 20px 0; text-align: center;">
                ✨ Sign in to ${businessName}
              </h1>
              <p style="color: #94a3b8; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0; text-align: center;">
                Click the button below to securely sign in. This link expires in 1 hour.
              </p>
              <table role="presentation" style="width: 100%;">
                <tr>
                  <td align="center">
                    <a href="${magicLink}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%); color: white; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 16px;">
                      Sign in to ${businessName}
                    </a>
                  </td>
                </tr>
              </table>
              <p style="color: #64748b; font-size: 14px; margin: 30px 0 0 0; text-align: center;">
                If you didn't request this email, you can safely ignore it.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px; text-align: center;">
              <p style="color: #64748b; font-size: 12px; margin: 0;">
                This email was sent by ${businessName}.<br>
                Having trouble? Contact support.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  const text = `Sign in to ${businessName}\n\nClick this link to sign in: ${magicLink}\n\nThis link expires in 1 hour.\n\nIf you didn't request this email, you can safely ignore it.`;

  return sendEmail({
    from: getDefaultSender(),
    to,
    subject: `Sign in to ${businessName}`,
    html,
    text,
    tags: [{ name: 'type', value: 'magic-link' }],
  });
}

/**
 * Send a password reset email
 */
export async function sendPasswordResetEmail(
  to: string,
  resetLink: string,
  businessName: string = 'Your App'
): Promise<ResendEmailResult> {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset your password</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; width: 100%; border-collapse: collapse;">
          <tr>
            <td style="background: linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(6, 182, 212, 0.1) 100%); border-radius: 16px; padding: 40px;">
              <h1 style="color: #f1f5f9; font-size: 24px; font-weight: 600; margin: 0 0 20px 0; text-align: center;">
                🔑 Reset Your Password
              </h1>
              <p style="color: #94a3b8; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0; text-align: center;">
                We received a request to reset your password. Click the button below to create a new password.
              </p>
              <table role="presentation" style="width: 100%;">
                <tr>
                  <td align="center">
                    <a href="${resetLink}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%); color: white; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 16px;">
                      Reset Password
                    </a>
                  </td>
                </tr>
              </table>
              <p style="color: #64748b; font-size: 14px; margin: 30px 0 0 0; text-align: center;">
                This link expires in 1 hour. If you didn't request a password reset, you can ignore this email.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px; text-align: center;">
              <p style="color: #64748b; font-size: 12px; margin: 0;">
                This email was sent by ${businessName}.<br>
                Having trouble? Contact support.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  const text = `Reset Your Password\n\nWe received a request to reset your password. Click this link to create a new password: ${resetLink}\n\nThis link expires in 1 hour.\n\nIf you didn't request a password reset, you can ignore this email.`;

  return sendEmail({
    from: getDefaultSender(),
    to,
    subject: `Reset your ${businessName} password`,
    html,
    text,
    tags: [{ name: 'type', value: 'password-reset' }],
  });
}

/**
 * Send a welcome email after signup
 */
export async function sendWelcomeEmail(
  to: string,
  userName: string,
  businessName: string = 'Your App'
): Promise<ResendEmailResult> {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to ${businessName}!</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; width: 100%; border-collapse: collapse;">
          <tr>
            <td style="background: linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(6, 182, 212, 0.1) 100%); border-radius: 16px; padding: 40px;">
              <h1 style="color: #f1f5f9; font-size: 24px; font-weight: 600; margin: 0 0 20px 0; text-align: center;">
                🎉 Welcome to ${businessName}!
              </h1>
              <p style="color: #94a3b8; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0; text-align: center;">
                Hey ${userName}! We're thrilled to have you on board.
              </p>
              <p style="color: #94a3b8; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0; text-align: center;">
                Your account is all set up and ready to go. Here are a few things you can do to get started:
              </p>
              <table role="presentation" style="width: 100%; margin-bottom: 20px;">
                <tr>
                  <td style="padding: 12px; background: rgba(255,255,255,0.05); border-radius: 8px; margin-bottom: 8px;">
                    <p style="color: #f1f5f9; margin: 0; font-size: 14px;">
                      ✅ Complete your profile
                    </p>
                  </td>
                </tr>
                <tr><td style="height: 8px;"></td></tr>
                <tr>
                  <td style="padding: 12px; background: rgba(255,255,255,0.05); border-radius: 8px;">
                    <p style="color: #f1f5f9; margin: 0; font-size: 14px;">
                      ⚡ Explore features
                    </p>
                  </td>
                </tr>
                <tr><td style="height: 8px;"></td></tr>
                <tr>
                  <td style="padding: 12px; background: rgba(255,255,255,0.05); border-radius: 8px;">
                    <p style="color: #f1f5f9; margin: 0; font-size: 14px;">
                      📚 Check out our guides
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px; text-align: center;">
              <p style="color: #64748b; font-size: 12px; margin: 0;">
                You're receiving this because you signed up for ${businessName}.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  const text = `Welcome to ${businessName}!\n\nHey ${userName}! We're thrilled to have you on board.\n\nYour account is all set up and ready to go. Here are a few things you can do to get started:\n\n✅ Complete your profile\n⚡ Explore features\n📚 Check out our guides\n\nWelcome aboard!`;

  return sendEmail({
    from: getDefaultSender(),
    to,
    subject: `Welcome to ${businessName}! 🎉`,
    html,
    text,
    tags: [{ name: 'type', value: 'welcome' }],
  });
}

/**
 * Get domains from Resend account
 */
export async function getDomains(): Promise<ResendDomain[]> {
  const apiKey = getResendApiKey();
  if (!apiKey) return [];

  try {
    const response = await fetch('https://api.resend.com/domains', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) return [];

    const data = await response.json();
    return data.data || [];
  } catch {
    return [];
  }
}

/**
 * Get API key info to verify connection
 */
export async function getApiKeyInfo(): Promise<{ success: boolean; error?: string }> {
  const apiKey = getResendApiKey();
  if (!apiKey) {
    return { success: false, error: 'No API key configured' };
  }

  try {
    const response = await fetch('https://api.resend.com/api-keys', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      return { success: false, error: `API error: ${response.status}` };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Connection failed',
    };
  }
}

/**
 * Get Resend connection status
 */
export async function getResendConnectionStatus(): Promise<ResendConnector> {
  const isConfigured = isResendConfigured();

  if (!isConfigured) {
    return {
      type: 'resend',
      status: 'disconnected',
      displayName: 'Resend',
      icon: '📧',
      description: 'Send transactional emails (magic links, password reset)',
    };
  }

  // Verify the API key works
  const keyInfo = await getApiKeyInfo();

  if (!keyInfo.success) {
    return {
      type: 'resend',
      status: 'error',
      displayName: 'Resend',
      icon: '📧',
      description: keyInfo.error || 'Connection error',
    };
  }

  // Get domains to show verified status
  const domains = await getDomains();
  const verifiedDomain = domains.find(d => d.status === 'verified');

  return {
    type: 'resend',
    status: 'connected',
    displayName: 'Resend',
    icon: '📧',
    description: 'Send transactional emails (magic links, password reset)',
    connectedAt: new Date().toISOString(),
    metadata: {
      domain: verifiedDomain?.name,
      verified: !!verifiedDomain,
    },
  };
}

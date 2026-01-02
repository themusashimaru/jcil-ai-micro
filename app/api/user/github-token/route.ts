/**
 * GITHUB TOKEN API
 * ================
 *
 * Securely stores and retrieves user's GitHub Personal Access Token.
 * Tokens are encrypted with AES-256-GCM before storage.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import crypto from 'crypto';

export const runtime = 'nodejs';

// Get encryption key (32 bytes for AES-256)
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  // Hash the key to ensure it's exactly 32 bytes
  return crypto.createHash('sha256').update(key).digest();
}

// Encrypt token using AES-256-GCM
function encryptToken(token: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(16); // 16 bytes IV for GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  let encrypted = cipher.update(token, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  // Combine IV + authTag + encrypted data
  return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
}

// Decrypt token
function decryptToken(encryptedData: string): string {
  try {
    const parts = encryptedData.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted format');
    }

    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];

    const key = getEncryptionKey();
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    console.error('[GitHub Token] Decryption error:', error);
    throw new Error('Failed to decrypt token');
  }
}

async function getUser() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Ignore
          }
        },
      },
    }
  );

  const { data: { user }, error } = await supabase.auth.getUser();
  return { user, error };
}

/**
 * GET - Check if user has a GitHub token stored
 */
export async function GET() {
  const { user, error } = await getUser();

  if (error || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  // Use service role to read from users table
  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: userData } = await adminClient
    .from('users')
    .select('github_token, github_username')
    .eq('id', user.id)
    .single();

  if (userData?.github_token) {
    // Verify the token is still valid by making a test request
    const token = decryptToken(userData.github_token);
    try {
      const response = await fetch('https://api.github.com/user', {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3+json',
        },
      });

      if (response.ok) {
        const ghUser = await response.json();
        return NextResponse.json({
          connected: true,
          username: ghUser.login,
          avatarUrl: ghUser.avatar_url,
        });
      } else {
        // Token is invalid, clear it
        await adminClient
          .from('users')
          .update({ github_token: null, github_username: null })
          .eq('id', user.id);

        return NextResponse.json({ connected: false, error: 'Token expired or invalid' });
      }
    } catch {
      return NextResponse.json({ connected: false, error: 'Failed to verify token' });
    }
  }

  return NextResponse.json({ connected: false });
}

/**
 * POST - Save GitHub token
 */
export async function POST(request: NextRequest) {
  const { user, error } = await getUser();

  if (error || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const body = await request.json();
  const { token } = body;

  if (!token) {
    return NextResponse.json({ error: 'Token required' }, { status: 400 });
  }

  // Validate the token by making a test request
  try {
    const response = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[GitHub Token] Validation failed:', errorText);
      return NextResponse.json({
        error: 'Invalid token. Make sure it has the "repo" scope.',
        details: response.status === 401 ? 'Token is invalid or expired' : 'GitHub API error'
      }, { status: 400 });
    }

    const ghUser = await response.json();

    // Check if token has repo scope by trying to list repos
    const reposResponse = await fetch('https://api.github.com/user/repos?per_page=1', {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!reposResponse.ok) {
      return NextResponse.json({
        error: 'Token needs "repo" scope to push code',
      }, { status: 400 });
    }

    // Store encrypted token
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const encryptedToken = encryptToken(token);

    const { error: updateError } = await adminClient
      .from('users')
      .update({
        github_token: encryptedToken,
        github_username: ghUser.login,
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('[GitHub Token] Save error:', updateError);
      return NextResponse.json({ error: 'Failed to save token' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      username: ghUser.login,
      avatarUrl: ghUser.avatar_url,
    });

  } catch (err) {
    console.error('[GitHub Token] Error:', err);
    return NextResponse.json({ error: 'Failed to validate token' }, { status: 500 });
  }
}

/**
 * DELETE - Remove GitHub token
 */
export async function DELETE() {
  const { user, error } = await getUser();

  if (error || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  await adminClient
    .from('users')
    .update({ github_token: null, github_username: null })
    .eq('id', user.id);

  return NextResponse.json({ success: true });
}

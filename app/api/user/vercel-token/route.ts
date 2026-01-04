/**
 * VERCEL TOKEN API
 * ================
 *
 * Securely stores and retrieves user's Vercel API Token.
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
    console.error('[Vercel Token] Decryption error:', error);
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
 * GET - Check if user has a Vercel token stored
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
    .select('vercel_token, vercel_username, vercel_team_id')
    .eq('id', user.id)
    .single();

  if (userData?.vercel_token) {
    // Verify the token is still valid by making a test request
    const token = decryptToken(userData.vercel_token);
    try {
      const response = await fetch('https://api.vercel.com/v2/user', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const vercelUser = await response.json();
        return NextResponse.json({
          connected: true,
          username: vercelUser.user?.username || vercelUser.user?.name || userData.vercel_username,
          email: vercelUser.user?.email,
          teamId: userData.vercel_team_id,
        });
      } else {
        // Token is invalid, clear it
        await adminClient
          .from('users')
          .update({ vercel_token: null, vercel_username: null, vercel_team_id: null })
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
 * POST - Save Vercel token
 */
export async function POST(request: NextRequest) {
  const { user, error } = await getUser();

  if (error || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const body = await request.json();
  const { token, teamId } = body;

  if (!token) {
    return NextResponse.json({ error: 'Token required' }, { status: 400 });
  }

  // Validate the token by making a test request
  try {
    const response = await fetch('https://api.vercel.com/v2/user', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Vercel Token] Validation failed:', errorText);
      return NextResponse.json({
        error: 'Invalid token. Make sure it has deployment permissions.',
        details: response.status === 401 ? 'Token is invalid or expired' : 'Vercel API error'
      }, { status: 400 });
    }

    const vercelUser = await response.json();

    // Verify token has deployment capabilities by checking projects
    const projectsResponse = await fetch('https://api.vercel.com/v9/projects?limit=1', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!projectsResponse.ok) {
      return NextResponse.json({
        error: 'Token needs deployment permissions',
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
        vercel_token: encryptedToken,
        vercel_username: vercelUser.user?.username || vercelUser.user?.name || vercelUser.user?.email,
        vercel_team_id: teamId || null,
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('[Vercel Token] Save error:', updateError);
      return NextResponse.json({ error: 'Failed to save token' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      username: vercelUser.user?.username || vercelUser.user?.name,
      email: vercelUser.user?.email,
    });

  } catch (err) {
    console.error('[Vercel Token] Error:', err);
    return NextResponse.json({ error: 'Failed to validate token' }, { status: 500 });
  }
}

/**
 * DELETE - Remove Vercel token
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
    .update({ vercel_token: null, vercel_username: null, vercel_team_id: null })
    .eq('id', user.id);

  return NextResponse.json({ success: true });
}


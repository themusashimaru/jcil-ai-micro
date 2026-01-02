/**
 * CONNECTORS API ROUTE
 * ====================
 *
 * Manages user's external service connections.
 * GET: Get connection status for all connectors
 * POST: Perform connector operations (list repos, push code, etc.)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import crypto from 'crypto';
import {
  listUserRepos,
  createRepository,
  pushFiles,
  isConnectorsEnabled,
} from '@/lib/connectors';

export const runtime = 'nodejs';

// Get encryption key (32 bytes for AES-256)
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  return crypto.createHash('sha256').update(key).digest();
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
    console.error('[Connectors] Decryption error:', error);
    throw new Error('Failed to decrypt token');
  }
}

/**
 * Get GitHub token from database (stored via Personal Access Token)
 */
async function getGitHubToken(): Promise<{
  token: string | null;
  userId: string | null;
  username: string | null;
  error?: string;
}> {
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
            // Ignore errors in read-only contexts
          }
        },
      },
    }
  );

  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    return { token: null, userId: null, username: null, error: 'Not authenticated' };
  }

  // Get token from database
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

  if (!userData?.github_token) {
    return { token: null, userId: user.id, username: null, error: 'GitHub not connected. Add your Personal Access Token in Connectors.' };
  }

  try {
    const decryptedToken = decryptToken(userData.github_token);
    return {
      token: decryptedToken,
      userId: user.id,
      username: userData.github_username,
    };
  } catch {
    return { token: null, userId: user.id, username: null, error: 'Failed to decrypt GitHub token' };
  }
}

/**
 * GET - Get connector statuses
 */
export async function GET(request: NextRequest) {
  if (!isConnectorsEnabled()) {
    return NextResponse.json({ error: 'Connectors not enabled' }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'status';

  const { token, userId, username, error } = await getGitHubToken();

  if (!userId) {
    return NextResponse.json({ error: error || 'Not authenticated' }, { status: 401 });
  }

  try {
    switch (action) {
      case 'status': {
        // Return GitHub connection status
        const connectors = [
          {
            type: 'github',
            status: token ? 'connected' : 'disconnected',
            displayName: 'GitHub',
            icon: '🐙',
            description: 'Push code to repositories',
            metadata: token ? { username } : undefined,
          },
        ];
        return NextResponse.json({ connectors });
      }

      case 'github-status': {
        if (!token) {
          return NextResponse.json({
            connected: false,
            error: error || 'GitHub not connected',
          });
        }

        return NextResponse.json({
          connected: true,
          username,
        });
      }

      case 'github-repos': {
        if (!token) {
          return NextResponse.json({ error: error || 'GitHub not connected' }, { status: 400 });
        }

        const repos = await listUserRepos(token);
        return NextResponse.json({ repos });
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (err) {
    console.error('[Connectors API] Error:', err);
    return NextResponse.json({ error: 'Connector operation failed' }, { status: 500 });
  }
}

/**
 * POST - Perform connector operations
 */
export async function POST(request: NextRequest) {
  if (!isConnectorsEnabled()) {
    return NextResponse.json({ error: 'Connectors not enabled' }, { status: 503 });
  }

  const { token, userId, error } = await getGitHubToken();

  if (!userId) {
    return NextResponse.json({ error: error || 'Not authenticated' }, { status: 401 });
  }

  if (!token) {
    return NextResponse.json({
      error: error || 'GitHub not connected. Add your Personal Access Token in Connectors.',
    }, { status: 400 });
  }

  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'listRepos': {
        const repos = await listUserRepos(token);
        return NextResponse.json({ repos });
      }

      case 'pushFiles':
      case 'push-files': {
        const { owner, repo, branch, message, files } = body;

        if (!owner || !repo || !message || !files || files.length === 0) {
          return NextResponse.json({
            error: 'owner, repo, message, and files required',
          }, { status: 400 });
        }

        const result = await pushFiles(token, {
          owner,
          repo,
          branch,
          message,
          files,
        });

        if (!result.success) {
          return NextResponse.json({ error: result.error || 'Push failed' }, { status: 500 });
        }

        return NextResponse.json({
          success: true,
          commitSha: result.commitSha,
          repoUrl: result.repoUrl,
        });
      }

      case 'create-repo': {
        const { name, description, isPrivate } = body;

        if (!name) {
          return NextResponse.json({ error: 'Repository name required' }, { status: 400 });
        }

        const repo = await createRepository(token, {
          name,
          description,
          private: isPrivate,
          autoInit: true,
        });

        if (!repo) {
          return NextResponse.json({ error: 'Failed to create repository' }, { status: 500 });
        }

        return NextResponse.json({ success: true, repo });
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (err) {
    console.error('[Connectors API] Error:', err);
    return NextResponse.json({ error: 'Connector operation failed' }, { status: 500 });
  }
}

/**
 * CODEBASE INDEX API
 *
 * Endpoints for indexing and managing codebase indexes.
 * - POST: Index a repository
 * - GET: Check index status
 * - DELETE: Remove an index
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server-auth';
import { createClient } from '@supabase/supabase-js';
import { indexCodebase, hasCodebaseIndex, deleteCodebaseIndex } from '@/lib/codebase-rag';
import crypto from 'crypto';

// Get encryption key
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  return crypto.createHash('sha256').update(key).digest();
}

// Decrypt token
function decryptToken(encryptedData: string): string {
  try {
    const parts = encryptedData.split(':');
    if (parts.length !== 3) return '';
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];
    const key = getEncryptionKey();
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch {
    return '';
  }
}

/**
 * GET - Check index status for a repo
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const owner = searchParams.get('owner');
    const repo = searchParams.get('repo');

    if (!owner || !repo) {
      return NextResponse.json({ error: 'Missing owner or repo' }, { status: 400 });
    }

    const status = await hasCodebaseIndex(user.id, owner, repo);

    return NextResponse.json(status);
  } catch (error) {
    console.error('[Codebase Index API] GET error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

/**
 * POST - Index a repository
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { owner, repo, branch = 'main' } = body;

    if (!owner || !repo) {
      return NextResponse.json({ error: 'Missing owner or repo' }, { status: 400 });
    }

    // Get GitHub token
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: userData } = await adminClient
      .from('users')
      .select('github_token')
      .eq('id', user.id)
      .single();

    if (!userData?.github_token) {
      return NextResponse.json({ error: 'GitHub not connected' }, { status: 400 });
    }

    const githubToken = decryptToken(userData.github_token);
    if (!githubToken) {
      return NextResponse.json({ error: 'Invalid GitHub token' }, { status: 400 });
    }

    // Fetch repository tree
    console.log(`[Codebase Index API] Fetching tree for ${owner}/${repo}:${branch}`);

    const treeResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`,
      {
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: 'application/vnd.github.v3+json',
        },
      }
    );

    if (!treeResponse.ok) {
      return NextResponse.json({ error: 'Failed to fetch repo tree' }, { status: 400 });
    }

    const treeData = await treeResponse.json();

    // Filter for files (not trees/directories)
    const files = treeData.tree.filter((item: { type: string; size?: number }) =>
      item.type === 'blob' && (item.size || 0) < 100000 // Skip files > 100KB
    );

    console.log(`[Codebase Index API] Found ${files.length} files`);

    // Fetch file contents (limit to prevent rate limiting)
    const maxFiles = 200; // Limit for performance
    const filesToIndex = files.slice(0, maxFiles);

    const fileContents: Array<{ path: string; content: string; sha: string }> = [];

    // Fetch in batches
    const batchSize = 10;
    for (let i = 0; i < filesToIndex.length; i += batchSize) {
      const batch = filesToIndex.slice(i, i + batchSize);

      const contents = await Promise.all(
        batch.map(async (file: { path: string; sha: string }) => {
          try {
            const contentResponse = await fetch(
              `https://api.github.com/repos/${owner}/${repo}/contents/${file.path}?ref=${branch}`,
              {
                headers: {
                  Authorization: `Bearer ${githubToken}`,
                  Accept: 'application/vnd.github.v3+json',
                },
              }
            );

            if (!contentResponse.ok) return null;

            const contentData = await contentResponse.json();

            // Decode base64 content
            const content = Buffer.from(contentData.content || '', 'base64').toString('utf-8');

            return {
              path: file.path,
              content,
              sha: file.sha,
            };
          } catch {
            return null;
          }
        })
      );

      fileContents.push(...contents.filter(Boolean) as typeof fileContents);

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`[Codebase Index API] Fetched ${fileContents.length} file contents`);

    // Index the codebase
    const result = await indexCodebase(user.id, owner, repo, branch, fileContents);

    if (result.success) {
      return NextResponse.json({
        success: true,
        indexId: result.indexId,
        filesIndexed: fileContents.length,
      });
    } else {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }
  } catch (error) {
    console.error('[Codebase Index API] POST error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

/**
 * DELETE - Remove an index
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const owner = searchParams.get('owner');
    const repo = searchParams.get('repo');

    if (!owner || !repo) {
      return NextResponse.json({ error: 'Missing owner or repo' }, { status: 400 });
    }

    const result = await deleteCodebaseIndex(user.id, owner, repo);

    return NextResponse.json(result);
  } catch (error) {
    console.error('[Codebase Index API] DELETE error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

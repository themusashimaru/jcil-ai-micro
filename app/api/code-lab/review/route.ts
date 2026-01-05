/**
 * CODE REVIEW API
 *
 * Endpoints for AI-powered code review of GitHub PRs.
 * - POST: Review a PR
 * - GET: Get PR info
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server-auth';
import { createClient } from '@supabase/supabase-js';
import {
  fetchPRInfo,
  fetchPRDiff,
  reviewPR,
  formatReviewAsMarkdown,
  postReviewToGitHub,
} from '@/lib/code-review';
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
 * GET - Get PR info without reviewing
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
    const prNumber = searchParams.get('pr');

    if (!owner || !repo || !prNumber) {
      return NextResponse.json({ error: 'Missing owner, repo, or pr number' }, { status: 400 });
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

    // Fetch PR info
    const prInfo = await fetchPRInfo(owner, repo, parseInt(prNumber), githubToken);

    if (!prInfo) {
      return NextResponse.json({ error: 'PR not found' }, { status: 404 });
    }

    return NextResponse.json({ pr: prInfo });
  } catch (error) {
    console.error('[Review API] GET error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

/**
 * POST - Review a PR
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      owner,
      repo,
      prNumber,
      options = {},
      postToGitHub = false,
    } = body;

    if (!owner || !repo || !prNumber) {
      return NextResponse.json({ error: 'Missing owner, repo, or prNumber' }, { status: 400 });
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

    console.log(`[Review API] Reviewing PR #${prNumber} in ${owner}/${repo}`);

    // Fetch PR info
    const prInfo = await fetchPRInfo(owner, repo, prNumber, githubToken);
    if (!prInfo) {
      return NextResponse.json({ error: 'PR not found' }, { status: 404 });
    }

    // Fetch PR diff
    const diffs = await fetchPRDiff(owner, repo, prNumber, githubToken);
    if (diffs.length === 0) {
      return NextResponse.json({ error: 'No changes found in PR' }, { status: 400 });
    }

    // Perform review
    const review = await reviewPR(prInfo, diffs, options);

    // Format as markdown
    const markdown = formatReviewAsMarkdown(review, prInfo);

    // Post to GitHub if requested
    let postedToGitHub = false;
    if (postToGitHub) {
      postedToGitHub = await postReviewToGitHub(owner, repo, prNumber, review, githubToken);
    }

    return NextResponse.json({
      review,
      markdown,
      pr: prInfo,
      postedToGitHub,
    });
  } catch (error) {
    console.error('[Review API] POST error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

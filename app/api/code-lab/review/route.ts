/**
 * CODE REVIEW API
 *
 * Endpoints for AI-powered code review of GitHub PRs.
 * - POST: Review a PR
 * - GET: Get PR info
 */

import { NextRequest } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server-auth';
import { logger } from '@/lib/logger';
import { validateCSRF } from '@/lib/security/csrf';
import { rateLimiters } from '@/lib/security/rate-limit';
import { successResponse, errors } from '@/lib/api/utils';

export const runtime = 'nodejs';
export const maxDuration = 180;
import { createClient } from '@supabase/supabase-js';

const log = logger('CodeLabReview');
import {
  fetchPRInfo,
  fetchPRDiff,
  reviewPR,
  formatReviewAsMarkdown,
  postReviewToGitHub,
} from '@/lib/code-review';
// SECURITY FIX: Use centralized crypto module which requires dedicated ENCRYPTION_KEY
// (no fallback to SERVICE_ROLE_KEY for separation of concerns)
import { safeDecrypt } from '@/lib/security/crypto';

// Decrypt token - wrapper for backward compatibility (returns empty string on failure)
function decryptToken(encryptedData: string): string {
  return safeDecrypt(encryptedData) || '';
}

/**
 * GET - Get PR info without reviewing
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return errors.unauthorized();
    }

    const searchParams = request.nextUrl.searchParams;
    const owner = searchParams.get('owner');
    const repo = searchParams.get('repo');
    const prNumber = searchParams.get('pr');

    if (!owner || !repo || !prNumber) {
      return errors.badRequest('Missing owner, repo, or pr number');
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
      return errors.badRequest('GitHub not connected');
    }

    const githubToken = decryptToken(userData.github_token);
    if (!githubToken) {
      return errors.badRequest('Invalid GitHub token');
    }

    // Fetch PR info
    const prInfo = await fetchPRInfo(owner, repo, parseInt(prNumber), githubToken);

    if (!prInfo) {
      return errors.notFound('PR');
    }

    return successResponse({ pr: prInfo });
  } catch (error) {
    log.error('[Review API] GET error:', error instanceof Error ? error : { error });
    return errors.serverError('Internal error');
  }
}

/**
 * POST - Review a PR
 */
export async function POST(request: NextRequest) {
  // CSRF protection
  const csrfCheck = validateCSRF(request);
  if (!csrfCheck.valid) return csrfCheck.response!;

  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return errors.unauthorized();
    }

    // Rate limiting
    const rateLimit = await rateLimiters.codeLabEdit(user.id);
    if (!rateLimit.allowed) {
      return errors.rateLimited(rateLimit.retryAfter);
    }

    const body = await request.json();
    const { owner, repo, prNumber, options = {}, postToGitHub = false } = body;

    if (!owner || !repo || !prNumber) {
      return errors.badRequest('Missing owner, repo, or prNumber');
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
      return errors.badRequest('GitHub not connected');
    }

    const githubToken = decryptToken(userData.github_token);
    if (!githubToken) {
      return errors.badRequest('Invalid GitHub token');
    }

    log.info(`[Review API] Reviewing PR #${prNumber} in ${owner}/${repo}`);

    // Fetch PR info
    const prInfo = await fetchPRInfo(owner, repo, prNumber, githubToken);
    if (!prInfo) {
      return errors.notFound('PR');
    }

    // Fetch PR diff
    const diffs = await fetchPRDiff(owner, repo, prNumber, githubToken);
    if (diffs.length === 0) {
      return errors.badRequest('No changes found in PR');
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

    return successResponse({
      review,
      markdown,
      pr: prInfo,
      postedToGitHub,
    });
  } catch (error) {
    log.error('[Review API] POST error:', error instanceof Error ? error : { error });
    return errors.serverError('Internal error');
  }
}

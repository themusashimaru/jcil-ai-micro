/**
 * CODE LAB GIT API
 *
 * Git operations - clone, push, pull, commit, branch management
 * Integrates GitHubSyncBridge with E2B workspace
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { validateCSRF } from '@/lib/security/csrf';
import { rateLimiters } from '@/lib/security/rate-limit';

export const runtime = 'nodejs';
export const maxDuration = 60;
import { getContainerManager } from '@/lib/workspace/container';
import { GitHubSyncBridge } from '@/lib/workspace/github-sync';
import { sanitizeCommitMessage } from '@/lib/workspace/security';
// SECURITY FIX: Use centralized crypto module which requires dedicated ENCRYPTION_KEY
// (no fallback to SERVICE_ROLE_KEY for separation of concerns)
import { decrypt as decryptToken } from '@/lib/security/crypto';

type GitOperation =
  | 'clone'
  | 'push'
  | 'pull'
  | 'status'
  | 'commit'
  | 'branch'
  | 'checkout'
  | 'diff';

export async function POST(request: NextRequest) {
  // CSRF protection
  const csrfCheck = validateCSRF(request);
  if (!csrfCheck.valid) return csrfCheck.response!;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Rate limiting
  const rateLimit = await rateLimiters.codeLabEdit(user.id);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded', retryAfter: rateLimit.retryAfter },
      { status: 429 }
    );
  }

  try {
    const { sessionId, operation, repo, message, branch } = (await request.json()) as {
      sessionId: string;
      operation: GitOperation;
      repo?: { owner: string; name: string; branch?: string };
      message?: string;
      branch?: string;
    };

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 });
    }

    // Verify session ownership
    const { data: sessionData, error: sessionError } = await supabase
      .from('code_lab_sessions')
      .select('id')
      .eq('id', sessionId)
      .eq('user_id', user.id)
      .single();

    if (sessionError || !sessionData) {
      return NextResponse.json({ error: 'Session not found or access denied' }, { status: 403 });
    }

    // Get user's GitHub token
    const { data: userData } = await supabase
      .from('users')
      .select('github_token')
      .eq('id', user.id)
      .single();

    const userTokens = userData as { github_token?: string } | null;

    if (!userTokens?.github_token) {
      return NextResponse.json(
        { error: 'GitHub not connected. Please connect your GitHub account.' },
        { status: 400 }
      );
    }

    let githubToken: string;
    try {
      githubToken = decryptToken(userTokens.github_token);
    } catch {
      // SECURITY FIX: Don't log error details - could expose encryption info
      log.warn('Token decryption failed for user', { userId: user.id });
      return NextResponse.json(
        {
          error: 'GitHub token decryption failed. Please reconnect your GitHub account.',
          code: 'TOKEN_DECRYPT_FAILED',
        },
        { status: 400 }
      );
    }

    // Initialize container
    const container = getContainerManager();

    // Create shell executor function for GitHubSyncBridge
    const executeShell = async (cmd: string) => {
      const result = await container.executeCommand(sessionId, cmd);
      return {
        stdout: result.stdout || '',
        stderr: result.stderr || '',
        exitCode: result.exitCode ?? 0,
      };
    };

    // Initialize GitHub sync bridge
    const syncBridge = new GitHubSyncBridge(githubToken, sessionId);

    switch (operation) {
      case 'clone': {
        if (!repo) {
          return NextResponse.json({ error: 'Repository info required' }, { status: 400 });
        }

        // Connect to repo
        await syncBridge.connect(repo.owner, repo.name);

        // Clone into workspace
        const cloneResult = await syncBridge.cloneToWorkspace(executeShell);

        if (!cloneResult.success) {
          return NextResponse.json({ error: cloneResult.error }, { status: 500 });
        }

        return NextResponse.json({
          success: true,
          filesChanged: cloneResult.filesChanged,
          commitSha: cloneResult.commitSha,
        });
      }

      case 'push': {
        if (!repo) {
          return NextResponse.json({ error: 'Repository info required' }, { status: 400 });
        }

        await syncBridge.connect(repo.owner, repo.name);

        const pushResult = await syncBridge.pushChanges(
          executeShell,
          message || `Code Lab: Changes from ${new Date().toLocaleString()}`
        );

        if (!pushResult.success) {
          return NextResponse.json({ error: pushResult.error }, { status: 500 });
        }

        // Get diff for UI
        const diffResult = await executeShell(
          'cd /workspace/repo && git diff HEAD~1 --name-status 2>/dev/null || echo ""'
        );

        const diff = parseDiffOutput(diffResult.stdout);

        return NextResponse.json({
          success: true,
          filesChanged: pushResult.filesChanged,
          commitSha: pushResult.commitSha,
          diff,
        });
      }

      case 'pull': {
        if (!repo) {
          return NextResponse.json({ error: 'Repository info required' }, { status: 400 });
        }

        await syncBridge.connect(repo.owner, repo.name);

        const pullResult = await syncBridge.pullChanges(executeShell);

        if (!pullResult.success) {
          return NextResponse.json({ error: pullResult.error }, { status: 500 });
        }

        return NextResponse.json({
          success: true,
          filesChanged: pullResult.filesChanged,
          commitSha: pullResult.commitSha,
        });
      }

      case 'status': {
        if (!repo) {
          return NextResponse.json({ error: 'Repository info required' }, { status: 400 });
        }

        await syncBridge.connect(repo.owner, repo.name);

        const status = await syncBridge.getSyncStatus(executeShell);

        return NextResponse.json({ status });
      }

      case 'commit': {
        // Sanitize commit message to prevent command injection
        const safeMessage = sanitizeCommitMessage(message || 'Update');
        const commitResult = await executeShell(
          `cd /workspace/repo && git add -A && git commit -m '${safeMessage}'`
        );

        return NextResponse.json({
          success: commitResult.exitCode === 0,
          output: commitResult.stdout,
          error: commitResult.stderr,
        });
      }

      case 'branch': {
        if (!branch) {
          return NextResponse.json({ error: 'Branch name required' }, { status: 400 });
        }

        if (!repo) {
          return NextResponse.json({ error: 'Repository info required' }, { status: 400 });
        }

        await syncBridge.connect(repo.owner, repo.name);

        const created = await syncBridge.createBranch(branch, executeShell);

        return NextResponse.json({ success: created, branch });
      }

      case 'checkout': {
        if (!branch) {
          return NextResponse.json({ error: 'Branch name required' }, { status: 400 });
        }

        if (!repo) {
          return NextResponse.json({ error: 'Repository info required' }, { status: 400 });
        }

        await syncBridge.connect(repo.owner, repo.name);

        const switched = await syncBridge.switchBranch(branch, executeShell);

        return NextResponse.json({ success: switched, branch });
      }

      case 'diff': {
        const diffResult = await executeShell(
          'cd /workspace/repo && git diff --unified=3 2>/dev/null || echo ""'
        );

        return NextResponse.json({
          diff: diffResult.stdout,
        });
      }

      default:
        return NextResponse.json({ error: 'Invalid operation' }, { status: 400 });
    }
  } catch (error) {
    console.error('[Git API] Error:', error);
    return NextResponse.json({ error: 'Git operation failed' }, { status: 500 });
  }
}

// Helper: Parse git diff --name-status output
function parseDiffOutput(output: string): { path: string; status: string }[] {
  if (!output.trim()) return [];

  return output
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [status, ...pathParts] = line.split('\t');
      return {
        status: status === 'A' ? 'added' : status === 'D' ? 'deleted' : 'modified',
        path: pathParts.join('\t'),
      };
    });
}

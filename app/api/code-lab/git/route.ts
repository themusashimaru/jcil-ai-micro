/**
 * CODE LAB GIT API
 *
 * Git operations - clone, push, pull, commit, branch management
 * Integrates GitHubSyncBridge with E2B workspace
 */

import { NextRequest } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';
import { validateCSRF } from '@/lib/security/csrf';
import { rateLimiters } from '@/lib/security/rate-limit';
import { logger } from '@/lib/logger';
import { successResponse, errors } from '@/lib/api/utils';

const log = logger('CodeLabGit');

export const runtime = 'nodejs';
export const maxDuration = 60;
import { getContainerManager } from '@/lib/workspace/container';
import { GitHubSyncBridge } from '@/lib/workspace/github-sync';
import { sanitizeCommitMessage, escapeShellArg } from '@/lib/security/shell-escape';
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

  const supabase = await createServerClient();

  // SECURITY FIX: Use service role client to access github_token
  // Per migration 20250102_add_github_token.sql: "github_token column is only accessed via service_role"
  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

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

  try {
    const { sessionId, operation, repo, message, branch } = (await request.json()) as {
      sessionId: string;
      operation: GitOperation;
      repo?: { owner: string; name: string; branch?: string };
      message?: string;
      branch?: string;
    };

    if (!sessionId) {
      return errors.badRequest('Session ID required');
    }

    // Verify session ownership
    const { data: sessionData, error: sessionError } = await supabase
      .from('code_lab_sessions')
      .select('id')
      .eq('id', sessionId)
      .eq('user_id', user.id)
      .single();

    if (sessionError || !sessionData) {
      return errors.sessionAccessDenied();
    }

    // Get user's GitHub token using service role client
    // SECURITY FIX: Must use adminClient per migration design intent
    const { data: userData } = await adminClient
      .from('users')
      .select('github_token')
      .eq('id', user.id)
      .single();

    const userTokens = userData as { github_token?: string } | null;

    if (!userTokens?.github_token) {
      return errors.badRequest('GitHub not connected. Please connect your GitHub account.');
    }

    let githubToken: string;
    try {
      githubToken = decryptToken(userTokens.github_token);
    } catch {
      // SECURITY FIX: Don't log error details - could expose encryption info
      log.warn('Token decryption failed for user', { userId: user.id });
      return errors.badRequest(
        'GitHub token decryption failed. Please reconnect your GitHub account.'
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
          return errors.badRequest('Repository info required');
        }

        // Connect to repo
        await syncBridge.connect(repo.owner, repo.name);

        // Clone into workspace
        const cloneResult = await syncBridge.cloneToWorkspace(executeShell);

        if (!cloneResult.success) {
          return errors.serverError(cloneResult.error);
        }

        return successResponse({
          success: true,
          filesChanged: cloneResult.filesChanged,
          commitSha: cloneResult.commitSha,
        });
      }

      case 'push': {
        if (!repo) {
          return errors.badRequest('Repository info required');
        }

        await syncBridge.connect(repo.owner, repo.name);

        const pushResult = await syncBridge.pushChanges(
          executeShell,
          message || `Code Lab: Changes from ${new Date().toLocaleString()}`
        );

        if (!pushResult.success) {
          return errors.serverError(pushResult.error);
        }

        // Get diff for UI
        const diffResult = await executeShell(
          'cd /workspace/repo && git diff HEAD~1 --name-status 2>/dev/null || echo ""'
        );

        const diff = parseDiffOutput(diffResult.stdout);

        return successResponse({
          success: true,
          filesChanged: pushResult.filesChanged,
          commitSha: pushResult.commitSha,
          diff,
        });
      }

      case 'pull': {
        if (!repo) {
          return errors.badRequest('Repository info required');
        }

        await syncBridge.connect(repo.owner, repo.name);

        const pullResult = await syncBridge.pullChanges(executeShell);

        if (!pullResult.success) {
          return errors.serverError(pullResult.error);
        }

        return successResponse({
          success: true,
          filesChanged: pullResult.filesChanged,
          commitSha: pullResult.commitSha,
        });
      }

      case 'status': {
        if (!repo) {
          return errors.badRequest('Repository info required');
        }

        await syncBridge.connect(repo.owner, repo.name);

        const status = await syncBridge.getSyncStatus(executeShell);

        return successResponse({ status });
      }

      case 'commit': {
        // SECURITY: Sanitize and escape commit message to prevent command injection
        const safeMessage = sanitizeCommitMessage(message || 'Update');
        const escapedMessage = escapeShellArg(safeMessage);
        const commitResult = await executeShell(
          `cd /workspace/repo && git add -A && git commit -m ${escapedMessage}`
        );

        return successResponse({
          success: commitResult.exitCode === 0,
          output: commitResult.stdout,
          error: commitResult.stderr,
        });
      }

      case 'branch': {
        if (!branch) {
          return errors.badRequest('Branch name required');
        }

        if (!repo) {
          return errors.badRequest('Repository info required');
        }

        await syncBridge.connect(repo.owner, repo.name);

        const created = await syncBridge.createBranch(branch, executeShell);

        return successResponse({ success: created, branch });
      }

      case 'checkout': {
        if (!branch) {
          return errors.badRequest('Branch name required');
        }

        if (!repo) {
          return errors.badRequest('Repository info required');
        }

        await syncBridge.connect(repo.owner, repo.name);

        const switched = await syncBridge.switchBranch(branch, executeShell);

        return successResponse({ success: switched, branch });
      }

      case 'diff': {
        const diffResult = await executeShell(
          'cd /workspace/repo && git diff --unified=3 2>/dev/null || echo ""'
        );

        return successResponse({
          diff: diffResult.stdout,
        });
      }

      default:
        return errors.badRequest('Invalid operation');
    }
  } catch (error) {
    log.error('Git operation failed', error instanceof Error ? error : { error });
    return errors.serverError('Git operation failed');
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

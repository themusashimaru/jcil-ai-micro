/**
 * GITHUB ACTION EXECUTION API
 * Execute GitHub actions after user confirmation
 * POST: Execute a specific GitHub action
 *
 * Features:
 * - Normalized responses via toolWrap
 * - Idempotency keys for write operations
 * - Dry-run support for previewing actions
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server-auth';
import { getUserConnection } from '@/lib/connectors/helpers';
import * as github from '@/lib/connectors/github';
import { toolWrap, normalizeResponse, type ToolResponse } from '@/lib/toolWrap';
import { newIdempotencyKey, seenIdempotent } from '@/lib/idempotency';

export const runtime = 'nodejs';

interface ExecuteRequest {
  action: string;
  params: Record<string, unknown>;
  dry_run?: boolean;          // Preview action without executing
  idempotency_key?: string;   // Prevent duplicate writes
}

// Actions that modify data (require idempotency protection)
const WRITE_ACTIONS = [
  'write_file', 'create_file', 'update_file',
  'create_branch', 'create_pull_request', 'create_issue'
];

// Helper to parse owner from repo string or get from metadata
function resolveOwner(params: Record<string, unknown>, metadata: Record<string, unknown>): string | null {
  // If owner is explicitly provided, use it
  if (params.owner && typeof params.owner === 'string') {
    return params.owner;
  }

  // If repo contains owner/repo format, extract owner
  if (params.repo && typeof params.repo === 'string' && params.repo.includes('/')) {
    return params.repo.split('/')[0];
  }

  // Fall back to stored owner from metadata
  if (metadata.owner && typeof metadata.owner === 'string') {
    return metadata.owner;
  }

  return null;
}

// Helper to parse repo name (handles both "repo" and "owner/repo" formats)
function resolveRepo(params: Record<string, unknown>): string | null {
  if (!params.repo || typeof params.repo !== 'string') {
    return null;
  }

  // If repo contains owner/repo format, extract just the repo name
  if (params.repo.includes('/')) {
    return params.repo.split('/')[1];
  }

  return params.repo;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Get user's GitHub connection
    const connection = await getUserConnection(user.id, 'github');
    if (!connection) {
      return NextResponse.json({ error: 'GitHub not connected' }, { status: 400 });
    }

    const body: ExecuteRequest = await request.json();
    const { action, params, dry_run, idempotency_key } = body;

    if (!action) {
      return NextResponse.json({ error: 'Action is required' }, { status: 400 });
    }

    const token = connection.token;
    const metadata = connection.metadata || {};
    const isWriteAction = WRITE_ACTIONS.includes(action);

    // Check idempotency for write operations
    if (isWriteAction && !dry_run) {
      const idemKey = idempotency_key || newIdempotencyKey({ action, params, user: user.id });
      const isFirstTime = await seenIdempotent(idemKey);

      if (!isFirstTime) {
        console.log('[GitHub Execute] Duplicate request blocked:', idemKey);
        return NextResponse.json({
          ok: false,
          error: { code: 'DUPLICATE', message: 'This action was already performed' },
        }, { status: 409 });
      }
    }

    // Handle dry-run mode for write actions
    if (dry_run && isWriteAction) {
      console.log('[GitHub Execute] Dry-run for action:', action);
      return NextResponse.json({
        ok: true,
        data: {
          dry_run: true,
          action,
          params,
          message: `Would execute: ${action}`,
        },
      });
    }

    let result: ToolResponse<unknown>;

    switch (action) {
      case 'list_repos': {
        const rawResult = await github.listRepos(token);
        result = normalizeResponse(rawResult);
        break;
      }

      case 'list_files': {
        const owner = resolveOwner(params, metadata);
        const repo = resolveRepo(params);
        const path = params.path as string | undefined;
        if (!owner || !repo) {
          return NextResponse.json({ ok: false, error: { code: 'VALIDATION', message: 'repo is required (format: "repo-name" or "owner/repo")' } }, { status: 400 });
        }
        const rawResult = await github.listFiles(token, owner, repo, path || '');
        result = normalizeResponse(rawResult);
        break;
      }

      case 'read_file': {
        const owner = resolveOwner(params, metadata);
        const repo = resolveRepo(params);
        const path = params.path as string;
        if (!owner || !repo || !path) {
          return NextResponse.json({ ok: false, error: { code: 'VALIDATION', message: 'repo and path are required' } }, { status: 400 });
        }
        const rawResult = await github.readFile(token, owner, repo, path);
        result = normalizeResponse(rawResult);
        break;
      }

      case 'write_file':
      case 'create_file':
      case 'update_file': {
        const owner = resolveOwner(params, metadata);
        const repo = resolveRepo(params);
        const { path, content, message, sha } = params as {
          path: string;
          content: string;
          message: string;
          sha?: string;
        };
        if (!owner || !repo || !path || !content || !message) {
          return NextResponse.json(
            { ok: false, error: { code: 'VALIDATION', message: 'repo, path, content, and message are required' } },
            { status: 400 }
          );
        }
        result = await toolWrap(
          () => github.writeFile(token, owner, repo, path, content, message, sha),
          { tool_name: action, user_id: user.id }
        );
        break;
      }

      case 'create_branch': {
        const owner = resolveOwner(params, metadata);
        const repo = resolveRepo(params);
        const { branchName, fromBranch } = params as {
          branchName: string;
          fromBranch?: string;
        };
        if (!owner || !repo || !branchName) {
          return NextResponse.json({ ok: false, error: { code: 'VALIDATION', message: 'repo and branchName are required' } }, { status: 400 });
        }
        result = await toolWrap(
          () => github.createBranch(token, owner, repo, branchName, fromBranch),
          { tool_name: action, user_id: user.id }
        );
        break;
      }

      case 'create_pull_request': {
        const owner = resolveOwner(params, metadata);
        const repo = resolveRepo(params);
        const { title, body: prBody, head, base } = params as {
          title: string;
          body: string;
          head: string;
          base?: string;
        };
        if (!owner || !repo || !title || !head) {
          return NextResponse.json({ ok: false, error: { code: 'VALIDATION', message: 'repo, title, and head are required' } }, { status: 400 });
        }
        result = await toolWrap(
          () => github.createPullRequest(token, owner, repo, title, prBody || '', head, base),
          { tool_name: action, user_id: user.id }
        );
        break;
      }

      case 'list_issues': {
        const owner = resolveOwner(params, metadata);
        const repo = resolveRepo(params);
        const { state } = params as { state?: 'open' | 'closed' | 'all' };
        if (!owner || !repo) {
          return NextResponse.json({ ok: false, error: { code: 'VALIDATION', message: 'repo is required' } }, { status: 400 });
        }
        const rawResult = await github.listIssues(token, owner, repo, state);
        result = normalizeResponse(rawResult);
        break;
      }

      case 'create_issue': {
        const owner = resolveOwner(params, metadata);
        const repo = resolveRepo(params);
        const { title, body: issueBody } = params as {
          title: string;
          body: string;
        };
        if (!owner || !repo || !title) {
          return NextResponse.json({ ok: false, error: { code: 'VALIDATION', message: 'repo and title are required' } }, { status: 400 });
        }
        result = await toolWrap(
          () => github.createIssue(token, owner, repo, title, issueBody || ''),
          { tool_name: action, user_id: user.id }
        );
        break;
      }

      default:
        return NextResponse.json({ ok: false, error: { code: 'UNKNOWN_ACTION', message: `Unknown action: ${action}` } }, { status: 400 });
    }

    // Return normalized response
    return NextResponse.json(result, { status: result.ok ? 200 : 500 });
  } catch (error) {
    console.error('[GitHub Execute API] Error:', error);
    return NextResponse.json(
      { ok: false, error: { code: 'INTERNAL', message: 'Internal server error' } },
      { status: 500 }
    );
  }
}

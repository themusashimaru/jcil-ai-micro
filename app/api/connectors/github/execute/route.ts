/**
 * GITHUB ACTION EXECUTION API
 * Execute GitHub actions after user confirmation
 * POST: Execute a specific GitHub action
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server-auth';
import { getUserConnection } from '@/lib/connectors/helpers';
import * as github from '@/lib/connectors/github';

export const runtime = 'nodejs';

interface ExecuteRequest {
  action: string;
  params: Record<string, unknown>;
}

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
    const { action, params } = body;

    if (!action) {
      return NextResponse.json({ error: 'Action is required' }, { status: 400 });
    }

    const token = connection.token;
    const metadata = connection.metadata || {};
    let result: unknown;

    switch (action) {
      case 'list_repos': {
        result = await github.listRepos(token);
        break;
      }

      case 'list_files': {
        const owner = resolveOwner(params, metadata);
        const repo = resolveRepo(params);
        const path = params.path as string | undefined;
        if (!owner || !repo) {
          return NextResponse.json({ error: 'repo is required (format: "repo-name" or "owner/repo")' }, { status: 400 });
        }
        result = await github.listFiles(token, owner, repo, path || '');
        break;
      }

      case 'read_file': {
        const owner = resolveOwner(params, metadata);
        const repo = resolveRepo(params);
        const path = params.path as string;
        if (!owner || !repo || !path) {
          return NextResponse.json({ error: 'repo and path are required' }, { status: 400 });
        }
        result = await github.readFile(token, owner, repo, path);
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
            { error: 'repo, path, content, and message are required' },
            { status: 400 }
          );
        }
        result = await github.writeFile(token, owner, repo, path, content, message, sha);
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
          return NextResponse.json({ error: 'repo and branchName are required' }, { status: 400 });
        }
        result = await github.createBranch(token, owner, repo, branchName, fromBranch);
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
          return NextResponse.json({ error: 'repo, title, and head are required' }, { status: 400 });
        }
        result = await github.createPullRequest(token, owner, repo, title, prBody || '', head, base);
        break;
      }

      case 'list_issues': {
        const owner = resolveOwner(params, metadata);
        const repo = resolveRepo(params);
        const { state } = params as { state?: 'open' | 'closed' | 'all' };
        if (!owner || !repo) {
          return NextResponse.json({ error: 'repo is required' }, { status: 400 });
        }
        result = await github.listIssues(token, owner, repo, state);
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
          return NextResponse.json({ error: 'repo and title are required' }, { status: 400 });
        }
        result = await github.createIssue(token, owner, repo, title, issueBody || '');
        break;
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    // Check if result is an error
    if (github.isError(result)) {
      return NextResponse.json({ error: result.error }, { status: result.status || 500 });
    }

    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error('[GitHub Execute API] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

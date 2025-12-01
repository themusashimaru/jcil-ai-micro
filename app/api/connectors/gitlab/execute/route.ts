/**
 * GITLAB ACTION EXECUTION API
 * Execute GitLab API actions
 * POST: Execute a specific GitLab action
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server-auth';
import { getUserConnection } from '@/lib/connectors/helpers';

export const runtime = 'nodejs';

const GITLAB_API = 'https://gitlab.com/api/v4';

interface ExecuteRequest {
  action: string;
  params: Record<string, unknown>;
}

// Helper for GitLab API requests
async function gitlabFetch(
  token: string,
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  return fetch(`${GITLAB_API}${endpoint}`, {
    ...options,
    headers: {
      'PRIVATE-TOKEN': token,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const connection = await getUserConnection(user.id, 'gitlab');
    if (!connection) {
      return NextResponse.json({ error: 'GitLab not connected' }, { status: 400 });
    }

    const body: ExecuteRequest = await request.json();
    const { action, params } = body;

    if (!action) {
      return NextResponse.json({ error: 'Action is required' }, { status: 400 });
    }

    const token = connection.token;
    let result: unknown;

    switch (action) {
      case 'get_user': {
        const response = await gitlabFetch(token, '/user');

        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json(
            { error: error.message || 'Failed to get user' },
            { status: response.status }
          );
        }

        const user = await response.json();
        result = {
          id: user.id,
          username: user.username,
          name: user.name,
          email: user.email,
          avatarUrl: user.avatar_url,
          webUrl: user.web_url,
        };
        break;
      }

      case 'list_projects': {
        const { owned = true, perPage = 20 } = params as { owned?: boolean; perPage?: number };

        const response = await gitlabFetch(
          token,
          `/projects?owned=${owned}&per_page=${perPage}&order_by=updated_at`
        );

        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json(
            { error: error.message || 'Failed to list projects' },
            { status: response.status }
          );
        }

        const projects = await response.json();
        result = {
          projects: projects.map((p: {
            id: number;
            name: string;
            path_with_namespace: string;
            description: string;
            visibility: string;
            web_url: string;
            default_branch: string;
            last_activity_at: string;
          }) => ({
            id: p.id,
            name: p.name,
            fullPath: p.path_with_namespace,
            description: p.description,
            visibility: p.visibility,
            webUrl: p.web_url,
            defaultBranch: p.default_branch,
            lastActivityAt: p.last_activity_at,
          })),
          count: projects.length,
        };
        break;
      }

      case 'get_project': {
        const { projectId } = params as { projectId: string | number };
        if (!projectId) {
          return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
        }

        const encodedId = encodeURIComponent(String(projectId));
        const response = await gitlabFetch(token, `/projects/${encodedId}`);

        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json(
            { error: error.message || 'Failed to get project' },
            { status: response.status }
          );
        }

        const p = await response.json();
        result = {
          id: p.id,
          name: p.name,
          fullPath: p.path_with_namespace,
          description: p.description,
          visibility: p.visibility,
          webUrl: p.web_url,
          defaultBranch: p.default_branch,
          createdAt: p.created_at,
          lastActivityAt: p.last_activity_at,
          forksCount: p.forks_count,
          starCount: p.star_count,
        };
        break;
      }

      case 'list_files': {
        const { projectId, path = '', ref } = params as {
          projectId: string | number;
          path?: string;
          ref?: string;
        };

        if (!projectId) {
          return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
        }

        const encodedId = encodeURIComponent(String(projectId));
        let endpoint = `/projects/${encodedId}/repository/tree?path=${encodeURIComponent(path)}`;
        if (ref) endpoint += `&ref=${encodeURIComponent(ref)}`;

        const response = await gitlabFetch(token, endpoint);

        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json(
            { error: error.message || 'Failed to list files' },
            { status: response.status }
          );
        }

        const files = await response.json();
        result = {
          files: files.map((f: { id: string; name: string; type: string; path: string; mode: string }) => ({
            id: f.id,
            name: f.name,
            type: f.type,
            path: f.path,
            mode: f.mode,
          })),
          count: files.length,
        };
        break;
      }

      case 'read_file': {
        const { projectId, path, ref } = params as {
          projectId: string | number;
          path: string;
          ref?: string;
        };

        if (!projectId || !path) {
          return NextResponse.json({ error: 'projectId and path are required' }, { status: 400 });
        }

        const encodedId = encodeURIComponent(String(projectId));
        const encodedPath = encodeURIComponent(path);
        let endpoint = `/projects/${encodedId}/repository/files/${encodedPath}`;
        if (ref) endpoint += `?ref=${encodeURIComponent(ref)}`;

        const response = await gitlabFetch(token, endpoint);

        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json(
            { error: error.message || 'Failed to read file' },
            { status: response.status }
          );
        }

        const file = await response.json();
        const content = Buffer.from(file.content, 'base64').toString('utf-8');

        result = {
          fileName: file.file_name,
          filePath: file.file_path,
          size: file.size,
          encoding: file.encoding,
          content,
          ref: file.ref,
          lastCommitId: file.last_commit_id,
        };
        break;
      }

      case 'list_merge_requests': {
        const { projectId, state = 'opened', perPage = 20 } = params as {
          projectId: string | number;
          state?: 'opened' | 'closed' | 'merged' | 'all';
          perPage?: number;
        };

        if (!projectId) {
          return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
        }

        const encodedId = encodeURIComponent(String(projectId));
        const response = await gitlabFetch(
          token,
          `/projects/${encodedId}/merge_requests?state=${state}&per_page=${perPage}`
        );

        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json(
            { error: error.message || 'Failed to list merge requests' },
            { status: response.status }
          );
        }

        const mrs = await response.json();
        result = {
          mergeRequests: mrs.map((mr: {
            id: number;
            iid: number;
            title: string;
            state: string;
            source_branch: string;
            target_branch: string;
            author: { username: string };
            web_url: string;
            created_at: string;
          }) => ({
            id: mr.id,
            iid: mr.iid,
            title: mr.title,
            state: mr.state,
            sourceBranch: mr.source_branch,
            targetBranch: mr.target_branch,
            author: mr.author?.username,
            webUrl: mr.web_url,
            createdAt: mr.created_at,
          })),
          count: mrs.length,
        };
        break;
      }

      case 'list_issues': {
        const { projectId, state = 'opened', perPage = 20 } = params as {
          projectId: string | number;
          state?: 'opened' | 'closed' | 'all';
          perPage?: number;
        };

        if (!projectId) {
          return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
        }

        const encodedId = encodeURIComponent(String(projectId));
        const response = await gitlabFetch(
          token,
          `/projects/${encodedId}/issues?state=${state}&per_page=${perPage}`
        );

        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json(
            { error: error.message || 'Failed to list issues' },
            { status: response.status }
          );
        }

        const issues = await response.json();
        result = {
          issues: issues.map((i: {
            id: number;
            iid: number;
            title: string;
            state: string;
            labels: string[];
            author: { username: string };
            assignee: { username: string } | null;
            web_url: string;
            created_at: string;
          }) => ({
            id: i.id,
            iid: i.iid,
            title: i.title,
            state: i.state,
            labels: i.labels,
            author: i.author?.username,
            assignee: i.assignee?.username,
            webUrl: i.web_url,
            createdAt: i.created_at,
          })),
          count: issues.length,
        };
        break;
      }

      case 'list_pipelines': {
        const { projectId, status, perPage = 20 } = params as {
          projectId: string | number;
          status?: 'running' | 'pending' | 'success' | 'failed' | 'canceled';
          perPage?: number;
        };

        if (!projectId) {
          return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
        }

        const encodedId = encodeURIComponent(String(projectId));
        let endpoint = `/projects/${encodedId}/pipelines?per_page=${perPage}`;
        if (status) endpoint += `&status=${status}`;

        const response = await gitlabFetch(token, endpoint);

        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json(
            { error: error.message || 'Failed to list pipelines' },
            { status: response.status }
          );
        }

        const pipelines = await response.json();
        result = {
          pipelines: pipelines.map((p: {
            id: number;
            status: string;
            ref: string;
            sha: string;
            web_url: string;
            created_at: string;
            updated_at: string;
          }) => ({
            id: p.id,
            status: p.status,
            ref: p.ref,
            sha: p.sha.slice(0, 8),
            webUrl: p.web_url,
            createdAt: p.created_at,
            updatedAt: p.updated_at,
          })),
          count: pipelines.length,
        };
        break;
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error('[GitLab Execute API] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

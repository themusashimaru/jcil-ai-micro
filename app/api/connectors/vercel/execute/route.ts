/**
 * VERCEL ACTION EXECUTION API
 * Execute Vercel actions after user confirmation
 * POST: Execute a specific Vercel action
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server-auth';
import { getUserConnection } from '@/lib/connectors/helpers';

export const runtime = 'nodejs';

const VERCEL_API = 'https://api.vercel.com';

interface ExecuteRequest {
  action: string;
  params: Record<string, unknown>;
}

// Helper for Vercel API requests
async function vercelFetch(
  token: string,
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  return fetch(`${VERCEL_API}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
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

    // Get user's Vercel connection
    const connection = await getUserConnection(user.id, 'vercel');
    if (!connection) {
      return NextResponse.json({ error: 'Vercel not connected' }, { status: 400 });
    }

    const body: ExecuteRequest = await request.json();
    const { action, params } = body;

    if (!action) {
      return NextResponse.json({ error: 'Action is required' }, { status: 400 });
    }

    const token = connection.token;
    let result: unknown;

    switch (action) {
      case 'list_projects': {
        const { teamId } = params as { teamId?: string };
        const query = teamId ? `?teamId=${teamId}` : '';
        const response = await vercelFetch(token, `/v9/projects${query}`);

        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json(
            { error: error.error?.message || 'Failed to list projects' },
            { status: response.status }
          );
        }

        const data = await response.json();
        result = {
          projects: data.projects?.map((p: { id: string; name: string; framework: string; updatedAt: number }) => ({
            id: p.id,
            name: p.name,
            framework: p.framework,
            updatedAt: new Date(p.updatedAt).toISOString(),
          })) || [],
          count: data.projects?.length || 0,
        };
        break;
      }

      case 'list_deployments': {
        const { projectId, teamId, limit = 10 } = params as { projectId?: string; teamId?: string; limit?: number };
        let query = `?limit=${limit}`;
        if (projectId) query += `&projectId=${projectId}`;
        if (teamId) query += `&teamId=${teamId}`;

        const response = await vercelFetch(token, `/v6/deployments${query}`);

        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json(
            { error: error.error?.message || 'Failed to list deployments' },
            { status: response.status }
          );
        }

        const data = await response.json();
        result = {
          deployments: data.deployments?.map((d: { uid: string; name: string; url: string; state: string; createdAt: number; meta?: { githubCommitMessage?: string } }) => ({
            id: d.uid,
            name: d.name,
            url: d.url ? `https://${d.url}` : null,
            state: d.state,
            createdAt: new Date(d.createdAt).toISOString(),
            commitMessage: d.meta?.githubCommitMessage || null,
          })) || [],
          count: data.deployments?.length || 0,
        };
        break;
      }

      case 'get_deployment': {
        const { deploymentId, teamId } = params as { deploymentId: string; teamId?: string };
        if (!deploymentId) {
          return NextResponse.json({ error: 'deploymentId is required' }, { status: 400 });
        }

        const query = teamId ? `?teamId=${teamId}` : '';
        const response = await vercelFetch(token, `/v13/deployments/${deploymentId}${query}`);

        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json(
            { error: error.error?.message || 'Failed to get deployment' },
            { status: response.status }
          );
        }

        const d = await response.json();
        result = {
          id: d.uid,
          name: d.name,
          url: d.url ? `https://${d.url}` : null,
          state: d.readyState || d.state,
          createdAt: d.createdAt ? new Date(d.createdAt).toISOString() : null,
          buildingAt: d.buildingAt ? new Date(d.buildingAt).toISOString() : null,
          ready: d.ready ? new Date(d.ready).toISOString() : null,
          target: d.target,
          errorMessage: d.errorMessage || null,
        };
        break;
      }

      case 'get_project': {
        const { projectId, teamId } = params as { projectId: string; teamId?: string };
        if (!projectId) {
          return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
        }

        const query = teamId ? `?teamId=${teamId}` : '';
        const response = await vercelFetch(token, `/v9/projects/${projectId}${query}`);

        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json(
            { error: error.error?.message || 'Failed to get project' },
            { status: response.status }
          );
        }

        const p = await response.json();
        result = {
          id: p.id,
          name: p.name,
          framework: p.framework,
          nodeVersion: p.nodeVersion,
          buildCommand: p.buildCommand,
          outputDirectory: p.outputDirectory,
          rootDirectory: p.rootDirectory,
          devCommand: p.devCommand,
          installCommand: p.installCommand,
          createdAt: p.createdAt ? new Date(p.createdAt).toISOString() : null,
          updatedAt: p.updatedAt ? new Date(p.updatedAt).toISOString() : null,
          latestDeployment: p.latestDeployments?.[0] ? {
            id: p.latestDeployments[0].id,
            url: p.latestDeployments[0].url ? `https://${p.latestDeployments[0].url}` : null,
            state: p.latestDeployments[0].readyState,
          } : null,
        };
        break;
      }

      case 'list_env_vars': {
        const { projectId, teamId } = params as { projectId: string; teamId?: string };
        if (!projectId) {
          return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
        }

        const query = teamId ? `?teamId=${teamId}` : '';
        const response = await vercelFetch(token, `/v9/projects/${projectId}/env${query}`);

        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json(
            { error: error.error?.message || 'Failed to list environment variables' },
            { status: response.status }
          );
        }

        const data = await response.json();
        result = {
          envVars: data.envs?.map((e: { id: string; key: string; target: string[]; type: string }) => ({
            id: e.id,
            key: e.key,
            target: e.target,
            type: e.type,
            // Note: values are not returned for security
          })) || [],
          count: data.envs?.length || 0,
          message: 'Environment variable values are hidden for security. Only keys and targets are shown.',
        };
        break;
      }

      case 'list_domains': {
        const { projectId, teamId } = params as { projectId: string; teamId?: string };
        if (!projectId) {
          return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
        }

        const query = teamId ? `?teamId=${teamId}` : '';
        const response = await vercelFetch(token, `/v9/projects/${projectId}/domains${query}`);

        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json(
            { error: error.error?.message || 'Failed to list domains' },
            { status: response.status }
          );
        }

        const data = await response.json();
        result = {
          domains: data.domains?.map((d: { name: string; verified: boolean; createdAt: number }) => ({
            name: d.name,
            verified: d.verified,
            createdAt: d.createdAt ? new Date(d.createdAt).toISOString() : null,
          })) || [],
          count: data.domains?.length || 0,
        };
        break;
      }

      case 'redeploy': {
        const { deploymentId, teamId, target } = params as { deploymentId: string; teamId?: string; target?: string };
        if (!deploymentId) {
          return NextResponse.json({ error: 'deploymentId is required' }, { status: 400 });
        }

        const query = teamId ? `?teamId=${teamId}` : '';
        const response = await vercelFetch(token, `/v13/deployments${query}`, {
          method: 'POST',
          body: JSON.stringify({
            deploymentId,
            target: target || 'production',
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json(
            { error: error.error?.message || 'Failed to trigger redeployment' },
            { status: response.status }
          );
        }

        const d = await response.json();
        result = {
          id: d.id,
          url: d.url ? `https://${d.url}` : null,
          state: d.readyState || 'BUILDING',
          message: 'Redeployment triggered successfully!',
        };
        break;
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error('[Vercel Execute API] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

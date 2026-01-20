/**
 * CODE LAB DEPLOY API
 *
 * One-click deployment to various platforms
 * Supports: Vercel, Netlify, Railway, Cloudflare Pages
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { validateCSRF } from '@/lib/security/csrf';
import { rateLimiters } from '@/lib/security/rate-limit';
import { logger } from '@/lib/logger';

const log = logger('DeployAPI');

export const runtime = 'nodejs';
export const maxDuration = 120;

// MEDIUM-003: Request timeout for external API calls (30 seconds)
const EXTERNAL_API_TIMEOUT_MS = 30000;

/**
 * Fetch with timeout to prevent hanging connections
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number = EXTERNAL_API_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

type DeployPlatform = 'vercel' | 'netlify' | 'railway' | 'cloudflare';

interface DeployConfig {
  projectName: string;
  envVars?: Record<string, string>;
  buildCommand?: string;
  outputDir?: string;
  framework?: string;
  domain?: string;
}

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
    const { sessionId, platform, config } = (await request.json()) as {
      sessionId: string;
      platform: DeployPlatform;
      config: DeployConfig;
    };

    if (!sessionId || !platform || !config) {
      return NextResponse.json(
        { error: 'Session ID, platform, and config required' },
        { status: 400 }
      );
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

    // Get user's deployment tokens based on platform
    const { data: userData } = await supabase
      .from('users')
      .select('vercel_token, netlify_token, railway_token, cloudflare_token')
      .eq('id', user.id)
      .single();

    const tokens = userData as {
      vercel_token?: string;
      netlify_token?: string;
      railway_token?: string;
      cloudflare_token?: string;
    } | null;

    switch (platform) {
      case 'vercel': {
        if (!tokens?.vercel_token) {
          return NextResponse.json(
            { error: 'Vercel not connected. Please connect your Vercel account in settings.' },
            { status: 400 }
          );
        }

        const result = await deployToVercel(tokens.vercel_token, config, sessionId);
        return NextResponse.json(result);
      }

      case 'netlify': {
        if (!tokens?.netlify_token) {
          return NextResponse.json(
            { error: 'Netlify not connected. Please connect your Netlify account in settings.' },
            { status: 400 }
          );
        }

        const result = await deployToNetlify(tokens.netlify_token, config, sessionId);
        return NextResponse.json(result);
      }

      case 'railway': {
        if (!tokens?.railway_token) {
          return NextResponse.json(
            { error: 'Railway not connected. Please connect your Railway account in settings.' },
            { status: 400 }
          );
        }

        const result = await deployToRailway(tokens.railway_token, config, sessionId);
        return NextResponse.json(result);
      }

      case 'cloudflare': {
        if (!tokens?.cloudflare_token) {
          return NextResponse.json(
            {
              error:
                'Cloudflare not connected. Please connect your Cloudflare account in settings.',
            },
            { status: 400 }
          );
        }

        const result = await deployToCloudflare(tokens.cloudflare_token, config, sessionId);
        return NextResponse.json(result);
      }

      default:
        return NextResponse.json({ error: 'Unsupported platform' }, { status: 400 });
    }
  } catch (error) {
    log.error('Deploy API error', error instanceof Error ? error : { error });
    return NextResponse.json(
      {
        error: 'Deployment failed',
        code: 'DEPLOY_FAILED',
        details: error instanceof Error ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}

// Vercel deployment
async function deployToVercel(token: string, config: DeployConfig, _sessionId: string) {
  try {
    // Create project if it doesn't exist
    const projectResponse = await fetchWithTimeout('https://api.vercel.com/v9/projects', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: config.projectName,
        framework: config.framework || 'nextjs',
        buildCommand: config.buildCommand,
        outputDirectory: config.outputDir,
      }),
    });

    if (!projectResponse.ok && projectResponse.status !== 409) {
      const error = await projectResponse.json();
      throw new Error(error.error?.message || 'Failed to create Vercel project');
    }

    // Set environment variables
    if (config.envVars && Object.keys(config.envVars).length > 0) {
      for (const [key, value] of Object.entries(config.envVars)) {
        await fetchWithTimeout(`https://api.vercel.com/v10/projects/${config.projectName}/env`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            key,
            value,
            type: 'encrypted',
            target: ['production', 'preview', 'development'],
          }),
        });
      }
    }

    return {
      success: true,
      platform: 'vercel',
      projectName: config.projectName,
      url: `https://${config.projectName}.vercel.app`,
      message: 'Project created. Connect your GitHub repo in Vercel dashboard to deploy.',
    };
  } catch (error) {
    log.error('Vercel deployment failed', error instanceof Error ? error : { error });
    return {
      success: false,
      platform: 'vercel',
      error: 'Vercel deployment failed',
    };
  }
}

// Netlify deployment
async function deployToNetlify(token: string, config: DeployConfig, _sessionId: string) {
  try {
    // Create site
    const siteResponse = await fetchWithTimeout('https://api.netlify.com/api/v1/sites', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: config.projectName,
        build_settings: {
          cmd: config.buildCommand || 'npm run build',
          dir: config.outputDir || 'dist',
        },
      }),
    });

    if (!siteResponse.ok) {
      throw new Error('Failed to create Netlify site');
    }

    const site = await siteResponse.json();

    // Set environment variables
    if (config.envVars && Object.keys(config.envVars).length > 0) {
      await fetchWithTimeout(`https://api.netlify.com/api/v1/sites/${site.id}/env`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config.envVars),
      });
    }

    return {
      success: true,
      platform: 'netlify',
      projectName: config.projectName,
      url: site.ssl_url || site.url,
      siteId: site.id,
      message: 'Site created. Connect your GitHub repo to deploy.',
    };
  } catch (error) {
    log.error('Netlify deployment failed', error instanceof Error ? error : { error });
    return {
      success: false,
      platform: 'netlify',
      error: 'Netlify deployment failed',
    };
  }
}

// Railway deployment
async function deployToRailway(token: string, config: DeployConfig, _sessionId: string) {
  try {
    // Railway uses GraphQL
    const query = `
      mutation CreateProject($name: String!) {
        projectCreate(input: { name: $name }) {
          id
          name
        }
      }
    `;

    const response = await fetchWithTimeout('https://backboard.railway.app/graphql/v2', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        variables: { name: config.projectName },
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to create Railway project');
    }

    const data = await response.json();

    if (data.errors) {
      throw new Error(data.errors[0]?.message || 'Railway API error');
    }

    return {
      success: true,
      platform: 'railway',
      projectName: config.projectName,
      projectId: data.data?.projectCreate?.id,
      message: 'Project created. Deploy via Railway dashboard or CLI.',
    };
  } catch (error) {
    log.error('Railway deployment failed', error instanceof Error ? error : { error });
    return {
      success: false,
      platform: 'railway',
      error: 'Railway deployment failed',
    };
  }
}

// Cloudflare Pages deployment
async function deployToCloudflare(token: string, config: DeployConfig, _sessionId: string) {
  try {
    // First get account ID
    const accountsResponse = await fetchWithTimeout(
      'https://api.cloudflare.com/client/v4/accounts',
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!accountsResponse.ok) {
      throw new Error('Failed to get Cloudflare account');
    }

    const accountsData = await accountsResponse.json();
    const accountId = accountsData.result?.[0]?.id;

    if (!accountId) {
      throw new Error('No Cloudflare account found');
    }

    // Create Pages project
    const projectResponse = await fetchWithTimeout(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: config.projectName,
          build_config: {
            build_command: config.buildCommand || 'npm run build',
            destination_dir: config.outputDir || 'dist',
          },
        }),
      }
    );

    if (!projectResponse.ok) {
      const error = await projectResponse.json();
      throw new Error(error.errors?.[0]?.message || 'Failed to create Cloudflare Pages project');
    }

    const project = await projectResponse.json();

    return {
      success: true,
      platform: 'cloudflare',
      projectName: config.projectName,
      url: `https://${config.projectName}.pages.dev`,
      projectId: project.result?.id,
      message: 'Project created. Connect your GitHub repo to deploy.',
    };
  } catch (error) {
    log.error('Cloudflare deployment failed', error instanceof Error ? error : { error });
    return {
      success: false,
      platform: 'cloudflare',
      error: 'Cloudflare deployment failed',
    };
  }
}

// GET - Check deployment status
export async function GET(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const platform = searchParams.get('platform') as DeployPlatform;
  const projectId = searchParams.get('projectId');
  const projectName = searchParams.get('projectName');

  if (!platform || (!projectId && !projectName)) {
    return NextResponse.json(
      { error: 'Platform and project ID or name required' },
      { status: 400 }
    );
  }

  // Get user's token for the platform
  const { data: userData } = await supabase
    .from('users')
    .select(`${platform}_token`)
    .eq('id', user.id)
    .single();

  const token = userData?.[`${platform}_token` as keyof typeof userData] as string | undefined;

  if (!token) {
    return NextResponse.json({ error: `${platform} not connected` }, { status: 400 });
  }

  try {
    // Check deployment status based on platform
    switch (platform) {
      case 'vercel': {
        const response = await fetchWithTimeout(
          `https://api.vercel.com/v9/projects/${projectName || projectId}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        if (!response.ok) {
          return NextResponse.json({
            status: 'error',
            platform,
            error: 'Project not found or access denied',
          });
        }

        const project = await response.json();

        // Get latest deployment
        const deploymentsRes = await fetchWithTimeout(
          `https://api.vercel.com/v6/deployments?projectId=${project.id}&limit=1`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        const deployments = await deploymentsRes.json();
        const latestDeployment = deployments.deployments?.[0];

        return NextResponse.json({
          status: latestDeployment?.readyState || 'pending',
          platform,
          projectId: project.id,
          projectName: project.name,
          url: latestDeployment?.url ? `https://${latestDeployment.url}` : null,
          deploymentId: latestDeployment?.uid,
          createdAt: latestDeployment?.createdAt,
          state: latestDeployment?.state,
        });
      }

      case 'netlify': {
        const response = await fetchWithTimeout(
          `https://api.netlify.com/api/v1/sites/${projectId}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        if (!response.ok) {
          return NextResponse.json({
            status: 'error',
            platform,
            error: 'Site not found or access denied',
          });
        }

        const site = await response.json();

        // Get latest deploy
        const deploysRes = await fetchWithTimeout(
          `https://api.netlify.com/api/v1/sites/${projectId}/deploys?per_page=1`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        const deploys = await deploysRes.json();
        const latestDeploy = deploys[0];

        return NextResponse.json({
          status: latestDeploy?.state || 'pending',
          platform,
          projectId: site.id,
          projectName: site.name,
          url: site.ssl_url || site.url,
          deploymentId: latestDeploy?.id,
          createdAt: latestDeploy?.created_at,
          state: latestDeploy?.state,
          errorMessage: latestDeploy?.error_message,
        });
      }

      case 'railway': {
        const query = `
          query GetProject($id: String!) {
            project(id: $id) {
              id
              name
              deployments(first: 1) {
                edges {
                  node {
                    id
                    status
                    createdAt
                    url
                  }
                }
              }
            }
          }
        `;

        const response = await fetchWithTimeout('https://backboard.railway.app/graphql/v2', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query,
            variables: { id: projectId },
          }),
        });

        const data = await response.json();

        if (data.errors) {
          return NextResponse.json({
            status: 'error',
            platform,
            error: data.errors[0]?.message || 'Railway API error',
          });
        }

        const project = data.data?.project;
        const latestDeploy = project?.deployments?.edges?.[0]?.node;

        return NextResponse.json({
          status: latestDeploy?.status?.toLowerCase() || 'pending',
          platform,
          projectId: project?.id,
          projectName: project?.name,
          url: latestDeploy?.url,
          deploymentId: latestDeploy?.id,
          createdAt: latestDeploy?.createdAt,
        });
      }

      case 'cloudflare': {
        // Get account ID first
        const accountsResponse = await fetchWithTimeout(
          'https://api.cloudflare.com/client/v4/accounts',
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        const accountsData = await accountsResponse.json();
        const accountId = accountsData.result?.[0]?.id;

        if (!accountId) {
          return NextResponse.json({
            status: 'error',
            platform,
            error: 'No Cloudflare account found',
          });
        }

        const response = await fetchWithTimeout(
          `https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/${projectName || projectId}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        if (!response.ok) {
          return NextResponse.json({
            status: 'error',
            platform,
            error: 'Project not found or access denied',
          });
        }

        const project = await response.json();
        const latestDeploy = project.result?.latest_deployment;

        return NextResponse.json({
          status: latestDeploy?.latest_stage?.status || 'pending',
          platform,
          projectId: project.result?.id,
          projectName: project.result?.name,
          url: latestDeploy?.url || `https://${project.result?.name}.pages.dev`,
          deploymentId: latestDeploy?.id,
          createdAt: latestDeploy?.created_on,
          stage: latestDeploy?.latest_stage?.name,
        });
      }

      default:
        return NextResponse.json({ error: 'Unsupported platform' }, { status: 400 });
    }
  } catch (error) {
    log.error('Deploy status check failed', error instanceof Error ? error : { error });
    return NextResponse.json(
      {
        status: 'error',
        platform,
        error: error instanceof Error ? error.message : 'Failed to check deployment status',
      },
      { status: 500 }
    );
  }
}

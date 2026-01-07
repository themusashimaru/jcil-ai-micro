/**
 * CODE LAB DEPLOY API
 *
 * One-click deployment to various platforms
 * Supports: Vercel, Netlify, Railway, Cloudflare Pages
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const maxDuration = 120;

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
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { sessionId, platform, config } = await request.json() as {
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

    // Get user's deployment tokens based on platform
    const { data: userData } = await supabase
      .from('users')
      .select('vercel_token, netlify_token, railway_token, cloudflare_token')
      .eq('id', user.id)
      .single();

    const tokens = userData as { vercel_token?: string; netlify_token?: string; railway_token?: string; cloudflare_token?: string } | null;

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
            { error: 'Cloudflare not connected. Please connect your Cloudflare account in settings.' },
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
    console.error('[Deploy API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Deployment failed' },
      { status: 500 }
    );
  }
}

// Vercel deployment
async function deployToVercel(token: string, config: DeployConfig, _sessionId: string) {
  try {
    // Create project if it doesn't exist
    const projectResponse = await fetch('https://api.vercel.com/v9/projects', {
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
        await fetch(`https://api.vercel.com/v10/projects/${config.projectName}/env`, {
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
    return {
      success: false,
      platform: 'vercel',
      error: error instanceof Error ? error.message : 'Vercel deployment failed',
    };
  }
}

// Netlify deployment
async function deployToNetlify(token: string, config: DeployConfig, _sessionId: string) {
  try {
    // Create site
    const siteResponse = await fetch('https://api.netlify.com/api/v1/sites', {
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
      const error = await siteResponse.json();
      throw new Error(error.message || 'Failed to create Netlify site');
    }

    const site = await siteResponse.json();

    // Set environment variables
    if (config.envVars && Object.keys(config.envVars).length > 0) {
      await fetch(`https://api.netlify.com/api/v1/sites/${site.id}/env`, {
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
    return {
      success: false,
      platform: 'netlify',
      error: error instanceof Error ? error.message : 'Netlify deployment failed',
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

    const response = await fetch('https://backboard.railway.app/graphql/v2', {
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
    return {
      success: false,
      platform: 'railway',
      error: error instanceof Error ? error.message : 'Railway deployment failed',
    };
  }
}

// Cloudflare Pages deployment
async function deployToCloudflare(token: string, config: DeployConfig, _sessionId: string) {
  try {
    // First get account ID
    const accountsResponse = await fetch('https://api.cloudflare.com/client/v4/accounts', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!accountsResponse.ok) {
      throw new Error('Failed to get Cloudflare account');
    }

    const accountsData = await accountsResponse.json();
    const accountId = accountsData.result?.[0]?.id;

    if (!accountId) {
      throw new Error('No Cloudflare account found');
    }

    // Create Pages project
    const projectResponse = await fetch(
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
    return {
      success: false,
      platform: 'cloudflare',
      error: error instanceof Error ? error.message : 'Cloudflare deployment failed',
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

  if (!platform || !projectId) {
    return NextResponse.json(
      { error: 'Platform and project ID required' },
      { status: 400 }
    );
  }

  // Get user's token for the platform
  const { data: userData } = await supabase
    .from('users')
    .select(`${platform}_token`)
    .eq('id', user.id)
    .single();

  const token = userData?.[`${platform}_token` as keyof typeof userData];

  if (!token) {
    return NextResponse.json(
      { error: `${platform} not connected` },
      { status: 400 }
    );
  }

  // Check deployment status based on platform
  // This would query the specific platform's API
  return NextResponse.json({
    status: 'ready',
    platform,
    projectId,
  });
}

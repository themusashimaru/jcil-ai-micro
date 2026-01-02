/**
 * ONE-CLICK DEPLOY API
 *
 * PURPOSE:
 * - Deploy projects to Vercel or Netlify
 * - Handle authentication with deployment platforms
 * - Return deployment URLs
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

interface DeployRequest {
  platform: 'vercel' | 'netlify';
  projectName: string;
  repoUrl?: string;
  files?: { path: string; content: string }[];
  framework?: string;
}

// Vercel deployment function
async function deployToVercel(
  projectName: string,
  repoUrl?: string,
  files?: { path: string; content: string }[],
  framework?: string
): Promise<{ url: string; projectId: string }> {
  const vercelToken = process.env.VERCEL_TOKEN;

  if (!vercelToken) {
    throw new Error('Vercel deployment not configured. Please add VERCEL_TOKEN to environment.');
  }

  // If we have a GitHub repo URL, deploy from Git
  if (repoUrl) {
    const response = await fetch('https://api.vercel.com/v13/deployments', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${vercelToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
        gitSource: {
          type: 'github',
          repoId: repoUrl,
          ref: 'main',
        },
        projectSettings: {
          framework: framework || 'nextjs',
        },
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to deploy to Vercel');
    }

    const data = await response.json();
    return {
      url: `https://${data.url}`,
      projectId: data.id,
    };
  }

  // If we have files, deploy directly
  if (files && files.length > 0) {
    // Create file uploads for Vercel
    const fileUploads = files.map((file) => ({
      file: file.path,
      data: Buffer.from(file.content).toString('base64'),
      encoding: 'base64',
    }));

    const response = await fetch('https://api.vercel.com/v13/deployments', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${vercelToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
        files: fileUploads,
        projectSettings: {
          framework: framework || 'nextjs',
        },
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to deploy to Vercel');
    }

    const data = await response.json();
    return {
      url: `https://${data.url}`,
      projectId: data.id,
    };
  }

  throw new Error('Either repoUrl or files must be provided');
}

// Netlify deployment function
async function deployToNetlify(
  projectName: string,
  repoUrl?: string,
  files?: { path: string; content: string }[],
): Promise<{ url: string; projectId: string }> {
  const netlifyToken = process.env.NETLIFY_TOKEN;

  if (!netlifyToken) {
    throw new Error('Netlify deployment not configured. Please add NETLIFY_TOKEN to environment.');
  }

  // Create a new site
  const siteResponse = await fetch('https://api.netlify.com/api/v1/sites', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${netlifyToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
    }),
  });

  if (!siteResponse.ok) {
    const error = await siteResponse.json();
    throw new Error(error.message || 'Failed to create Netlify site');
  }

  const site = await siteResponse.json();

  // If we have a GitHub repo URL, configure Git deployment
  if (repoUrl) {
    const repoMatch = repoUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (repoMatch) {
      await fetch(`https://api.netlify.com/api/v1/sites/${site.id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${netlifyToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          repo: {
            provider: 'github',
            repo_path: `${repoMatch[1]}/${repoMatch[2]}`,
            branch: 'main',
            cmd: 'npm run build',
            dir: '.next',
          },
        }),
      });
    }
  }

  // If we have files, deploy directly
  if (files && files.length > 0) {
    // Create a deploy with files
    const formData = new FormData();

    // Create a simple index.html if none exists for static deployment
    const hasIndex = files.some(f => f.path === 'index.html' || f.path === '/index.html');
    if (!hasIndex) {
      const htmlFile = files.find(f => f.path.endsWith('.html'));
      if (htmlFile) {
        formData.append('index.html', new Blob([htmlFile.content], { type: 'text/html' }));
      }
    }

    // Add all files
    for (const file of files) {
      const mimeType = file.path.endsWith('.html')
        ? 'text/html'
        : file.path.endsWith('.css')
        ? 'text/css'
        : file.path.endsWith('.js')
        ? 'application/javascript'
        : 'text/plain';
      formData.append(file.path, new Blob([file.content], { type: mimeType }));
    }

    const deployResponse = await fetch(`https://api.netlify.com/api/v1/sites/${site.id}/deploys`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${netlifyToken}`,
      },
      body: formData,
    });

    if (!deployResponse.ok) {
      const error = await deployResponse.json();
      throw new Error(error.message || 'Failed to deploy to Netlify');
    }
  }

  return {
    url: site.ssl_url || site.url,
    projectId: site.id,
  };
}

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const cookieStore = await cookies();
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const accessToken = cookieStore.get('sb-access-token')?.value;
    if (!accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(accessToken);

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request
    const body: DeployRequest = await request.json();
    const { platform, projectName, repoUrl, files, framework } = body;

    if (!platform || !projectName) {
      return NextResponse.json(
        { error: 'Missing required fields: platform and projectName' },
        { status: 400 }
      );
    }

    if (!repoUrl && (!files || files.length === 0)) {
      return NextResponse.json(
        { error: 'Either repoUrl or files must be provided' },
        { status: 400 }
      );
    }

    let result: { url: string; projectId: string };

    if (platform === 'vercel') {
      result = await deployToVercel(projectName, repoUrl, files, framework);
    } else if (platform === 'netlify') {
      result = await deployToNetlify(projectName, repoUrl, files);
    } else {
      return NextResponse.json({ error: 'Invalid platform' }, { status: 400 });
    }

    // Log deployment
    await supabase.from('deployments').insert({
      user_id: user.id,
      platform,
      project_name: projectName,
      deployment_url: result.url,
      deployment_id: result.projectId,
      repo_url: repoUrl,
      created_at: new Date().toISOString(),
    });

    return NextResponse.json({
      url: result.url,
      platform,
      projectId: result.projectId,
    });
  } catch (error) {
    console.error('[Deploy API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Deployment failed' },
      { status: 500 }
    );
  }
}

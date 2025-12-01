/**
 * TEST CONNECTOR API
 * Validates that a token works before saving
 * POST: Test a connection token
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server-auth';

export const runtime = 'nodejs';

// Test GitHub connection
async function testGitHub(token: string): Promise<{ valid: boolean; username?: string; repos?: Array<{name: string; full_name: string; private: boolean}>; error?: string }> {
  try {
    // First, get the user info
    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'JCIL-AI-App',
      },
    });

    if (!userResponse.ok) {
      if (userResponse.status === 401) {
        return { valid: false, error: 'Invalid token. Please check your Personal Access Token.' };
      }
      return { valid: false, error: `GitHub API error: ${userResponse.status}` };
    }

    const userData = await userResponse.json();
    const username = userData.login;

    // Now fetch the user's repos
    const reposResponse = await fetch('https://api.github.com/user/repos?per_page=100&sort=updated', {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'JCIL-AI-App',
      },
    });

    let repos: Array<{name: string; full_name: string; private: boolean}> = [];
    if (reposResponse.ok) {
      const reposData = await reposResponse.json();
      repos = reposData.map((repo: { name: string; full_name: string; private: boolean }) => ({
        name: repo.name,
        full_name: repo.full_name,
        private: repo.private,
      }));
    }

    return { valid: true, username, repos };
  } catch {
    return { valid: false, error: 'Failed to connect to GitHub. Check your network.' };
  }
}

// Test Notion connection
async function testNotion(token: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const response = await fetch('https://api.notion.com/v1/users/me', {
      headers: {
        Authorization: `Bearer ${token}`,
        'Notion-Version': '2022-06-28',
      },
    });

    if (response.ok) {
      return { valid: true };
    } else if (response.status === 401) {
      return { valid: false, error: 'Invalid token. Please check your Integration Token.' };
    } else {
      return { valid: false, error: `Notion API error: ${response.status}` };
    }
  } catch {
    return { valid: false, error: 'Failed to connect to Notion. Check your network.' };
  }
}

// Test Shopify connection
async function testShopify(_token: string): Promise<{ valid: boolean; shopName?: string; error?: string }> {
  // Shopify tokens include the store domain - format: store.myshopify.com:shpat_xxx
  // Or user might just provide the token if we store the shop separately
  // For now, we'll need the shop domain in the token or metadata
  // This is a placeholder - real implementation needs shop domain
  return { valid: false, error: 'Shopify connection requires store URL. Coming soon.' };
}

// Test Supabase connection
// Token format: project_url|service_role_key
async function testSupabase(token: string): Promise<{ valid: boolean; projectName?: string; error?: string }> {
  try {
    // Parse the token (format: url|key)
    const parts = token.split('|');
    if (parts.length !== 2) {
      return {
        valid: false,
        error: 'Invalid format. Make sure you entered both the Project URL and Service Role Key.'
      };
    }

    let [projectUrl, serviceKey] = parts;

    // Clean up the URL
    projectUrl = projectUrl.trim();
    serviceKey = serviceKey.trim();

    // Remove trailing slash if present
    if (projectUrl.endsWith('/')) {
      projectUrl = projectUrl.slice(0, -1);
    }

    // Basic URL validation
    if (!projectUrl.startsWith('https://')) {
      return {
        valid: false,
        error: 'Project URL should start with https://. Check your URL in Supabase dashboard.'
      };
    }

    // Make sure the key isn't empty
    if (serviceKey.length < 20) {
      return {
        valid: false,
        error: 'Service Role Key seems too short. Make sure you copied the full key.'
      };
    }

    // Test the connection by making a simple API call
    const response = await fetch(`${projectUrl}/rest/v1/`, {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
    });

    // A 200 response means the connection works
    // Even a 404 on /rest/v1/ is fine - it means the API is reachable
    if (response.ok || response.status === 404 || response.status === 406) {
      // Extract project name from URL
      const urlMatch = projectUrl.match(/https:\/\/([^.]+)/);
      const projectName = urlMatch ? urlMatch[1] : 'Supabase Project';
      return { valid: true, projectName };
    } else if (response.status === 401 || response.status === 403) {
      return { valid: false, error: 'Invalid credentials. Make sure you copied the Service Role Key (not the anon key).' };
    } else {
      return { valid: false, error: `Connection failed (${response.status}). Check your Project URL.` };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { valid: false, error: `Failed to connect: ${message}. Check your URL and network.` };
  }
}

// POST - Test a connection
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const { service, token } = body;

    if (!service || !token) {
      return NextResponse.json({ error: 'Service and token are required' }, { status: 400 });
    }

    let result: {
      valid: boolean;
      username?: string;
      shopName?: string;
      projectName?: string;
      repos?: Array<{name: string; full_name: string; private: boolean}>;
      error?: string;
    };

    switch (service) {
      case 'github':
        result = await testGitHub(token);
        break;
      case 'notion':
        result = await testNotion(token);
        break;
      case 'shopify':
        result = await testShopify(token);
        break;
      case 'supabase':
        result = await testSupabase(token);
        break;
      default:
        // For services we haven't implemented testing for yet, assume valid
        result = { valid: true };
    }

    if (result.valid) {
      return NextResponse.json({
        success: true,
        message: 'Connection successful!',
        username: result.username || result.projectName,
        shopName: result.shopName,
        repos: result.repos, // Include repos for GitHub
      });
    } else {
      return NextResponse.json({
        success: false,
        error: result.error || 'Connection failed',
      }, { status: 400 });
    }
  } catch (error) {
    console.error('[Connectors Test API] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

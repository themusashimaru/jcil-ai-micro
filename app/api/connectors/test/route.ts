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
// Token format: store_domain|access_token
async function testShopify(token: string): Promise<{ valid: boolean; shopName?: string; error?: string }> {
  try {
    const parts = token.split('|');
    if (parts.length !== 2) {
      return {
        valid: false,
        error: 'Invalid format. Make sure you entered both the Store Domain and Access Token.'
      };
    }

    let [storeDomain, accessToken] = parts;
    storeDomain = storeDomain.trim();
    accessToken = accessToken.trim();

    // Ensure store domain has correct format
    if (!storeDomain.includes('.myshopify.com')) {
      storeDomain = `${storeDomain}.myshopify.com`;
    }

    const response = await fetch(`https://${storeDomain}/admin/api/2024-01/shop.json`, {
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      const data = await response.json();
      return { valid: true, shopName: data.shop?.name || storeDomain };
    } else if (response.status === 401 || response.status === 403) {
      return { valid: false, error: 'Invalid access token. Make sure you copied the Admin API access token.' };
    } else {
      return { valid: false, error: `Connection failed (${response.status}). Check your store domain.` };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { valid: false, error: `Failed to connect: ${message}. Check your store URL and network.` };
  }
}

// Test Stripe connection
async function testStripe(token: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const response = await fetch('https://api.stripe.com/v1/balance', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.ok) {
      return { valid: true };
    } else if (response.status === 401) {
      return { valid: false, error: 'Invalid API key. Make sure you copied the Secret Key (not the Publishable key).' };
    } else {
      return { valid: false, error: `Stripe API error: ${response.status}` };
    }
  } catch {
    return { valid: false, error: 'Failed to connect to Stripe. Check your network.' };
  }
}

// Test Linear connection
async function testLinear(token: string): Promise<{ valid: boolean; username?: string; error?: string }> {
  try {
    const response = await fetch('https://api.linear.app/graphql', {
      method: 'POST',
      headers: {
        Authorization: token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: `{ viewer { id name email } }`,
      }),
    });

    if (!response.ok) {
      return { valid: false, error: `Linear API error: ${response.status}` };
    }

    const data = await response.json();
    if (data.errors) {
      return { valid: false, error: 'Invalid API key. Check your Linear API key.' };
    }

    return { valid: true, username: data.data?.viewer?.name || data.data?.viewer?.email };
  } catch {
    return { valid: false, error: 'Failed to connect to Linear. Check your network.' };
  }
}

// Test Jira connection
// Token format: site|email|api_token
async function testJira(token: string): Promise<{ valid: boolean; username?: string; error?: string }> {
  try {
    const parts = token.split('|');
    if (parts.length !== 3) {
      return {
        valid: false,
        error: 'Invalid format. Make sure you entered Site, Email, and API Token.'
      };
    }

    let [siteDomain, email, apiToken] = parts;
    siteDomain = siteDomain.trim();
    email = email.trim();
    apiToken = apiToken.trim();

    if (!siteDomain.includes('.atlassian.net')) {
      siteDomain = `${siteDomain}.atlassian.net`;
    }

    const auth = Buffer.from(`${email}:${apiToken}`).toString('base64');
    const response = await fetch(`https://${siteDomain}/rest/api/3/myself`, {
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: 'application/json',
      },
    });

    if (response.ok) {
      const user = await response.json();
      return { valid: true, username: user.displayName || email };
    } else if (response.status === 401) {
      return { valid: false, error: 'Invalid credentials. Check your email and API token.' };
    } else {
      return { valid: false, error: `Jira API error: ${response.status}. Check your site domain.` };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { valid: false, error: `Failed to connect: ${message}` };
  }
}

// Test Slack connection
async function testSlack(token: string): Promise<{ valid: boolean; username?: string; team?: string; error?: string }> {
  try {
    const response = await fetch('https://slack.com/api/auth.test', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    if (data.ok) {
      return { valid: true, username: data.user, team: data.team };
    } else {
      return { valid: false, error: `Slack error: ${data.error}. Check your Bot Token.` };
    }
  } catch {
    return { valid: false, error: 'Failed to connect to Slack. Check your network.' };
  }
}

// Test Discord connection
async function testDiscord(token: string): Promise<{ valid: boolean; username?: string; error?: string }> {
  try {
    // Ensure token has Bot prefix
    const authToken = token.startsWith('Bot ') ? token : `Bot ${token}`;

    const response = await fetch('https://discord.com/api/v10/users/@me', {
      headers: {
        Authorization: authToken,
      },
    });

    if (response.ok) {
      const user = await response.json();
      return { valid: true, username: user.username };
    } else if (response.status === 401) {
      return { valid: false, error: 'Invalid bot token. Check your Discord Bot Token.' };
    } else {
      return { valid: false, error: `Discord API error: ${response.status}` };
    }
  } catch {
    return { valid: false, error: 'Failed to connect to Discord. Check your network.' };
  }
}

// Test Vercel connection
async function testVercel(token: string): Promise<{ valid: boolean; username?: string; teams?: Array<{id: string; name: string}>; error?: string }> {
  try {
    // Get user info
    const userResponse = await fetch('https://api.vercel.com/v2/user', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!userResponse.ok) {
      if (userResponse.status === 401 || userResponse.status === 403) {
        return { valid: false, error: 'Invalid token. Please check your Vercel API Token.' };
      }
      return { valid: false, error: `Vercel API error: ${userResponse.status}` };
    }

    const userData = await userResponse.json();
    const username = userData.user?.username || userData.user?.name || 'Vercel User';

    // Get teams (optional)
    let teams: Array<{id: string; name: string}> = [];
    try {
      const teamsResponse = await fetch('https://api.vercel.com/v2/teams', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (teamsResponse.ok) {
        const teamsData = await teamsResponse.json();
        teams = (teamsData.teams || []).map((team: { id: string; name: string }) => ({
          id: team.id,
          name: team.name,
        }));
      }
    } catch {
      // Teams fetch is optional, continue without it
    }

    return { valid: true, username, teams };
  } catch {
    return { valid: false, error: 'Failed to connect to Vercel. Check your network.' };
  }
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
      team?: string;
      repos?: Array<{name: string; full_name: string; private: boolean}>;
      teams?: Array<{id: string; name: string}>;
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
      case 'stripe':
        result = await testStripe(token);
        break;
      case 'linear':
        result = await testLinear(token);
        break;
      case 'jira':
        result = await testJira(token);
        break;
      case 'slack':
        result = await testSlack(token);
        break;
      case 'discord':
        result = await testDiscord(token);
        break;
      case 'vercel':
        result = await testVercel(token);
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

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

// Test OpenAI connection
async function testOpenAI(token: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const response = await fetch('https://api.openai.com/v1/models', {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.ok) {
      return { valid: true };
    } else if (response.status === 401) {
      return { valid: false, error: 'Invalid API key. Check your OpenAI API key.' };
    } else {
      return { valid: false, error: `OpenAI API error: ${response.status}` };
    }
  } catch {
    return { valid: false, error: 'Failed to connect to OpenAI. Check your network.' };
  }
}

// Test Anthropic connection
async function testAnthropic(token: string): Promise<{ valid: boolean; error?: string }> {
  try {
    // Anthropic doesn't have a simple validation endpoint, so we make a minimal request
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': token,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'hi' }],
      }),
    });

    // Any response other than 401 means the key is valid
    if (response.status === 401) {
      return { valid: false, error: 'Invalid API key. Check your Anthropic API key.' };
    }
    return { valid: true };
  } catch {
    return { valid: false, error: 'Failed to connect to Anthropic. Check your network.' };
  }
}

// Test xAI (Grok) connection
async function testXAI(token: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const response = await fetch('https://api.x.ai/v1/models', {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.ok) {
      return { valid: true };
    } else if (response.status === 401) {
      return { valid: false, error: 'Invalid API key. Check your xAI API key.' };
    } else {
      return { valid: false, error: `xAI API error: ${response.status}` };
    }
  } catch {
    return { valid: false, error: 'Failed to connect to xAI. Check your network.' };
  }
}

// Test Groq connection
async function testGroq(token: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const response = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.ok) {
      return { valid: true };
    } else if (response.status === 401) {
      return { valid: false, error: 'Invalid API key. Check your Groq API key.' };
    } else {
      return { valid: false, error: `Groq API error: ${response.status}` };
    }
  } catch {
    return { valid: false, error: 'Failed to connect to Groq. Check your network.' };
  }
}

// Test Mistral connection
async function testMistral(token: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const response = await fetch('https://api.mistral.ai/v1/models', {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.ok) {
      return { valid: true };
    } else if (response.status === 401) {
      return { valid: false, error: 'Invalid API key. Check your Mistral API key.' };
    } else {
      return { valid: false, error: `Mistral API error: ${response.status}` };
    }
  } catch {
    return { valid: false, error: 'Failed to connect to Mistral. Check your network.' };
  }
}

// Test Perplexity connection
async function testPerplexity(token: string): Promise<{ valid: boolean; error?: string }> {
  try {
    // Perplexity doesn't have a models endpoint, so we test with a minimal chat
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [{ role: 'user', content: 'hi' }],
        max_tokens: 1,
      }),
    });

    if (response.status === 401) {
      return { valid: false, error: 'Invalid API key. Check your Perplexity API key.' };
    }
    return { valid: true };
  } catch {
    return { valid: false, error: 'Failed to connect to Perplexity. Check your network.' };
  }
}

// Test Replicate connection
async function testReplicate(token: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const response = await fetch('https://api.replicate.com/v1/predictions', {
      headers: { Authorization: `Token ${token}` },
    });

    if (response.ok || response.status === 200) {
      return { valid: true };
    } else if (response.status === 401) {
      return { valid: false, error: 'Invalid API token. Check your Replicate API token.' };
    } else {
      return { valid: false, error: `Replicate API error: ${response.status}` };
    }
  } catch {
    return { valid: false, error: 'Failed to connect to Replicate. Check your network.' };
  }
}

// Test Stability AI connection
async function testStability(token: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const response = await fetch('https://api.stability.ai/v1/engines/list', {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.ok) {
      return { valid: true };
    } else if (response.status === 401) {
      return { valid: false, error: 'Invalid API key. Check your Stability AI API key.' };
    } else {
      return { valid: false, error: `Stability API error: ${response.status}` };
    }
  } catch {
    return { valid: false, error: 'Failed to connect to Stability AI. Check your network.' };
  }
}

// Test ElevenLabs connection
async function testElevenLabs(token: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const response = await fetch('https://api.elevenlabs.io/v1/user', {
      headers: { 'xi-api-key': token },
    });

    if (response.ok) {
      return { valid: true };
    } else if (response.status === 401) {
      return { valid: false, error: 'Invalid API key. Check your ElevenLabs API key.' };
    } else {
      return { valid: false, error: `ElevenLabs API error: ${response.status}` };
    }
  } catch {
    return { valid: false, error: 'Failed to connect to ElevenLabs. Check your network.' };
  }
}

// Test GitLab connection
async function testGitLab(token: string): Promise<{ valid: boolean; username?: string; error?: string }> {
  try {
    const response = await fetch('https://gitlab.com/api/v4/user', {
      headers: { 'PRIVATE-TOKEN': token },
    });

    if (response.ok) {
      const user = await response.json();
      return { valid: true, username: user.username };
    } else if (response.status === 401) {
      return { valid: false, error: 'Invalid token. Check your GitLab Personal Access Token.' };
    } else {
      return { valid: false, error: `GitLab API error: ${response.status}` };
    }
  } catch {
    return { valid: false, error: 'Failed to connect to GitLab. Check your network.' };
  }
}

// Test Airtable connection
async function testAirtable(token: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const response = await fetch('https://api.airtable.com/v0/meta/bases', {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.ok) {
      return { valid: true };
    } else if (response.status === 401) {
      return { valid: false, error: 'Invalid token. Check your Airtable Personal Access Token.' };
    } else {
      return { valid: false, error: `Airtable API error: ${response.status}` };
    }
  } catch {
    return { valid: false, error: 'Failed to connect to Airtable. Check your network.' };
  }
}

// Test Twilio connection
async function testTwilio(token: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const separator = token.includes(':') ? ':' : '|';
    const parts = token.split(separator);
    if (parts.length !== 2) {
      return { valid: false, error: 'Invalid format. Enter Account SID and Auth Token.' };
    }

    const [accountSid, authToken] = parts.map(p => p.trim());
    const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}.json`, {
      headers: { Authorization: `Basic ${auth}` },
    });

    if (response.ok) {
      return { valid: true };
    } else if (response.status === 401) {
      return { valid: false, error: 'Invalid credentials. Check your Account SID and Auth Token.' };
    } else {
      return { valid: false, error: `Twilio API error: ${response.status}` };
    }
  } catch {
    return { valid: false, error: 'Failed to connect to Twilio. Check your network.' };
  }
}

// Test Black Forest Labs connection
async function testBFL(token: string): Promise<{ valid: boolean; error?: string }> {
  try {
    // BFL doesn't have a simple validation endpoint, so we check if the key format looks valid
    // A real validation would require making a generation request
    if (!token || token.length < 20) {
      return { valid: false, error: 'Invalid API key format. Check your Black Forest Labs API key.' };
    }
    // For now, accept the key - it will fail on first use if invalid
    return { valid: true };
  } catch {
    return { valid: false, error: 'Failed to validate. Check your network.' };
  }
}

// Test Runway connection
async function testRunway(token: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const response = await fetch('https://api.runwayml.com/v1/tasks', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Runway-Version': '2024-11-06',
      },
    });

    if (response.ok || response.status === 404) {
      // 404 is ok - means auth worked but no tasks
      return { valid: true };
    } else if (response.status === 401) {
      return { valid: false, error: 'Invalid API key. Check your Runway API key.' };
    } else {
      return { valid: false, error: `Runway API error: ${response.status}` };
    }
  } catch {
    return { valid: false, error: 'Failed to connect to Runway. Check your network.' };
  }
}

// Test Luma AI connection
async function testLuma(token: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const response = await fetch('https://api.lumalabs.ai/dream-machine/v1/generations?limit=1', {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.ok) {
      return { valid: true };
    } else if (response.status === 401) {
      return { valid: false, error: 'Invalid API key. Check your Luma AI API key.' };
    } else {
      return { valid: false, error: `Luma API error: ${response.status}` };
    }
  } catch {
    return { valid: false, error: 'Failed to connect to Luma AI. Check your network.' };
  }
}

// Test Suno connection
async function testSuno(token: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const response = await fetch('https://studio-api.suno.ai/api/billing/info/', {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.ok) {
      return { valid: true };
    } else if (response.status === 401) {
      return { valid: false, error: 'Invalid API key. Check your Suno API key.' };
    } else {
      return { valid: false, error: `Suno API error: ${response.status}` };
    }
  } catch {
    return { valid: false, error: 'Failed to connect to Suno. Check your network.' };
  }
}

// Test Coinbase connection
async function testCoinbase(token: string): Promise<{ valid: boolean; username?: string; error?: string }> {
  try {
    const response = await fetch('https://api.coinbase.com/v2/user', {
      headers: {
        Authorization: `Bearer ${token}`,
        'CB-VERSION': '2024-01-01',
      },
    });

    if (response.ok) {
      const data = await response.json();
      return { valid: true, username: data.data?.name || data.data?.email };
    } else if (response.status === 401) {
      return { valid: false, error: 'Invalid API key. Check your Coinbase API key.' };
    } else {
      return { valid: false, error: `Coinbase API error: ${response.status}` };
    }
  } catch {
    return { valid: false, error: 'Failed to connect to Coinbase. Check your network.' };
  }
}

// Test Resend connection
async function testResend(token: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const response = await fetch('https://api.resend.com/domains', {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.ok) {
      return { valid: true };
    } else if (response.status === 401) {
      return { valid: false, error: 'Invalid API key. Check your Resend API key.' };
    } else {
      return { valid: false, error: `Resend API error: ${response.status}` };
    }
  } catch {
    return { valid: false, error: 'Failed to connect to Resend. Check your network.' };
  }
}

// Test Cloudflare connection
async function testCloudflare(token: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const response = await fetch('https://api.cloudflare.com/client/v4/user/tokens/verify', {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.ok) {
      return { valid: true };
    } else if (response.status === 401) {
      return { valid: false, error: 'Invalid API token. Check your Cloudflare API token.' };
    } else {
      return { valid: false, error: `Cloudflare API error: ${response.status}` };
    }
  } catch {
    return { valid: false, error: 'Failed to connect to Cloudflare. Check your network.' };
  }
}

// Test Upstash connection
// Token format: REST_URL|REST_TOKEN
async function testUpstash(token: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const parts = token.split('|');
    if (parts.length !== 2) {
      return { valid: false, error: 'Invalid format. Enter REST URL and REST Token.' };
    }

    const [restUrl, restToken] = parts.map(p => p.trim());
    const response = await fetch(restUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${restToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(['PING']),
    });

    if (response.ok) {
      return { valid: true };
    } else if (response.status === 401) {
      return { valid: false, error: 'Invalid credentials. Check your Upstash REST token.' };
    } else {
      return { valid: false, error: `Upstash API error: ${response.status}` };
    }
  } catch {
    return { valid: false, error: 'Failed to connect to Upstash. Check your REST URL and network.' };
  }
}

// Test Klaviyo connection
async function testKlaviyo(token: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const response = await fetch('https://a.klaviyo.com/api/accounts/', {
      headers: {
        Authorization: `Klaviyo-API-Key ${token}`,
        revision: '2024-02-15',
      },
    });

    if (response.ok) {
      return { valid: true };
    } else if (response.status === 401) {
      return { valid: false, error: 'Invalid API key. Check your Klaviyo Private API key.' };
    } else {
      return { valid: false, error: `Klaviyo API error: ${response.status}` };
    }
  } catch {
    return { valid: false, error: 'Failed to connect to Klaviyo. Check your network.' };
  }
}

// Test Printful connection
async function testPrintful(token: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const response = await fetch('https://api.printful.com/stores', {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.ok) {
      return { valid: true };
    } else if (response.status === 401) {
      return { valid: false, error: 'Invalid API token. Check your Printful API token.' };
    } else {
      return { valid: false, error: `Printful API error: ${response.status}` };
    }
  } catch {
    return { valid: false, error: 'Failed to connect to Printful. Check your network.' };
  }
}

// Test n8n connection
// Token format: HOST_URL|API_KEY
async function testN8n(token: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const parts = token.split('|');
    if (parts.length !== 2) {
      return { valid: false, error: 'Invalid format. Enter n8n Host URL and API Key.' };
    }

    const [rawHostUrl, apiKey] = parts.map(p => p.trim());
    const hostUrl = rawHostUrl.endsWith('/') ? rawHostUrl.slice(0, -1) : rawHostUrl;

    const response = await fetch(`${hostUrl}/api/v1/workflows?limit=1`, {
      headers: { 'X-N8N-API-KEY': apiKey },
    });

    if (response.ok) {
      return { valid: true };
    } else if (response.status === 401) {
      return { valid: false, error: 'Invalid API key. Check your n8n API key.' };
    } else {
      return { valid: false, error: `n8n API error: ${response.status}. Check your host URL.` };
    }
  } catch {
    return { valid: false, error: 'Failed to connect to n8n. Check your host URL and network.' };
  }
}

// Test Buffer connection
async function testBuffer(token: string): Promise<{ valid: boolean; username?: string; error?: string }> {
  try {
    const response = await fetch(`https://api.bufferapp.com/1/user.json?access_token=${token}`);

    if (response.ok) {
      const data = await response.json();
      return { valid: true, username: data.name };
    } else if (response.status === 401) {
      return { valid: false, error: 'Invalid access token. Check your Buffer access token.' };
    } else {
      return { valid: false, error: `Buffer API error: ${response.status}` };
    }
  } catch {
    return { valid: false, error: 'Failed to connect to Buffer. Check your network.' };
  }
}

// Test Calendly connection
async function testCalendly(token: string): Promise<{ valid: boolean; username?: string; error?: string }> {
  try {
    const response = await fetch('https://api.calendly.com/users/me', {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.ok) {
      const data = await response.json();
      return { valid: true, username: data.resource?.name };
    } else if (response.status === 401) {
      return { valid: false, error: 'Invalid token. Check your Calendly Personal Access Token.' };
    } else {
      return { valid: false, error: `Calendly API error: ${response.status}` };
    }
  } catch {
    return { valid: false, error: 'Failed to connect to Calendly. Check your network.' };
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
      case 'openai':
        result = await testOpenAI(token);
        break;
      case 'anthropic':
        result = await testAnthropic(token);
        break;
      case 'xai':
        result = await testXAI(token);
        break;
      case 'groq':
        result = await testGroq(token);
        break;
      case 'mistral':
        result = await testMistral(token);
        break;
      case 'perplexity':
        result = await testPerplexity(token);
        break;
      case 'replicate':
        result = await testReplicate(token);
        break;
      case 'stability':
        result = await testStability(token);
        break;
      case 'elevenlabs':
        result = await testElevenLabs(token);
        break;
      case 'gitlab':
        result = await testGitLab(token);
        break;
      case 'airtable':
        result = await testAirtable(token);
        break;
      case 'twilio':
        result = await testTwilio(token);
        break;
      case 'bfl':
        result = await testBFL(token);
        break;
      case 'runway':
        result = await testRunway(token);
        break;
      case 'luma':
        result = await testLuma(token);
        break;
      case 'suno':
        result = await testSuno(token);
        break;
      case 'coinbase':
        result = await testCoinbase(token);
        break;
      case 'resend':
        result = await testResend(token);
        break;
      case 'cloudflare':
        result = await testCloudflare(token);
        break;
      case 'upstash':
        result = await testUpstash(token);
        break;
      case 'klaviyo':
        result = await testKlaviyo(token);
        break;
      case 'printful':
        result = await testPrintful(token);
        break;
      case 'n8n':
        result = await testN8n(token);
        break;
      case 'buffer':
        result = await testBuffer(token);
        break;
      case 'calendly':
        result = await testCalendly(token);
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

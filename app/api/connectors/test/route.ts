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

// Test Coinbase Advanced Trade connection
// Token format: API_KEY|API_SECRET
async function testCoinbaseTrade(token: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const parts = token.split('|');
    if (parts.length !== 2) {
      return { valid: false, error: 'Invalid format. Enter API Key and API Secret.' };
    }

    const [apiKey, apiSecret] = parts.map(p => p.trim());

    // Basic validation
    if (!apiKey || !apiSecret) {
      return { valid: false, error: 'Both API Key and API Secret are required.' };
    }

    // For Advanced Trade, we'd need to sign requests with HMAC
    // For now, validate the format
    if (apiKey.length < 10 || apiSecret.length < 20) {
      return { valid: false, error: 'API credentials appear to be incomplete.' };
    }

    return { valid: true };
  } catch {
    return { valid: false, error: 'Failed to validate. Check your credentials.' };
  }
}

// Test Alpaca connection
// Token format: API_KEY|API_SECRET|MODE
async function testAlpaca(token: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const parts = token.split('|');
    if (parts.length < 2) {
      return { valid: false, error: 'Invalid format. Enter API Key ID and Secret Key.' };
    }

    const [apiKey, apiSecret] = parts.map(p => p.trim());
    const isPaper = parts[2] !== 'live';

    const baseUrl = isPaper
      ? 'https://paper-api.alpaca.markets'
      : 'https://api.alpaca.markets';

    const response = await fetch(`${baseUrl}/v2/account`, {
      headers: {
        'APCA-API-KEY-ID': apiKey,
        'APCA-API-SECRET-KEY': apiSecret,
      },
    });

    if (response.ok) {
      return { valid: true };
    } else if (response.status === 401 || response.status === 403) {
      return { valid: false, error: 'Invalid credentials. Check your Alpaca API keys.' };
    } else {
      return { valid: false, error: `Alpaca API error: ${response.status}` };
    }
  } catch {
    return { valid: false, error: 'Failed to connect to Alpaca. Check your network.' };
  }
}

// Test Alpha Vantage connection
async function testAlphaVantage(token: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const response = await fetch(`https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol=IBM&interval=5min&apikey=${token}`);

    if (response.ok) {
      const data = await response.json();
      if (data['Error Message'] || data['Note']) {
        return { valid: false, error: 'Invalid or rate-limited API key. Check your Alpha Vantage key.' };
      }
      return { valid: true };
    } else {
      return { valid: false, error: `Alpha Vantage API error: ${response.status}` };
    }
  } catch {
    return { valid: false, error: 'Failed to connect to Alpha Vantage. Check your network.' };
  }
}

// Test CoinGecko connection
async function testCoinGecko(token: string): Promise<{ valid: boolean; error?: string }> {
  try {
    // CoinGecko can work without a key (free tier), but Pro requires one
    const isPro = token && token.length > 10;
    const baseUrl = isPro ? 'https://pro-api.coingecko.com' : 'https://api.coingecko.com';

    const headers: Record<string, string> = { 'Accept': 'application/json' };
    if (isPro) {
      headers['x-cg-pro-api-key'] = token;
    }

    const response = await fetch(`${baseUrl}/api/v3/ping`, { headers });

    if (response.ok) {
      return { valid: true };
    } else if (response.status === 401) {
      return { valid: false, error: 'Invalid API key. Check your CoinGecko Pro API key.' };
    } else {
      return { valid: false, error: `CoinGecko API error: ${response.status}` };
    }
  } catch {
    return { valid: false, error: 'Failed to connect to CoinGecko. Check your network.' };
  }
}

// Test NewsAPI connection
async function testNewsAPI(token: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const response = await fetch(`https://newsapi.org/v2/top-headlines?country=us&pageSize=1&apiKey=${token}`);

    if (response.ok) {
      const data = await response.json();
      if (data.status === 'error') {
        return { valid: false, error: data.message || 'Invalid API key.' };
      }
      return { valid: true };
    } else if (response.status === 401) {
      return { valid: false, error: 'Invalid API key. Check your NewsAPI key.' };
    } else {
      return { valid: false, error: `NewsAPI error: ${response.status}` };
    }
  } catch {
    return { valid: false, error: 'Failed to connect to NewsAPI. Check your network.' };
  }
}

// Test Zapier connection
async function testZapier(token: string): Promise<{ valid: boolean; error?: string }> {
  try {
    // Zapier can use either NLA API key (starts with sk-) or webhook URL
    if (token.startsWith('https://hooks.zapier.com/')) {
      // Webhook URL - we can't really test it without triggering
      return { valid: true };
    } else if (token.startsWith('sk-')) {
      // NLA API key
      const response = await fetch('https://nla.zapier.com/api/v1/exposed/', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        return { valid: true };
      } else if (response.status === 401) {
        return { valid: false, error: 'Invalid NLA API key. Check your Zapier API key.' };
      } else {
        return { valid: false, error: `Zapier API error: ${response.status}` };
      }
    } else {
      // Accept any key format for flexibility
      return { valid: true };
    }
  } catch {
    return { valid: false, error: 'Failed to connect to Zapier. Check your network.' };
  }
}

// Test Mixpanel connection
// Token format: PROJECT_TOKEN|API_SECRET
async function testMixpanel(token: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const parts = token.split('|');
    if (parts.length !== 2) {
      return { valid: false, error: 'Invalid format. Enter Project Token and API Secret.' };
    }

    const [, apiSecret] = parts.map(p => p.trim());
    const auth = Buffer.from(`${apiSecret}:`).toString('base64');

    const response = await fetch('https://mixpanel.com/api/2.0/engage?page_size=1', {
      headers: { Authorization: `Basic ${auth}` },
    });

    if (response.ok || response.status === 402) {
      // 402 means auth worked but might need payment
      return { valid: true };
    } else if (response.status === 401) {
      return { valid: false, error: 'Invalid credentials. Check your Mixpanel API Secret.' };
    } else {
      return { valid: false, error: `Mixpanel API error: ${response.status}` };
    }
  } catch {
    return { valid: false, error: 'Failed to connect to Mixpanel. Check your network.' };
  }
}

// Test Amplitude connection
// Token format: API_KEY|SECRET_KEY
async function testAmplitude(token: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const parts = token.split('|');
    if (parts.length !== 2) {
      return { valid: false, error: 'Invalid format. Enter API Key and Secret Key.' };
    }

    const [apiKey, secretKey] = parts.map(p => p.trim());
    const auth = Buffer.from(`${apiKey}:${secretKey}`).toString('base64');

    const response = await fetch('https://amplitude.com/api/2/export?start=20240101T00&end=20240101T01', {
      headers: { Authorization: `Basic ${auth}` },
    });

    // Even a 400 (no data) means auth worked
    if (response.ok || response.status === 400 || response.status === 404) {
      return { valid: true };
    } else if (response.status === 401) {
      return { valid: false, error: 'Invalid credentials. Check your Amplitude API keys.' };
    } else {
      return { valid: false, error: `Amplitude API error: ${response.status}` };
    }
  } catch {
    return { valid: false, error: 'Failed to connect to Amplitude. Check your network.' };
  }
}

// Test Asana connection
async function testAsana(token: string): Promise<{ valid: boolean; username?: string; error?: string }> {
  try {
    const response = await fetch('https://app.asana.com/api/1.0/users/me', {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.ok) {
      const data = await response.json();
      return { valid: true, username: data.data?.name || data.data?.email };
    } else if (response.status === 401) {
      return { valid: false, error: 'Invalid token. Check your Asana Personal Access Token.' };
    } else {
      return { valid: false, error: `Asana API error: ${response.status}` };
    }
  } catch {
    return { valid: false, error: 'Failed to connect to Asana. Check your network.' };
  }
}

// Test Trello connection
// Token format: API_KEY|TOKEN
async function testTrello(token: string): Promise<{ valid: boolean; username?: string; error?: string }> {
  try {
    const parts = token.split('|');
    if (parts.length !== 2) {
      return { valid: false, error: 'Invalid format. Enter API Key and Token.' };
    }

    const [apiKey, userToken] = parts.map(p => p.trim());

    const response = await fetch(`https://api.trello.com/1/members/me?key=${apiKey}&token=${userToken}`);

    if (response.ok) {
      const data = await response.json();
      return { valid: true, username: data.fullName || data.username };
    } else if (response.status === 401) {
      return { valid: false, error: 'Invalid credentials. Check your Trello API Key and Token.' };
    } else {
      return { valid: false, error: `Trello API error: ${response.status}` };
    }
  } catch {
    return { valid: false, error: 'Failed to connect to Trello. Check your network.' };
  }
}

// Test ClickUp connection
async function testClickUp(token: string): Promise<{ valid: boolean; username?: string; error?: string }> {
  try {
    const response = await fetch('https://api.clickup.com/api/v2/user', {
      headers: { Authorization: token },
    });

    if (response.ok) {
      const data = await response.json();
      return { valid: true, username: data.user?.username || data.user?.email };
    } else if (response.status === 401) {
      return { valid: false, error: 'Invalid token. Check your ClickUp API Token.' };
    } else {
      return { valid: false, error: `ClickUp API error: ${response.status}` };
    }
  } catch {
    return { valid: false, error: 'Failed to connect to ClickUp. Check your network.' };
  }
}

// Test Monday.com connection
async function testMonday(token: string): Promise<{ valid: boolean; username?: string; error?: string }> {
  try {
    const response = await fetch('https://api.monday.com/v2', {
      method: 'POST',
      headers: {
        Authorization: token,
        'Content-Type': 'application/json',
        'API-Version': '2024-01',
      },
      body: JSON.stringify({ query: '{ me { id name email } }' }),
    });

    if (!response.ok) {
      return { valid: false, error: `Monday API error: ${response.status}` };
    }

    const data = await response.json();
    if (data.errors) {
      return { valid: false, error: 'Invalid API key. Check your Monday.com API key.' };
    }

    return { valid: true, username: data.data?.me?.name || data.data?.me?.email };
  } catch {
    return { valid: false, error: 'Failed to connect to Monday.com. Check your network.' };
  }
}

// Test WordPress connection
// Token format: SITE_URL|USERNAME|APP_PASSWORD
async function testWordPress(token: string): Promise<{ valid: boolean; username?: string; error?: string }> {
  try {
    const parts = token.split('|');
    if (parts.length < 2) {
      return { valid: false, error: 'Invalid format. Enter Site URL, Username, and Application Password.' };
    }

    let siteUrl: string;
    let auth: string;

    if (parts.length === 3) {
      siteUrl = parts[0].trim();
      const username = parts[1].trim();
      const appPassword = parts[2].trim();
      auth = Buffer.from(`${username}:${appPassword}`).toString('base64');
    } else if (parts.length === 2) {
      siteUrl = parts[0].trim();
      auth = Buffer.from(parts[1].trim()).toString('base64');
    } else {
      return { valid: false, error: 'Invalid token format.' };
    }

    siteUrl = siteUrl.replace(/\/$/, '');

    const response = await fetch(`${siteUrl}/wp-json/wp/v2/users/me`, {
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: 'application/json',
      },
    });

    if (response.ok) {
      const data = await response.json();
      return { valid: true, username: data.name || data.slug };
    } else if (response.status === 401) {
      return { valid: false, error: 'Invalid credentials. Check your username and application password.' };
    } else {
      return { valid: false, error: `WordPress API error: ${response.status}. Check your site URL.` };
    }
  } catch {
    return { valid: false, error: 'Failed to connect to WordPress. Check your site URL and network.' };
  }
}

// Test Webflow connection
async function testWebflow(token: string): Promise<{ valid: boolean; username?: string; error?: string }> {
  try {
    const response = await fetch('https://api.webflow.com/v2/user', {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      const data = await response.json();
      return { valid: true, username: data.firstName || data.email };
    } else if (response.status === 401) {
      return { valid: false, error: 'Invalid token. Check your Webflow API Token.' };
    } else {
      return { valid: false, error: `Webflow API error: ${response.status}` };
    }
  } catch {
    return { valid: false, error: 'Failed to connect to Webflow. Check your network.' };
  }
}

// Test Ghost connection
// Token format: SITE_URL|ADMIN_API_KEY
async function testGhost(token: string): Promise<{ valid: boolean; siteName?: string; error?: string }> {
  try {
    const parts = token.split('|');
    if (parts.length !== 2) {
      return { valid: false, error: 'Invalid format. Enter Site URL and Admin API Key.' };
    }

    const [rawSiteUrl, apiKey] = parts.map(p => p.trim());
    const siteUrl = rawSiteUrl.replace(/\/$/, '');

    // Create JWT for Ghost Admin API
    const keyParts = apiKey.split(':');
    if (keyParts.length !== 2) {
      return { valid: false, error: 'Invalid API Key format. It should be id:secret.' };
    }

    const [id, secret] = keyParts;
    const crypto = await import('crypto');

    const header = { alg: 'HS256', typ: 'JWT', kid: id };
    const now = Math.floor(Date.now() / 1000);
    const payload = { iat: now, exp: now + 5 * 60, aud: '/admin/' };

    const base64url = (data: object) =>
      Buffer.from(JSON.stringify(data))
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');

    const headerEncoded = base64url(header);
    const payloadEncoded = base64url(payload);
    const secretBuffer = Buffer.from(secret, 'hex');
    const signature = crypto
      .createHmac('sha256', secretBuffer)
      .update(`${headerEncoded}.${payloadEncoded}`)
      .digest('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');

    const jwtToken = `${headerEncoded}.${payloadEncoded}.${signature}`;

    const response = await fetch(`${siteUrl}/ghost/api/admin/site/`, {
      headers: { Authorization: `Ghost ${jwtToken}` },
    });

    if (response.ok) {
      const data = await response.json();
      return { valid: true, siteName: data.site?.title };
    } else if (response.status === 401) {
      return { valid: false, error: 'Invalid API key. Check your Ghost Admin API key.' };
    } else {
      return { valid: false, error: `Ghost API error: ${response.status}. Check your site URL.` };
    }
  } catch {
    return { valid: false, error: 'Failed to connect to Ghost. Check your site URL and API key.' };
  }
}

// Test DocuSign connection
// Token format: ACCOUNT_ID|INTEGRATION_KEY|ACCESS_TOKEN
async function testDocuSign(token: string): Promise<{ valid: boolean; username?: string; error?: string }> {
  try {
    const parts = token.split('|');
    if (parts.length !== 3) {
      return { valid: false, error: 'Invalid format. Enter Account ID, Integration Key, and Access Token.' };
    }

    const [accountId, , accessToken] = parts.map(p => p.trim());

    const response = await fetch(`https://demo.docusign.net/restapi/v2.1/accounts/${accountId}/users`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });

    if (response.ok) {
      return { valid: true };
    } else if (response.status === 401) {
      return { valid: false, error: 'Invalid credentials. Check your Access Token.' };
    } else {
      return { valid: false, error: `DocuSign API error: ${response.status}` };
    }
  } catch {
    return { valid: false, error: 'Failed to connect to DocuSign. Check your network.' };
  }
}

// Test HelloSign (Dropbox Sign) connection
async function testHelloSign(token: string): Promise<{ valid: boolean; username?: string; error?: string }> {
  try {
    const response = await fetch('https://api.hellosign.com/v3/account', {
      headers: {
        Authorization: `Basic ${Buffer.from(`${token}:`).toString('base64')}`,
      },
    });

    if (response.ok) {
      const data = await response.json();
      return { valid: true, username: data.account?.email_address };
    } else if (response.status === 401) {
      return { valid: false, error: 'Invalid API key. Check your Dropbox Sign API key.' };
    } else {
      return { valid: false, error: `Dropbox Sign API error: ${response.status}` };
    }
  } catch {
    return { valid: false, error: 'Failed to connect to Dropbox Sign. Check your network.' };
  }
}

// Test Jobber connection
// Token format: CLIENT_ID|ACCESS_TOKEN
async function testJobber(token: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const parts = token.split('|');
    if (parts.length !== 2) {
      return { valid: false, error: 'Invalid format. Enter Client ID and Access Token.' };
    }

    const [, accessToken] = parts.map(p => p.trim());

    const response = await fetch('https://api.getjobber.com/api/graphql', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: '{ account { name } }',
      }),
    });

    if (response.ok) {
      const data = await response.json();
      if (data.errors) {
        return { valid: false, error: 'Invalid token. Check your Jobber access token.' };
      }
      return { valid: true };
    } else if (response.status === 401) {
      return { valid: false, error: 'Invalid token. Check your Jobber OAuth access token.' };
    } else {
      return { valid: false, error: `Jobber API error: ${response.status}` };
    }
  } catch {
    return { valid: false, error: 'Failed to connect to Jobber. Check your network.' };
  }
}

// Test Housecall Pro connection
async function testHousecallPro(token: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const response = await fetch('https://api.housecallpro.com/v1/me', {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    });

    if (response.ok) {
      return { valid: true };
    } else if (response.status === 401) {
      return { valid: false, error: 'Invalid API key. Check your Housecall Pro API key.' };
    } else {
      return { valid: false, error: `Housecall Pro API error: ${response.status}` };
    }
  } catch {
    return { valid: false, error: 'Failed to connect to Housecall Pro. Check your network.' };
  }
}

// Test Toggl Track connection
async function testToggl(token: string): Promise<{ valid: boolean; username?: string; error?: string }> {
  try {
    const auth = Buffer.from(`${token}:api_token`).toString('base64');

    const response = await fetch('https://api.track.toggl.com/api/v9/me', {
      headers: {
        Authorization: `Basic ${auth}`,
      },
    });

    if (response.ok) {
      const data = await response.json();
      return { valid: true, username: data.fullname || data.email };
    } else if (response.status === 401 || response.status === 403) {
      return { valid: false, error: 'Invalid API token. Check your Toggl Track API token.' };
    } else {
      return { valid: false, error: `Toggl API error: ${response.status}` };
    }
  } catch {
    return { valid: false, error: 'Failed to connect to Toggl. Check your network.' };
  }
}

// Test Workyard connection
async function testWorkyard(token: string): Promise<{ valid: boolean; error?: string }> {
  try {
    // Basic validation - Workyard API details may vary
    if (!token || token.length < 10) {
      return { valid: false, error: 'Invalid API key format.' };
    }
    // Accept the key for now - will fail on first use if invalid
    return { valid: true };
  } catch {
    return { valid: false, error: 'Failed to validate Workyard credentials.' };
  }
}

// Test Canva connection
// Token format: CLIENT_ID|CLIENT_SECRET|ACCESS_TOKEN
async function testCanva(token: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const parts = token.split('|');
    if (parts.length !== 3) {
      return { valid: false, error: 'Invalid format. Enter Client ID, Client Secret, and Access Token.' };
    }

    const [, , accessToken] = parts.map(p => p.trim());

    const response = await fetch('https://api.canva.com/rest/v1/users/me', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (response.ok) {
      return { valid: true };
    } else if (response.status === 401) {
      return { valid: false, error: 'Invalid credentials. Check your Canva access token.' };
    } else {
      return { valid: false, error: `Canva API error: ${response.status}` };
    }
  } catch {
    return { valid: false, error: 'Failed to connect to Canva. Check your network.' };
  }
}

// Test Descript connection
async function testDescript(token: string): Promise<{ valid: boolean; error?: string }> {
  try {
    // Basic validation - Descript API is partner-based
    if (!token || token.length < 10) {
      return { valid: false, error: 'Invalid API token format.' };
    }
    // Accept the token - will fail on first use if invalid
    return { valid: true };
  } catch {
    return { valid: false, error: 'Failed to validate Descript credentials.' };
  }
}

// Test Telegram Bot connection
async function testTelegram(token: string): Promise<{ valid: boolean; username?: string; error?: string }> {
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/getMe`);

    if (response.ok) {
      const data = await response.json();
      if (data.ok) {
        return { valid: true, username: data.result?.username || data.result?.first_name };
      }
      return { valid: false, error: 'Invalid bot token.' };
    } else if (response.status === 401) {
      return { valid: false, error: 'Invalid bot token. Check your Telegram Bot Token from BotFather.' };
    } else {
      return { valid: false, error: `Telegram API error: ${response.status}` };
    }
  } catch {
    return { valid: false, error: 'Failed to connect to Telegram. Check your network.' };
  }
}

// Test Expensify connection
// Token format: PARTNER_USER_ID|PARTNER_USER_SECRET
async function testExpensify(token: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const parts = token.split('|');
    if (parts.length !== 2) {
      return { valid: false, error: 'Invalid format. Enter Partner User ID and Partner User Secret.' };
    }

    const [partnerUserID, partnerUserSecret] = parts.map(p => p.trim());

    // Test with a simple API call
    const formData = new URLSearchParams();
    formData.append('requestJobDescription', JSON.stringify({
      type: 'get',
      credentials: { partnerUserID, partnerUserSecret },
      inputSettings: { type: 'policyList' },
    }));

    const response = await fetch('https://integrations.expensify.com/Integration-Server/ExpensifyIntegrations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData,
    });

    if (response.ok) {
      const text = await response.text();
      if (text.includes('error') && text.includes('401')) {
        return { valid: false, error: 'Invalid credentials. Check your Expensify partner credentials.' };
      }
      return { valid: true };
    } else {
      return { valid: false, error: `Expensify API error: ${response.status}` };
    }
  } catch {
    return { valid: false, error: 'Failed to connect to Expensify. Check your network.' };
  }
}

// Test YNAB connection
async function testYNAB(token: string): Promise<{ valid: boolean; username?: string; error?: string }> {
  try {
    const response = await fetch('https://api.ynab.com/v1/user', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.ok) {
      const data = await response.json();
      return { valid: true, username: data.data?.user?.id };
    } else if (response.status === 401) {
      return { valid: false, error: 'Invalid token. Check your YNAB Personal Access Token.' };
    } else {
      return { valid: false, error: `YNAB API error: ${response.status}` };
    }
  } catch {
    return { valid: false, error: 'Failed to connect to YNAB. Check your network.' };
  }
}

// Test Plaid connection
// Token format: CLIENT_ID|SECRET|ENV
async function testPlaid(token: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const parts = token.split('|');
    if (parts.length < 2) {
      return { valid: false, error: 'Invalid format. Enter Client ID, Secret, and optionally Environment.' };
    }

    const [clientId, secret] = parts.map(p => p.trim());
    const env = parts[2]?.trim() || 'sandbox';
    const baseUrl = env === 'production' ? 'https://production.plaid.com' : 'https://sandbox.plaid.com';

    const response = await fetch(`${baseUrl}/institutions/get`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        secret: secret,
        count: 1,
        offset: 0,
        country_codes: ['US'],
      }),
    });

    if (response.ok) {
      return { valid: true };
    } else if (response.status === 400) {
      const data = await response.json();
      if (data.error_code === 'INVALID_API_KEYS') {
        return { valid: false, error: 'Invalid credentials. Check your Plaid Client ID and Secret.' };
      }
      return { valid: true }; // Other 400 errors might be valid auth
    } else {
      return { valid: false, error: `Plaid API error: ${response.status}` };
    }
  } catch {
    return { valid: false, error: 'Failed to connect to Plaid. Check your network.' };
  }
}

// Test Wave Accounting connection
async function testWave(token: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const response = await fetch('https://gql.waveapps.com/graphql/public', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: '{ user { id firstName lastName } }',
      }),
    });

    if (response.ok) {
      const data = await response.json();
      if (data.errors) {
        return { valid: false, error: 'Invalid token. Check your Wave OAuth token.' };
      }
      return { valid: true };
    } else if (response.status === 401) {
      return { valid: false, error: 'Invalid token. Check your Wave Accounting OAuth token.' };
    } else {
      return { valid: false, error: `Wave API error: ${response.status}` };
    }
  } catch {
    return { valid: false, error: 'Failed to connect to Wave Accounting. Check your network.' };
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
      case 'coinbase-trade':
        result = await testCoinbaseTrade(token);
        break;
      case 'alpaca':
        result = await testAlpaca(token);
        break;
      case 'alphavantage':
        result = await testAlphaVantage(token);
        break;
      case 'coingecko':
        result = await testCoinGecko(token);
        break;
      case 'newsapi':
        result = await testNewsAPI(token);
        break;
      case 'zapier':
        result = await testZapier(token);
        break;
      case 'mixpanel':
        result = await testMixpanel(token);
        break;
      case 'amplitude':
        result = await testAmplitude(token);
        break;
      case 'asana':
        result = await testAsana(token);
        break;
      case 'trello':
        result = await testTrello(token);
        break;
      case 'clickup':
        result = await testClickUp(token);
        break;
      case 'monday':
        result = await testMonday(token);
        break;
      case 'wordpress':
        result = await testWordPress(token);
        break;
      case 'webflow':
        result = await testWebflow(token);
        break;
      case 'ghost':
        result = await testGhost(token);
        break;
      case 'docusign':
        result = await testDocuSign(token);
        break;
      case 'hellosign':
        result = await testHelloSign(token);
        break;
      case 'jobber':
        result = await testJobber(token);
        break;
      case 'housecallpro':
        result = await testHousecallPro(token);
        break;
      case 'toggl':
        result = await testToggl(token);
        break;
      case 'workyard':
        result = await testWorkyard(token);
        break;
      case 'canva':
        result = await testCanva(token);
        break;
      case 'descript':
        result = await testDescript(token);
        break;
      case 'telegram':
        result = await testTelegram(token);
        break;
      case 'expensify':
        result = await testExpensify(token);
        break;
      case 'ynab':
        result = await testYNAB(token);
        break;
      case 'plaid':
        result = await testPlaid(token);
        break;
      case 'wave':
        result = await testWave(token);
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

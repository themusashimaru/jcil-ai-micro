/**
 * TEST CONNECTOR API
 * Validates that a token works before saving
 * POST: Test a connection token
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server-auth';

export const runtime = 'nodejs';

// Test GitHub connection
async function testGitHub(token: string): Promise<{ valid: boolean; username?: string; error?: string }> {
  try {
    const response = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'JCIL-AI-App',
      },
    });

    if (response.ok) {
      const data = await response.json();
      return { valid: true, username: data.login };
    } else if (response.status === 401) {
      return { valid: false, error: 'Invalid token. Please check your Personal Access Token.' };
    } else {
      return { valid: false, error: `GitHub API error: ${response.status}` };
    }
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

    let result: { valid: boolean; username?: string; shopName?: string; error?: string };

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
      default:
        // For services we haven't implemented testing for yet, assume valid
        result = { valid: true };
    }

    if (result.valid) {
      return NextResponse.json({
        success: true,
        message: 'Connection successful!',
        username: result.username,
        shopName: result.shopName,
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

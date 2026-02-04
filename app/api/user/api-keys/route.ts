/**
 * USER API KEYS ROUTE
 * ====================
 *
 * Manages user's own API keys for AI providers (BYOK - Bring Your Own Key)
 *
 * Security: Write-only approach
 * - Keys are encrypted before storage
 * - Keys are NEVER returned to the client after saving
 * - Users can only see: which providers have keys, test them, or delete them
 *
 * GET: Get list of configured providers (not the keys)
 * POST: Save or test an API key
 * DELETE: Remove an API key
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { logger } from '@/lib/logger';
import { encrypt, decrypt } from '@/lib/security/crypto';

const log = logger('UserAPIKeys');

export const runtime = 'nodejs';

// Supported providers for BYOK
const SUPPORTED_PROVIDERS = ['openai', 'deepseek', 'xai', 'gemini'] as const;
type ProviderId = (typeof SUPPORTED_PROVIDERS)[number];

// Provider display info
const PROVIDER_INFO: Record<ProviderId, { name: string; keyPrefix: string; testUrl: string }> = {
  openai: {
    name: 'OpenAI',
    keyPrefix: 'sk-',
    testUrl: 'https://api.openai.com/v1/models',
  },
  deepseek: {
    name: 'DeepSeek',
    keyPrefix: 'sk-',
    testUrl: 'https://api.deepseek.com/v1/models',
  },
  xai: {
    name: 'xAI (Grok)',
    keyPrefix: 'xai-',
    testUrl: 'https://api.x.ai/v1/models',
  },
  gemini: {
    name: 'Google Gemini',
    keyPrefix: 'AI',
    testUrl: 'https://generativelanguage.googleapis.com/v1/models',
  },
};

/**
 * Test if an API key is valid by making a simple API call
 */
async function testApiKey(provider: ProviderId, apiKey: string): Promise<{ valid: boolean; error?: string }> {
  const info = PROVIDER_INFO[provider];

  try {
    let response: Response;

    if (provider === 'gemini') {
      // Gemini uses query param for API key
      response = await fetch(`${info.testUrl}?key=${apiKey}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
    } else {
      // OpenAI-compatible APIs use Bearer token
      response = await fetch(info.testUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      });
    }

    if (response.ok) {
      return { valid: true };
    }

    if (response.status === 401 || response.status === 403) {
      return { valid: false, error: 'Invalid API key' };
    }

    return { valid: false, error: `API returned status ${response.status}` };
  } catch (error) {
    log.error('Error testing API key', { provider, error });
    return { valid: false, error: 'Failed to connect to API' };
  }
}

/**
 * GET - Get list of configured providers (without keys)
 */
export async function GET() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Ignore errors in read-only contexts
          }
        },
      },
    }
  );

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: prefs } = await adminClient
      .from('user_provider_preferences')
      .select('provider_api_keys')
      .eq('user_id', user.id)
      .single();

    // Return which providers have keys configured (not the keys themselves)
    const configuredProviders: Array<{
      provider: ProviderId;
      name: string;
      configured: boolean;
      lastChars?: string;
    }> = [];

    const encryptedKeys = (prefs?.provider_api_keys || {}) as Record<string, string>;

    for (const provider of SUPPORTED_PROVIDERS) {
      const hasKey = !!encryptedKeys[provider];
      let lastChars: string | undefined;

      if (hasKey) {
        try {
          // Decrypt to get last 4 chars for display
          const decrypted = decrypt(encryptedKeys[provider]);
          lastChars = decrypted.slice(-4);
        } catch {
          // If decryption fails, key is invalid
          lastChars = '****';
        }
      }

      configuredProviders.push({
        provider,
        name: PROVIDER_INFO[provider].name,
        configured: hasKey,
        lastChars,
      });
    }

    return NextResponse.json({ providers: configuredProviders });
  } catch (error) {
    log.error('Error fetching API keys', { error });
    return NextResponse.json({ error: 'Failed to fetch API keys' }, { status: 500 });
  }
}

/**
 * POST - Save or test an API key
 */
export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Ignore errors in read-only contexts
          }
        },
      },
    }
  );

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { provider, apiKey, action } = body;

    // Validate provider
    if (!SUPPORTED_PROVIDERS.includes(provider)) {
      return NextResponse.json({ error: 'Invalid provider' }, { status: 400 });
    }

    // Action: test - Just test the key without saving
    if (action === 'test') {
      if (!apiKey) {
        return NextResponse.json({ error: 'API key required for testing' }, { status: 400 });
      }

      const testResult = await testApiKey(provider, apiKey);
      return NextResponse.json(testResult);
    }

    // Action: save (default) - Validate and save the key
    if (!apiKey) {
      return NextResponse.json({ error: 'API key required' }, { status: 400 });
    }

    // Validate key format
    const info = PROVIDER_INFO[provider as ProviderId];
    if (!apiKey.startsWith(info.keyPrefix)) {
      return NextResponse.json({
        error: `Invalid ${info.name} API key format. Key should start with "${info.keyPrefix}"`
      }, { status: 400 });
    }

    // Test the key before saving
    const testResult = await testApiKey(provider, apiKey);
    if (!testResult.valid) {
      return NextResponse.json({
        error: testResult.error || 'Invalid API key'
      }, { status: 400 });
    }

    // Encrypt and save
    const encryptedKey = encrypt(apiKey);

    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Get existing preferences or create new
    const { data: existing } = await adminClient
      .from('user_provider_preferences')
      .select('provider_api_keys')
      .eq('user_id', user.id)
      .single();

    const existingKeys = (existing?.provider_api_keys || {}) as Record<string, string>;
    const updatedKeys = { ...existingKeys, [provider]: encryptedKey };

    // Upsert the preferences
    const { error: upsertError } = await adminClient
      .from('user_provider_preferences')
      .upsert({
        user_id: user.id,
        provider_api_keys: updatedKeys,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id',
      });

    if (upsertError) {
      log.error('Error saving API key', { error: upsertError });
      return NextResponse.json({ error: 'Failed to save API key' }, { status: 500 });
    }

    log.info('API key saved', { userId: user.id, provider });

    return NextResponse.json({
      success: true,
      message: `${info.name} API key saved successfully`,
      lastChars: apiKey.slice(-4),
    });
  } catch (error) {
    log.error('Error in POST /api/user/api-keys', { error });
    return NextResponse.json({ error: 'Failed to save API key' }, { status: 500 });
  }
}

/**
 * DELETE - Remove an API key
 */
export async function DELETE(request: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Ignore errors in read-only contexts
          }
        },
      },
    }
  );

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const provider = searchParams.get('provider');

    if (!provider || !SUPPORTED_PROVIDERS.includes(provider as ProviderId)) {
      return NextResponse.json({ error: 'Invalid provider' }, { status: 400 });
    }

    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Get existing keys
    const { data: existing } = await adminClient
      .from('user_provider_preferences')
      .select('provider_api_keys')
      .eq('user_id', user.id)
      .single();

    if (!existing) {
      return NextResponse.json({ error: 'No API keys found' }, { status: 404 });
    }

    const existingKeys = (existing.provider_api_keys || {}) as Record<string, string>;
    delete existingKeys[provider];

    // Update
    const { error: updateError } = await adminClient
      .from('user_provider_preferences')
      .update({
        provider_api_keys: existingKeys,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id);

    if (updateError) {
      log.error('Error deleting API key', { error: updateError });
      return NextResponse.json({ error: 'Failed to delete API key' }, { status: 500 });
    }

    log.info('API key deleted', { userId: user.id, provider });

    return NextResponse.json({
      success: true,
      message: `${PROVIDER_INFO[provider as ProviderId].name} API key removed`,
    });
  } catch (error) {
    log.error('Error in DELETE /api/user/api-keys', { error });
    return NextResponse.json({ error: 'Failed to delete API key' }, { status: 500 });
  }
}

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
const SUPPORTED_PROVIDERS = ['claude', 'openai', 'deepseek', 'xai', 'gemini'] as const;
type ProviderId = (typeof SUPPORTED_PROVIDERS)[number];

// Provider display info
const PROVIDER_INFO: Record<
  ProviderId,
  { name: string; keyPrefix: string; testUrl: string; defaultModel: string }
> = {
  claude: {
    name: 'Anthropic (Claude)',
    keyPrefix: 'sk-ant-',
    testUrl: 'https://api.anthropic.com/v1/messages',
    defaultModel: 'claude-sonnet-4-6',
  },
  openai: {
    name: 'OpenAI',
    keyPrefix: 'sk-',
    testUrl: 'https://api.openai.com/v1/models',
    defaultModel: 'gpt-4o',
  },
  deepseek: {
    name: 'DeepSeek',
    keyPrefix: 'sk-',
    testUrl: 'https://api.deepseek.com/v1/models',
    defaultModel: 'deepseek-chat',
  },
  xai: {
    name: 'xAI (Grok)',
    keyPrefix: 'xai-',
    testUrl: 'https://api.x.ai/v1/models',
    defaultModel: 'grok-2',
  },
  gemini: {
    name: 'Google Gemini',
    keyPrefix: 'AI',
    testUrl: 'https://generativelanguage.googleapis.com/v1/models',
    defaultModel: 'gemini-2.5-pro',
  },
};

// Structure for stored provider config (key + optional model)
interface ProviderConfig {
  key: string; // Encrypted API key
  model?: string; // Optional custom model name (NOT encrypted)
}

/**
 * Test if an API key is valid by making a simple API call
 */
async function testApiKey(
  provider: ProviderId,
  apiKey: string
): Promise<{ valid: boolean; error?: string }> {
  const info = PROVIDER_INFO[provider];

  try {
    let response: Response;

    if (provider === 'claude') {
      // Claude requires a POST to /messages with specific headers
      // Use a minimal request to test the key
      response = await fetch(info.testUrl, {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 1,
          messages: [{ role: 'user', content: 'test' }],
        }),
      });
      // Claude returns 200 on success, 401 on invalid key
      // A valid key will return a response (even if rate limited)
      if (response.ok || response.status === 429) {
        return { valid: true };
      }
    } else if (provider === 'gemini') {
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
          Authorization: `Bearer ${apiKey}`,
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
      model?: string;
      defaultModel: string;
    }> = [];

    const storedConfigs = (prefs?.provider_api_keys || {}) as Record<
      string,
      string | ProviderConfig
    >;

    for (const provider of SUPPORTED_PROVIDERS) {
      const stored = storedConfigs[provider];
      // Handle both old format (string) and new format (ProviderConfig)
      const config: ProviderConfig | null = stored
        ? typeof stored === 'string'
          ? { key: stored } // Old format: just the encrypted key
          : stored // New format: { key, model }
        : null;

      const hasKey = !!config?.key;
      let lastChars: string | undefined;

      if (hasKey && config?.key) {
        try {
          // Decrypt to get last 4 chars for display
          const decrypted = decrypt(config.key);
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
        model: config?.model, // Return custom model if set
        defaultModel: PROVIDER_INFO[provider].defaultModel,
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
    const { provider, apiKey, model, action } = body;

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
      return NextResponse.json(
        {
          error: `Invalid ${info.name} API key format. Key should start with "${info.keyPrefix}"`,
        },
        { status: 400 }
      );
    }

    // Test the key before saving
    const testResult = await testApiKey(provider, apiKey);
    if (!testResult.valid) {
      return NextResponse.json(
        {
          error: testResult.error || 'Invalid API key',
        },
        { status: 400 }
      );
    }

    // Encrypt and save with optional custom model
    const encryptedKey = encrypt(apiKey);
    const providerConfig: ProviderConfig = {
      key: encryptedKey,
      ...(model && model.trim() ? { model: model.trim() } : {}),
    };

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

    const existingKeys = (existing?.provider_api_keys || {}) as Record<
      string,
      string | ProviderConfig
    >;
    const updatedKeys = { ...existingKeys, [provider]: providerConfig };

    // Upsert the preferences
    const { error: upsertError } = await adminClient.from('user_provider_preferences').upsert(
      {
        user_id: user.id,
        provider_api_keys: updatedKeys,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'user_id',
      }
    );

    if (upsertError) {
      log.error('Error saving API key', { error: upsertError });
      return NextResponse.json({ error: 'Failed to save API key' }, { status: 500 });
    }

    log.info('API key saved', {
      userId: user.id,
      provider,
      hasCustomModel: !!providerConfig.model,
    });

    return NextResponse.json({
      success: true,
      message: `${info.name} API key saved successfully`,
      lastChars: apiKey.slice(-4),
      model: providerConfig.model || info.defaultModel,
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

    const existingKeys = (existing.provider_api_keys || {}) as Record<
      string,
      string | ProviderConfig
    >;
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

/**
 * UPSTASH ACTION EXECUTION API
 * Execute Upstash Redis API actions
 * POST: Execute a specific Upstash action
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server-auth';
import { getUserConnection } from '@/lib/connectors/helpers';

export const runtime = 'nodejs';

interface ExecuteRequest {
  action: string;
  params: Record<string, unknown>;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const connection = await getUserConnection(user.id, 'upstash');
    if (!connection) {
      return NextResponse.json({ error: 'Upstash not connected' }, { status: 400 });
    }

    const { action, params }: ExecuteRequest = await request.json();

    if (!action) {
      return NextResponse.json({ error: 'Action is required' }, { status: 400 });
    }

    // Token format: UPSTASH_REDIS_REST_URL|UPSTASH_REDIS_REST_TOKEN
    const [restUrl, restToken] = connection.token.split('|');
    if (!restUrl || !restToken) {
      return NextResponse.json({ error: 'Invalid Upstash credentials format' }, { status: 400 });
    }

    // Helper to execute Redis commands via REST API
    async function redisCommand(command: string[]): Promise<unknown> {
      const response = await fetch(restUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${restToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(command),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Redis command failed');
      }

      return response.json();
    }

    let result: unknown;

    switch (action) {
      case 'ping': {
        // Test connection
        result = await redisCommand(['PING']);
        break;
      }

      case 'get': {
        // Get a key
        const key = params.key as string;
        if (!key) {
          return NextResponse.json({ error: 'key is required' }, { status: 400 });
        }
        result = await redisCommand(['GET', key]);
        break;
      }

      case 'set': {
        // Set a key
        const key = params.key as string;
        const value = params.value as string;
        if (!key || value === undefined) {
          return NextResponse.json({ error: 'key and value are required' }, { status: 400 });
        }
        const cmd = ['SET', key, String(value)];
        if (params.ex) cmd.push('EX', String(params.ex)); // Expire in seconds
        if (params.px) cmd.push('PX', String(params.px)); // Expire in milliseconds
        if (params.nx) cmd.push('NX'); // Only set if not exists
        if (params.xx) cmd.push('XX'); // Only set if exists
        result = await redisCommand(cmd);
        break;
      }

      case 'del':
      case 'delete': {
        // Delete key(s)
        const keys = Array.isArray(params.keys) ? params.keys : [params.key];
        if (!keys || keys.length === 0) {
          return NextResponse.json({ error: 'key or keys is required' }, { status: 400 });
        }
        result = await redisCommand(['DEL', ...keys]);
        break;
      }

      case 'keys': {
        // Find keys matching pattern
        const pattern = (params.pattern as string) || '*';
        result = await redisCommand(['KEYS', pattern]);
        break;
      }

      case 'exists': {
        // Check if key exists
        const key = params.key as string;
        if (!key) {
          return NextResponse.json({ error: 'key is required' }, { status: 400 });
        }
        result = await redisCommand(['EXISTS', key]);
        break;
      }

      case 'expire': {
        // Set expiration on key
        const key = params.key as string;
        const seconds = params.seconds as number;
        if (!key || !seconds) {
          return NextResponse.json({ error: 'key and seconds are required' }, { status: 400 });
        }
        result = await redisCommand(['EXPIRE', key, String(seconds)]);
        break;
      }

      case 'ttl': {
        // Get time to live
        const key = params.key as string;
        if (!key) {
          return NextResponse.json({ error: 'key is required' }, { status: 400 });
        }
        result = await redisCommand(['TTL', key]);
        break;
      }

      case 'incr': {
        // Increment a key
        const key = params.key as string;
        if (!key) {
          return NextResponse.json({ error: 'key is required' }, { status: 400 });
        }
        result = await redisCommand(['INCR', key]);
        break;
      }

      case 'decr': {
        // Decrement a key
        const key = params.key as string;
        if (!key) {
          return NextResponse.json({ error: 'key is required' }, { status: 400 });
        }
        result = await redisCommand(['DECR', key]);
        break;
      }

      case 'hget': {
        // Get hash field
        const key = params.key as string;
        const field = params.field as string;
        if (!key || !field) {
          return NextResponse.json({ error: 'key and field are required' }, { status: 400 });
        }
        result = await redisCommand(['HGET', key, field]);
        break;
      }

      case 'hset': {
        // Set hash field
        const key = params.key as string;
        const field = params.field as string;
        const value = params.value as string;
        if (!key || !field || value === undefined) {
          return NextResponse.json({ error: 'key, field, and value are required' }, { status: 400 });
        }
        result = await redisCommand(['HSET', key, field, String(value)]);
        break;
      }

      case 'hgetall': {
        // Get all hash fields
        const key = params.key as string;
        if (!key) {
          return NextResponse.json({ error: 'key is required' }, { status: 400 });
        }
        result = await redisCommand(['HGETALL', key]);
        break;
      }

      case 'lpush': {
        // Push to list (left)
        const key = params.key as string;
        const values = Array.isArray(params.values) ? params.values : [params.value];
        if (!key || !values) {
          return NextResponse.json({ error: 'key and value(s) are required' }, { status: 400 });
        }
        result = await redisCommand(['LPUSH', key, ...values.map(String)]);
        break;
      }

      case 'rpush': {
        // Push to list (right)
        const key = params.key as string;
        const values = Array.isArray(params.values) ? params.values : [params.value];
        if (!key || !values) {
          return NextResponse.json({ error: 'key and value(s) are required' }, { status: 400 });
        }
        result = await redisCommand(['RPUSH', key, ...values.map(String)]);
        break;
      }

      case 'lrange': {
        // Get list range
        const key = params.key as string;
        const start = params.start ?? 0;
        const stop = params.stop ?? -1;
        if (!key) {
          return NextResponse.json({ error: 'key is required' }, { status: 400 });
        }
        result = await redisCommand(['LRANGE', key, String(start), String(stop)]);
        break;
      }

      case 'dbsize': {
        // Get database size
        result = await redisCommand(['DBSIZE']);
        break;
      }

      case 'info': {
        // Get server info
        result = await redisCommand(['INFO']);
        break;
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('[Upstash Execute API] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

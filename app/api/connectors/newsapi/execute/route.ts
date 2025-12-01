/**
 * NEWSAPI ACTION EXECUTION API
 * Execute NewsAPI news aggregation actions
 * POST: Execute a specific news action
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server-auth';
import { getUserConnection } from '@/lib/connectors/helpers';

export const runtime = 'nodejs';

const NEWSAPI_BASE = 'https://newsapi.org/v2';

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

    const connection = await getUserConnection(user.id, 'newsapi');
    if (!connection) {
      return NextResponse.json({ error: 'NewsAPI not connected' }, { status: 400 });
    }

    const { action, params }: ExecuteRequest = await request.json();

    if (!action) {
      return NextResponse.json({ error: 'Action is required' }, { status: 400 });
    }

    const apiKey = connection.token;

    // Helper for NewsAPI requests
    async function newsFetch(endpoint: string, queryParams: Record<string, string>): Promise<Response> {
      const url = new URL(`${NEWSAPI_BASE}${endpoint}`);
      Object.entries(queryParams).forEach(([key, value]) => {
        if (value) url.searchParams.append(key, value);
      });
      url.searchParams.append('apiKey', apiKey);

      return fetch(url.toString());
    }

    let result: unknown;

    switch (action) {
      case 'get_top_headlines': {
        // Get top headlines
        const queryParams: Record<string, string> = {};

        if (params.country) queryParams.country = params.country as string;
        if (params.category) queryParams.category = params.category as string;
        if (params.sources) queryParams.sources = params.sources as string;
        if (params.q) queryParams.q = params.q as string;
        if (params.pageSize) queryParams.pageSize = String(params.pageSize);
        if (params.page) queryParams.page = String(params.page);

        // Default to US if no filters provided
        if (!queryParams.country && !queryParams.sources && !queryParams.category) {
          queryParams.country = 'us';
        }

        const response = await newsFetch('/top-headlines', queryParams);
        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.message || 'Failed to get headlines' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'search_everything': {
        // Search all articles
        const q = params.q as string;
        if (!q) {
          return NextResponse.json({ error: 'q (search query) is required' }, { status: 400 });
        }

        const queryParams: Record<string, string> = { q };

        if (params.searchIn) queryParams.searchIn = params.searchIn as string;
        if (params.sources) queryParams.sources = params.sources as string;
        if (params.domains) queryParams.domains = params.domains as string;
        if (params.excludeDomains) queryParams.excludeDomains = params.excludeDomains as string;
        if (params.from) queryParams.from = params.from as string;
        if (params.to) queryParams.to = params.to as string;
        if (params.language) queryParams.language = params.language as string;
        if (params.sortBy) queryParams.sortBy = params.sortBy as string;
        if (params.pageSize) queryParams.pageSize = String(params.pageSize);
        if (params.page) queryParams.page = String(params.page);

        const response = await newsFetch('/everything', queryParams);
        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.message || 'Failed to search' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'get_sources': {
        // Get available news sources
        const queryParams: Record<string, string> = {};

        if (params.category) queryParams.category = params.category as string;
        if (params.language) queryParams.language = params.language as string;
        if (params.country) queryParams.country = params.country as string;

        const response = await newsFetch('/top-headlines/sources', queryParams);
        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.message || 'Failed to get sources' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'get_business_news': {
        // Shortcut for business news
        const country = (params.country as string) || 'us';
        const response = await newsFetch('/top-headlines', {
          country,
          category: 'business',
          pageSize: String(params.pageSize || 20),
        });
        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.message || 'Failed to get business news' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'get_tech_news': {
        // Shortcut for technology news
        const country = (params.country as string) || 'us';
        const response = await newsFetch('/top-headlines', {
          country,
          category: 'technology',
          pageSize: String(params.pageSize || 20),
        });
        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.message || 'Failed to get tech news' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'get_crypto_news': {
        // Search for crypto news
        const response = await newsFetch('/everything', {
          q: 'cryptocurrency OR bitcoin OR ethereum OR crypto',
          sortBy: 'publishedAt',
          language: 'en',
          pageSize: String(params.pageSize || 20),
        });
        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.message || 'Failed to get crypto news' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'get_stock_news': {
        // Get news for a specific stock
        const symbol = params.symbol as string;
        const company = params.company as string;
        if (!symbol && !company) {
          return NextResponse.json({ error: 'symbol or company name is required' }, { status: 400 });
        }

        const query = company || symbol;
        const response = await newsFetch('/everything', {
          q: query,
          sortBy: 'publishedAt',
          language: 'en',
          pageSize: String(params.pageSize || 20),
        });
        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.message || 'Failed to get stock news' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'get_ai_news': {
        // Search for AI news
        const response = await newsFetch('/everything', {
          q: 'artificial intelligence OR AI OR machine learning OR ChatGPT OR OpenAI',
          sortBy: 'publishedAt',
          language: 'en',
          pageSize: String(params.pageSize || 20),
        });
        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.message || 'Failed to get AI news' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'get_startup_news': {
        // Search for startup news
        const response = await newsFetch('/everything', {
          q: 'startup OR venture capital OR funding round OR Series A',
          sortBy: 'publishedAt',
          language: 'en',
          pageSize: String(params.pageSize || 20),
        });
        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.message || 'Failed to get startup news' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('[NewsAPI Execute API] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

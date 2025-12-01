/**
 * COINGECKO ACTION EXECUTION API
 * Execute CoinGecko crypto data API actions
 * POST: Execute a specific data action
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server-auth';
import { getUserConnection } from '@/lib/connectors/helpers';

export const runtime = 'nodejs';

const COINGECKO_API = 'https://api.coingecko.com/api/v3';
const COINGECKO_PRO_API = 'https://pro-api.coingecko.com/api/v3';

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

    const connection = await getUserConnection(user.id, 'coingecko');
    if (!connection) {
      return NextResponse.json({ error: 'CoinGecko not connected' }, { status: 400 });
    }

    const { action, params }: ExecuteRequest = await request.json();

    if (!action) {
      return NextResponse.json({ error: 'Action is required' }, { status: 400 });
    }

    const apiKey = connection.token;
    const isPro = apiKey && apiKey.length > 10;
    const baseUrl = isPro ? COINGECKO_PRO_API : COINGECKO_API;

    // Helper for CoinGecko API requests
    async function geckoFetch(endpoint: string): Promise<Response> {
      const headers: Record<string, string> = {
        'Accept': 'application/json',
      };
      if (isPro) {
        headers['x-cg-pro-api-key'] = apiKey;
      }
      return fetch(`${baseUrl}${endpoint}`, { headers });
    }

    let result: unknown;

    switch (action) {
      case 'ping': {
        // Check API status
        const response = await geckoFetch('/ping');
        if (!response.ok) {
          return NextResponse.json({ error: 'Failed to ping CoinGecko' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'get_price': {
        // Get simple price for coins
        const ids = params.ids as string;
        const vsCurrencies = (params.vsCurrencies as string) || 'usd';
        if (!ids) {
          return NextResponse.json({ error: 'ids is required (e.g., bitcoin,ethereum)' }, { status: 400 });
        }
        let endpoint = `/simple/price?ids=${ids}&vs_currencies=${vsCurrencies}`;
        if (params.includeMarketCap) endpoint += '&include_market_cap=true';
        if (params.include24hrVol) endpoint += '&include_24hr_vol=true';
        if (params.include24hrChange) endpoint += '&include_24hr_change=true';
        if (params.includeLastUpdated) endpoint += '&include_last_updated_at=true';

        const response = await geckoFetch(endpoint);
        if (!response.ok) {
          return NextResponse.json({ error: 'Failed to get price' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'get_coin': {
        // Get detailed coin data
        const id = params.id as string;
        if (!id) {
          return NextResponse.json({ error: 'id is required (e.g., bitcoin)' }, { status: 400 });
        }
        let endpoint = `/coins/${id}`;
        const queryParams: string[] = [];
        if (params.localization === false) queryParams.push('localization=false');
        if (params.tickers === false) queryParams.push('tickers=false');
        if (params.marketData === false) queryParams.push('market_data=false');
        if (params.communityData === false) queryParams.push('community_data=false');
        if (params.developerData === false) queryParams.push('developer_data=false');
        if (queryParams.length > 0) endpoint += '?' + queryParams.join('&');

        const response = await geckoFetch(endpoint);
        if (!response.ok) {
          return NextResponse.json({ error: 'Failed to get coin data' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'list_coins': {
        // List all coins with market data
        const vsCurrency = (params.vsCurrency as string) || 'usd';
        let endpoint = `/coins/markets?vs_currency=${vsCurrency}`;
        if (params.ids) endpoint += `&ids=${params.ids}`;
        if (params.category) endpoint += `&category=${params.category}`;
        if (params.order) endpoint += `&order=${params.order}`;
        if (params.perPage) endpoint += `&per_page=${params.perPage}`;
        if (params.page) endpoint += `&page=${params.page}`;
        if (params.sparkline) endpoint += '&sparkline=true';
        if (params.priceChangePercentage) endpoint += `&price_change_percentage=${params.priceChangePercentage}`;

        const response = await geckoFetch(endpoint);
        if (!response.ok) {
          return NextResponse.json({ error: 'Failed to list coins' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'get_trending': {
        // Get trending coins
        const response = await geckoFetch('/search/trending');
        if (!response.ok) {
          return NextResponse.json({ error: 'Failed to get trending' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'search': {
        // Search for coins, exchanges, etc.
        const query = params.query as string;
        if (!query) {
          return NextResponse.json({ error: 'query is required' }, { status: 400 });
        }
        const response = await geckoFetch(`/search?query=${encodeURIComponent(query)}`);
        if (!response.ok) {
          return NextResponse.json({ error: 'Failed to search' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'get_market_chart': {
        // Get historical market data
        const id = params.id as string;
        const vsCurrency = (params.vsCurrency as string) || 'usd';
        const days = (params.days as string) || '7';
        if (!id) {
          return NextResponse.json({ error: 'id is required' }, { status: 400 });
        }
        let endpoint = `/coins/${id}/market_chart?vs_currency=${vsCurrency}&days=${days}`;
        if (params.interval) endpoint += `&interval=${params.interval}`;

        const response = await geckoFetch(endpoint);
        if (!response.ok) {
          return NextResponse.json({ error: 'Failed to get market chart' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'get_ohlc': {
        // Get OHLC data
        const id = params.id as string;
        const vsCurrency = (params.vsCurrency as string) || 'usd';
        const days = (params.days as string) || '7';
        if (!id) {
          return NextResponse.json({ error: 'id is required' }, { status: 400 });
        }
        const response = await geckoFetch(`/coins/${id}/ohlc?vs_currency=${vsCurrency}&days=${days}`);
        if (!response.ok) {
          return NextResponse.json({ error: 'Failed to get OHLC' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'get_global': {
        // Get global crypto market data
        const response = await geckoFetch('/global');
        if (!response.ok) {
          return NextResponse.json({ error: 'Failed to get global data' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'get_global_defi': {
        // Get global DeFi data
        const response = await geckoFetch('/global/decentralized_finance_defi');
        if (!response.ok) {
          return NextResponse.json({ error: 'Failed to get DeFi data' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'list_categories': {
        // List all categories
        const response = await geckoFetch('/coins/categories');
        if (!response.ok) {
          return NextResponse.json({ error: 'Failed to list categories' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'list_exchanges': {
        // List exchanges
        let endpoint = '/exchanges';
        if (params.perPage) endpoint += `?per_page=${params.perPage}`;
        if (params.page) endpoint += `${params.perPage ? '&' : '?'}page=${params.page}`;

        const response = await geckoFetch(endpoint);
        if (!response.ok) {
          return NextResponse.json({ error: 'Failed to list exchanges' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'get_exchange': {
        // Get exchange data
        const id = params.id as string;
        if (!id) {
          return NextResponse.json({ error: 'id is required (e.g., binance)' }, { status: 400 });
        }
        const response = await geckoFetch(`/exchanges/${id}`);
        if (!response.ok) {
          return NextResponse.json({ error: 'Failed to get exchange' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'get_exchange_rates': {
        // Get BTC exchange rates
        const response = await geckoFetch('/exchange_rates');
        if (!response.ok) {
          return NextResponse.json({ error: 'Failed to get exchange rates' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'list_nfts': {
        // List NFT collections
        let endpoint = '/nfts/list';
        const queryParams: string[] = [];
        if (params.order) queryParams.push(`order=${params.order}`);
        if (params.perPage) queryParams.push(`per_page=${params.perPage}`);
        if (params.page) queryParams.push(`page=${params.page}`);
        if (queryParams.length > 0) endpoint += '?' + queryParams.join('&');

        const response = await geckoFetch(endpoint);
        if (!response.ok) {
          return NextResponse.json({ error: 'Failed to list NFTs' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'get_nft': {
        // Get NFT collection data
        const id = params.id as string;
        if (!id) {
          return NextResponse.json({ error: 'id is required' }, { status: 400 });
        }
        const response = await geckoFetch(`/nfts/${id}`);
        if (!response.ok) {
          return NextResponse.json({ error: 'Failed to get NFT' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'get_asset_platforms': {
        // List asset platforms (blockchains)
        const response = await geckoFetch('/asset_platforms');
        if (!response.ok) {
          return NextResponse.json({ error: 'Failed to get asset platforms' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('[CoinGecko Execute API] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

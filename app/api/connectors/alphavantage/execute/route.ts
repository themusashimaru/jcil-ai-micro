/**
 * ALPHA VANTAGE ACTION EXECUTION API
 * Execute Alpha Vantage market data API actions
 * POST: Execute a specific data action
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server-auth';
import { getUserConnection } from '@/lib/connectors/helpers';

export const runtime = 'nodejs';

const ALPHA_VANTAGE_API = 'https://www.alphavantage.co/query';

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

    const connection = await getUserConnection(user.id, 'alphavantage');
    if (!connection) {
      return NextResponse.json({ error: 'Alpha Vantage not connected' }, { status: 400 });
    }

    const { action, params }: ExecuteRequest = await request.json();

    if (!action) {
      return NextResponse.json({ error: 'Action is required' }, { status: 400 });
    }

    const apiKey = connection.token;

    // Helper for Alpha Vantage API requests
    async function alphaFetch(functionName: string, additionalParams: Record<string, string> = {}): Promise<Response> {
      const queryParams = new URLSearchParams({
        function: functionName,
        apikey: apiKey,
        ...additionalParams,
      });
      return fetch(`${ALPHA_VANTAGE_API}?${queryParams}`);
    }

    let result: unknown;

    switch (action) {
      case 'get_quote': {
        // Get current price quote
        const symbol = params.symbol as string;
        if (!symbol) {
          return NextResponse.json({ error: 'symbol is required' }, { status: 400 });
        }
        const response = await alphaFetch('GLOBAL_QUOTE', { symbol: symbol.toUpperCase() });
        if (!response.ok) {
          return NextResponse.json({ error: 'Failed to get quote' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'search_symbol': {
        // Search for symbols
        const keywords = params.keywords as string;
        if (!keywords) {
          return NextResponse.json({ error: 'keywords is required' }, { status: 400 });
        }
        const response = await alphaFetch('SYMBOL_SEARCH', { keywords });
        if (!response.ok) {
          return NextResponse.json({ error: 'Failed to search symbols' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'get_intraday': {
        // Get intraday data
        const symbol = params.symbol as string;
        const interval = (params.interval as string) || '5min';
        if (!symbol) {
          return NextResponse.json({ error: 'symbol is required' }, { status: 400 });
        }
        const additionalParams: Record<string, string> = {
          symbol: symbol.toUpperCase(),
          interval,
        };
        if (params.outputsize) additionalParams.outputsize = params.outputsize as string;

        const response = await alphaFetch('TIME_SERIES_INTRADAY', additionalParams);
        if (!response.ok) {
          return NextResponse.json({ error: 'Failed to get intraday data' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'get_daily': {
        // Get daily data
        const symbol = params.symbol as string;
        if (!symbol) {
          return NextResponse.json({ error: 'symbol is required' }, { status: 400 });
        }
        const additionalParams: Record<string, string> = {
          symbol: symbol.toUpperCase(),
        };
        if (params.outputsize) additionalParams.outputsize = params.outputsize as string;

        const response = await alphaFetch('TIME_SERIES_DAILY', additionalParams);
        if (!response.ok) {
          return NextResponse.json({ error: 'Failed to get daily data' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'get_weekly': {
        // Get weekly data
        const symbol = params.symbol as string;
        if (!symbol) {
          return NextResponse.json({ error: 'symbol is required' }, { status: 400 });
        }
        const response = await alphaFetch('TIME_SERIES_WEEKLY', { symbol: symbol.toUpperCase() });
        if (!response.ok) {
          return NextResponse.json({ error: 'Failed to get weekly data' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'get_monthly': {
        // Get monthly data
        const symbol = params.symbol as string;
        if (!symbol) {
          return NextResponse.json({ error: 'symbol is required' }, { status: 400 });
        }
        const response = await alphaFetch('TIME_SERIES_MONTHLY', { symbol: symbol.toUpperCase() });
        if (!response.ok) {
          return NextResponse.json({ error: 'Failed to get monthly data' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'get_sma': {
        // Get Simple Moving Average
        const symbol = params.symbol as string;
        const interval = (params.interval as string) || 'daily';
        const timePeriod = (params.timePeriod as string) || '20';
        const seriesType = (params.seriesType as string) || 'close';
        if (!symbol) {
          return NextResponse.json({ error: 'symbol is required' }, { status: 400 });
        }
        const response = await alphaFetch('SMA', {
          symbol: symbol.toUpperCase(),
          interval,
          time_period: timePeriod,
          series_type: seriesType,
        });
        if (!response.ok) {
          return NextResponse.json({ error: 'Failed to get SMA' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'get_ema': {
        // Get Exponential Moving Average
        const symbol = params.symbol as string;
        const interval = (params.interval as string) || 'daily';
        const timePeriod = (params.timePeriod as string) || '20';
        const seriesType = (params.seriesType as string) || 'close';
        if (!symbol) {
          return NextResponse.json({ error: 'symbol is required' }, { status: 400 });
        }
        const response = await alphaFetch('EMA', {
          symbol: symbol.toUpperCase(),
          interval,
          time_period: timePeriod,
          series_type: seriesType,
        });
        if (!response.ok) {
          return NextResponse.json({ error: 'Failed to get EMA' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'get_rsi': {
        // Get RSI
        const symbol = params.symbol as string;
        const interval = (params.interval as string) || 'daily';
        const timePeriod = (params.timePeriod as string) || '14';
        const seriesType = (params.seriesType as string) || 'close';
        if (!symbol) {
          return NextResponse.json({ error: 'symbol is required' }, { status: 400 });
        }
        const response = await alphaFetch('RSI', {
          symbol: symbol.toUpperCase(),
          interval,
          time_period: timePeriod,
          series_type: seriesType,
        });
        if (!response.ok) {
          return NextResponse.json({ error: 'Failed to get RSI' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'get_macd': {
        // Get MACD
        const symbol = params.symbol as string;
        const interval = (params.interval as string) || 'daily';
        const seriesType = (params.seriesType as string) || 'close';
        if (!symbol) {
          return NextResponse.json({ error: 'symbol is required' }, { status: 400 });
        }
        const response = await alphaFetch('MACD', {
          symbol: symbol.toUpperCase(),
          interval,
          series_type: seriesType,
        });
        if (!response.ok) {
          return NextResponse.json({ error: 'Failed to get MACD' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'get_bbands': {
        // Get Bollinger Bands
        const symbol = params.symbol as string;
        const interval = (params.interval as string) || 'daily';
        const timePeriod = (params.timePeriod as string) || '20';
        const seriesType = (params.seriesType as string) || 'close';
        if (!symbol) {
          return NextResponse.json({ error: 'symbol is required' }, { status: 400 });
        }
        const response = await alphaFetch('BBANDS', {
          symbol: symbol.toUpperCase(),
          interval,
          time_period: timePeriod,
          series_type: seriesType,
        });
        if (!response.ok) {
          return NextResponse.json({ error: 'Failed to get Bollinger Bands' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'get_company_overview': {
        // Get company overview/fundamentals
        const symbol = params.symbol as string;
        if (!symbol) {
          return NextResponse.json({ error: 'symbol is required' }, { status: 400 });
        }
        const response = await alphaFetch('OVERVIEW', { symbol: symbol.toUpperCase() });
        if (!response.ok) {
          return NextResponse.json({ error: 'Failed to get company overview' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'get_earnings': {
        // Get earnings data
        const symbol = params.symbol as string;
        if (!symbol) {
          return NextResponse.json({ error: 'symbol is required' }, { status: 400 });
        }
        const response = await alphaFetch('EARNINGS', { symbol: symbol.toUpperCase() });
        if (!response.ok) {
          return NextResponse.json({ error: 'Failed to get earnings' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'get_news': {
        // Get market news and sentiment
        const additionalParams: Record<string, string> = {};
        if (params.tickers) additionalParams.tickers = params.tickers as string;
        if (params.topics) additionalParams.topics = params.topics as string;
        if (params.limit) additionalParams.limit = String(params.limit);

        const response = await alphaFetch('NEWS_SENTIMENT', additionalParams);
        if (!response.ok) {
          return NextResponse.json({ error: 'Failed to get news' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'get_top_gainers_losers': {
        // Get top gainers, losers, and most active
        const response = await alphaFetch('TOP_GAINERS_LOSERS');
        if (!response.ok) {
          return NextResponse.json({ error: 'Failed to get top movers' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'get_exchange_rate': {
        // Get currency exchange rate
        const fromCurrency = params.fromCurrency as string;
        const toCurrency = params.toCurrency as string;
        if (!fromCurrency || !toCurrency) {
          return NextResponse.json({ error: 'fromCurrency and toCurrency are required' }, { status: 400 });
        }
        const response = await alphaFetch('CURRENCY_EXCHANGE_RATE', {
          from_currency: fromCurrency.toUpperCase(),
          to_currency: toCurrency.toUpperCase(),
        });
        if (!response.ok) {
          return NextResponse.json({ error: 'Failed to get exchange rate' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'get_crypto_rating': {
        // Get crypto rating
        const symbol = params.symbol as string;
        if (!symbol) {
          return NextResponse.json({ error: 'symbol is required' }, { status: 400 });
        }
        const response = await alphaFetch('CRYPTO_RATING', { symbol: symbol.toUpperCase() });
        if (!response.ok) {
          return NextResponse.json({ error: 'Failed to get crypto rating' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('[Alpha Vantage Execute API] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

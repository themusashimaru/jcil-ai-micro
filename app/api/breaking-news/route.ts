/**
 * BREAKING NEWS API ROUTE
 *
 * PURPOSE:
 * - Provide comprehensive breaking news from conservative perspective
 * - Same report for all users, refreshed every 30 minutes via cron
 * - Uses AI to generate college-level news analysis
 *
 * HOW IT WORKS:
 * - GET /api/breaking-news - Returns cached news (instant for users)
 * - Cache lasts 30 minutes, stored in Supabase database
 * - Cron job at /api/cron/breaking-news regenerates every 30 min
 *
 * FEATURES:
 * - ✅ 46 comprehensive news categories
 * - ✅ Core news, military branches, intelligence agencies
 * - ✅ International allied & adversarial nations coverage
 * - ✅ Crime, disasters, technology, faith categories
 * - ✅ Database-backed cache (survives serverless restarts)
 * - ✅ Credible source prioritization
 */

import { createChatCompletion } from '@/lib/xai/client';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

interface NewsReport {
  content: string;
  generatedAt: Date;
}

const CACHE_DURATION_MS = 30 * 60 * 1000; // 30 minutes

// Create Supabase admin client for database operations
function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase environment variables');
  }

  return createClient(supabaseUrl, supabaseServiceKey);
}

async function getCachedNews(): Promise<NewsReport | null> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('breaking_news_cache')
      .select('content, generated_at')
      .eq('id', 1)
      .single();

    if (error || !data) {
      console.log('[Breaking News] No cache found in database');
      return null;
    }

    return {
      content: data.content,
      generatedAt: new Date(data.generated_at),
    };
  } catch (error) {
    console.error('[Breaking News] Error reading cache:', error);
    return null;
  }
}

async function setCachedNews(content: string, generatedAt: Date): Promise<void> {
  try {
    const supabase = getSupabaseAdmin();

    // Upsert the cache (insert or update row with id=1)
    const { error } = await supabase
      .from('breaking_news_cache')
      .upsert({
        id: 1,
        content,
        generated_at: generatedAt.toISOString(),
      });

    if (error) {
      console.error('[Breaking News] Error saving cache:', error);
      throw error;
    }

    console.log('[Breaking News] Cache saved to database');
  } catch (error) {
    console.error('[Breaking News] Error in setCachedNews:', error);
    throw error;
  }
}

async function isCacheValid(): Promise<boolean> {
  const cachedNews = await getCachedNews();
  if (!cachedNews) return false;

  const now = new Date().getTime();
  const cacheTime = new Date(cachedNews.generatedAt).getTime();
  const age = now - cacheTime;

  return age < CACHE_DURATION_MS;
}

async function generateBreakingNews(): Promise<string> {
  // Get CURRENT date and time in ET timezone
  const now = new Date();
  const formattedDateTime = now.toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
    timeZone: 'America/New_York',
  });

  const systemPrompt = `You are a professional news editor for a conservative news service. Generate comprehensive news coverage for ${formattedDateTime}.

WRITING STYLE:
- College-level journalism: sophisticated yet accessible
- Each story: bold headline, 2-3 detailed paragraphs, sources at end
- Include specific names, dates, numbers, quotes
- Conservative analysis woven naturally into factual reporting

FORMAT EACH CATEGORY LIKE THIS:
**Headline Here**
First paragraph with key facts (who, what, when, where).

Second paragraph with context and background.

Third paragraph with analysis and implications.

Sources: Source Name, Source Name

---

**Next Headline**
...

CATEGORIES TO COVER (40 total):

CORE (4): breaking, us_major, economy_markets, politics_elections
SECURITY (3): global_conflict, defense_military, world_geopolitics
INTEL (6): intel_dhs, intel_fbi, intel_cia, intel_nsa, intel_counter, intel_geospatial
CRIME (4): crime_terror, crime_major, crime_serial, crime_trafficking
DISASTERS (2): disaster_weather, disaster_geological
AMERICAS (2): intl_canada, intl_mexico
EUROPE (5): intl_uk, intl_ireland, intl_france, intl_germany, intl_italy
ASIA-PACIFIC (4): intl_australia, intl_southkorea, intl_taiwan, intl_japan
ADVERSARIES (5): adv_russia, adv_china, adv_northkorea, adv_venezuela, adv_iran
TECH (2): tech_ai, tech_cyber
LIFESTYLE (3): christian_persecution, american_good_news, health_science

Return valid JSON:
{
  "timestamp": "${formattedDateTime}",
  "categories": {
    "breaking": "**Headline**\\nContent...\\n\\nSources: AP, Reuters",
    "us_major": "**Headline**\\nContent...\\n\\nSources: ...",
    ... (all 40 categories)
  }
}`;

  try {
    const response = await createChatCompletion({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Generate today's breaking news report. Search current news sources and provide 2-3 stories per category with detailed coverage. Use **bold** for headlines. End each category with "Sources: ..." listing where you found the news. Return valid JSON with all 40 category keys populated.` }
      ],
      tool: 'research',
      stream: false,
      temperature: 0.7,
      maxTokens: 24000,
    });

    if (!response || !response.text) {
      throw new Error('Failed to generate breaking news content');
    }

    // Return the raw text (could be JSON or markdown)
    // Handle both string and Promise<string> return types
    const text = await Promise.resolve(response.text);
    return text.trim();
  } catch (error) {
    console.error('Error generating breaking news:', error);
    throw error;
  }
}

export async function GET() {
  try {
    // Check if we have valid cached news (less than 30 minutes old)
    const isValid = await isCacheValid();
    if (isValid) {
      const cachedNews = await getCachedNews();
      if (cachedNews) {
        console.log('[Breaking News] Serving from cache');
        return NextResponse.json({
          content: cachedNews.content,
          generatedAt: cachedNews.generatedAt,
          cached: true,
        });
      }
    }

    // Cache expired or missing - generate fresh news
    console.log('[Breaking News] Cache expired, generating fresh report...');

    const content = await generateBreakingNews();
    const generatedAt = new Date();

    // Save to database for next 30 minutes
    await setCachedNews(content, generatedAt);

    return NextResponse.json({
      content,
      generatedAt,
      cached: false,
    });
  } catch (error) {
    console.error('[Breaking News] Error:', error);
    return NextResponse.json(
      { error: 'Failed to load breaking news' },
      { status: 500 }
    );
  }
}

// POST handler for Vercel cron - always regenerates fresh news
export async function POST(request: Request) {
  try {
    // Verify this is from Vercel Cron (optional security check)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    // If CRON_SECRET is set, verify it matches
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      console.log('[Breaking News Cron] Unauthorized request');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[Breaking News Cron] Starting scheduled regeneration...');
    const startTime = Date.now();

    // Always generate fresh news (ignore cache)
    const content = await generateBreakingNews();
    const generatedAt = new Date();

    // Save to database
    await setCachedNews(content, generatedAt);

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[Breaking News Cron] Completed in ${duration}s at ${generatedAt.toISOString()}`);

    return NextResponse.json({
      success: true,
      generatedAt,
      duration: `${duration}s`,
    });
  } catch (error) {
    console.error('[Breaking News Cron] Error:', error);
    return NextResponse.json(
      { error: 'Failed to regenerate breaking news', details: String(error) },
      { status: 500 }
    );
  }
}

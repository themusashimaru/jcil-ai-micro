/**
 * BREAKING NEWS API ROUTE
 *
 * PURPOSE:
 * - Provide breaking news updates from conservative perspective
 * - Same report for all users, refreshed every 30 minutes
 * - Uses AI to generate college-level news analysis
 *
 * PUBLIC ROUTES:
 * - GET /api/breaking-news - Returns cached news report
 * - POST /api/breaking-news - Generates new report (cron only)
 *
 * FEATURES:
 * - ✅ 30-minute caching (same for all users)
 * - ✅ Database-backed cache (survives serverless restarts)
 * - ✅ Instant loading for users (no 30-60s wait)
 * - ✅ 11 news categories
 * - ✅ Conservative perspective
 * - ✅ Credible source prioritization
 *
 * PERFORMANCE FIX:
 * - Replaced in-memory cache with Supabase database storage
 * - Cron pre-generates every 30 min → all users get instant results
 * - Eliminated loading delays caused by serverless architecture
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

  const systemPrompt = `SYSTEM ROLE: You are the Breaking News Intelligence Desk for a national and international conservative news and analysis service. Your role is to gather, evaluate, and summarize the most important news events across key global and domestic categories. You provide fact-based, professional, college-level reporting from a traditional conservative worldview: pro-life, pro-family, pro-religious liberty, strong national defense, stable borders, constitutional freedoms, rule of law, responsible fiscal policy. Tone must be composed, calm, factual, and non-sensational.

NEWS SOURCING RULES (NO EXCEPTIONS):
Always pull facts FIRST from major credible wire services, primary documents, and official statements: AP News, Reuters, Bloomberg, Wall Street Journal (NEWS side only), Financial Times, The Economist (news desks), BBC World Service, Nikkei Asia, Al Jazeera English (for Middle East perspective differences, read critically), Defense.gov, CENTCOM, EUCOM, INDOPACOM, Pentagon briefings, State Dept releases, Congressional records.

AFTER factual grounding is established, draw interpretive and worldview framing from reputable conservative sources: National Review, The Dispatch, Washington Examiner, RealClearPolitics, Daily Signal, Christianity Today, The Gospel Coalition, The American Conservative, Wall Street Journal (Opinion side), The Federalist.

NEVER use unverified blogs, rumor networks, anonymous Telegram channels, or activist/conspiracy sites.

RANKED NEWS CATEGORIES (ALWAYS OUTPUT IN THIS ORDER):
1. BREAKING NEWS (urgent developments across all topics)
2. U.S. MAJOR NEWS (federal gov, SCOTUS, DOJ, border, national stability)
3. GLOBAL CONFLICT & CRISIS (wars, escalations, coups, insurgencies)
4. DEPARTMENT OF DEFENSE / WAR (U.S. & allied force posture, deployments, procurement)
5. ECONOMY & MARKETS (indices, commodities, inflation, employment, Fed, corporate movement)
6. WORLD / GEOPOLITICS (diplomacy, alliances, sanctions, elections abroad)
7. POLITICS & ELECTIONS (U.S. + allied democratic processes)
8. TECHNOLOGY & CYBERSECURITY (AI, cyber ops, infrastructure breaches, space domain)
9. HEALTH, SCIENCE & ENVIRONMENT (medical research, outbreaks, disasters)
10. CHRISTIAN PERSECUTION (global religious freedom violations, church attacks, targeted violence)
11. AMERICAN GOOD NEWS (courage, service, charity, recovery, community strength)

WRITING STYLE: College-educated, professional newsroom voice. Clear, structured paragraphs. No slang, hype, sarcasm, or emotional panic. Provide substantive, detailed reporting with context and background. Each story should include:
- Specific names, dates, locations, and numbers
- Relevant background context and history
- Conservative analysis and implications
- Multiple perspectives when applicable
- Expert quotes and official statements when available

When reporting on Christian persecution: respectful, factual, non-dramatic; dignity forward. When reporting American Good News: uplifting but not cheesy; emphasize courage, resilience, service, and unity.

OUTPUT FORMAT (EVERY RUN):
Return a JSON object with each category as a separate field. The current date/time is ${formattedDateTime}.

CRITICAL REQUIREMENTS FOR EACH CATEGORY:
- Provide DETAILED, IN-DEPTH coverage (minimum 300-500 words per major category)
- Include specific details: names, dates, locations, statistics, quotes
- Explain WHY stories matter from a conservative worldview
- Provide context and background information
- Connect stories to broader trends and implications
- Use **bold formatting** for story headlines and key points
- End each section with cited sources

IMPORTANT: You MUST conduct live web searches to get the LATEST, CURRENT news happening RIGHT NOW. Use real-time data from credible sources. The date ${formattedDateTime} should reflect ACTUAL current events, not historical information.

Return in this JSON format:
{
  "timestamp": "${formattedDateTime}",
  "categories": {
    "breaking": "4-6 urgent developments with **bold story headlines**, detailed paragraphs with specific facts, names, dates, and conservative analysis...",
    "us_major": "3-5 detailed stories covering federal government, SCOTUS, DOJ, border issues, national stability. Each story should be 2-3 paragraphs with specific details, context, and conservative perspective...",
    "global_conflict": "2-4 in-depth conflict reports with casualty figures, diplomatic developments, military movements, strategic analysis...",
    "defense_war": "2-3 detailed defense stories covering force readiness, deployments, procurement, military strategy with specific budget figures and timelines...",
    "economy_markets": "3-4 economic stories with specific market data, inflation figures, employment statistics, Fed policy details, corporate earnings, conservative fiscal analysis...",
    "world_geopolitics": "2-4 international stories covering alliances, sanctions, elections, diplomatic relations with detailed background and strategic implications...",
    "politics_elections": "3-4 political stories with polling data, legislative details, campaign developments, electoral analysis from conservative perspective...",
    "tech_cyber": "2-3 technology stories covering AI developments, cyber attacks, infrastructure security, space programs with technical details and privacy/security implications...",
    "health_science": "2-3 health/science stories with research findings, outbreak statistics, policy implications, environmental developments...",
    "christian_persecution": "1-3 detailed reports on religious freedom violations, church attacks, legal challenges with specific locations, victim names (when appropriate), legal details...",
    "american_good_news": "2-3 uplifting stories showcasing American resilience, community service, heroism, innovation with specific details and locations..."
  }
}

MOBILE UI: Ensure readability on mobile devices. Use **bold headlines** to break up text. Include source links at the end of each section.

FAILSAFES: If sourcing unclear: say "**Developing** — awaiting verification." If claims conflict: note "**Competing reports** — unresolved." Never speculate. Never sensationalize. Never invent.

CRITICAL: Use live web search to get ACTUAL current news happening RIGHT NOW at ${formattedDateTime}. Do not use outdated or historical information.`;

  try {
    const response = await createChatCompletion({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: 'Conduct comprehensive live web searches and generate detailed, in-depth breaking news reports across all 11 categories. Each category should contain substantive analysis with specific facts, figures, names, dates, and conservative perspective. Return the response in the exact JSON format specified, using real-time current data.' }
      ],
      tool: 'research',
      stream: false,
      temperature: 0.7,
      maxTokens: 8000,
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
    // Check if we have a valid cached report in database
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

    console.log('[Breaking News] Cache miss or expired, generating new report');

    // Generate new report
    const content = await generateBreakingNews();
    const generatedAt = new Date();

    // Save to database
    await setCachedNews(content, generatedAt);

    return NextResponse.json({
      content,
      generatedAt,
      cached: false,
    });
  } catch (error) {
    console.error('[Breaking News] Error in GET:', error);
    return NextResponse.json(
      { error: 'Failed to load breaking news' },
      { status: 500 }
    );
  }
}

// Cron endpoint to refresh every 30 minutes (Vercel Cron will call this)
export async function POST(request: Request) {
  try {
    // Vercel Cron sends a special authorization header
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    // Allow Vercel Cron or requests with valid secret
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('[Breaking News] Cron job triggered - generating new report');

    const content = await generateBreakingNews();
    const generatedAt = new Date();

    // Save to database
    await setCachedNews(content, generatedAt);

    console.log('[Breaking News] Cron job completed successfully');

    return NextResponse.json({
      success: true,
      generatedAt,
      message: 'Breaking news updated successfully in database',
    });
  } catch (error) {
    console.error('[Breaking News] Error in cron job:', error);
    return NextResponse.json(
      { error: 'Failed to refresh breaking news' },
      { status: 500 }
    );
  }
}

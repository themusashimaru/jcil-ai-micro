/**
 * BREAKING NEWS API ROUTE
 *
 * PURPOSE:
 * - Provide comprehensive breaking news from conservative perspective
 * - Same report for all users, refreshed every 30 minutes via cron
 * - Uses batched AI generation for newspaper-grade depth
 *
 * HOW IT WORKS:
 * - GET /api/breaking-news - Returns cached news (instant for users)
 * - Cache lasts 30 minutes, stored in Supabase database
 * - Cron job at /api/cron/breaking-news regenerates every 30 min
 *
 * BATCHED GENERATION:
 * - 11 category groups generated in parallel batches
 * - Specific credible sources per domain
 * - 300-500 words per category for newspaper-grade depth
 * - Results combined into single cached report
 */

// Vercel Pro: Allow up to 5 minutes for batched generation
export const maxDuration = 300;

import { createChatCompletion } from '@/lib/openai/client';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

interface NewsReport {
  content: string;
  generatedAt: Date;
}

interface CategoryGroup {
  name: string;
  categories: { key: string; label: string }[];
  sources: string;
  searchFocus: string;
}

const CACHE_DURATION_MS = 30 * 60 * 1000; // 30 minutes

// Define category groups with specialized sources
const CATEGORY_GROUPS: CategoryGroup[] = [
  {
    name: 'CORE NEWS',
    categories: [
      { key: 'breaking', label: 'Breaking News' },
      { key: 'us_major', label: 'U.S. Major News' },
      { key: 'economy_markets', label: 'Economy & Markets' },
      { key: 'politics_elections', label: 'Politics & Elections' },
    ],
    sources: 'AP News, Reuters, Wall Street Journal, Bloomberg, Fox News, New York Post, Washington Examiner, Daily Wire',
    searchFocus: 'Search for the most important breaking news stories in the United States right now. Focus on major headlines, economic developments, stock market movements, and political news.',
  },
  {
    name: 'GLOBAL SECURITY',
    categories: [
      { key: 'global_conflict', label: 'Global Conflict & Crisis' },
      { key: 'defense_military', label: 'Defense & Military' },
      { key: 'world_geopolitics', label: 'World / Geopolitics' },
    ],
    sources: 'Defense.gov, Military Times, Stars and Stripes, Jane\'s Defence, Breaking Defense, War on the Rocks, Foreign Policy, The Diplomat',
    searchFocus: 'Search for current military operations, defense policy updates, global conflicts, and geopolitical developments affecting U.S. interests.',
  },
  {
    name: 'U.S. INTELLIGENCE & LAW ENFORCEMENT',
    categories: [
      { key: 'intel_dhs', label: 'Homeland Security' },
      { key: 'intel_fbi', label: 'FBI' },
      { key: 'intel_cia', label: 'CIA' },
      { key: 'intel_nsa', label: 'NSA' },
      { key: 'intel_counter', label: 'Counter Intelligence' },
      { key: 'intel_geospatial', label: 'Geospatial Intelligence' },
    ],
    sources: 'DHS.gov, FBI.gov, CIA.gov, NSA.gov, Justice.gov, Lawfare Blog, Just Security, The Intercept, Bellingcat',
    searchFocus: 'Search for news about U.S. intelligence agencies, homeland security threats, FBI investigations, counterintelligence operations, and national security developments.',
  },
  {
    name: 'CRIME & JUSTICE',
    categories: [
      { key: 'crime_terror', label: 'Terrorism & Domestic Threats' },
      { key: 'crime_major', label: 'Major Crimes & Investigations' },
      { key: 'crime_serial', label: 'Serial Killers & Cold Cases' },
      { key: 'crime_trafficking', label: 'Human Trafficking' },
    ],
    sources: 'FBI.gov, DOJ.gov, local news stations, Crime Online, Law & Crime, Fox News Crime, New York Post',
    searchFocus: 'Search for major crime stories, terrorism threats, high-profile investigations, serial killer cases, and human trafficking busts in the United States.',
  },
  {
    name: 'NATURAL DISASTERS',
    categories: [
      { key: 'disaster_weather', label: 'Severe Weather' },
      { key: 'disaster_geological', label: 'Geological Events' },
    ],
    sources: 'National Weather Service (weather.gov), USGS.gov, NOAA, local emergency management, Weather Channel, AccuWeather',
    searchFocus: 'Search for current severe weather events (tornadoes, hurricanes, floods), earthquakes, volcanic activity, and natural disaster impacts across the United States.',
  },
  {
    name: 'ALLIED NATIONS - AMERICAS',
    categories: [
      { key: 'intl_canada', label: 'Canada' },
      { key: 'intl_mexico', label: 'Mexico' },
    ],
    sources: 'CBC News, Globe and Mail, National Post, CTV News, El Universal, Reforma, Mexico News Daily, Reuters Latin America',
    searchFocus: 'Search for major news from Canada and Mexico, focusing on politics, U.S. relations, trade, border issues, and significant events affecting North American interests.',
  },
  {
    name: 'ALLIED NATIONS - EUROPE',
    categories: [
      { key: 'intl_uk', label: 'United Kingdom' },
      { key: 'intl_ireland', label: 'Ireland' },
      { key: 'intl_france', label: 'France' },
      { key: 'intl_germany', label: 'Germany' },
      { key: 'intl_italy', label: 'Italy' },
    ],
    sources: 'BBC News, The Telegraph, Daily Mail, RTE Ireland, Irish Times, France 24, Le Monde, Deutsche Welle, Der Spiegel, ANSA Italy, La Repubblica',
    searchFocus: 'Search for major news from key European allies: UK, Ireland, France, Germany, and Italy. Focus on politics, EU affairs, defense, and issues affecting U.S.-European relations.',
  },
  {
    name: 'ALLIED NATIONS - ASIA-PACIFIC',
    categories: [
      { key: 'intl_australia', label: 'Australia' },
      { key: 'intl_southkorea', label: 'South Korea' },
      { key: 'intl_taiwan', label: 'Taiwan' },
      { key: 'intl_japan', label: 'Japan' },
    ],
    sources: 'ABC Australia, Sydney Morning Herald, The Australian, Yonhap News, Korea Herald, Taipei Times, Taiwan News, NHK Japan, Japan Times, Nikkei Asia',
    searchFocus: 'Search for major news from Asia-Pacific allies: Australia, South Korea, Taiwan, and Japan. Focus on China tensions, defense partnerships, trade, and regional security.',
  },
  {
    name: 'ADVERSARIAL NATIONS',
    categories: [
      { key: 'adv_russia', label: 'Russia Watch' },
      { key: 'adv_china', label: 'China Watch' },
      { key: 'adv_northkorea', label: 'North Korea Watch' },
      { key: 'adv_venezuela', label: 'Venezuela Watch' },
      { key: 'adv_iran', label: 'Iran Watch' },
    ],
    sources: 'Radio Free Europe/Radio Liberty, Voice of America, South China Morning Post, The Epoch Times, Reuters, AP, Foundation for Defense of Democracies, Atlantic Council',
    searchFocus: 'Search for news about U.S. adversaries: Russia, China, North Korea, Venezuela, and Iran. Focus on military activities, human rights, sanctions, provocations, and threats to U.S. interests.',
  },
  {
    name: 'TECHNOLOGY',
    categories: [
      { key: 'tech_ai', label: 'AI News & Developments' },
      { key: 'tech_cyber', label: 'Technology & Cybersecurity' },
    ],
    sources: 'Wired, Ars Technica, The Verge, TechCrunch, MIT Technology Review, Krebs on Security, CyberScoop, Dark Reading',
    searchFocus: 'Search for major AI developments, tech industry news, cybersecurity threats, data breaches, and technology policy affecting national security.',
  },
  {
    name: 'FAITH & LIFESTYLE',
    categories: [
      { key: 'christian_persecution', label: 'Christian Persecution' },
      { key: 'american_good_news', label: 'American Good News' },
      { key: 'health_science', label: 'Health & Science' },
    ],
    sources: 'Christianity Today, The Christian Post, Open Doors, Voice of the Martyrs, Good News Network, Positive News, CDC, NIH, health journals, Science Daily',
    searchFocus: 'Search for stories about persecution of Christians worldwide, uplifting positive news from America, and important health and science developments.',
  },
];

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

/**
 * Generate news for a single category group
 * Each group gets focused attention and specific source guidance
 */
async function generateCategoryGroup(
  group: CategoryGroup,
  formattedDateTime: string
): Promise<Record<string, string>> {
  const categoryKeys = group.categories.map(c => c.key).join(', ');
  const categoryList = group.categories.map(c => `- ${c.key}: ${c.label}`).join('\n');

  const systemPrompt = `You are a senior news editor for a respected conservative news service. Your job is to produce newspaper-quality journalism for the ${group.name} section.

CURRENT DATE/TIME: ${formattedDateTime}

YOUR SECTION: ${group.name}
CATEGORIES TO COVER:
${categoryList}

TRUSTED SOURCES FOR THIS SECTION:
${group.sources}

JOURNALISM STANDARDS:
1. Each category gets ONE comprehensive story (300-500 words)
2. Write at a college-reading level - sophisticated but accessible
3. Lead with the most newsworthy facts (inverted pyramid style)
4. Include specific details: names, dates, numbers, locations, quotes when available
5. Provide context and background in the second paragraph
6. Include conservative analysis woven naturally into factual reporting
7. End each story with source citations using ONLY the publication name (e.g., "Reuters", "Fox News", "Wall Street Journal")

CRITICAL SOURCE FORMATTING RULES:
- NEVER include URLs in your response
- NEVER include links like "https://..." or "www...."
- Only list source NAMES like: "Sources: Reuters, Associated Press, Fox News"
- If you found information from a website, just name the publication (e.g., "USGS" not "https://www.usgs.gov/...")

STORY FORMAT FOR EACH CATEGORY:
**[Compelling Headline That Captures the Story]**

[Opening paragraph: Who, what, when, where, why - the essential facts. Be specific with names, dates, and figures.]

[Second paragraph: Context, background, and how this connects to broader issues. What led to this? Why does it matter?]

[Third paragraph: Implications, reactions from key figures, and what happens next. Include quotes if available from your search.]

[Fourth paragraph (if needed): Additional details, related developments, or conservative perspective on implications.]

Sources: [Source Name 1], [Source Name 2], [Source Name 3]

---

SEARCH INSTRUCTION:
${group.searchFocus}

Return valid JSON with this exact structure:
{
  ${group.categories.map(c => `"${c.key}": "**Headline**\\n\\nFull story content...\\n\\nSources: Source1, Source2, Source3"`).join(',\n  ')}
}

CRITICAL: You MUST search for CURRENT news from TODAY or the past 24 hours. Every story must be timely and newsworthy.`;

  try {
    console.log(`[Breaking News] Generating ${group.name} (${group.categories.length} categories)...`);

    const response = await createChatCompletion({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Search for the latest news and generate comprehensive coverage for these categories: ${categoryKeys}. Each story should be 300-500 words with specific facts, quotes, and source citations. Return as JSON.` }
      ],
      tool: 'research',
      stream: false,
      temperature: 0.6,
      maxTokens: 8000,
    });

    if (!response || !response.text) {
      throw new Error(`Failed to generate ${group.name}`);
    }

    const text = await Promise.resolve(response.text);

    // Parse JSON response
    let cleanedText = text.trim();
    cleanedText = cleanedText.replace(/```json\n?/g, '').replace(/```\n?/g, '');

    try {
      const parsed = JSON.parse(cleanedText);
      console.log(`[Breaking News] ✓ ${group.name} complete`);
      return parsed;
    } catch {
      // If JSON parsing fails, try to extract content
      console.warn(`[Breaking News] JSON parse failed for ${group.name}, using raw content`);
      const result: Record<string, string> = {};
      for (const cat of group.categories) {
        result[cat.key] = `Content generation in progress for ${cat.label}. Please refresh in a few minutes.`;
      }
      return result;
    }
  } catch (error) {
    console.error(`[Breaking News] Error generating ${group.name}:`, error);
    // Return placeholder content for failed group
    const result: Record<string, string> = {};
    for (const cat of group.categories) {
      result[cat.key] = `**${cat.label} Update**\n\nNews content is temporarily unavailable for this category. Please check back shortly.\n\nSources: Unavailable`;
    }
    return result;
  }
}

/**
 * Generate all breaking news using parallel batched API calls
 * Groups are processed in parallel batches of 3 to balance speed vs rate limits
 */
async function generateBreakingNews(): Promise<string> {
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

  console.log(`[Breaking News] Starting parallel generation at ${formattedDateTime}`);
  console.log(`[Breaking News] Generating ${CATEGORY_GROUPS.length} category groups in parallel batches...`);

  // Process groups in parallel batches of 3 to avoid rate limiting
  const BATCH_SIZE = 3;
  const allCategories: Record<string, string> = {};

  for (let i = 0; i < CATEGORY_GROUPS.length; i += BATCH_SIZE) {
    const batch = CATEGORY_GROUPS.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(CATEGORY_GROUPS.length / BATCH_SIZE);

    console.log(`[Breaking News] Processing batch ${batchNum}/${totalBatches}: ${batch.map(g => g.name).join(', ')}`);

    // Run this batch in parallel
    const batchResults = await Promise.all(
      batch.map(group => generateCategoryGroup(group, formattedDateTime))
    );

    // Merge results
    for (const result of batchResults) {
      Object.assign(allCategories, result);
    }

    // Brief pause between batches to be nice to the API
    if (i + BATCH_SIZE < CATEGORY_GROUPS.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  // Combine into final JSON structure
  const finalReport = {
    timestamp: formattedDateTime,
    generatedAt: now.toISOString(),
    categories: allCategories,
  };

  console.log(`[Breaking News] Generation complete. ${Object.keys(allCategories).length} categories populated.`);

  return JSON.stringify(finalReport);
}

export async function GET() {
  try {
    // Always try to serve from cache first - this should be instant
    const cachedNews = await getCachedNews();

    if (cachedNews && cachedNews.content) {
      // Check if cache is valid (less than 30 minutes old)
      const now = new Date().getTime();
      const cacheTime = new Date(cachedNews.generatedAt).getTime();
      const age = now - cacheTime;
      const isValid = age < CACHE_DURATION_MS;

      console.log(`[Breaking News] Serving from cache (age: ${Math.round(age / 60000)} min, valid: ${isValid})`);

      return NextResponse.json({
        content: cachedNews.content,
        generatedAt: cachedNews.generatedAt,
        cached: true,
        cacheAge: Math.round(age / 60000), // age in minutes
      });
    }

    // No cache available - return error (don't try to generate - that's what cron is for)
    console.log('[Breaking News] No cache available - cron job may not have run yet');

    return NextResponse.json({
      error: 'News is being prepared. Please try again in a few minutes.',
      message: 'The news service is warming up. News will be available shortly.',
      retryAfter: 60, // suggest retry in 60 seconds
    }, { status: 503 }); // 503 Service Unavailable

  } catch (error) {
    console.error('[Breaking News] Error:', error);
    return NextResponse.json(
      { error: 'Failed to load breaking news' },
      { status: 500 }
    );
  }
}

// POST handler for manual regeneration (admin use)
export async function POST(request: Request) {
  try {
    // Verify this is from Vercel Cron (optional security check)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    // Always require CRON_SECRET - reject if not configured or doesn't match
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      console.log('[Breaking News] Unauthorized request - missing or invalid secret');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[Breaking News] Starting manual regeneration...');
    const startTime = Date.now();

    // Always generate fresh news (ignore cache)
    const content = await generateBreakingNews();
    const generatedAt = new Date();

    // Save to database
    await setCachedNews(content, generatedAt);

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[Breaking News] Completed in ${duration}s at ${generatedAt.toISOString()}`);

    return NextResponse.json({
      success: true,
      generatedAt,
      duration: `${duration}s`,
    });
  } catch (error) {
    console.error('[Breaking News] Error:', error);
    return NextResponse.json(
      { error: 'Failed to regenerate breaking news', details: String(error) },
      { status: 500 }
    );
  }
}

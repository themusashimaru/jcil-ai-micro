/**
 * BREAKING NEWS CRON ENDPOINT
 *
 * PURPOSE:
 * - Dedicated endpoint for Vercel cron job
 * - Always regenerates fresh news (ignores cache)
 * - Runs every 30 minutes automatically
 * - Generates comprehensive 46-category news report
 *
 * CATEGORIES:
 * - Core news, global security, military branches
 * - Intelligence agencies, crime & justice, disasters
 * - Allied nations (Americas, Europe, Asia-Pacific)
 * - Adversarial nations (Russia, China, NK, Venezuela, Iran)
 * - Technology, AI, faith & lifestyle
 *
 * SECURITY:
 * - Vercel crons include CRON_SECRET header for verification
 * - Only accepts requests from Vercel's cron system
 */

import { createChatCompletion } from '@/lib/xai/client';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Create Supabase admin client for database operations
function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase environment variables');
  }

  return createClient(supabaseUrl, supabaseServiceKey);
}

async function setCachedNews(content: string, generatedAt: Date): Promise<void> {
  const supabase = getSupabaseAdmin();

  const { error } = await supabase
    .from('breaking_news_cache')
    .upsert({
      id: 1,
      content,
      generated_at: generatedAt.toISOString(),
    });

  if (error) {
    console.error('[Breaking News Cron] Error saving cache:', error);
    throw error;
  }

  console.log('[Breaking News Cron] Cache saved to database');
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

  const systemPrompt = `SYSTEM ROLE: You are the Breaking News Intelligence Desk for a comprehensive national and international conservative news service. Your role is to gather, evaluate, and summarize the most important news events across ALL categories below. You provide fact-based, professional, college-level reporting from a traditional conservative worldview: pro-life, pro-family, pro-religious liberty, strong national defense, stable borders, constitutional freedoms, rule of law, responsible fiscal policy. Tone must be composed, calm, factual, and non-sensational.

CRITICAL: Each category MUST have SUBSTANTIAL content (300-500 words minimum). Users are coming for in-depth analysis, not brief summaries. If a category has less news, provide more context, background, and analysis.

═══════════════════════════════════════════════════════════════════════════════
CATEGORY-SPECIFIC NEWS SOURCES (SEARCH THESE FOR EACH CATEGORY)
═══════════════════════════════════════════════════════════════════════════════

CORE NEWS SOURCES:
- Wire Services: AP News, Reuters, AFP, Bloomberg
- Major Papers: Wall Street Journal, Washington Times, New York Post
- Conservative Analysis: National Review, The Dispatch, Washington Examiner, Daily Wire, Daily Signal, The Federalist, RealClearPolitics

U.S. MILITARY BRANCHES - Search these specifically:
- Official: Defense.gov, Army.mil, Navy.mil, Marines.mil, AF.mil, SpaceForce.mil, USCG.mil, DVIDS.net
- Military News: Military.com, Defense News, Breaking Defense, Defense One, Task & Purpose, Military Times, Stars and Stripes
- Branch-Specific: Army Times, Navy Times, Air Force Times, Marine Corps Times
- CENTCOM.mil, EUCOM.mil, INDOPACOM.mil, AFRICOM.mil, SOUTHCOM.mil, NORTHCOM.mil

U.S. INTELLIGENCE & LAW ENFORCEMENT - Search these specifically:
- Official: FBI.gov, CIA.gov, DHS.gov, NSA.gov, NGA.gov, DNI.gov, CISA.gov, DOJ.gov, ATF.gov, DEA.gov, USMS.gov
- Intel Analysis: Lawfare Blog, Just Security, War on the Rocks, Foreign Policy, The Cipher Brief
- Investigative: Court Listener, PACER, DOJ Press Releases

CRIME & JUSTICE - Search these specifically:
- FBI Most Wanted, US Marshals Most Wanted, DOJ Press Releases, ICE Newsroom
- True Crime: Crime Online, Law & Crime, Oxygen Crime News, Investigation Discovery
- Court News: SCOTUSblog, Reuters Legal, Law360

NATURAL DISASTERS - Search these specifically:
- Weather: NOAA.gov, NWS.gov, NHC.NOAA.gov (hurricanes), SPC.NOAA.gov (tornadoes), Weather.com, AccuWeather
- Geological: USGS.gov, earthquake.usgs.gov, Volcano.si.edu, tsunami.gov
- Emergency: FEMA.gov, Ready.gov, state emergency management agencies

ALLIED NATIONS - AMERICAS:
- Canada: CBC News, CTV News, Global News Canada, National Post, Globe and Mail, Toronto Sun
- Mexico: El Universal, Reforma, Milenio, Mexico News Daily, Borderland Beat (cartel coverage)

ALLIED NATIONS - EUROPE:
- UK: BBC News, Sky News, The Telegraph, The Times, Daily Mail, GB News, The Spectator
- Ireland: RTE News, Irish Times, Irish Independent, TheJournal.ie
- France: France 24, Le Figaro, The Local France, RFI English
- Germany: Deutsche Welle, FAZ, Die Welt, The Local Germany, BILD
- Italy: ANSA, Corriere della Sera, La Repubblica, The Local Italy

ALLIED NATIONS - ASIA-PACIFIC:
- Australia: ABC Australia, Sky News Australia, The Australian, 9News, news.com.au
- South Korea: Korea Herald, Yonhap News, Korea Times, KBS World
- Taiwan: Taipei Times, Taiwan News, Focus Taiwan, CNA English
- Japan: Japan Times, NHK World, Kyodo News, Nikkei Asia, Japan Today

ADVERSARIAL NATIONS - Search these specifically:
- Russia: Moscow Times, Meduza, Radio Free Europe/Radio Liberty, ISW (Institute for Study of War)
- China: South China Morning Post, Radio Free Asia, China Digital Times, Taiwan News (China coverage), The Diplomat
- North Korea: NK News, 38 North, Daily NK, Radio Free Asia Korea
- Venezuela: El Nacional, NTN24, Caracas Chronicles, Miami Herald (Venezuela coverage)
- Iran: Iran International, Radio Farda, NCRI, Al Arabiya (Iran coverage)

TECHNOLOGY & AI - Search these specifically:
- Tech: TechCrunch, Wired, Ars Technica, The Verge, MIT Technology Review, The Information
- AI Specific: VentureBeat AI, AI News, OpenAI Blog, Anthropic Blog, Google AI Blog
- Cybersecurity: Krebs on Security, Dark Reading, CyberScoop, The Record, BleepingComputer

CHRISTIAN PERSECUTION - Search these specifically:
- Watchdogs: Open Doors USA, International Christian Concern (ICC), Voice of the Martyrs, Barnabas Fund
- Official: USCIRF.gov (US Commission on International Religious Freedom)
- Religious News: Christianity Today, Catholic News Agency, EWTN, The Christian Post, Religion News Service

AMERICAN GOOD NEWS - Search these specifically:
- Good news: Good News Network, Positive News, Sunny Skyz, Today Show Feel Good
- Local heroes: Local news stations, military hometown news, community foundations
- Faith stories: Christianity Today, Deseret News, local church news

HEALTH & SCIENCE - Search these specifically:
- Health: CDC.gov, NIH.gov, FDA.gov, WHO, WebMD, Healthline, STAT News
- Science: Nature, Science Magazine, Scientific American, Phys.org, ScienceDaily
- Medical Journals: NEJM, JAMA, The Lancet (for major findings)

═══════════════════════════════════════════════════════════════════════════════
WRITING REQUIREMENTS
═══════════════════════════════════════════════════════════════════════════════

CONTENT DEPTH (MANDATORY):
- Each category: 300-500 words MINIMUM
- Include 2-4 distinct stories per category
- Each story needs: WHO, WHAT, WHEN, WHERE, WHY, and SO WHAT (implications)
- Include specific numbers, dates, names, locations, quotes when available
- Provide historical context and explain why it matters

WRITING STYLE:
- College-level journalism: sophisticated but accessible
- Active voice, strong verbs, clear sentences
- NO jargon without explanation
- Assume reader is intelligent but may not know background
- Conservative analysis woven naturally into factual reporting

STORY STRUCTURE FOR EACH ITEM:
**[BOLD HEADLINE]**
Lead paragraph with key facts (who, what, when, where)
Context paragraph (background, why this matters)
Details paragraph (specifics, quotes, numbers)
Analysis paragraph (implications, conservative perspective)

SOURCE CITATIONS (MANDATORY AT END OF EACH CATEGORY):
Format sources in a reader-friendly way:
📰 Sources: [Source Name] • [Source Name] • [Source Name]

═══════════════════════════════════════════════════════════════════════════════
OUTPUT FORMAT
═══════════════════════════════════════════════════════════════════════════════

Return valid JSON with this structure. The current date/time is ${formattedDateTime}.

{
  "timestamp": "${formattedDateTime}",
  "categories": {
    "breaking": "**[Headline 1]**\\nDetailed coverage...\\n\\n**[Headline 2]**\\nDetailed coverage...\\n\\n📰 Sources: AP News • Reuters • WSJ",
    "us_major": "**[Headline 1]**\\nDetailed coverage with context and analysis...\\n\\n📰 Sources: ...",
    ... (all 46 categories with substantial content)
  }
}

FAILSAFES:
- If sourcing unclear: "**Developing** — awaiting verification from official sources."
- If claims conflict: "**Competing reports** — [Source A] reports X while [Source B] reports Y."
- If limited news in category: Provide more context, recent developments, or ongoing situation updates.

CRITICAL REMINDERS:
1. Use live web search to get ACTUAL current news at ${formattedDateTime}
2. Each category needs 300-500 words minimum - users want depth, not brevity
3. Search the SPECIFIC sources listed for each category
4. Include source citations at the end of EVERY category
5. Make it worth reading - this is a news destination, not a summary service`;

  const response = await createChatCompletion({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Generate a comprehensive breaking news report for ${formattedDateTime}.

IMPORTANT REQUIREMENTS:
1. Search the SPECIFIC sources listed for each category (Military Times for military, FBI.gov for FBI, etc.)
2. Each category MUST have 300-500 words with 2-4 stories
3. Include WHO, WHAT, WHEN, WHERE, WHY for each story
4. End EVERY category with: 📰 Sources: [list sources used]
5. Use **bold headlines** for each story
6. Provide college-level analysis that's accessible but substantive

Return valid JSON with all 46 categories fully populated. This is a premium news service - users expect depth and quality comparable to major news outlets.` }
    ],
    tool: 'research',
    stream: false,
    temperature: 0.7,
    maxTokens: 32000,
  });

  if (!response || !response.text) {
    throw new Error('Failed to generate breaking news content');
  }

  const text = await Promise.resolve(response.text);
  return text.trim();
}

export async function GET(request: Request) {
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
      message: 'Breaking news regenerated successfully',
    });
  } catch (error) {
    console.error('[Breaking News Cron] Error:', error);
    return NextResponse.json(
      { error: 'Failed to regenerate breaking news', details: String(error) },
      { status: 500 }
    );
  }
}

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
 * - ✅ 11 news categories
 * - ✅ Conservative perspective
 * - ✅ Credible source prioritization
 */

import { createChatCompletion } from '@/lib/xai/client';
import { NextResponse } from 'next/server';

interface NewsReport {
  content: string;
  generatedAt: Date;
}

// In-memory cache for the breaking news report
let cachedNews: NewsReport | null = null;

const CACHE_DURATION_MS = 30 * 60 * 1000; // 30 minutes

function isCacheValid(): boolean {
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

WRITING STYLE: College-educated, professional newsroom voice. Clear, structured paragraphs. No slang, hype, sarcasm, or emotional panic. Do NOT editorialize in news sections. If analysis needed, add subsection: "Context & Interpretation (Conservative Viewpoint)." When reporting on Christian persecution: respectful, factual, non-dramatic; dignity forward. When reporting American Good News: uplifting but not cheesy; emphasize courage, resilience, service, and unity.

OUTPUT FORMAT (EVERY RUN):
Return a JSON object with each category as a separate field. The current date/time is ${formattedDateTime}.

Format each category with:
- **Bold titles** for important stories and key points
- Clear paragraph structure (no bullet points with dashes)
- Use bold text for emphasis instead of bullets
- Source citations at the end of each section

IMPORTANT: You MUST conduct live web searches to get the LATEST, CURRENT news happening RIGHT NOW. Use real-time data from credible sources. The date ${formattedDateTime} should reflect ACTUAL current events, not historical information.

Return in this JSON format:
{
  "timestamp": "${formattedDateTime}",
  "categories": {
    "breaking": "3-7 urgent developments with **bold titles**...",
    "us_major": "2-4 paragraphs + key insights with **bold emphasis**...",
    "global_conflict": "Current conflicts and crises with **bold titles**...",
    "defense_war": "Military and defense updates with **bold emphasis**...",
    "economy_markets": "Economic and market analysis with **bold titles**...",
    "world_geopolitics": "International affairs with **bold emphasis**...",
    "politics_elections": "Political developments with **bold titles**...",
    "tech_cyber": "Technology and cybersecurity with **bold emphasis**...",
    "health_science": "Health and science updates with **bold titles**...",
    "christian_persecution": "Religious freedom issues with **bold emphasis**...",
    "american_good_news": "Inspiring stories with **bold titles**..."
  }
}

MOBILE UI: Paragraphs ≤ 4 lines on mobile. Bold titles for emphasis. No large tables. Include source links.

FAILSAFES: If sourcing unclear: say "**Developing** — awaiting verification." If claims conflict: note "**Competing reports** — unresolved." Never speculate. Never sensationalize. Never invent.

CRITICAL: Use live web search to get ACTUAL current news happening RIGHT NOW at ${formattedDateTime}. Do not use outdated or historical information.`;

  try {
    const response = await createChatCompletion({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: 'Conduct live web searches and generate the latest breaking news report across all 11 categories. Return the response in the exact JSON format specified, using real-time current data.' }
      ],
      tool: 'research',
      stream: false,
      temperature: 0.7,
      maxTokens: 4000,
    });

    if (!response || !response.text) {
      throw new Error('Failed to generate breaking news content');
    }

    // Return the raw text (could be JSON or markdown)
    return response.text.trim();
  } catch (error) {
    console.error('Error generating breaking news:', error);
    throw error;
  }
}

export async function GET() {
  try {
    // Check if we have a valid cached report
    if (isCacheValid() && cachedNews) {
      return NextResponse.json({
        content: cachedNews.content,
        generatedAt: cachedNews.generatedAt,
        cached: true,
      });
    }

    // Generate new report
    const content = await generateBreakingNews();
    const generatedAt = new Date();

    // Cache it
    cachedNews = {
      content,
      generatedAt,
    };

    return NextResponse.json({
      content,
      generatedAt,
      cached: false,
    });
  } catch (error) {
    console.error('Error in breaking news API:', error);
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

    const content = await generateBreakingNews();
    const generatedAt = new Date();

    cachedNews = {
      content,
      generatedAt,
    };

    return NextResponse.json({
      success: true,
      generatedAt,
      message: 'Breaking news updated successfully',
    });
  } catch (error) {
    console.error('Error refreshing breaking news:', error);
    return NextResponse.json(
      { error: 'Failed to refresh breaking news' },
      { status: 500 }
    );
  }
}

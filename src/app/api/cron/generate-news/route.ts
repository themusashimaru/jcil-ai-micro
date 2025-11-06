export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/lib/supabase/server';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/**
 * Get the current 30-minute timestamp key
 * Format: YYYY-MM-DD-HH-MM (rounded to nearest 30 min)
 */
function get30MinTimestampKey(): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  const hour = String(now.getUTCHours()).padStart(2, '0');
  const minutes = now.getUTCMinutes();

  // Round to nearest 30 minutes (00 or 30)
  const roundedMinutes = minutes < 30 ? '00' : '30';

  return `${year}-${month}-${day}-${hour}-${roundedMinutes}`;
}

const NEWS_SUMMARY_SYSTEM_PROMPT = `You are a PhD-level intelligence analyst and conservative Christian strategist providing comprehensive geopolitical, economic, and cultural analysis.

# CRITICAL MISSION
Generate RENOWNED, PROFESSIONAL-GRADE intelligence reports that rival The Economist, WSJ, and top-tier think tanks. This must be PhD-LEVEL ANALYSIS with depth, nuance, and strategic insight.

# ANALYTICAL FRAMEWORK
- **Academic Rigor:** Doctoral-level research depth with sourced citations
- **Strategic Analysis:** Connect dots between events, identify patterns, forecast implications
- **Conservative Christian Lens:** Free markets, constitutional governance, Judeo-Christian values, strong national defense
- **Geopolitical Sophistication:** Multi-dimensional analysis of power dynamics, economic warfare, ideological conflicts
- **NO BULLETS:** Write FULL PARAGRAPHS with analytical depth like a professional intelligence briefing

# EXPANDED COVERAGE CATEGORIES

## 1. BREAKING NEWS & POLITICS
**Coverage:** Presidential actions, Congressional battles, Supreme Court, state politics, elections, policy developments, corruption investigations
**Depth:** Multi-paragraph analysis of political implications, constitutional questions, power dynamics
**Sources:** Fox News, Newsmax, WSJ, The Hill, RealClearPolitics, National Review

## 2. MARKETS & FINANCIAL INTELLIGENCE
**Coverage:**
- **Stock Market Analysis:** Dow, S&P 500, NASDAQ movements with sector breakdowns
- **Individual Stock Highlights:** Major movers, earnings reports, mergers & acquisitions
- **Commodities:** Oil, gold, silver, agricultural futures
- **Currency Markets:** Dollar strength, Bitcoin, foreign exchange
- **Economic Indicators:** Inflation (CPI, PPI), employment, GDP, manufacturing indexes
- **Federal Reserve:** Interest rate decisions, quantitative tightening/easing, policy signals
- **Corporate Earnings:** Major company reports with strategic implications
**Depth:** 3-4 paragraphs with specific numbers, percentages, and market driver analysis
**Sources:** Bloomberg, WSJ, CNBC, MarketWatch, Zero Hedge, Seeking Alpha, The Epoch Times (economic reporting)

## 3. INTERNATIONAL AFFAIRS & GEOPOLITICS
**Coverage:** European developments, Middle East conflicts, Latin America, Africa, Asia-Pacific alliances, UN actions, trade agreements
**Depth:** Strategic analysis of how events affect U.S. interests and Christian communities globally
**Sources:** Reuters, AP, WSJ, The Economist, Foreign Affairs, Real Clear Defense

## 4. NATIONAL SECURITY & DEFENSE
**Coverage:** Military readiness, Pentagon budgets, weapons systems, cyber warfare capabilities, homeland security, border security operations
**Depth:** Threat assessment with strategic recommendations
**Sources:** Defense News, Military Times, National Review (defense coverage), Breaking Defense

## 5. INTELLIGENCE & ESPIONAGE
**Coverage:** CIA/NSA operations, foreign interference (Russian, Chinese, Iranian), cybersecurity threats, election security, industrial espionage
**Depth:** Multi-layered analysis of intelligence community actions and geopolitical spy games
**Sources:** WSJ (national security), Reuters, verified intelligence community sources

## 6. TECH & BIG TECH TYRANNY
**Coverage:** Censorship, AI developments, data privacy, tech monopolies, social media manipulation, surveillance capitalism
**Depth:** Analysis of First Amendment implications and corporate-government collusion
**Sources:** The Post Millennial, National Review, WSJ Tech, Reclaim The Net, independent tech analysts

## 7. ENERGY & RESOURCES
**Coverage:** Oil production, natural gas, renewable push/costs, pipeline politics, strategic petroleum reserve, OPEC actions
**Depth:** Energy independence analysis with economic and national security implications
**Sources:** Bloomberg Energy, WSJ, OilPrice.com, Institute for Energy Research

## 8. CHRISTIAN PERSECUTION & RELIGIOUS LIBERTY
**Coverage:** Global persecution of Christians, domestic religious freedom battles, anti-Christian policies, church developments
**Depth:** Country-by-country analysis with advocacy recommendations
**Sources:** Christian Post, World Magazine, Open Doors USA, Voice of the Martyrs, ADF Legal

## 9. CULTURE WAR & EDUCATION
**Coverage:** Woke ideology in schools, parental rights, Title IX, DEI mandates, cultural Marxism, entertainment industry, academic freedom
**Depth:** Ideological analysis with biblical worldview perspective
**Sources:** National Review, The Federalist, Daily Wire, City Journal, American Mind

## 10. CHINA THREAT ASSESSMENT
**Coverage:** CCP military expansion, Taiwan threats, economic warfare, tech theft, Belt & Road, human rights abuses, influence operations
**Depth:** Comprehensive adversarial analysis with strategic countermeasures
**Sources:** WSJ China coverage, Reuters, Epoch Times, Gordon Chang analysis, China watchers

## 11. RUSSIA & EASTERN EUROPE
**Coverage:** Ukraine conflict, Putin regime actions, NATO dynamics, energy blackmail, disinformation warfare
**Depth:** Strategic analysis of authoritarian expansion and Western response
**Sources:** WSJ, Reuters, Institute for the Study of War, European defense analysts

## 12. MIDDLE EAST & IRAN
**Coverage:** Iran nuclear program, terrorism financing, Hezbollah/Hamas, Saudi-Israeli normalization, regional proxy wars
**Depth:** Eschatological and strategic analysis relevant to Christian understanding
**Sources:** WSJ, Jerusalem Post, MEMRI, Foundation for Defense of Democracies

# WRITING STYLE: PHD-LEVEL INTELLIGENCE REPORT

**FORMAT:** Write 2-4 FULL PARAGRAPHS per major category (not bullet points). Each paragraph should:
- Open with the most critical development
- Provide context and background
- Include specific data, percentages, dollar amounts, vote counts
- Analyze strategic implications
- Reference verified sources inline
- Connect to broader geopolitical/economic/cultural patterns

**TONE:**
- **Authoritative & Sophisticated:** Write like a senior intelligence analyst
- **Data-Rich:** Specific numbers, percentages, names, dates
- **Strategic:** Always answer "so what?" and "what's next?"
- **Conservative Framework:** Free markets, limited government, constitutional principles
- **Biblical Worldview:** Where relevant, note how developments affect Christians/churches

# SOURCES (Verified & Reputable)

**Tier 1 - Premium Financial/News:**
Bloomberg, WSJ, Reuters, AP, Financial Times, The Economist

**Tier 2 - Conservative Analysis:**
Fox News, Newsmax, National Review, The Federalist, Daily Wire, Washington Examiner, The Epoch Times

**Tier 3 - Independents (Highly Regarded):**
Zero Hedge (markets), Seeking Alpha (stocks), RealClearPolitics, City Journal, American Mind, Tablet Magazine

**Tier 4 - Christian & Specialized:**
Christian Post, World Magazine, First Things, Defense News, Breaking Defense, MEMRI

**Tier 5 - Verified Independent Analysts:**
Peter Zeihan (geopolitics), Dan Dicker (energy), Gordon Chang (China), Victor Davis Hanson (culture/history)

Generate a LEGENDARY intelligence report that Christians will SHARE and REFERENCE. This must be PhD-level quality that builds your reputation as THE conservative Christian news source.`;

/**
 * Cron endpoint - called every 30 minutes by Vercel Cron
 * Fetches LIVE breaking news and generates PhD-level analysis
 */
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret to prevent unauthorized access
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();
    const timestampKey = get30MinTimestampKey();

    console.log('🤖 [CRON] Fetching LIVE news for:', timestampKey);

    // Fetch live breaking news from NewsAPI
    const newsApiKey = process.env.NEWS_API_KEY;
    if (!newsApiKey) {
      console.error('❌ NEWS_API_KEY not configured');
      return NextResponse.json(
        { ok: false, error: 'NewsAPI key not configured' },
        { status: 500 }
      );
    }

    // Fetch breaking news for each category
    const categories = [
      { name: 'Politics', query: 'US politics Trump Biden Congress Supreme Court' },
      { name: 'Markets', query: 'stock market Dow S&P NASDAQ Bitcoin Fed interest rates' },
      { name: 'International', query: 'geopolitics international Ukraine Russia China Taiwan' },
      { name: 'Defense', query: 'military defense Pentagon national security border' },
      { name: 'Tech', query: 'big tech AI censorship Google Facebook Twitter' },
      { name: 'Energy', query: 'oil gas energy OPEC petroleum pipeline' },
      { name: 'Christian', query: 'Christian persecution religious freedom church' },
      { name: 'Culture', query: 'woke DEI education parental rights' },
      { name: 'China', query: 'China CCP Taiwan military expansion' },
      { name: 'Middle East', query: 'Iran Israel Hamas terrorism Middle East' },
    ];

    console.log('📡 [CRON] Fetching live news from NewsAPI...');

    const newsResults = await Promise.all(
      categories.map(async (cat) => {
        try {
          const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(cat.query)}&sortBy=publishedAt&language=en&pageSize=10&apiKey=${newsApiKey}`;
          const response = await fetch(url);
          const data = await response.json();

          if (data.status === 'ok' && data.articles) {
            const headlines = data.articles
              .slice(0, 10)
              .map((article: any) => ({
                title: article.title,
                description: article.description,
                source: article.source.name,
                publishedAt: article.publishedAt,
                url: article.url,
              }));

            return {
              category: cat.name,
              articles: headlines,
            };
          }
          return { category: cat.name, articles: [] };
        } catch (error) {
          console.error(`Error fetching ${cat.name}:`, error);
          return { category: cat.name, articles: [] };
        }
      })
    );

    console.log('✅ [CRON] Live news fetched, generating PhD analysis...');

    // Compile news into structured format for Claude
    const liveNewsContext = newsResults
      .map((result) => {
        if (result.articles.length === 0) return '';

        const articleList = result.articles
          .map(
            (a: { title: string; description: string; source: string; publishedAt: string; url: string }, i: number) =>
              `${i + 1}. [${a.source}] ${a.title}\n   ${a.description || 'No description'}\n   Published: ${new Date(a.publishedAt).toLocaleString()}`
          )
          .join('\n\n');

        return `## ${result.category.toUpperCase()} - BREAKING NEWS\n\n${articleList}`;
      })
      .filter((text) => text)
      .join('\n\n---\n\n');

    // Generate PhD-level analysis with LIVE web searches
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929', // Sonnet 4.5 with web search
      max_tokens: 8192,
      thinking: {
        type: 'enabled',
        budget_tokens: 5000,
      },
      system: NEWS_SUMMARY_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `You have access to LIVE WEB SEARCH capabilities. Use them to find the ABSOLUTE LATEST breaking news and developments from the past few hours.

I've provided some initial breaking news headlines below as context, but you MUST perform your own LIVE web searches to get the most current intel:

${liveNewsContext}

---

**YOUR TASK:** Generate a comprehensive PhD-level intelligence report with the MOST UP-TO-DATE information available.

**CRITICAL:** For EACH of the 10 sections below, you MUST:
1. Perform LIVE web searches to find breaking news from the past few hours
2. Search for specific market data, percentages, vote counts, and current prices
3. Find the latest developments, announcements, and breaking stories
4. Verify and cross-reference information from multiple sources

**SECTIONS TO COVER:**

1. **Breaking News & Politics** - Search for latest political developments, votes, announcements
2. **Markets & Financial Intelligence** - Search current stock prices, market movements, Fed news
3. **International Affairs & Geopolitics** - Search latest global conflicts, diplomatic developments
4. **National Security & Defense** - Search Pentagon announcements, military actions, border news
5. **Tech & Big Tech Tyranny** - Search latest tech censorship, AI developments, policy changes
6. **Energy & Resources** - Search current oil/gas prices, OPEC decisions, pipeline news
7. **Christian Persecution & Religious Liberty** - Search religious freedom cases, persecution reports
8. **Culture War & Education** - Search school board decisions, DEI policies, parental rights
9. **China Threat Assessment** - Search CCP military actions, Taiwan news, economic warfare
10. **Middle East & Iran** - Search Iran nuclear program, terrorism, regional conflicts

**WRITING REQUIREMENTS:**
- Write 2-4 FULL PARAGRAPHS per section (not bullet points)
- Include SPECIFIC data: percentages, dollar amounts, vote counts, stock prices, dates, times
- Reference REAL breaking news from your web searches
- Provide strategic analysis and implications
- Conservative Christian perspective
- PhD-level quality like a prestigious think tank

Use your LIVE web search to ensure this is the MOST CURRENT intelligence report possible!`,
        },
      ],
    });

    const summaryContent = response.content[0];
    if (summaryContent.type !== 'text') {
      throw new Error('Invalid response type from Claude');
    }

    const newsSummary = summaryContent.text;

    // Delete old summaries (keep only last 48 hours)
    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    await supabase
      .from('daily_news_summaries')
      .delete()
      .lt('generated_at', twoDaysAgo);

    // Store in database
    const { error: insertError } = await supabase
      .from('daily_news_summaries')
      .insert({
        timestamp_key: timestampKey,
        content: { summary: newsSummary, generated_at: new Date().toISOString() },
        generated_at: new Date().toISOString(),
      });

    if (insertError) {
      console.error('❌ [CRON] Database insert error:', insertError);
      return NextResponse.json(
        { ok: false, error: 'Failed to store summary' },
        { status: 500 }
      );
    }

    console.log('✅ [CRON] PhD news analysis generated and cached:', timestampKey);

    return NextResponse.json({
      ok: true,
      timestamp: timestampKey,
      message: 'Live news summary generated successfully',
      articlesProcessed: newsResults.reduce((sum, r) => sum + r.articles.length, 0),
    });
  } catch (error: any) {
    console.error('❌ [CRON] News generation error:', error);
    return NextResponse.json(
      {
        ok: false,
        error: 'Failed to generate news summary',
        details: error?.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
}

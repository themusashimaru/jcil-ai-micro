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

const NEWS_SUMMARY_SYSTEM_PROMPT = `You are a conservative Christian news analyst who provides balanced, fact-based news summaries from a center-right perspective.

# YOUR MISSION
Provide clear, concise news summaries that help believers stay informed without being overwhelmed. Focus on verified facts, avoid sensationalism, and maintain a biblical worldview.

# PERSPECTIVE
- **Conservative/Center-Right:** Economic freedom, limited government, strong defense, traditional values
- **Christian Worldview:** Uphold biblical truth, religious liberty, sanctity of life, traditional marriage
- **Factual & Balanced:** Report facts accurately, acknowledge opposing views, avoid conspiracy theories
- **Hopeful:** Point to truth and hope even in difficult news

# CATEGORIES TO COVER

## 1. U.S. BREAKING NEWS
Major domestic developments: politics, legislation, Supreme Court, social issues, culture

## 2. INTERNATIONAL NEWS
Global developments affecting U.S. interests and the Christian community

## 3. ECONOMICS & BUSINESS
Market news, inflation, jobs, trade, regulations, economic policy

## 4. NATIONAL DEFENSE
Military developments, defense policy, veterans affairs, homeland security

## 5. INTERNATIONAL ESPIONAGE
Intelligence operations, cyber warfare, foreign interference, security threats

## 6. CHRISTIAN PERSECUTION
Religious freedom threats worldwide, persecution of believers, church developments

## 7. CHINA (Adversarial Summary)
CCP actions, military developments, economic warfare, human rights violations

## 8. RUSSIA (Adversarial Summary)
Putin regime, military actions, disinformation campaigns, regional threats

## 9. IRAN (Adversarial Summary)
Regime actions, nuclear program, terrorism support, regional destabilization

## 10. NORTH KOREA (Adversarial Summary)
Kim regime, nuclear/missile developments, human rights abuses, regional threats

# OUTPUT FORMAT

For each category, provide 2-4 concise bullet points summarizing the most important recent developments:

**Category Name**
• [Headline]: Brief 1-2 sentence summary. [Source if notable]
• [Headline]: Brief 1-2 sentence summary.

# TONE & STYLE
- **Clear & Concise:** 1-2 sentences per item
- **Factual:** Stick to verified information
- **Conservative Framing:** Economic freedom, strong defense, traditional values
- **Not Alarmist:** Inform without fear-mongering
- **Cite Sources:** Reference major news outlets when relevant

# SOURCES TO PRIORITIZE
- **Major Networks:** Fox News, WSJ, AP, Reuters, Bloomberg
- **Conservative:** National Review, The Federalist, Washington Examiner
- **Christian:** Christian Post, World Magazine, Religion News Service
- **Defense:** Defense News, Military Times
- **International:** BBC, The Economist

Avoid fringe sources, conspiracy sites, or unverified claims.

# EXAMPLE OUTPUT

**U.S. BREAKING NEWS**
• **Border Crisis Continues**: CBP reports 250,000 encounters in December, highest December on record. GOP pushes for stricter enforcement measures. [Fox News]
• **Supreme Court Hears Free Speech Case**: Justices appear divided on social media content moderation laws in Texas and Florida. Ruling expected June. [WSJ]

**CHRISTIAN PERSECUTION**
• **Nigeria Church Attacks**: Fulani militants kill 12 Christians in Plateau State raids. Government criticized for inaction. [Christian Post]
• **China Cracks Down**: 50+ house church pastors detained in Henan Province. CCP intensifies religious surveillance. [World Magazine]

Now generate today's news summary based on current events.`;

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const timestampKey = get30MinTimestampKey();

    // Check for existing summary for this 30-minute window
    const { data: existingSummary } = await supabase
      .from('daily_news_summaries')
      .select('*')
      .eq('timestamp_key', timestampKey)
      .single();

    if (existingSummary) {
      return NextResponse.json({
        ok: true,
        summary: existingSummary.content,
        timestamp: existingSummary.timestamp_key,
        cached: true,
      });
    }

    // Generate new news summary
    console.log('📰 Generating new news summary for:', timestampKey);

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514', // Claude Sonnet 4.5
      max_tokens: 4096,
      system: NEWS_SUMMARY_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Generate a comprehensive conservative Christian news summary for the current time period.

Cover all 10 categories:
1. U.S. Breaking News
2. International News
3. Economics & Business
4. National Defense
5. International Espionage
6. Christian Persecution
7. China (Adversarial Summary)
8. Russia (Adversarial Summary)
9. Iran (Adversarial Summary)
10. North Korea (Adversarial Summary)

For each category, provide 2-4 recent, verified news items with brief summaries. Focus on the most important developments from the past 24-48 hours.

Use factual reporting from verified major sources. Maintain a conservative Christian perspective while being balanced and truthful.`,
        },
      ],
    });

    const summaryContent = response.content[0];
    if (summaryContent.type !== 'text') {
      throw new Error('Invalid response type from Claude');
    }

    const newsSummary = summaryContent.text;

    // Store in database
    const { error: insertError } = await supabase
      .from('daily_news_summaries')
      .insert({
        timestamp_key: timestampKey,
        content: { summary: newsSummary, generated_at: new Date().toISOString() },
        generated_at: new Date().toISOString(),
      });

    if (insertError) {
      console.error('Database insert error:', insertError);
      // Continue anyway - return the summary even if storage fails
    }

    return NextResponse.json({
      ok: true,
      summary: { summary: newsSummary, generated_at: new Date().toISOString() },
      timestamp: timestampKey,
      cached: false,
    });
  } catch (error: any) {
    console.error('News summary error:', error);
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

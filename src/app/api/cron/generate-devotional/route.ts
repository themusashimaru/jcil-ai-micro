export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { xai } from '@ai-sdk/xai';
import { generateText } from 'ai';
import { createClient } from '@/lib/supabase/server';

const DEVOTIONAL_SYSTEM_PROMPT = `You are a Christian devotional writer creating daily devotionals for believers.

Your devotionals should:
- Be rooted in the 66 canonical books of Scripture
- Include a relevant Bible passage (cite book, chapter, verses)
- **ALWAYS quote Scripture from the New King James Version (NKJV)**
- Provide thoughtful reflection on the passage
- Offer practical application for daily life
- Include a closing prayer
- Be encouraging and faith-building
- Be 300-500 words total

Structure each devotional as follows:

# [Engaging Title]

**Scripture:** [Book Chapter:Verses (NKJV)]

**[Quote the verses from NKJV - be accurate to the NKJV translation]**

## Reflection

[2-3 paragraphs of thoughtful reflection on the passage, connecting to daily Christian life]

## Application

[Practical ways to apply this Scripture today]

## Prayer

[A short, heartfelt prayer based on the passage]

---

**CRITICAL:** All Bible quotes MUST be from the New King James Version (NKJV). Be accurate to the NKJV translation.
**Remember:** Ground everything in Scripture. Be encouraging. Point people to Christ.`;

/**
 * Cron endpoint - called daily at 2am by Vercel Cron
 * Generates the daily devotional for the entire site
 *
 * Query params:
 * - date: YYYY-MM-DD (optional) - generate for specific date
 * - force: true (optional) - regenerate even if exists
 */
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret to prevent unauthorized access
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();

    // Allow manual date specification via query param
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get('date');
    const forceRegenerate = searchParams.get('force') === 'true';

    const today = dateParam ? new Date(dateParam) : new Date();
    const dateKey = today.toISOString().split('T')[0]; // YYYY-MM-DD

    console.log('🙏 [CRON] Generating daily devotional for:', dateKey, forceRegenerate ? '(FORCED)' : '');

    // Check if devotional already exists for today
    const { data: existing } = await supabase
      .from('daily_devotionals')
      .select('date_key')
      .eq('date_key', dateKey)
      .single();

    if (existing && !forceRegenerate) {
      console.log('✅ [CRON] Devotional already exists for today');
      return NextResponse.json({
        ok: true,
        message: 'Devotional already exists for today',
        date: dateKey,
      });
    }

    // If force regenerating, delete existing
    if (existing && forceRegenerate) {
      await supabase
        .from('daily_devotionals')
        .delete()
        .eq('date_key', dateKey);
      console.log('🔄 [CRON] Deleted existing devotional for regeneration');
    }

    // Generate new devotional using Grok 4 Fast Reasoning
    const response = await generateText({
      model: xai('grok-4-fast-reasoning'),
      system: DEVOTIONAL_SYSTEM_PROMPT,
      prompt: `Create today's daily devotional for ${today.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })}. Make it fresh, relevant, and encouraging for believers.`,
    });

    const devotionalContent = response.text || 'Error generating devotional.';

    // Store in database
    const { error: insertError } = await supabase
      .from('daily_devotionals')
      .insert({
        date_key: dateKey,
        content: devotionalContent,
        generated_at: new Date().toISOString(),
      });

    if (insertError) {
      console.error('❌ [CRON] Error storing devotional:', insertError);
      return NextResponse.json(
        { ok: false, error: 'Failed to store devotional' },
        { status: 500 }
      );
    }

    // Delete old devotionals (keep only last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    await supabase
      .from('daily_devotionals')
      .delete()
      .lt('date_key', thirtyDaysAgo);

    console.log('✅ [CRON] Devotional generated and stored successfully');

    return NextResponse.json({
      ok: true,
      message: 'Daily devotional generated successfully',
      date: dateKey,
    });
  } catch (error: any) {
    console.error('❌ [CRON] Devotional generation error:', error);
    return NextResponse.json(
      {
        ok: false,
        error: 'Failed to generate devotional',
        details: error?.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
}

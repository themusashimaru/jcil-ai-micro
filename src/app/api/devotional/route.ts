import { NextRequest, NextResponse } from 'next/server';
import { xai } from '@ai-sdk/xai';
import { generateText } from 'ai';
import { createClient } from '@/lib/supabase/server';

/**
 * Daily Devotional API
 *
 * Generates a new devotional once per day at midnight.
 * All users see the same devotional for that day.
 */

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

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get today's date (UTC) as identifier
    const today = new Date();
    const dateKey = today.toISOString().split('T')[0]; // YYYY-MM-DD format

    // Check for force regeneration (dev/admin use)
    const { searchParams } = new URL(request.url);
    const forceRegenerate = searchParams.get('force') === 'true';

    // Check if we already have today's devotional
    const { data: existingDevotional, error: fetchError } = await supabase
      .from('daily_devotionals')
      .select('*')
      .eq('date_key', dateKey)
      .single();

    // If force regenerating, delete existing
    if (existingDevotional && forceRegenerate) {
      await supabase
        .from('daily_devotionals')
        .delete()
        .eq('date_key', dateKey);
      console.log('Force regenerating devotional for:', dateKey);
    } else if (existingDevotional && !fetchError) {
      // Return existing devotional
      return NextResponse.json({
        ok: true,
        devotional: existingDevotional.content,
        date: existingDevotional.date_key,
        cached: true,
      });
    }

    // Generate new devotional using Grok
    console.log('Generating new devotional for:', dateKey);

    const response = await generateText({
      model: xai('grok-4-fast-reasoning'),
      system: DEVOTIONAL_SYSTEM_PROMPT,
      prompt: `Create today's daily devotional for ${today.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}. Make it fresh, relevant, and encouraging.`,
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
      console.error('Error storing devotional:', insertError);
      // Still return the devotional even if storage fails
    }

    return NextResponse.json({
      ok: true,
      devotional: devotionalContent,
      date: dateKey,
      cached: false,
    });
  } catch (error: any) {
    console.error('Error generating devotional:', error);
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || 'Failed to generate devotional',
      },
      { status: 500 }
    );
  }
}

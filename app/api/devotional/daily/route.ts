/**
 * DAILY DEVOTIONAL API ROUTE
 *
 * PURPOSE:
 * - Provide a daily Christian devotional using KJV Bible
 * - Same devotional for all users, refreshed at 12:01 AM daily
 * - Uses AI to generate theologically sound content
 *
 * PUBLIC ROUTES:
 * - GET /api/devotional/daily
 *
 * FEATURES:
 * - ✅ Daily devotional generation
 * - ✅ 24-hour caching (same for all users)
 * - ✅ KJV Scripture references
 * - ✅ Proper Christian theology
 * - ✅ Includes meditation, prayer, and application
 */

import { createChatCompletion } from '@/lib/xai/client';
import { NextResponse } from 'next/server';

interface Devotional {
  date: string;
  title: string;
  scripture: {
    reference: string;
    text: string;
  };
  meditation: string;
  prayer: string;
  application: string;
}

// In-memory cache for the daily devotional
let cachedDevotional: { date: string; devotional: Devotional } | null = null;

function getTodayDateString(): string {
  const now = new Date();
  return now.toISOString().split('T')[0]; // YYYY-MM-DD
}

async function generateDevotional(): Promise<Devotional> {
  const today = new Date();
  const formattedDate = today.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const prompt = `You are a faithful Christian pastor and theologian creating a daily devotional for believers. Generate a biblically sound, encouraging devotional for ${formattedDate}.

Requirements:
1. Use a REAL King James Version (KJV) Bible verse - cite the exact reference
2. Provide the ACTUAL KJV text of that verse (not paraphrased)
3. Write a thoughtful meditation (150-200 words) that explains the verse and applies it to daily Christian living
4. Include a sincere prayer (75-100 words) that helps readers connect with God
5. Provide a practical application (50-75 words) with actionable steps

The devotional must be:
- Theologically sound and biblically accurate
- Encouraging and uplifting
- Relevant to modern Christians
- Rooted in orthodox Christian teaching
- Focused on spiritual growth and discipleship

Return ONLY a valid JSON object in this exact format (no markdown, no code blocks):
{
  "date": "${formattedDate}",
  "title": "A brief, compelling title (4-6 words)",
  "scripture": {
    "reference": "Book Chapter:Verse (KJV)",
    "text": "The exact KJV verse text"
  },
  "meditation": "The meditation text here...",
  "prayer": "The prayer text here...",
  "application": "The application text here..."
}`;

  try {
    const response = await createChatCompletion({
      messages: [
        {
          role: 'system',
          content:
            'You are a faithful Christian theologian who creates biblically sound devotionals. You have deep knowledge of Scripture and Christian theology. Always use accurate KJV Bible verses with proper citations. Return only valid JSON with no markdown formatting.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      tool: 'scripture',
      stream: false,
      temperature: 0.8,
      maxTokens: 1500,
    });

    if (!response || !response.text) {
      throw new Error('Failed to generate devotional content');
    }

    // Parse the JSON response
    let content = response.text.trim();

    // Remove markdown code blocks if present
    content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '');

    const devotional = JSON.parse(content) as Devotional;

    // Validate the response has all required fields
    if (
      !devotional.title ||
      !devotional.scripture?.reference ||
      !devotional.scripture?.text ||
      !devotional.meditation ||
      !devotional.prayer ||
      !devotional.application
    ) {
      throw new Error('Invalid devotional structure');
    }

    return devotional;
  } catch (error) {
    console.error('Error generating devotional:', error);

    // Fallback devotional if generation fails
    return {
      date: formattedDate,
      title: 'Walk in Faith',
      scripture: {
        reference: 'Proverbs 3:5-6 (KJV)',
        text: 'Trust in the LORD with all thine heart; and lean not unto thine own understanding. In all thy ways acknowledge him, and he shall direct thy paths.',
      },
      meditation:
        "Today's Scripture calls us to a life of complete trust in God. The command to trust \"with all thine heart\" means holding nothing back - not our fears, not our plans, not our understanding. When we lean on our own understanding, we limit ourselves to what we can see and comprehend. But God sees the entire picture of our lives.\n\nThe promise is beautiful: when we acknowledge Him in all our ways - in our decisions, relationships, work, and daily routines - He will direct our paths. This doesn't mean we become passive, but rather that we actively seek His guidance in everything. Walking by faith means trusting that God's direction is better than our own planning, even when we cannot see the outcome.",
      prayer:
        "Heavenly Father, I come before You acknowledging my need for Your guidance. Forgive me for the times I have relied solely on my own understanding instead of seeking Your wisdom. Help me to trust You completely, even when the path ahead seems unclear. Direct my steps today, Lord, and give me the courage to follow where You lead. May every decision I make honor You. In Jesus' name, Amen.",
      application:
        "Today, identify one area where you've been relying on your own understanding rather than God's guidance. It might be a decision you're facing, a relationship, or a plan you're making. Pause and specifically pray about it, asking God to direct your path. Write down what you sense Him leading you to do, and take one practical step of obedience in that direction.",
    };
  }
}

export async function GET() {
  try {
    const today = getTodayDateString();

    // Check if we have a cached devotional for today
    if (cachedDevotional && cachedDevotional.date === today) {
      return NextResponse.json({ devotional: cachedDevotional.devotional });
    }

    // Generate new devotional
    const devotional = await generateDevotional();

    // Cache it
    cachedDevotional = {
      date: today,
      devotional,
    };

    return NextResponse.json({ devotional });
  } catch (error) {
    console.error('Error in devotional API:', error);
    return NextResponse.json({ error: 'Failed to load devotional' }, { status: 500 });
  }
}

// Optional: Add a cron endpoint to refresh at 12:01 AM
export async function POST() {
  try {
    const devotional = await generateDevotional();
    const today = getTodayDateString();

    cachedDevotional = {
      date: today,
      devotional,
    };

    return NextResponse.json({ success: true, devotional });
  } catch (error) {
    console.error('Error refreshing devotional:', error);
    return NextResponse.json({ error: 'Failed to refresh devotional' }, { status: 500 });
  }
}

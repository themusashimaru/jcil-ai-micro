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

import { createAnthropicCompletion } from '@/lib/anthropic/client';
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

  const prompt = `You are a Christian pastor and theologian creating a daily devotional for believers. Generate a biblically sound, encouraging devotional for ${formattedDate}.

Requirements:
1. Use a REAL King James Version (KJV) Bible verse - cite the exact reference with (KJV) notation
2. Provide the ACTUAL KJV text of that verse (not paraphrased)
3. Write a thoughtful meditation (150-200 words) that:
   - Explains the verse clearly and provides biblical insight
   - Includes relevant historical or cultural context when helpful
   - Uses clear, accessible language appropriate for college-level readers
   - Explores the spiritual meaning and theological significance
   - Connects to broader biblical themes
   - Applies the truth to everyday Christian living
4. Compose a heartfelt prayer (75-100 words) that:
   - Is theologically sound and reverent
   - Uses clear, sincere language
   - Helps readers connect with God personally
5. Provide a practical application (50-75 words) that:
   - Gives concrete, doable action steps
   - Challenges readers to grow spiritually
   - Connects faith to daily life

The devotional must be:
- Written at a college reading level with clear, accessible vocabulary
- Theologically accurate and biblically sound
- Rooted in orthodox Christian teaching
- Encouraging and practical while remaining substantive
- Spiritually enriching without being overly academic

Return ONLY a valid JSON object in this exact format (no markdown, no code blocks):
{
  "date": "${formattedDate}",
  "title": "An encouraging title (4-6 words)",
  "scripture": {
    "reference": "Book Chapter:Verse (KJV)",
    "text": "The exact KJV verse text"
  },
  "meditation": "The meditation text here...",
  "prayer": "The prayer text here...",
  "application": "The application text here..."
}`;

  try {
    const response = await createAnthropicCompletion({
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      systemPrompt: 'You are a Christian pastor and theologian who creates biblically sound, encouraging devotionals for everyday believers. You have deep knowledge of Scripture, theology, and biblical context. Write at a college reading level using clear, accessible language that is theologically accurate but not overly academic. Always use accurate KJV Bible verses with proper (KJV) notation. Return only valid JSON with no markdown formatting.',
      temperature: 0.8,
      maxTokens: 1500,
    });

    if (!response || !response.text) {
      throw new Error('Failed to generate devotional content');
    }

    // Parse the JSON response
    // Handle both string and Promise<string> return types
    const textContent = await Promise.resolve(response.text);
    let content = textContent.trim();

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
      title: 'Trust God Completely',
      scripture: {
        reference: 'Proverbs 3:5-6 (KJV)',
        text: 'Trust in the LORD with all thine heart; and lean not unto thine own understanding. In all thy ways acknowledge him, and he shall direct thy paths.',
      },
      meditation:
        "This passage from Proverbs gives us powerful wisdom about our relationship with God. When it says to trust with \"all thine heart,\" it means we should trust God with our whole being - our thoughts, feelings, will, and actions. The Hebrew word for \"heart\" (leb) refers to the center of who we are, not just our emotions.\n\nThe command not to lean on our own understanding is challenging. We naturally want to figure everything out ourselves and rely on our own logic. But God sees the whole picture of our lives while we can only see a small part. This verse calls us to humble ourselves and recognize that God's wisdom is greater than ours.\n\nThe promise is beautiful: when we acknowledge God in all our ways - in our relationships, work, decisions, and daily routines - He will direct our paths. This doesn't mean we become passive, but rather that we actively seek His guidance in everything. It means trusting that God's plan is better than our own, even when we can't see the outcome. This is the foundation of faith.",
      prayer:
        "Heavenly Father, I come to You acknowledging that I need Your wisdom and guidance. Forgive me for the times when I've trusted in my own understanding instead of seeking You first. Help me to trust You with my whole heart, even when the path ahead is unclear. Direct my steps today, Lord, and give me the courage to follow where You lead. May every decision I make honor You and reflect my trust in Your goodness. In Jesus' name, Amen.",
      application:
        "Today, identify one area where you've been relying on your own understanding instead of God's guidance. It could be a decision you're facing, a relationship, or a plan you're making. Spend time in prayer about it, asking God to show you His will. Write down what you sense Him leading you to do, and take one practical step of obedience. Choose to trust God's direction even if it doesn't make sense to you right now.",
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

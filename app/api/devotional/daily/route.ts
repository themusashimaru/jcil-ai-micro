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

  const prompt = `You are a seminary-trained Christian theologian with a Master of Divinity degree, creating a daily devotional for spiritually mature believers. Generate a biblically sound, theologically rich devotional for ${formattedDate}.

Requirements:
1. Use a REAL King James Version (KJV) Bible verse - cite the exact reference with (KJV) notation
2. Provide the ACTUAL KJV text of that verse (not paraphrased)
3. Write a sophisticated meditation (200-250 words) that:
   - Demonstrates exegetical depth and biblical insight
   - Engages with the historical, cultural, and theological context
   - Uses elevated vocabulary appropriate for graduate-level readers
   - Explores theological themes and doctrines
   - Makes connections to broader biblical theology
   - Applies profound spiritual truths to contemporary Christian living
4. Compose an eloquent prayer (100-125 words) that:
   - Reflects theological sophistication
   - Uses rich, reverent language
   - Addresses God with depth and intimacy
5. Provide a substantive application (75-100 words) that:
   - Challenges readers at a deeper spiritual level
   - Offers concrete, transformative action steps
   - Connects devotional practice to theological understanding

The devotional must be:
- Written at a master's degree reading level with sophisticated vocabulary
- Theologically rigorous and exegetically sound
- Rooted in orthodox Christian doctrine and biblical theology
- Intellectually stimulating while remaining pastorally sensitive
- Reflective of deep spiritual maturity and theological acumen

Return ONLY a valid JSON object in this exact format (no markdown, no code blocks):
{
  "date": "${formattedDate}",
  "title": "A theologically rich title (4-6 words)",
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
            'You are a seminary-trained theologian with a Master of Divinity degree who creates intellectually rigorous, theologically rich devotionals for spiritually mature believers. You possess comprehensive knowledge of biblical exegesis, systematic theology, church history, and biblical languages. Write at a graduate-level reading comprehension with sophisticated vocabulary and profound theological insight. Always use accurate KJV Bible verses with proper (KJV) notation. Return only valid JSON with no markdown formatting.',
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
      title: 'The Epistemology of Divine Trust',
      scripture: {
        reference: 'Proverbs 3:5-6 (KJV)',
        text: 'Trust in the LORD with all thine heart; and lean not unto thine own understanding. In all thy ways acknowledge him, and he shall direct thy paths.',
      },
      meditation:
        "This Solomonic wisdom presents a profound theological tension between human epistemology and divine omniscience. The imperative to trust \"with all thine heart\" employs the Hebrew concept of \"leb\" - not merely emotional sentiment, but the totality of one's intellectual, volitional, and affective faculties. The antithesis posed - \"lean not unto thine own understanding\" - challenges the Enlightenment privileging of autonomous reason, instead advocating a posture of epistemic humility before the transcendent God.\n\nThe text establishes a covenantal framework wherein comprehensive acknowledgment of God's sovereignty becomes the prerequisite for divine guidance. The phrase \"in all thy ways\" demands an integrated theology of vocation, where the sacred-secular dichotomy dissolves. God's promise to \"direct thy paths\" employs a causative verb form, indicating divine intervention that actively shapes our trajectory. This theodicy affirms God's meticulous providence while maintaining human agency - a nuanced middle path between determinism and open theism. The wisdom tradition here anticipates Paul's later theological development regarding the renewal of the mind (Romans 12:2) and Christ as the wisdom of God (1 Corinthians 1:24).",
      prayer:
        "Sovereign Lord, You who inhabit eternity and perceive all temporal realities simultaneously, I approach Your throne acknowledging my finite understanding and propensity toward autonomous reasoning. Forgive my presumption when I have elevated human wisdom above Your divine counsel. Grant me the theological virtue of faith that transcends empirical certainty, enabling me to rest in Your providential governance. Illumine my heart with the wisdom that originates in the fear of the Lord. May Your Spirit cultivate within me an epistemological humility that seeks Your guidance in every dimension of my existence. Through Christ, who is Himself the incarnate Wisdom of God, I pray. Amen.",
      application:
        "Engage in a rigorous theological audit of your decision-making processes. Identify one specific domain where Enlightenment rationalism or pragmatic utilitarianism has supplanted trust in divine providence. Practice the spiritual discipline of discernment through extended contemplative prayer, Scripture meditation, and consultation with mature believers. Document the tension between human understanding and faith-oriented trust, then deliberately choose one concrete action that reflects epistemic submission to God's revealed will, even if it contradicts conventional wisdom or personal preference. This praxis of trust becomes a tangible demonstration of covenant faithfulness.",
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

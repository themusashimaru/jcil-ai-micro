import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/lib/supabase/server';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check authentication
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { query, location } = await request.json();

    if (!query || typeof query !== 'string') {
      return NextResponse.json({ error: 'Invalid query' }, { status: 400 });
    }

    // Append location to query if provided
    let searchQuery = query;
    if (location && location.latitude && location.longitude) {
      searchQuery = `${query} near ${location.latitude},${location.longitude}`;
      console.log('📍 Location-enhanced search query:', searchQuery);
    }

    // Fetch web search results from Brave Search API
    const braveApiKey = process.env.BRAVE_SEARCH_API_KEY;

    if (!braveApiKey) {
      return NextResponse.json(
        { error: 'Web search is not configured' },
        { status: 500 }
      );
    }

    console.log('🔍 Searching the web for:', searchQuery);

    const searchUrl = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(searchQuery)}&count=10&freshness=7d`;
    const searchResponse = await fetch(searchUrl, {
      headers: {
        'X-Subscription-Token': braveApiKey,
      },
    });

    const searchData = await searchResponse.json();

    if (!searchResponse.ok || !searchData.web?.results) {
      return NextResponse.json(
        { error: 'Web search failed' },
        { status: 500 }
      );
    }

    // Format search results for Claude
    const searchResults = searchData.web.results
      .slice(0, 8)
      .map((result: any, index: number) => {
        return `${index + 1}. **${result.title}**
   ${result.description || 'No description available'}
   URL: ${result.url}
   ${result.age ? `Published: ${result.age}` : ''}`;
      })
      .join('\n\n');

    console.log('✅ Search results fetched, sending to Claude for analysis...');

    // Detect if this is a LOCAL/PRACTICAL query (restaurants, shops, services, etc.)
    const localQueryPatterns = [
      /\b(restaurant|barber|barbershop|shop|store|hotel|cafe|coffee|gym|salon|spa|dentist|doctor|hospital|pharmacy|gas station|bank|atm|pizza|food)\b/i,
      /\b(nearest|closest|best|near me|around me|nearby|close by)\b/i,
      /\b(where can i|where to|how do i get|directions to)\b/i,
      /(closest|nearest|near me)\s+(restaurant|barber|barbershop|shop|store|hotel|cafe|gym|pizza)/i,
      /(restaurant|barber|barbershop|shop|store|hotel|cafe|gym|pizza)\s+(near|nearby|around|close to|closest to|nearest to)\s+(me|here)/i
    ];

    const isLocalQuery = localQueryPatterns.some(pattern => pattern.test(query));

    // Use DIFFERENT prompts for LOCAL vs NEWS/POLITICAL queries
    let systemPrompt = '';
    let userPrompt = '';

    if (isLocalQuery) {
      // FOR LOCAL QUERIES: Direct, practical, helpful (NO biblical commentary needed for barber shops!)
      systemPrompt = `You are a helpful local search assistant. Give ULTRA-SHORT, direct answers.

CRITICAL RULES:
- Extract specific business names, addresses, and contact info from the results
- List 3-5 places even if info is partial
- If results have business names and any location details, USE THEM
- NO excuses about not having specific data - work with what you have
- Format links properly
- Keep it SHORT

Format:
**Business Name**
Address (or "See website for location")
[Website](url) or Phone`;

      const locationInfo = location
        ? `\n\n🎯 USER'S LOCATION: Latitude ${location.latitude}, Longitude ${location.longitude}\nSearch results are filtered for this area.`
        : '';

      userPrompt = `I searched for: "${query}"${locationInfo}

Here are the search results:

${searchResults}

---

CRITICAL INSTRUCTIONS:
1. Extract SPECIFIC business names and addresses from the results above
2. Even if it's a directory link, mention the business names you see
3. DO NOT say you don't have data - use whatever is in the results
4. If you see business names mentioned, list them with whatever details are available
5. Format links from the URLs provided

Provide 3-5 places based on the results. Work with what you have!`;

    } else {
      // FOR NEWS/POLITICAL/GENERAL QUERIES: Christian conservative analysis
      systemPrompt = `You are a Christian conservative AI assistant. Provide clear, factual answers with biblical perspective when relevant.

**CRITICAL FORMATTING RULES:**
- **Bold** = Section headers ONLY (use sparingly!)
- Regular text = All factual content and explanations
- *Italics* = Biblical commentary and Scripture quotes ONLY

Example of GOOD formatting:
"The latest reports show unemployment at 3.8%. According to WSJ, job growth remains strong in tech and healthcare sectors. *From a biblical perspective, we should remember that 'whatever you do, work heartily, as for the Lord' (Colossians 3:23).*"

Example of BAD formatting (too many bolds):
"The **latest reports** show **unemployment** at **3.8%**. According to **WSJ**, **job growth** remains **strong**..."

Keep it clean! Bold for headers, italics for biblical commentary, regular text for everything else.`;

      userPrompt = `I searched for: "${query}"

Here are the search results:

${searchResults}

---

Provide a clear answer with:

1. **Direct Answer** - The key facts
2. **Analysis** - What Christians should know
3. **Biblical Perspective** - If relevant (use *italics* for this section)

Keep formatting clean:
- **Bold** for section headers only
- Regular text for facts and explanations
- *Italics* for biblical commentary and Scripture

Be concise and thorough.`;
    }

    // Send search results to Claude Haiku 4.5 for interpretation
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: userPrompt,
        },
      ],
    });

    const interpretation = response.content[0].type === 'text'
      ? response.content[0].text
      : 'Unable to generate interpretation';

    console.log('✅ Claude interpretation complete');

    return NextResponse.json({
      ok: true,
      interpretation,
      sources: searchData.web.results.slice(0, 5).map((r: any) => ({
        title: r.title,
        url: r.url,
      })),
    });
  } catch (error: any) {
    console.error('❌ Web search error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to perform web search' },
      { status: 500 }
    );
  }
}

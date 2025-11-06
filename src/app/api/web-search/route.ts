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
      /\b(restaurant|barber|shop|store|hotel|cafe|coffee|gym|salon|spa|dentist|doctor|hospital|pharmacy|gas station|bank|atm)\b/i,
      /\b(nearest|closest|best|near me|around me|nearby)\b/i,
      /\b(where can i|where to|how do i get|directions to)\b/i,
    ];

    const isLocalQuery = localQueryPatterns.some(pattern => pattern.test(query));

    // Use DIFFERENT prompts for LOCAL vs NEWS/POLITICAL queries
    let systemPrompt = '';
    let userPrompt = '';

    if (isLocalQuery) {
      // FOR LOCAL QUERIES: Direct, practical, helpful (NO biblical commentary needed for barber shops!)
      systemPrompt = `You are a helpful local search assistant. Provide direct, practical information from search results.

Your role:
- Give clear, actionable information (addresses, hours, ratings, etc.)
- List specific businesses/locations with details
- Be concise and helpful
- Format with clear headings and bullet points
- NO religious commentary needed for practical local searches

Keep it simple and useful!`;

      userPrompt = `I searched for: "${query}"

Here are the top local search results:

${searchResults}

---

Please provide a clear, practical answer with:
1. **Top Results**: List 3-5 specific places with key details (address, ratings if available)
2. **Quick Summary**: Brief overview of what's available
3. **Helpful Tips**: Any useful info from the results

Keep it direct and useful - no need for philosophical or religious analysis for this practical search.`;

    } else {
      // FOR NEWS/POLITICAL/GENERAL QUERIES: Christian conservative analysis
      systemPrompt = `You are a Christian conservative AI assistant that analyzes web search results through a biblical worldview lens.

Your role:
- Provide comprehensive, accurate answers grounded in truth
- Evaluate information against Scripture and Christian values when relevant
- Identify secular bias, woke ideology, or anti-Christian narratives in the sources
- Defend biblical authority and Christian principles
- Be discerning and thorough

**FORMATTING RULES:**
- Use **bold** ONLY for section headers and key terms
- Use regular text for main content
- Use *italics* for Scripture references and biblical quotes
- Keep formatting clean and readable

Always cite sources while providing biblical perspective when appropriate.`;

      userPrompt = `I searched the web for: "${query}"

Here are the top search results:

${searchResults}

---

Analyze these search results and provide a comprehensive answer through a **Christian conservative worldview**:

1. **Direct Answer**: Provide a clear, factual answer to the query
2. **Key Information**: Summarize important facts from the search results
3. **Biblical Perspective**: If relevant, how should Christians understand this topic?
4. **Worldview Analysis**: Identify any secular bias or anti-Christian narratives if present
5. **Citations**: Reference specific sources by name

**FORMATTING:**
- Use **bold** only for headers
- Use regular text for explanations
- Use *italics* for Scripture references like *"For God so loved the world..." (John 3:16)*

Be thorough and discerning. Format your response clearly.`;
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

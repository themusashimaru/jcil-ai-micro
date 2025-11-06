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

    // Send search results to Claude Haiku 4.5 for interpretation with Christian worldview filter
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      system: `You are a Christian conservative AI assistant that analyzes web search results through a biblical worldview lens.

Your role:
- Provide comprehensive, accurate answers grounded in truth
- Evaluate information against Scripture and Christian values
- Identify secular bias, woke ideology, or anti-Christian narratives in the sources
- Highlight truth aligned with God's Word
- Challenge mainstream narratives that contradict Christian principles
- Defend biblical authority, traditional family values, and religious liberty
- Expose moral relativism and cultural Marxism where present

Be discerning, bold, and thorough. Always cite sources while providing biblical perspective.`,
      messages: [
        {
          role: 'user',
          content: `I searched the web for: "${query}"

Here are the top search results:

${searchResults}

---

**Your Task:** Analyze these search results and provide a comprehensive answer through a **Christian conservative worldview**:

1. **Direct Answer**: Provide a clear, factual answer to the query
2. **Key Information**: Summarize important facts from the search results
3. **Biblical Perspective**: How should Christians understand this topic?
4. **Worldview Analysis**:
   - Identify any secular bias, woke ideology, or anti-Christian narratives in the sources
   - Expose deception or manipulation if present
   - Highlight biblical principles at stake
5. **Citations**: Reference specific sources by name
6. **Context**: Provide important background information

Be thorough, discerning, and bold in defending Christian truth. Format your response clearly with proper paragraphs.`,
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

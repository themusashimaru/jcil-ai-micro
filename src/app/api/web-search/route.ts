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

    const { query } = await request.json();

    if (!query || typeof query !== 'string') {
      return NextResponse.json({ error: 'Invalid query' }, { status: 400 });
    }

    // Fetch web search results from Brave Search API
    const braveApiKey = process.env.BRAVE_SEARCH_API_KEY;

    if (!braveApiKey) {
      return NextResponse.json(
        { error: 'Web search is not configured' },
        { status: 500 }
      );
    }

    console.log('🔍 Searching the web for:', query);

    const searchUrl = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=10&freshness=7d`;
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

    // Send search results to Claude Sonnet 4.5 for interpretation
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 4096,
      system: `You are a helpful AI assistant that interprets web search results and provides comprehensive, accurate answers. Always cite sources and provide clear, well-structured responses.`,
      messages: [
        {
          role: 'user',
          content: `I searched the web for: "${query}"

Here are the top search results:

${searchResults}

---

Please analyze these search results and provide a comprehensive answer to my search query. Include:
1. A clear, direct answer to the question/query
2. Key information from the search results
3. Multiple perspectives if relevant
4. Citations to the sources (mention specific source names)
5. Any important context or background information

Be thorough but concise. Format your response in a readable way with proper paragraphs.`,
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

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

    const { claim } = await request.json();

    if (!claim || typeof claim !== 'string') {
      return NextResponse.json({ error: 'Invalid claim' }, { status: 400 });
    }

    // Get Perplexity API key
    const perplexityApiKey = process.env.PERPLEXITY_API_KEY;

    if (!perplexityApiKey) {
      return NextResponse.json(
        { error: 'Fact-checking is not configured' },
        { status: 500 }
      );
    }

    console.log('✅ Fact-checking claim:', claim);

    // Use Perplexity API for comprehensive fact-checking
    const perplexityResponse = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${perplexityApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-sonar-large-128k-online',
        messages: [
          {
            role: 'system',
            content: 'You are a precise fact-checker. Provide accurate, well-sourced information with citations. Include dates, statistics, and verifiable evidence.',
          },
          {
            role: 'user',
            content: `Fact-check this claim: "${claim}"

Provide:
1. **Verdict**: TRUE / FALSE / PARTIALLY TRUE / UNVERIFIABLE
2. **Evidence**: Detailed facts with sources and dates
3. **Context**: Important background information
4. **Citations**: List of sources with URLs

Be thorough and objective.`,
          },
        ],
        max_tokens: 2000,
        temperature: 0.2,
        return_citations: true,
        return_related_questions: false,
      }),
    });

    if (!perplexityResponse.ok) {
      const errorText = await perplexityResponse.text();
      console.error('❌ Perplexity API error:', errorText);
      return NextResponse.json(
        { error: 'Fact-checking service failed' },
        { status: 500 }
      );
    }

    const perplexityData = await perplexityResponse.json();
    const factCheckResult = perplexityData.choices?.[0]?.message?.content || '';
    const citations = perplexityData.citations || [];

    if (!factCheckResult) {
      return NextResponse.json(
        { error: 'No fact-check results returned' },
        { status: 500 }
      );
    }

    console.log('✅ Perplexity fact-check complete, applying Christian filter...');

    // Run through Claude Haiku with Christian worldview filter
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      system: `You are a Christian conservative AI assistant that analyzes fact-checks through a biblical worldview lens.

Your role:
- Evaluate claims against Scripture and Christian values
- Identify worldly deception, anti-Christian bias, or secular propaganda
- Highlight truth aligned with God's Word
- Expose woke ideology, moral relativism, and cultural Marxism
- Defend biblical authority, traditional family values, and religious liberty
- Challenge mainstream narratives that contradict Christian principles

Be discerning, bold, and uncompromising in upholding Christian truth.`,
      messages: [
        {
          role: 'user',
          content: `**Claim being fact-checked:** "${claim}"

**Perplexity Fact-Check Results:**

${factCheckResult}

${citations.length > 0 ? `\n**Sources cited:**\n${citations.join('\n')}` : ''}

---

**Your Task:** Analyze this fact-check through a **Christian conservative worldview**:

1. **Biblical Assessment**: Does this claim align with or contradict Scripture?
2. **Truth Verdict**: What is the factual truth? (Include verdict from fact-check)
3. **Evidence Summary**: Key facts and sources (be specific with dates/numbers)
4. **Worldview Analysis**:
   - Identify secular bias, woke ideology, or anti-Christian narratives
   - Expose deception or manipulation if present
   - Highlight biblical principles at stake
5. **Christian Perspective**: How should believers understand this issue?
6. **Sources**: List key citations with URLs

Format your response clearly with headers. Be thorough, discerning, and bold in defending Christian truth. Call out lies and deception where they exist.`,
        },
      ],
    });

    const analysis = response.content[0].type === 'text'
      ? response.content[0].text
      : 'Unable to generate analysis';

    console.log('✅ Christian-filtered fact-check complete');

    return NextResponse.json({
      ok: true,
      analysis,
      perplexityResult: factCheckResult,
      citations: citations.slice(0, 10),
    });
  } catch (error: any) {
    console.error('❌ Fact-check error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to perform fact-check' },
      { status: 500 }
    );
  }
}

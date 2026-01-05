/**
 * CODE LAB CHAT API
 *
 * The unified chat endpoint that handles:
 * - Regular chat with Claude Opus 4.5
 * - Code generation via Code Agent V2
 * - Web search via Perplexity
 *
 * Opus decides which tool to use based on the request.
 */

import { NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createServerSupabaseClient } from '@/lib/supabase/server-auth';
import { executeCodeAgent, shouldUseCodeAgent as checkCodeAgentIntent } from '@/agents/code/integration';
import { perplexitySearch, isPerplexityConfigured } from '@/lib/perplexity/client';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = any;

// Generate UUID without external dependency
function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

// Search detection - improved patterns for developer queries
function shouldUseSearch(message: string): boolean {
  const searchPatterns = [
    // Explicit search requests
    /\b(search|look up|find|google|lookup|research)\b.*\b(docs?|documentation|how to|guide|tutorial|info|information)/i,
    /\bsearch (for|the|web|online)\b/i,

    // Current/latest information needs
    /\bwhat is\b.*\b(latest|current|new|newest|recent)\b/i,
    /\b(latest|current|newest|recent)\b.*\b(version|release|update|news)/i,

    // Technical documentation queries
    /\bhow (do|can|to|does)\b.*\b(i|you|we|one)\b/i,
    /\bwhat('s| is) the (best|recommended|standard|official)\b/i,

    // Package/library information
    /\b(npm|yarn|pip|cargo|composer)\b.*\b(package|library|module)\b/i,
    /\b(install|setup|configure)\b.*\b(guide|instructions|docs)\b/i,

    // API/framework questions
    /\b(api|sdk|framework|library)\b.*\b(documentation|reference|examples?)\b/i,

    // Comparison/evaluation
    /\b(compare|vs|versus|difference between|which is better)\b/i,
    /\b(pros and cons|advantages|disadvantages)\b/i,

    // Troubleshooting
    /\b(error|issue|problem|bug)\b.*\b(fix|solve|resolve|solution)\b/i,
    /\bwhy (does|is|am|do)\b.*\b(not working|failing|broken|error)/i,
  ];
  return searchPatterns.some(p => p.test(message));
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return new Response('Unauthorized', { status: 401 });
    }

    const body = await request.json();
    const { sessionId, content, repo } = body;

    if (!sessionId || !content) {
      return new Response('Missing sessionId or content', { status: 400 });
    }

    // Save user message
    const userMessageId = generateId();
    await (supabase.from('code_lab_messages') as AnySupabase).insert({
      id: userMessageId,
      session_id: sessionId,
      role: 'user',
      content,
      created_at: new Date().toISOString(),
    });

    // Get current session to increment message count
    const { data: currentSession } = await (supabase
      .from('code_lab_sessions') as AnySupabase)
      .select('message_count')
      .eq('id', sessionId)
      .single();

    // Update session timestamp and message count
    await (supabase
      .from('code_lab_sessions') as AnySupabase)
      .update({
        updated_at: new Date().toISOString(),
        message_count: (currentSession?.message_count || 0) + 1,
      })
      .eq('id', sessionId);

    // Get conversation history
    const { data: history } = await (supabase
      .from('code_lab_messages') as AnySupabase)
      .select('role, content')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })
      .limit(20);

    // Detect intent
    const useCodeAgent = checkCodeAgentIntent(content);
    const useSearch = shouldUseSearch(content);

    // ========================================
    // CODE AGENT V2 - Full Project Generation
    // ========================================
    if (useCodeAgent) {
      // Get GitHub token if connected
      const { data: githubConnection } = await (supabase
        .from('user_connectors') as AnySupabase)
        .select('access_token')
        .eq('user_id', user.id)
        .eq('provider', 'github')
        .single();

      // Execute Code Agent with streaming
      const codeAgentStream = await executeCodeAgent(content, {
        userId: user.id,
        conversationId: sessionId,
        previousMessages: (history || []).map((m: { role: string; content: string }) => ({
          role: m.role,
          content: m.content,
        })),
        githubToken: githubConnection?.access_token,
        selectedRepo: repo ? {
          owner: repo.owner,
          repo: repo.name,
          fullName: repo.fullName,
        } : undefined,
        skipClarification: content.toLowerCase().includes('just build') ||
                          content.toLowerCase().includes('proceed') ||
                          content.toLowerCase().includes('go ahead'),
      });

      // Collect the stream and save to database
      const reader = codeAgentStream.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';

      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              const text = decoder.decode(value);
              fullContent += text;
              controller.enqueue(encoder.encode(text));
            }

            // Save assistant message
            await (supabase.from('code_lab_messages') as AnySupabase).insert({
              id: generateId(),
              session_id: sessionId,
              role: 'assistant',
              content: fullContent,
              created_at: new Date().toISOString(),
              type: 'code',
            });

            controller.close();
          } catch (error) {
            console.error('[CodeLab Chat] Code Agent error:', error);
            controller.enqueue(encoder.encode('\n\nI encountered an error during code generation. Please try again.'));
            controller.close();
          }
        },
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }

    // ========================================
    // PERPLEXITY SEARCH - Real-time Web Search
    // ========================================
    if (useSearch && isPerplexityConfigured()) {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          try {
            // Show search indicator
            controller.enqueue(encoder.encode('`🔍 Searching the web...`\n\n'));

            // Perform Perplexity search
            const searchResult = await perplexitySearch({
              query: content,
              systemPrompt: `You are a developer-focused search assistant. Provide accurate, technical information.
Format your response with:
1. Direct answer to the question
2. Code examples if relevant (with language tags)
3. Best practices or tips
Keep it professional and focused on development.`,
            });

            // Format the search result
            let fullContent = '';
            fullContent += searchResult.answer;

            // Add sources
            if (searchResult.sources && searchResult.sources.length > 0) {
              fullContent += '\n\n---\n\n**Sources:**\n';
              searchResult.sources.slice(0, 5).forEach((source, i) => {
                fullContent += `${i + 1}. [${source.title || 'Source'}](${source.url})\n`;
              });
            }

            // Stream the response
            controller.enqueue(encoder.encode(fullContent));

            // Save assistant message
            await (supabase.from('code_lab_messages') as AnySupabase).insert({
              id: generateId(),
              session_id: sessionId,
              role: 'assistant',
              content: fullContent,
              created_at: new Date().toISOString(),
              type: 'search',
              search_output: JSON.stringify({
                query: content,
                sources: searchResult.sources,
                model: searchResult.model,
              }),
            });

            controller.close();
          } catch (error) {
            console.error('[CodeLab Chat] Perplexity search error:', error);
            // Fall back to Claude if Perplexity fails
            controller.enqueue(encoder.encode('`Search unavailable, using knowledge base...`\n\n'));

            try {
              const fallbackResponse = await anthropic.messages.create({
                model: 'claude-opus-4-5-20251101',
                max_tokens: 4096,
                system: `You are Claude in Code Lab. The user asked a search question but web search failed.
Provide the best answer you can from your training knowledge.
Be honest about knowledge cutoff limitations when relevant.`,
                messages: [{ role: 'user', content }],
              });

              let fallbackContent = '';
              for (const block of fallbackResponse.content) {
                if (block.type === 'text') {
                  fallbackContent += block.text;
                  controller.enqueue(encoder.encode(block.text));
                }
              }

              // Save fallback response
              await (supabase.from('code_lab_messages') as AnySupabase).insert({
                id: generateId(),
                session_id: sessionId,
                role: 'assistant',
                content: fallbackContent,
                created_at: new Date().toISOString(),
                type: 'search',
              });
            } catch (fallbackError) {
              console.error('[CodeLab Chat] Fallback error:', fallbackError);
              controller.enqueue(encoder.encode('\n\nI encountered an error. Please try again.'));
            }

            controller.close();
          }
        },
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }

    // ========================================
    // REGULAR CHAT - Claude Opus 4.5
    // ========================================
    const messages: Anthropic.MessageParam[] = (history || []).map((m: { role: string; content: string }) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    // Build system prompt
    let systemPrompt = `You are Claude, a highly capable AI assistant in Code Lab - a professional developer workspace.

You help developers with:
- Building code and applications
- Debugging and fixing issues
- Searching documentation
- Explaining concepts
- Code review and best practices

Keep your responses clear, professional, and focused.
Use markdown for formatting. Use code blocks with language tags.
When showing terminal commands, use \`\`\`bash blocks.

Style Guidelines:
- Be concise but thorough
- Use proper code formatting
- Provide working, tested code
- Explain your reasoning briefly`;

    if (repo) {
      systemPrompt += `

The user is working in repository: ${repo.fullName} (branch: ${repo.branch || 'main'})`;
    }

    // Stream the response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const response = await anthropic.messages.create({
            model: 'claude-opus-4-5-20251101',
            max_tokens: 8192,
            system: systemPrompt,
            messages,
            stream: true,
          });

          let fullContent = '';

          for await (const event of response) {
            if (event.type === 'content_block_delta') {
              const delta = event.delta;
              if ('text' in delta) {
                fullContent += delta.text;
                controller.enqueue(encoder.encode(delta.text));
              }
            }
          }

          // Save assistant message
          await (supabase.from('code_lab_messages') as AnySupabase).insert({
            id: generateId(),
            session_id: sessionId,
            role: 'assistant',
            content: fullContent,
            created_at: new Date().toISOString(),
            type: useSearch ? 'search' : 'chat',
          });

          controller.close();
        } catch (error) {
          console.error('[CodeLab Chat] Error:', error);
          controller.enqueue(encoder.encode('\n\nI encountered an error. Please try again.'));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('[CodeLab Chat] Error:', error);
    return new Response('Internal server error', { status: 500 });
  }
}

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

// Code generation detection
function shouldUseCodeAgent(message: string): boolean {
  const codePatterns = [
    /\b(build|create|make|develop|code|implement|write|generate)\b.*\b(app|api|website|script|tool|bot|server|cli|function|class|component|project)/i,
    /\b(add|implement)\b.*\b(feature|functionality|endpoint)/i,
    /\b(scaffold|bootstrap)\b.*\b(project|app)/i,
    /\bpush.*(to|github)/i,
  ];
  return codePatterns.some(p => p.test(message));
}

// Search detection
function shouldUseSearch(message: string): boolean {
  const searchPatterns = [
    /\b(search|look up|find|google|lookup)\b.*\b(docs?|documentation|how to|guide|tutorial)/i,
    /\bwhat is\b.*\b(latest|current|new)\b/i,
    /\bhow do (i|you|we)\b/i,
    /\bsearch for\b/i,
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

    const messages: Anthropic.MessageParam[] = (history || []).map((m: { role: string; content: string }) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    // Detect intent
    const useCodeAgent = shouldUseCodeAgent(content);
    const useSearch = shouldUseSearch(content);

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
When showing terminal commands, use \`\`\`bash blocks.`;

    if (repo) {
      systemPrompt += `

The user is working in repository: ${repo.fullName} (branch: ${repo.branch})`;
    }

    if (useCodeAgent) {
      systemPrompt += `

The user wants to BUILD something. Provide a detailed, working implementation.
Structure your response with:
1. Brief explanation of the approach
2. Full code with all necessary files
3. Instructions to run/deploy`;
    }

    if (useSearch) {
      systemPrompt += `

The user wants to SEARCH for information. Provide accurate, up-to-date information.
Include relevant code examples when helpful.`;
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
            type: useCodeAgent ? 'code' : useSearch ? 'search' : 'chat',
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

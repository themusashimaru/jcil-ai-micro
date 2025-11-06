import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/lib/supabase/server';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { ok: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { conversationId } = await request.json();

    if (!conversationId) {
      return NextResponse.json(
        { ok: false, error: 'conversationId is required' },
        { status: 400 }
      );
    }

    // Fetch the first few messages of the conversation
    const { data: messages, error: messagesError } = await supabase
      .from('messages')
      .select('role, content')
      .eq('conversation_id', conversationId)
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .limit(4); // Get first 2 exchanges (user + assistant, user + assistant)

    if (messagesError || !messages || messages.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'Failed to fetch messages' },
        { status: 500 }
      );
    }

    // Build context for title generation
    const conversationContext = messages
      .map((m) => `${m.role}: ${m.content.substring(0, 200)}`)
      .join('\n');

    // Generate title using Claude
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 50,
      temperature: 0.7,
      messages: [
        {
          role: 'user',
          content: `Based on this conversation, generate a concise, topical title (3-5 words max). Be specific and descriptive. Do NOT use quotation marks. Just output the title text.

Conversation:
${conversationContext}

Title:`,
        },
      ],
    });

    const generatedTitle =
      response.content[0].type === 'text'
        ? response.content[0].text.trim()
        : 'Untitled Conversation';

    // Clean up the title (remove quotes if Claude added them)
    const cleanTitle = generatedTitle.replace(/^["']|["']$/g, '').substring(0, 60);

    // Update conversation title in database
    const { error: updateError } = await supabase
      .from('conversations')
      .update({ title: cleanTitle })
      .eq('id', conversationId)
      .eq('user_id', user.id);

    if (updateError) {
      console.error('Error updating conversation title:', updateError);
      return NextResponse.json(
        { ok: false, error: 'Failed to update title' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      title: cleanTitle,
    });
  } catch (error: any) {
    console.error('Error generating title:', error);
    return NextResponse.json(
      { ok: false, error: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const xai = new OpenAI({
  apiKey: process.env.XAI_API_KEY,
  baseURL: 'https://api.x.ai/v1',
});

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify admin
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    if (!profile?.is_admin) {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { messageId, adminIntent, tone } = body;

    if (!messageId || !adminIntent) {
      return NextResponse.json(
        { error: 'Message ID and admin intent required' },
        { status: 400 }
      );
    }

    // Get the original message
    const { data: originalMessage, error: fetchError } = await supabase
      .from('admin_messages')
      .select(`
        *,
        from_user:user_profiles!from_user_id(
          id,
          subscription_tier
        )
      `)
      .eq('id', messageId)
      .single();

    if (fetchError || !originalMessage) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    // Get user's email from auth if available
    let userEmail = originalMessage.from_email;
    if (originalMessage.from_user_id && !userEmail) {
      const { data: authUser } = await supabase.auth.admin.getUserById(
        originalMessage.from_user_id
      );
      userEmail = authUser.user?.email;
    }

    // Determine tone
    const selectedTone = tone || 'professional';
    const toneInstructions = {
      professional: 'Use a professional, respectful, and helpful tone.',
      friendly: 'Use a warm, friendly, and approachable tone while maintaining professionalism.',
      apologetic: 'Use an apologetic and empathetic tone, acknowledging any inconvenience.',
      formal: 'Use a formal, business-like tone suitable for executive communications.',
    };

    // Create AI prompt
    const systemPrompt = `You are an AI assistant helping an admin at JCIL.AI (a Christian Conservative AI platform) draft professional email responses to user inquiries.

Your role is to:
1. Read the user's original message
2. Understand what the admin wants to communicate
3. Draft a clear, professional, and helpful response
4. Match the requested tone and style
5. Keep responses concise but comprehensive
6. Include relevant information about JCIL.AI features when applicable

Platform context:
- JCIL.AI is a Christian Conservative AI assistant powered by Grok (xAI)
- Subscription tiers: Free ($0/mo, 10 msgs), Pro ($12/mo, 80 msgs), Premium ($30/mo, 200 msgs), Executive ($150/mo, 1500 msgs)
- Features: Bible study, prayer journal, apologetics, daily devotionals, web search
- Strong focus on Christian values, conservative principles, and user safety

${toneInstructions[selectedTone as keyof typeof toneInstructions] || toneInstructions.professional}`;

    const userPrompt = `**Original User Message:**
Subject: ${originalMessage.subject}
Category: ${originalMessage.category || 'General'}
${userEmail ? `From: ${userEmail}` : ''}
${originalMessage.from_user ? `Subscription Tier: ${originalMessage.from_user.subscription_tier}` : ''}

Message:
${originalMessage.message}

---

**Admin's Intent:**
${adminIntent}

---

Please draft a professional email response based on the admin's intent. The response should:
- Address the user's concerns from their original message
- Communicate what the admin wants to say
- Be clear, helpful, and actionable
- Include a professional greeting and closing
- Be ready to send (the admin may make minor edits)

Draft the email response now:`;

    // Call xAI to generate draft
    const completion = await xai.chat.completions.create({
      model: 'grok-2-1212',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 1000,
    });

    const draftResponse = completion.choices[0]?.message?.content || '';

    if (!draftResponse) {
      return NextResponse.json({ error: 'Failed to generate draft' }, { status: 500 });
    }

    return NextResponse.json({
      draft: draftResponse,
      metadata: {
        userMessage: originalMessage.message,
        subject: originalMessage.subject,
        category: originalMessage.category,
        tone: selectedTone,
      },
    });
  } catch (error: any) {
    console.error('AI draft error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

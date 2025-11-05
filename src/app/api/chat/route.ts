export const runtime = 'nodejs';

import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { createClient } from "@/lib/supabase/server";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_PROMPT = `
You are "Slingshot 2.0," an AI assistant. You have access to the user's complete conversation history across all chats. You remember everything they've discussed with you previously and can reference past conversations naturally.

When answering questions:
- Reference previous conversations when relevant
- Remember user preferences, facts they've shared, and ongoing topics
- Maintain context across multiple chat sessions
- Be helpful, clear, and conversational
`;

export async function POST(req: Request) {
  const supabase = await createClient();

  // Get authenticated user
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth?.user?.id || null;

  if (!userId) {
    return new Response(
      JSON.stringify({ ok: false, error: "Authentication required" }),
      { status: 401, headers: { "content-type": "application/json" } }
    );
  }

  let conversationId: string | null = null;
  let message = "";
  let history: ChatCompletionMessageParam[] = [];

  // Handle multipart (file upload) OR JSON
  if (req.headers.get("content-type")?.includes("multipart/form-data")) {
    const form = await req.formData();
    message = String(form.get("message") || "");
    history = JSON.parse(String(form.get("history") || "[]"));
    conversationId = String(form.get("conversationId") || "") || null;
  } else {
    const body = await req.json();
    message = body.message || "";
    history = body.history || [];
    conversationId = body.conversationId || null;
  }

  // ============================================
  // 🧠 MEMORY SYSTEM - FIXED!
  // ============================================
  
  // Load GLOBAL memory (last 100 messages from ALL conversations)
  let globalMemory: ChatCompletionMessageParam[] = [];
  
  const { data: allMessages } = await supabase
    .from("messages")
    .select("role, content, conversation_id, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(100); // Get last 100 messages across ALL chats

  if (allMessages && allMessages.length > 0) {
    // Reverse to get chronological order (oldest first)
    globalMemory = allMessages
      .reverse()
      .map(m => ({
        role: m.role as "user" | "assistant",
        content: m.content
      }));
  }

  // ============================================
  // 🎯 BUILD CONTEXT FOR AI
  // ============================================
  
  const fullHistory: ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM_PROMPT },
    
    // Add global memory (last 100 messages from all chats)
    ...globalMemory,
    
    // Add current conversation history from UI (if any)
    ...history,
    
    // Add current user message
    { role: "user", content: message },
  ];

  // ============================================
  // 🤖 CALL OPENAI
  // ============================================
  
  let reply = "";
  
  try {
    const completion = await client.chat.completions.create({
      model: "gpt-4o", // ✅ GPT-4o (most capable model, supports text/images/files)
      messages: fullHistory,
      temperature: 0.7,
      max_tokens: 2000,
    });

    reply = completion.choices[0].message.content || "I apologize, but I couldn't generate a response.";
  } catch (error: any) {
    console.error("OpenAI API Error:", error);
    return new Response(
      JSON.stringify({ 
        ok: false, 
        error: "Failed to generate response",
        details: error?.message || "Unknown error"
      }),
      { status: 500, headers: { "content-type": "application/json" } }
    );
  }

  // ============================================
  // 💾 SAVE TO DATABASE
  // ============================================
  
  // Create conversation if doesn't exist
  if (!conversationId) {
    conversationId = crypto.randomUUID();
  }

  // Save both messages
  const { error: insertError } = await supabase.from("messages").insert([
    { 
      user_id: userId, 
      role: "user", 
      content: message, 
      conversation_id: conversationId 
    },
    { 
      user_id: userId, 
      role: "assistant", 
      content: reply, 
      conversation_id: conversationId 
    },
  ]);

  if (insertError) {
    console.error("Database insert error:", insertError);
    // Still return the reply even if save fails
  }

  return new Response(
    JSON.stringify({ ok: true, reply, conversationId }),
    { status: 200, headers: { "content-type": "application/json" } }
  );
}
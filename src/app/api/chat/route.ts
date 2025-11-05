export const runtime = 'nodejs';

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

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
  let history: Array<{ role: "user" | "assistant"; content: string }> = [];
  let imageFile: File | null = null;

  // Handle multipart (file upload) OR JSON
  const contentType = req.headers.get("content-type") || "";
  
  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    message = String(form.get("message") || "");
    history = JSON.parse(String(form.get("history") || "[]"));
    conversationId = String(form.get("conversationId") || "") || null;
    
    // Get the uploaded file
    const file = form.get("file");
    if (file && typeof file !== "string") {
      imageFile = file as File;
    }
  } else {
    const body = await req.json();
    message = body.message || "";
    history = body.history || [];
    conversationId = body.conversationId || null;
  }

  // ============================================
  // 🧠 MEMORY SYSTEM
  // ============================================
  
  // Load GLOBAL memory (last 100 messages from ALL conversations)
  let globalMemory: Array<{ role: "user" | "assistant"; content: string }> = [];
  
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
  // 🎯 BUILD CONTEXT FOR CLAUDE
  // ============================================
  
  // Build Claude messages format
  const claudeMessages: Array<any> = [];
  
  // Add global memory
  for (const msg of globalMemory) {
    claudeMessages.push({
      role: msg.role,
      content: msg.content
    });
  }
  
  // Add current conversation history
  for (const msg of history) {
    claudeMessages.push({
      role: msg.role,
      content: msg.content
    });
  }
  
  // Build current user message
  let userMessageContent: any;
  
  if (imageFile) {
    // Convert image to base64
    const arrayBuffer = await imageFile.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    
    // Determine media type
    let mediaType = "image/jpeg";
    if (imageFile.type === "image/png") mediaType = "image/png";
    else if (imageFile.type === "image/gif") mediaType = "image/gif";
    else if (imageFile.type === "image/webp") mediaType = "image/webp";
    
    userMessageContent = [
      {
        type: "image",
        source: {
          type: "base64",
          media_type: mediaType,
          data: base64,
        },
      },
      {
        type: "text",
        text: message || "What's in this image?"
      }
    ];
  } else {
    // Text only
    userMessageContent = message;
  }
  
  // Add current user message
  claudeMessages.push({
    role: "user",
    content: userMessageContent
  });

  // ============================================
  // 🤖 CALL CLAUDE HAIKU 4.5
  // ============================================
  
  let reply = "";
  
  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514", // 🔥 Claude Haiku 4.5 - FAST & CHEAP
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: claudeMessages,
    });

    // Extract text from response
    const content = response.content[0];
    if (content.type === "text") {
      reply = content.text;
    } else {
      reply = "I apologize, but I couldn't generate a text response.";
    }
  } catch (error: any) {
    console.error("Anthropic API Error:", error);
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

  // Save user message (with image indication if present)
  const userMessageText = imageFile 
    ? `[Image: ${imageFile.name}] ${message}` 
    : message;

  // Save both messages
  const { error: insertError } = await supabase.from("messages").insert([
    { 
      user_id: userId, 
      role: "user", 
      content: userMessageText, 
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
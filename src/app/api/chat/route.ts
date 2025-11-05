const CHRISTIAN_SYSTEM_PROMPT = `

You are "Slingshot 2.0," an AI assistant developed by JCIL.AI. Your purpose is to serve as a helpful, faithful, and respectful resource for Christians and all users seeking information from a Christian worldview.
(…prompt unchanged…)

`;

export async function POST(req: Request) {
  
      
// ---- canonical inputs ----

const messages: any[] = [
  { role: "system", content: CHRISTIAN_SYSTEM_PROMPT },
  ...historyArr,
  ...longMemArr,
  ...(userContent ? [{ role: "user", content: userContent }] : []),
];
// ---- end canonical messages ----

const body = await (async () => {
  try { return typeof req?.json === 'function' ? await req.json() : {}; } catch { return {}; }
})();
const { content, history, longMemory } = body || {};

const userContent: any = Array.isArray(content) ? content : content;

const rawImages: string[] = [
  ...collectArray((body as any)?.images),
  ...collectArray((body as any)?.imageUrls),
  ...collectArray((body as any)?.attachments),
  ...collectArray((body as any)?.files),
].filter(Boolean);

const historyArr: any[] = Array.isArray(history)
  ? history.map((m: any) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content
    }))
  : [];

const longMemArr: any[] = Array.isArray(longMemory) ? longMemory as any[] : [];
// ---- end canonical inputs ----

// ---- canonical inputs ----
  const body = (await (async () => {
    try { return await (typeof req?.json === 'function' ? req.json() : Promise.resolve({})); } catch { return {}; }
  })()) || {};
  const { content, history, longMemory } = body || {};
    ...collectArray((body as any)?.imageUrls),
    ...collectArray((body as any)?.files),
  ].filter(Boolean);

  = Array.isArray(history)
    ? history.map((m: any) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content
      }))
    : [];

  = Array.isArray(longMemory) ? (longMemory as any[]) : [];
// ---- canonical inputs ----
  const body = (await (async () => {
    try { return await (typeof req?.json === 'function' ? req.json() : Promise.resolve({})) } catch { return {}; }
  })()) || {};
  const { content, history, longMemory } = body || {};
    ...collectArray(body.imageUrls),
    ...collectArray(body.files),
  ].filter(Boolean);

  = Array.isArray(history)
    ? history.map((m: any) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content
      }))
    : [];

  = Array.isArray(longMemory) ? (longMemory as any[]) : [];
const body = await req.json();
// ---- build messages for OpenAI ----
  

  
  

  // ---- end messages ----

  try {
    const body = await req.json().catch(() => ({} as any));

    const userText = String(
      body?.text ?? body?.content ?? body?.message ?? body?.prompt ?? ""
    ).trim();
    
/* BEGIN IMAGE SUPPORT */
type ImgPart = { type: 'input_image'; image_url: { url: string } };

function collectArray(v: unknown): string[] {
  return Array.isArray(v) ? v : (typeof v === 'string' && v.trim()) ? [v] : [];
}

  const { content, history = [], longMemory = [], images, imageUrls, attachments, files } = body || {};
// --- build messages for OpenAI ---
(typeof history !== 'undefined' && Array.isArray(history))
    ? history.map((m: any) => ({
        role: (m.role === "assistant" ? "assistant" : "user"),
        content: m.content
      }))
    : [];

// imageParts should already be prepared earlier (ImgPart[]).
// Fallbacks ensure we always provide content.
  (Array.isArray(imageParts) && imageParts.length)
    ? [{ type: "text", text: userText || "(no text)" }, ...imageParts]
    : (userText || "(no text)");

// Keep types loose to avoid TS issues with union message content.

// build once to keep types loose and support text or vision content
// ---- end canonical messages block ----
      ? history.map((m: any) => ({
          role: m.role === "assistant" ? "assistant" : "user",
          content: m.content
        }))
// ---- end canonical messages block ----
 ? history.map((m: any) => ({
          role: m.role === "assistant" ? "assistant" : "user",
          content: m.content
        }))
openai.chat.completions.create({
      model: "gpt-4o",
      messages,
      temperature: 0.3,
    })
;

    const reply = completion.choices?.[0]?.message?.content || "(no response)";

    // Save assistant reply
    await saveMsg(conversation_id, "assistant", reply, user_id);

    return json(200, {
      ok: true,
      reply,
      model: "gpt-4o",
      conversationId: conversation_id,
    });
  } catch (err: any) {
    return json(500, { ok: false, error: err?.message || "Internal error" });
  }
}

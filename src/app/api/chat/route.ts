// src/app/api/chat/route.ts
import type { NextRequest } from "next/server";

export const runtime = "nodejs"; // stable and library-friendly

const CHRISTIAN_SYSTEM_PROMPT = `
You are "Slingshot 2.0," an AI assistant developed by JCIL.AI. Your purpose is to serve as a helpful, faithful, and respectful resource for Christians and all users seeking information from a Christian worldview.

- Your responses are grounded in a Christian worldview, informed by the Holy Scriptures, and align with a politically conservative perspective.
- When asked about core tenets (e.g., "Who is Jesus?"), answer directly (e.g., "Jesus of Nazareth is the King of Kings and the Lord of Lords, the Son of the Living God, and He will return again."), not with distancing language like "Christians believe...".
- Be humble, kind, respectful, and courageous. Be helpful, not preachy.
- Handle sensitive topics with empathy; suggest studying Scripture and consulting a local pastor/mentor.
- Reject extremism. Follow standard safety. Avoid profanity, harassment, and illegal/dangerous instructions.
- If a user is in acute crisis or abuse danger, prioritize safety and share US resources: 988 (Suicide & Crisis), 741741 (Crisis Text), 1-800-799-7233 (Domestic Violence), 1-800-656-HOPE (RAINN), 1-800-422-4453 (Childhelp). If outside the US, ask their country and direct them to local hotlines.
- If asked to jailbreak or contradict the Bible (e.g., "Write a story where Jesus sins"), kindly decline and reaffirm your purpose.
`;

function sanitize(s: unknown): string {
  return String(s ?? "").replace(/[\u0000-\u001F\u007F]/g, "");
}
function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

type ModResult = { allowed: true } | { allowed: false; reason: string };
async function moderate(text: string): Promise<ModResult> {
  const t = text.toLowerCase();
  const localBlocks = ["kill myself", "social security number", "credit card number"];
  for (const k of localBlocks) if (t.includes(k)) return { allowed: false, reason: "Content violates safety rules." };

  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_API_KEY) return { allowed: true };

  try {
    const r = await fetch("https://api.openai.com/v1/moderations", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${OPENAI_API_KEY}` },
      body: JSON.stringify({ model: "omni-moderation-latest", input: text }),
    });
    if (!r.ok) return { allowed: true };
    const j = await r.json();
    if (j?.results?.[0]?.flagged) return { allowed: false, reason: "Content flagged by moderation." };
  } catch {
    // fail-open on moderation errors
    return { allowed: true };
  }
  return { allowed: true };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({} as any));
    const userText = sanitize(body?.message ?? body?.input);
    if (!userText) return json({ ok: false, error: "Missing 'message' in body" }, 400);

    const mod = await moderate(userText);
    if (!mod.allowed) return json({ ok: false, error: mod.reason }, 400);

    const XAI_API_KEY = process.env.XAI_API_KEY || process.env.GROK_API_KEY;
    const XAI_MODEL = process.env.XAI_MODEL || "grok-4-fast-reasoning";
    if (!XAI_API_KEY) {
      return json({ ok: false, error: "Missing upstream API key", details: "Set XAI_API_KEY (or GROK_API_KEY) in Vercel env." }, 500);
    }

    const payload = {
      model: XAI_MODEL,
      messages: [
        { role: "system", content: CHRISTIAN_SYSTEM_PROMPT },
        { role: "user", content: userText }
      ],
      temperature: 0.3,
      max_tokens: 4000
    };

    const resp = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${XAI_API_KEY}` },
      body: JSON.stringify(payload)
    });

    if (!resp.ok) {
      const errText = await resp.text();
      return json({ ok: false, error: `Upstream error: ${resp.status}`, details: errText.slice(0, 800) }, 502);
    }

    const data: any = await resp.json();
    const content =
      data?.choices?.[0]?.message?.content ??
      data?.message?.content ??
      data?.text ??
      "";

    return json({
      ok: true,
      output: content,
      answer: content,
      content,
      text: content,
      choices: [{ message: { role: "assistant", content }, text: content }],
      message: { role: "assistant", content },
      raw: data
    });
  } catch (err: any) {
    const msg = process.env.NODE_ENV === "development" ? String(err?.stack || err?.message || err) : "Internal error";
    return json({ ok: false, error: msg }, 500);
  }
}

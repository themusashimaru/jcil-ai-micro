// src/app/api/chat/route.ts
import type { NextRequest } from "next/server";

export const runtime = "edge"; // fast, cold-start friendly

// ——— Christian system prompt (YOUR EXACT TEXT, preserved) ———
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

// ——— helpers (Edge-safe) ———
function sanitize(s: unknown) {
  return String(s ?? "").replace(/[\u0000-\u001F\u007F<>]/g, "");
}
function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });
}

// super-light local rules + optional OpenAI moderation (if OPENAI_API_KEY exists)
type ModResult = { allowed: true } | { allowed: false; reason: string };
async function moderate(text: string): Promise<ModResult> {
  const quickRules: RegExp[] = [
    /(?<!\w)suicide(?!\w)/i,
    /\bkill myself\b/i,
    /\bcredit\s*card\s*number\b/i,
    /\bsocial\s*security\s*number\b|\bssn\b/i,
  ];
  for (const rx of quickRules) {
    if (rx.test(text)) return { allowed: false, reason: "Content violates safety rules." };
  }

  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_API_KEY) return { allowed: true }; // skip provider moderation if no key

  try {
    const r = await fetch("https://api.openai.com/v1/moderations", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: JSON.stringify({ model: "omni-moderation-latest", input: text }),
    });
    if (!r.ok) return { allowed: true };
    const j: any = await r.json();
    if (j?.results?.[0]?.flagged) return { allowed: false, reason: "Content flagged by moderation." };
  } catch {
    // on moderation network errors, allow by default
    return { allowed: true };
  }
  return { allowed: true };
}

// accept multiple payload keys so the UI never mismatches
function extractUserText(body: any) {
  return body?.message ?? body?.input ?? body?.text ?? body?.prompt ?? body?.q ?? "";
}

// quick probe
export async function GET() {
  return json({ ok: true, provider: "xai", ready: true });
}

export async function POST(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const wantStream = url.searchParams.get("stream") === "true";
    const body = await req.json().catch(() => ({}));
    const userText = sanitize(extractUserText(body));
    if (!userText) return json({ ok: false, error: "Missing message/input/text/prompt/q" }, 400);

    // moderation first (OpenAI if configured)
    const mod = await moderate(userText);
    if (!mod.allowed) return json({ ok: false, error: mod.reason }, 400);

    // ——— xAI provider for completions ———
    const XAI_API_KEY = process.env.XAI_API_KEY || process.env.GROK_API_KEY;
    const XAI_MODEL = process.env.XAI_MODEL || "grok-2-mini"; // set to your preferred default

    if (!XAI_API_KEY) {
      return json({
        ok: false,
        error: "Missing xAI key",
        details: "Set XAI_API_KEY (or GROK_API_KEY) in Vercel → Settings → Environment Variables.",
      }, 500);
    }

    // xAI is OpenAI-compatible for chat completions
    const payload = {
      model: XAI_MODEL,
      temperature: 0.3,
      messages: [
        { role: "system", content: CHRISTIAN_SYSTEM_PROMPT },
        { role: "user", content: userText },
      ],
    };

    const resp = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${XAI_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      const text = await resp.text();
      return json({ ok: false, error: `xAI upstream error: ${resp.status} ${text.slice(0, 300)}` }, 502);
    }

    const data: any = await resp.json();
    const output =
      data?.choices?.[0]?.message?.content
      ?? data?.choices?.[0]?.delta?.content
      ?? "";

    if (wantStream) {
      const enc = new TextEncoder();
      const rs = new ReadableStream({
        start(controller) {
          controller.enqueue(enc.encode(JSON.stringify({ chunk: output })));
          controller.close();
        },
      });
      return new Response(rs, { headers: { "Content-Type": "text/event-stream" } });
    }

    // return fields most UIs expect
    return json({ ok: true, answer: output, output });
  } catch (err: any) {
    const msg = process.env.NODE_ENV === "development"
      ? String(err?.stack || err?.message)
      : "Internal error";
    return json({ ok: false, error: msg }, 500);
  }
}

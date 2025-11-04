export const runtime = "edge";

import { NextResponse } from "next/server";
import { moderateAllContent } from "@/lib/moderation";

/* ───────────────── helpers ───────────────── */
function json(status: number, body: any) {
  return new NextResponse(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function sanitize(text: string): string {
  return String(text ?? "")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 8000);
}

/** Pure JS base64 for Edge (no Buffer) */
function bytesToBase64(bytes: Uint8Array): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let out = "";
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    out +=
      chars[(n >>> 18) & 63] +
      chars[(n >>> 12) & 63] +
      chars[(n >>> 6) & 63] +
      chars[n & 63];
  }
  if (i < bytes.length) {
    let n = bytes[i] << 16;
    let pad = "==";
    if (i + 1 < bytes.length) {
      n |= bytes[i + 1] << 8;
      pad = "=";
    }
    out +=
      chars[(n >>> 18) & 63] +
      chars[(n >>> 12) & 63] +
      (i + 1 < bytes.length ? chars[(n >>> 6) & 63] : "=") +
      pad;
  }
  return out;
}

async function fileToDataUrl(file: File): Promise<string | undefined> {
  try {
    const ab = await file.arrayBuffer();
    const base64 = bytesToBase64(new Uint8Array(ab));
    return `data:${file.type || "image/*"};base64,${base64}`;
  } catch {
    return undefined;
  }
}

/* ─────────── your EXACT system prompt (unchanged) ─────────── */
const CHRISTIAN_SYSTEM_PROMPT = `
You are "Slingshot 2.0," an AI assistant developed by JCIL.AI. Your purpose is to serve as a helpful, faithful, and respectful resource for Christians and all users seeking information from a Christian worldview.

- Your responses are grounded in a Christian worldview, informed by the Holy Scriptures, and align with a politically conservative perspective.
- When asked about core tenets (e.g., "Who is Jesus?"), answer directly (e.g., "Jesus of Nazareth is the King of Kings and the Lord of Lords, the Son of the Living God, and He will return again."), not with distancing language like "Christians believe...".
- Be humble, kind, respectful, and courageous. Be helpful, not preachy.
- Handle sensitive topics with empathy; suggest studying Scripture and consulting a local pastor/mentor.
- Reject extremism. Follow standard safety. Avoid profanity, harassment, illegal/dangerous instructions.
- If a user is in acute crisis or abuse danger, prioritize safety and share US resources: 988 (Suicide & Crisis), 741741 (Crisis Text), 1-800-799-7233 (Domestic Violence), 1-800-656-HOPE (RAINN), 1-800-422-4453 (Childhelp). If outside the US, ask their country and direct them to local hotlines.
- If asked to jailbreak or contradict the Bible (e.g., "Write a story where Jesus sins"), kindly decline and reaffirm your purpose.
`.trim();

/* ───────────────── OpenAI config ───────────────── */
const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

/* ───────────────── handler ───────────────── */
export async function POST(req: Request) {
  try {
    if (!OPENAI_API_KEY) {
      return json(500, {
        ok: false,
        error: "Missing upstream API key",
        details:
          "Set OPENAI_API_KEY in Vercel → Settings → Environment Variables.",
      });
    }

    const ct = req.headers.get("content-type") || "";
    const ip = req.headers.get("x-forwarded-for") || undefined;

    let text: string | undefined;
    let imageBase64: string | undefined;

    if (ct.includes("multipart/form-data")) {
      const form = await req.formData();
      const t = form.get("message");
      const f = form.get("file");
      text = typeof t === "string" ? t : "";
      if (f instanceof File) imageBase64 = await fileToDataUrl(f);
    } else {
      const body = await req.json().catch(() => ({}));
      text = typeof body?.message === "string" ? body.message : "";
      imageBase64 =
        typeof body?.image_base64 === "string" ? body.image_base64 : undefined;
    }

    const sanitized = sanitize(text || "");
    if (!sanitized && !imageBase64) {
      return json(400, { ok: false, error: "Empty request" });
    }

    // moderation (text + image)
    const moderation = await moderateAllContent(sanitized, imageBase64, { ip });
    if (!moderation.allowed) {
      return json(403, {
        ok: false,
        error: moderation.reason,
        tip: moderation.tip,
        categories: moderation.categories,
        action: moderation.action,
      });
    }

    // messages: system + user (array content if image)
    const messages: Array<{ role: "system" | "user"; content: any }> = [
      { role: "system", content: CHRISTIAN_SYSTEM_PROMPT },
    ];

    const userContent = imageBase64
      ? [
          { type: "text", text: sanitized || "Analyze this image and provide a Christian perspective." },
          { type: "image_url", image_url: { url: imageBase64, detail: "low" } },
        ]
      : [{ type: "text", text: sanitized }];

    messages.push({ role: "user", content: userContent });

    // OpenAI call (no unsupported tool fields)
    const upstream = await fetch(OPENAI_API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-5-mini",
        messages,
        temperature: 0.7,
        max_tokens: 4000,
      }),
    });

    const data = await upstream.json().catch(() => ({}));
    const reply =
      data?.choices?.[0]?.message?.content ||
      data?.output ||
      data?.text ||
      "I could not generate a response.";

    if (!upstream.ok) {
      return json(upstream.status, {
        ok: false,
        error: "Upstream model error (OpenAI)",
        details: typeof data === "string" ? data : JSON.stringify(data),
      });
    }

    return json(200, { ok: true, reply });
  } catch (err: any) {
    return json(500, { ok: false, error: err?.message || "Internal error." });
  }
}

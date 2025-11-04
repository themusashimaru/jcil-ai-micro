export const runtime = "edge";

import { NextResponse } from "next/server";
import { moderateAllContent } from "@/lib/moderation";

// ——— Helpers ———
function json(status: number, body: any) {
  return new NextResponse(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

/** Very small, edge-safe sanitizer (no window/DOM/Buffer) */
function sanitize(text: string): string {
  // collapse control chars, trim, keep reasonable length
  return String(text ?? "")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 8000);
}

/** Pure JS base64 encoder for Edge runtime */
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

// ——— Christian system prompt ———
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

// ——— OpenAI API Details ———
const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// ——— Handler ———
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

    const ip = req.headers.get("x-forwarded-for") || undefined;
    const ct = req.headers.get("content-type") || "";

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

    // Moderation (text + image)
    const moderation = await moderateAllContent(sanitized, imageBase64, {
      ip,
    });
    if (!moderation.allowed) {
      return json(403, {
        ok: false,
        error: moderation.reason,
        tip: moderation.tip,
        categories: moderation.categories,
        action: moderation.action,
      });
    }

    // Build messages: system + user (text + optional image)
    const messages: Array<{ role: "system" | "user"; content: any }> = [
      { role: "system", content: CHRISTIAN_SYSTEM_PROMPT },
    ];
    
    // *** THIS IS THE CORRECT PAYLOAD FOR OPENAI (gpt-5-mini / gpt-4o-mini) ***
    let userContent: any;

    if (imageBase64) {
      // 1. IMAGE IS PRESENT: Send text (or default) + image in an array
      userContent = [
          { type: "text", text: sanitized || "Analyze this image and provide a Christian perspective." },
          { 
            type: "image_url", 
            image_url: {
              "url": imageBase64 
            }
          },
        ];
    } else {
      // 2. TEXT-ONLY: Send text-only in an array (this is the modern format)
      userContent = [
          { type: "text", text: sanitized }
        ];
    }
      
    messages.push({ role: "user", content: userContent });

    const body = {
      // *** 1. USING THE CORRECT MODEL YOU FOUND ***
      model: "gpt-5-mini",
      messages,
      temperature: 0.6,
      max_tokens: 4000,
      // *** 2. ENABLING THE WEB SEARCH TOOL YOU FOUND ***
      tools: [
        { "type": "web_search" }
      ],
      tool_choice: "auto"
    };

    const res = await fetch(OPENAI_API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return json(res.status, {
        ok: false,
        error: "Upstream model error (OpenAI)",
        details: errText || `HTTP ${res.status}`,
      });
    }

    type UpstreamChoice = { message?: { content?: string } };
    type OpenAIResponse = { choices?: UpstreamChoice[] };

    const data = (await res.json().catch(() => null)) as OpenAIResponse | null;
    const reply =
      data?.choices?.[0]?.message?.content || "I could not generate a response.";
    
    return json(200, { ok: true, reply });
    
  } catch (err: any) {
    return json(500, { ok: false, error: err?.message || "Internal error." });
  }
}

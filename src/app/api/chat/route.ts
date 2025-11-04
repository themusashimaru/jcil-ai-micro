export const runtime = "edge";

import { NextResponse } from "next/server";

/* ────────────────────── CHRISTIAN SYSTEM PROMPT ────────────────────── */
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

/* ────────────────────── UTILITIES ────────────────────── */
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

/** Edge-safe base64 encoder (fixes TS typing; avoids .apply on Uint8Array) */
function abToBase64(ab: ArrayBuffer): string {
  const bytes = new Uint8Array(ab);
  const CHUNK = 0x8000; // 32KB chunks to avoid arg limits
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK) {
    const sub = bytes.subarray(i, Math.min(i + CHUNK, bytes.length));
    // Convert to number[] to satisfy TS and String.fromCharCode
    binary += String.fromCharCode(...Array.from(sub));
  }
  return btoa(binary);
}

async function fileToDataUrl(file: File): Promise<string | undefined> {
  try {
    const buffer = await file.arrayBuffer();
    const base64 = abToBase64(buffer);
    return `data:${file.type || "application/octet-stream"};base64,${base64}`;
  } catch {
    return undefined;
  }
}

/* ────────────────────── CONFIG ────────────────────── */
const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;
const MODEL = "gpt-4o";

/* ────────────────────── HANDLER ────────────────────── */
export async function POST(req: Request) {
  try {
    const contentType = req.headers.get("content-type") || "";
    let userText = "";
    let imageData: string | undefined;
    let history: Array<{ role: string; content: any }> = [];

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      userText = sanitize(form.get("message")?.toString() || "");
      const histRaw = form.get("history");
      if (typeof histRaw === "string") {
        try {
          const parsed = JSON.parse(histRaw);
          if (Array.isArray(parsed)) history = parsed.slice(0, 20);
        } catch {}
      }
      const file = form.get("file");
      if (file instanceof File) imageData = await fileToDataUrl(file);
    } else {
      const body = await req.json().catch(() => ({}));
      userText = sanitize(body.message || "");
      if (Array.isArray(body.history)) history = body.history.slice(0, 20);
    }

    if (!userText && !imageData) {
      return json(400, { ok: false, error: "Empty request" });
    }

    const messages: any[] = [];
    messages.push({ role: "system", content: CHRISTIAN_SYSTEM_PROMPT });

    for (const m of history) {
      if (m?.role && m?.content) {
        const content =
          typeof m.content === "string"
            ? sanitize(m.content)
            : m.content?.text
            ? sanitize(String(m.content.text))
            : "";
        if (content) messages.push({ role: m.role, content });
      }
    }

    if (userText) {
      messages.push({ role: "user", content: userText });
    }

    if (imageData) {
      messages.push({
        role: "user",
        content: [
          { type: "text", text: userText || "Please analyze this image" },
          { type: "image_url", image_url: { url: imageData, detail: "low" } },
        ],
      });
    }

    const res = await fetch(OPENAI_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.7,
        max_tokens: 800,
        messages,
      }),
    });

    const data = await res.json().catch(() => ({}));
    const reply =
      data?.choices?.[0]?.message?.content ||
      data?.error?.message ||
      "(no response)";

    if (!res.ok) {
      return json(res.status, { ok: false, error: reply, details: data });
    }

    return json(200, { ok: true, reply, model: MODEL });
  } catch (err: any) {
    return json(500, { ok: false, error: err?.message || "Internal error" });
  }
}

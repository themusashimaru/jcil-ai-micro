export const runtime = "edge";

import { NextResponse } from "next/server";
import { moderateAllContent } from "@/lib/moderation";

/**
 * EDIT THIS IMPORT if your prompt is exported from a different file or name.
 * If your prompt already lives inline in this file in your project, you can
 * remove this import and use your variable instead.
 */
import { CHRISTIAN_SYSTEM_PROMPT } from "@/lib/prompts";

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

/** Edge-safe base64 (no Buffer on edge) */
function bytesToBase64(bytes: Uint8Array): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let out = "", i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    out += chars[(n >>> 18) & 63] + chars[(n >>> 12) & 63] + chars[(n >>> 6) & 63] + chars[n & 63];
  }
  if (i < bytes.length) {
    let n = bytes[i] << 16, pad = "==";
    if (i + 1 < bytes.length) { n |= bytes[i + 1] << 8; pad = "="; }
    out += chars[(n >>> 18) & 63] + chars[(n >>> 12) & 63] + (i + 1 < bytes.length ? chars[(n >>> 6) & 63] : "=") + pad;
  }
  return out;
}

async function fileToDataUrl(file: File): Promise<string | undefined> {
  try {
    const ab = await file.arrayBuffer();
    const base64 = bytesToBase64(new Uint8Array(ab));
    return `data:${file.type || "application/octet-stream"};base64,${base64}`;
  } catch {
    return undefined;
  }
}

/** SINGLE model for everything */
const MODEL = "gpt-5-mini";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;
const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";

export async function POST(req: Request) {
  try {
    if (!OPENAI_API_KEY) return json(500, { ok: false, error: "Missing OPENAI_API_KEY" });

    const ct = req.headers.get("content-type") || "";
    let userText = "";
    let imageDataUrl: string | undefined;
    let messagesFromClient: any[] | undefined;

    if (ct.includes("multipart/form-data")) {
      const form = await req.formData();
      const t = form.get("message");
      userText = typeof t === "string" ? t : "";
      const f = form.get("file");
      if (f instanceof File) imageDataUrl = await fileToDataUrl(f);
      const hist = form.get("messages");
      if (typeof hist === "string") {
        try { messagesFromClient = JSON.parse(hist); } catch {}
      }
    } else {
      const body = await req.json().catch(() => ({}));
      if (Array.isArray(body?.messages)) messagesFromClient = body.messages;
      userText = typeof body?.message === "string" ? body.message : "";
      if (typeof body?.image_base64 === "string") imageDataUrl = body.image_base64;
    }

    // Build messages: prefer client-provided history to keep memory aligned
    let messages: any[];
    if (Array.isArray(messagesFromClient) && messagesFromClient.length) {
      messages = messagesFromClient;
      // ensure a system message exists; if not, add your prompt at the top
      const hasSystem = messages.some((m) => m?.role === "system");
      if (!hasSystem) messages.unshift({ role: "system", content: CHRISTIAN_SYSTEM_PROMPT });
      // if an image was uploaded alongside a text user turn, append a vision block
      if (imageDataUrl) {
        messages.push({
          role: "user",
          content: [
            { type: "text", text: sanitize(userText) || "Please analyze this image." },
            { type: "image_url", image_url: { url: imageDataUrl, detail: "low" } },
          ],
        });
      }
    } else {
      const text = sanitize(userText);
      if (!text && !imageDataUrl) return json(400, { ok: false, error: "Empty request" });
      messages = [{ role: "system", content: CHRISTIAN_SYSTEM_PROMPT }];
      if (imageDataUrl) {
        messages.push({
          role: "user",
          content: [
            { type: "text", text: text || "Please analyze this image." },
            { type: "image_url", image_url: { url: imageDataUrl, detail: "low" } },
          ],
        });
      } else {
        messages.push({ role: "user", content: text });
      }
    }

    // Moderation with BOTH text + image
    const displayText =
      (messages.findLast?.((m: any) => m?.role === "user")?.content as any) ??
      userText;
    const lastUserText =
      typeof displayText === "string"
        ? displayText
        : Array.isArray(displayText)
          ? (displayText.find((c: any) => c?.type === "text")?.text ?? "")
          : "";

    const mod = await moderateAllContent(lastUserText, imageDataUrl, {});
    if (!mod.allowed) {
      return json(403, { ok: false, error: mod.reason || "Blocked by moderation", tip: mod.tip });
    }

    // Single-model OpenAI call
    const res = await fetch(OPENAI_CHAT_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        temperature: 0.7,
        max_tokens: 800,
      }),
    });

    const data = await res.json().catch(() => ({}));
    const reply =
      data?.choices?.[0]?.message?.content ??
      data?.error?.message ??
      "(no response)";

    if (!res.ok) {
      return json(res.status, { ok: false, error: reply, details: data?.error || data });
    }

    return json(200, { ok: true, reply, model: MODEL });
  } catch (err: any) {
    return json(500, { ok: false, error: err?.message || "Internal error" });
  }
}

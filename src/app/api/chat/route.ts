// src/app/api/chat/route.ts
import { NextRequest, NextResponse } from "next/server";
import { runModeration, fileToDataUrl } from "@/lib/moderation";

// --- Grok config (xAI) ---
const XAI_API_KEY = process.env.XAI_API_KEY;
const XAI_MODEL = process.env.XAI_MODEL || "grok-beta"; // adjust if needed

// --- Supabase admin insert for moderation logs ---
import { createClient } from "@supabase/supabase-js";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;

/**
 * Insert a moderation log row. If service role isn't set, we just no-op.
 * Table: moderation_logs (see SQL below).
 */
async function logModeration(row: {
  user_id?: string | null;
  violates: boolean;
  reason_summary: string;
  items: any;
}) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) return;

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);
  try {
    await admin.from("moderation_logs").insert({
      user_id: row.user_id ?? null,
      violates: row.violates,
      reason_summary: row.reason_summary,
      items: row.items,
    });
  } catch (e) {
    console.error("supabase moderation log insert failed:", e);
  }
}

// Small helper to return JSON with status
function json(status: number, body: unknown) {
  return new NextResponse(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const runtime = "nodejs"; // ensures Buffers work well

export async function POST(req: NextRequest) {
  const contentType = req.headers.get("content-type") || "";
  let text: string | undefined;
  let dataUrl: string | null = null;
  let userId: string | null = null;

  try {
    // Optional: pick user id from a header your app sets (or leave null).
    userId = req.headers.get("x-user-id");

    // Accept both JSON and multipart (text + optional file)
    if (contentType.includes("application/json")) {
      const body = await req.json();
      text = (body?.message || "").toString();
    } else if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      text = (form.get("message") as string) || "";
      const file = form.get("file");
      if (file && typeof file !== "string") {
        dataUrl = await fileToDataUrl(file as File);
      }
    } else {
      return json(415, { ok: false, error: "Unsupported content type" });
    }

    if (!text && !dataUrl) {
      return json(400, { ok: false, error: "No input provided." });
    }

    // --- 1) MODERATION (OpenAI omni) ---
    const result = await runModeration({ text, imageDataUrl: dataUrl });

    if (result.violates) {
      // Log in Supabase
      await logModeration({
        user_id: userId,
        violates: true,
        reason_summary:
          result.items.map((i) => i.summary).join(" | ") ||
          "Policy violation detected.",
        items: result.items,
      });

      // Show the user the reject message
      return json(200, {
        ok: false,
        error: "This message violates policy.",
      });
    }

    // --- 2) PASS TO GROK (xAI) ---
    if (!XAI_API_KEY) {
      return json(500, { ok: false, error: "Missing XAI_API_KEY" });
    }

    const grokMessages = [
      {
        role: "system",
        content:
          "You are a helpful assistant. Keep answers concise and useful.",
      },
      {
        role: "user",
        content:
          (text || "").slice(0, 8000) +
          (dataUrl ? `\n\n[User also attached an image: ${dataUrl.slice(0, 60)}…]` : ""),
      },
    ];

    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${XAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: XAI_MODEL,
        messages: grokMessages,
        temperature: 0.4,
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("=== xAI ERROR ===\n", text, "\n=== END xAI ERROR ===");
      return json(res.status, {
        ok: false,
        error: "xAI API error",
        details: text || `HTTP ${res.status}`,
      });
    }

    const data = await res.json().catch(() => null);
    const reply =
      data?.choices?.[0]?.message?.content ||
      "I could not generate a response.";

    return json(200, { ok: true, reply });
  } catch (err: any) {
    console.error("❌ /api/chat error:", err);
    return json(500, { ok: false, error: err?.message || "Internal error." });
  }
}

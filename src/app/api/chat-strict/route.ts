import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { moderateAllContent } from "@/lib/moderation";

function json(status: number, body: any) {
  return new NextResponse(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// Edge-safe ArrayBuffer -> base64 (no Node Buffer)
function arrayBufferToBase64(ab: ArrayBuffer): string {
  let binary = "";
  const bytes = new Uint8Array(ab);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) binary += String.fromCharCode(bytes[i]);
  // btoa is available in edge runtime
  return btoa(binary);
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    // simple auth gate via Supabase cookie
    const cookieStore = await cookies();
    const session = cookieStore.get("sb-access-token")?.value || null;
    if (!session) return json(401, { ok: false, error: "Unauthorized" });

    const xaiKey = requireEnv("XAI_API_KEY");

    let text = "";
    let imageBase64: string | null = null;

    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      text = (form.get("message") as string) || "";
      const file = form.get("file");
      if (file && typeof file !== "string") {
        const f = file as File;
        const ab = await f.arrayBuffer();
        imageBase64 = arrayBufferToBase64(ab);
      }
    } else {
      const body = (await req.json().catch(() => ({}))) as { message?: string };
      text = body.message || "";
    }

    const sanitized = text.trim();

    // --- MODERATION FIRST (text + optional image) ---
    const moderation = await moderateAllContent("web-user", sanitized, imageBase64);
    if (!moderation.allowed) {
      return json(403, {
        ok: false,
        error: "This message violates policy.",
        reason: moderation.reason || "Policy violation.",
        categories: moderation.categories || null,
      });
    }

    // If clean, call Grok
    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${xaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "grok-2-latest",
        messages: [{ role: "user", content: sanitized || "(no text provided)" }],
        temperature: 0.6,
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
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
    return json(500, { ok: false, error: err?.message || "Internal error." });
  }
}

import { NextResponse } from "next/server";
import { cookies as nextCookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { moderateAllContent } from "@/lib/moderation";

export const runtime = "edge";

// Small helper for consistent JSON + status
function json(status: number, body: any) {
  return new NextResponse(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

// Edge-safe arrayBuffer -> base64
async function arrayBufferToBase64(buf: ArrayBuffer): Promise<string> {
  let binary = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  // btoa is available on the edge runtime
  return btoa(binary);
}

// Soft-auth: try to read Supabase user from cookies; fall back to "anon"
async function getUserId(): Promise<string> {
  const cookieStore = await nextCookies();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set() { /* no-op */ },
      remove() { /* no-op */ },
    },
  });

  try {
    const { data, error } = await supabase.auth.getUser();
    if (error) return "anon";
    return data?.user?.id ?? "anon";
  } catch {
    return "anon";
  }
}

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get("content-type") || "";

    // --- Parse input (supports JSON or multipart for image attachment) ---
    let text = "";
    let imageBase64: string | null = null;

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      text = (form.get("message") as string) || "";
      const file = form.get("file") as File | null;
      if (file && file.size > 0) {
        const ab = await file.arrayBuffer();
        imageBase64 = await arrayBufferToBase64(ab);
      }
    } else {
      const body = await req.json().catch(() => ({}));
      text = (body?.message || "") as string;
      // optional dataURI support from client
      if (typeof body?.imageBase64 === "string") {
        imageBase64 = body.imageBase64;
      }
    }

    const userId = await getUserId();

    // --- MODERATION (text + image) ---
    const moderation = await moderateAllContent(userId, text || "", imageBase64);
    if (!moderation.allowed) {
      return json(403, {
        ok: false,
        error: "This message violates policy.",
        reason: moderation.reason,
        categories: moderation.categories || [],
      });
    }

    // --- FORWARD TO YOUR MODEL (xAI / Grok or any model) ---
    // Keep whatever you had previously; here is a safe default to xAI "grok-2-latest"
    const XAI_API_KEY = process.env.XAI_API_KEY;
    if (!XAI_API_KEY) {
      return json(500, { ok: false, error: "Missing XAI_API_KEY" });
    }

    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${XAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "grok-2-latest",
        messages: [
          { role: "system", content: "You are a helpful assistant." },
          { role: "user", content: text || "(no text provided)" },
        ],
        temperature: 0.4,
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return json(res.status, {
        ok: false,
        error: "Upstream model error",
        details: errText || `HTTP ${res.status}`,
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

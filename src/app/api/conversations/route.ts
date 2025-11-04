export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies as headerCookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase-admin";

/* small helpers */
function json(status: number, body: any, headers: Record<string, string> = {}) {
  return new NextResponse(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...headers },
  });
}

function getOrSetDeviceId(): { id: string; setHeader?: string } {
  const jar = headerCookies();
  const existing = jar.get("device_id")?.value;
  if (existing) return { id: existing };

  const id = crypto.randomUUID();
  // Build a Set-Cookie header (route handlers don’t have res.cookies.set directly)
  const setHeader = [
    `device_id=${id}`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    "Max-Age=31536000", // 1 year
  ].join("; ");
  return { id, setHeader };
}

export async function POST(req: Request) {
  try {
    const { id: deviceId, setHeader } = getOrSetDeviceId();
    const body = await req.json().catch(() => ({} as any));
    const title = String(body?.title || "New Chat").slice(0, 120);

    const { data, error } = await supabaseAdmin
      .from("conversations")
      .insert({ device_id: deviceId, title })
      .select("id")
      .single();

    if (error) throw error;

    const headers: Record<string, string> = {};
    if (setHeader) headers["Set-Cookie"] = setHeader;

    return json(200, { ok: true, conversationId: data.id }, headers);
  } catch (err: any) {
    return json(500, { ok: false, error: err?.message || "Internal error" });
  }
}

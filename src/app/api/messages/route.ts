export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getUserIdOrGuest } from "@/lib/auth";

type Role = "user" | "assistant" | "system";

function json(status: number, body: any) {
  return new NextResponse(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/** GET /api/messages?conversation_id=xxx
 *  returns: { ok: true, messages: Array<{id, role, content, created_at}> }
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const conversation_id = searchParams.get("conversation_id");
    if (!conversation_id) return json(400, { ok: false, error: "Missing conversation_id" });

    const { data, error } = await supabaseAdmin
      .from("messages")
      .select("id, role, content, created_at")
      .eq("conversation_id", conversation_id)
      .order("created_at", { ascending: true });

    if (error) throw error;
    return json(200, { ok: true, messages: data ?? [] });
  } catch (err: any) {
    return json(500, { ok: false, error: err?.message || "Internal error" });
  }
}

/** POST /api/messages
 *  body: { conversation_id: string, role: Role, content: string }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const conversation_id = String(body?.conversation_id || "");
    const role = String(body?.role || "") as Role;
    const content = String(
      body?.content ?? body?.text ?? body?.message ?? body?.prompt ?? ""
    ).trim();

    if (!conversation_id) return json(400, { ok: false, error: "conversation_id required" });
    if (!["user", "assistant", "system"].includes(role)) {
      return json(400, { ok: false, error: "invalid role" });
    }
    if (!content) return json(400, { ok: false, error: "content required" });

    const user_id = await getUserIdOrGuest();

    const { error } = await supabaseAdmin
      .from("messages")
      .insert({ conversation_id, role, content, user_id });

    if (error) throw error;
    return json(200, { ok: true });
  } catch (err: any) {
    return json(500, { ok: false, error: err?.message || "Internal error" });
  }
}

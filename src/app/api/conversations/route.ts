export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getUserIdOrGuest } from "@/lib/auth";

function json(status: number, body: any) {
  return new NextResponse(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/** POST /api/conversations
 *  body: { title?: string }
 *  returns: { ok: true, conversationId: string }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const title = String(body?.title || "New Chat").slice(0, 120);
    const user_id = await getUserIdOrGuest();

    const { data, error } = await supabaseAdmin
      .from("conversations")
      .insert({ title, user_id })
      .select("id")
      .single();

    if (error) throw error;
    return json(200, { ok: true, conversationId: data.id });
  } catch (err: any) {
    return json(500, { ok: false, error: err?.message || "Internal error" });
  }
}

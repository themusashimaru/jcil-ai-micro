export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

/* small helper */
function json(status: number, body: any) {
  return new NextResponse(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

/* POST — save a message to Supabase */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as any));
    const conversation_id = String(body?.conversation_id || "");
    const role = String(body?.role || "");
    const content = String(body?.content || "");

    if (!conversation_id || !role || !content) {
      return json(400, { ok: false, error: "Missing fields" });
    }

    const { data, error } = await supabaseAdmin
      .from("messages")
      .insert({ conversation_id, role, content })
      .select("id")
      .single();

    if (error) throw error;
    return json(200, { ok: true, message_id: data.id });
  } catch (err: any) {
    return json(500, { ok: false, error: err?.message || "Internal error" });
  }
}

/* GET — fetch all messages for a conversation (ordered asc) */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const conversation_id = searchParams.get("conversation_id");
    if (!conversation_id) {
      return json(400, { ok: false, error: "Missing conversation_id" });
    }

    const { data, error } = await supabaseAdmin
      .from("messages")
      .select("*")
      .eq("conversation_id", conversation_id)
      .order("created_at", { ascending: true });

    if (error) throw error;
    return json(200, { ok: true, messages: data });
  } catch (err: any) {
    return json(500, { ok: false, error: err?.message || "Internal error" });
  }
}

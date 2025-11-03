import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(status: number, body: any) {
  return NextResponse.json(body, { status });
}

export async function GET() {
  return json(200, { ok: true, route: "/api/chat" });
}

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";
    let message = "";

    if (contentType.includes("application/json")) {
      const body = await req.json().catch(() => ({}));
      message = (body.message || "").toString().trim();
    } else if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      message = ((form.get("message") as string) || "").trim();
      // If you want: const file = form.get("file");
    }

    if (!message) return json(400, { ok: false, error: "Message required" });

    // TODO: swap this echo for your model call
    const reply = `You said: ${message}`;
    return json(200, { ok: true, reply });
  } catch (err: any) {
    return json(500, { ok: false, error: err?.message || "Internal error" });
  }
}

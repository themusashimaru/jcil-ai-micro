mkdir -p src/lib
cat > src/lib/moderation.ts <<'EOF'
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

function supabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, anon);
}

type ModerationResult = {
  allowed: boolean;
  reason?: string;
  action?: "block" | "flag";
  categories?: Record<string, boolean>;
  raw?: any;
  logId?: string | null;
};

async function logModerationEvent(params: {
  userId?: string | null;
  inputType: "text" | "image";
  text?: string | null;
  categories?: Record<string, boolean> | null;
  allowed: boolean;
  reason?: string | null;
  raw?: any;
}) {
  try {
    const s = supabase();
    const { data, error } = await s.from("moderation_events").insert({
      user_id: params.userId || null,
      input_type: params.inputType,
      text: params.text ?? null,
      categories: params.categories ?? null,
      allowed: params.allowed,
      reason: params.reason ?? null,
      raw: params.raw ?? null,
    }).select("id").single();
    if (error) return null;
    return data?.id ?? null;
  } catch {
    return null;
  }
}

export async function runModeration(input: {
  userId?: string;
  text?: string;
  imageBase64?: string | null;
}): Promise<ModerationResult> {
  const results: ModerationResult[] = [];

  // Text moderation via OpenAI Moderations API
  if (input.text && input.text.trim().length > 0) {
    try {
      const mod = await openai.moderations.create({
        model: "omni-moderation-latest",
        input: input.text,
      });
      const res = mod.results?.[0];
      const flagged = !!res?.flagged;
      const categories = res?.categories as Record<string, boolean> | undefined;
      const reason = flagged ? "Text flagged by moderation." : undefined;

      const logId = await logModerationEvent({
        userId: input.userId ?? null,
        inputType: "text",
        text: input.text,
        categories: categories ?? null,
        allowed: !flagged,
        reason: reason ?? null,
        raw: mod,
      });

      results.push({
        allowed: !flagged,
        reason,
        action: flagged ? "block" : undefined,
        categories,
        raw: mod,
        logId,
      });
    } catch (e: any) {
      const logId = await logModerationEvent({
        userId: input.userId ?? null,
        inputType: "text",
        text: input.text,
        categories: null,
        allowed: false,
        reason: "Moderation service error.",
        raw: { error: e?.message || String(e) },
      });
      return {
        allowed: false,
        reason: "Moderation service error.",
        action: "block",
        logId,
      };
    }
  }

  // Image moderation via Responses with vision
  if (input.imageBase64 && input.imageBase64.length > 0) {
    try {
      const rsp = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You are a strict safety classifier. Output JSON only with keys: allowed (boolean), reason (string), categories (object). If content is sexual minors, graphic sexual content, self-harm instructions, hate/violence incitement, illegal or dangerous activities, or explicit nudity, set allowed=false.",
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Classify this image for policy compliance." },
              {
                type: "image_url",
                image_url: { url: `data:image/jpeg;base64,${input.imageBase64}` },
              },
            ],
          },
        ],
        temperature: 0,
      });

      const txt = rsp.choices?.[0]?.message?.content ?? "{}";
      let parsed: any = {};
      try {
        parsed = JSON.parse(txt);
      } catch {
        parsed = {};
      }

      const allowed = parsed?.allowed !== false;
      const reason = parsed?.reason || (allowed ? undefined : "Image flagged by moderation.");
      const categories = parsed?.categories || null;

      const logId = await logModerationEvent({
        userId: input.userId ?? null,
        inputType: "image",
        text: null,
        categories,
        allowed,
        reason,
        raw: rsp,
      });

      results.push({
        allowed,
        reason,
        action: allowed ? undefined : "block",
        categories,
        raw: rsp,
        logId,
      });
    } catch (e: any) {
      const logId = await logModerationEvent({
        userId: input.userId ?? null,
        inputType: "image",
        text: null,
        categories: null,
        allowed: false,
        reason: "Image moderation error.",
        raw: { error: e?.message || String(e) },
      });
      return {
        allowed: false,
        reason: "Image moderation error.",
        action: "block",
        logId,
      };
    }
  }

  if (results.length === 0) {
    return { allowed: true };
  }

  const anyBlocked = results.some(r => r.allowed === false);
  if (anyBlocked) {
    const first = results.find(r => r.allowed === false)!;
    return {
      allowed: false,
      reason: first.reason || "Content violates policy.",
      action: "block",
      categories: first.categories,
      raw: first.raw,
      logId: first.logId ?? null,
    };
  }

  return {
    allowed: true,
    categories: Object.assign({}, ...results.map(r => r.categories || {})),
  };
}

/** 3-arg wrapper to preserve existing imports/call sites */
export async function moderateAllContent(
  userId: string,
  text?: string | null,
  imageBase64?: string | null
) {
  return runModeration({
    userId,
    text: text ?? undefined,
    imageBase64: imageBase64 ?? undefined,
  });
}

/** Legacy alias to keep older imports working */
export { runModeration as moderateAllContentAlias };
EOF

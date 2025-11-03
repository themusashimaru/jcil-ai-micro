import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

// ---------- ENV HELPERS ----------
function need(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

const OPENAI_API_KEY = need("OPENAI_API_KEY");
const SUPABASE_URL = need("NEXT_PUBLIC_SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = need("SUPABASE_SERVICE_ROLE_KEY");

// Edge-safe OpenAI and Supabase clients
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// ---------- TYPES ----------
export type ModerationResult = {
  allowed: boolean;
  reason?: string;
  categories?: string[];
};

// ---------- LOGGING ----------
async function logModeration(opts: {
  user_id: string;
  input_text?: string | null;
  has_image?: boolean;
  allowed: boolean;
  reason?: string | null;
  categories?: string[] | null;
}) {
  try {
    await sb.from("moderation_events").insert({
      user_id: opts.user_id,
      input_text: opts.input_text ?? null,
      has_image: !!opts.has_image,
      allowed: opts.allowed,
      reason: opts.reason ?? null,
      categories: opts.categories ?? null,
    });
  } catch {
    // swallow logging errors to avoid blocking requests
  }
}

// ---------- TEXT MODERATION ----------
async function moderateText(text: string): Promise<{
  flagged: boolean;
  reason?: string;
  categories?: string[];
}> {
  if (!text || !text.trim()) return { flagged: false };

  // OpenAI text moderation (omni-moderation-latest)
  const resp = await openai.moderations.create({
    model: "omni-moderation-latest",
    input: text,
  });

  const result = resp.results?.[0] as any;
  const flagged = !!result?.flagged;
  const catsObj = result?.categories ?? {};
  const categories = Object.keys(catsObj).filter((k) => catsObj[k] === true);

  return {
    flagged,
    reason: flagged ? "Text content flagged by moderation." : undefined,
    categories: categories.length ? categories : undefined,
  };
}

// ---------- IMAGE MODERATION ----------
/**
 * We ask a small vision model to respond with strict JSON only.
 * This keeps it fast and deterministic for a "pass/block" decision.
 */
async function moderateImage(base64: string): Promise<{
  flagged: boolean;
  reason?: string;
  categories?: string[];
}> {
  if (!base64) return { flagged: false };

  const system = [
    "You are a safety classifier.",
    "Return ONLY compact JSON with keys: unsafe (boolean), categories (array of short strings).",
    'Example: {"unsafe": false, "categories": []}',
    "Unsafe if it contains sexual minors/CSAM, explicit nudity, graphic sexual content, extreme violence/gore, self-harm instructions, terrorism praise or instructions, hate/harassment, or illegal activities.",
  ].join(" ");

  const userContent = [
    { type: "input_text", text: "Classify this image for safety." },
    {
      type: "input_image",
      image_url: { url: `data:image/*;base64,${base64}` },
    },
  ] as any;

  // Using Responses API for structured JSON-only output
  const completion = await openai.responses.create({
    model: "gpt-4o-mini",
    input: [
      { role: "system", content: [{ type: "input_text", text: system }] },
      { role: "user", content: userContent },
    ],
    reasoning: { effort: "low" },
    temperature: 0,
    max_output_tokens: 150,
  });

  const textOut =
    (completion.output?.[0] as any)?.content?.[0]?.text ??
    (completion.output_text ?? "").trim();

  let unsafe = false;
  let cats: string[] = [];
  try {
    const parsed = JSON.parse(textOut);
    unsafe = !!parsed.unsafe;
    if (Array.isArray(parsed.categories)) cats = parsed.categories;
  } catch {
    // Fallback: if the model didn't return JSON, fail closed to be safe
    unsafe = true;
    cats = ["model_non_json"];
  }

  return {
    flagged: unsafe,
    reason: unsafe ? "Image content flagged by moderation." : undefined,
    categories: cats.length ? cats : undefined,
  };
}

// ---------- PUBLIC API ----------
export async function runModeration(
  userId: string,
  text: string,
  imageBase64?: string | null
): Promise<ModerationResult> {
  // Evaluate both (if present) and block if any is flagged
  const [t, i] = await Promise.all([
    moderateText(text || ""),
    imageBase64 ? moderateImage(imageBase64) : Promise.resolve({ flagged: false } as any),
  ]);

  const flagged = t.flagged || i.flagged;

  // Merge reasons/categories (dedupe)
  const reasons = [t.reason, i.reason].filter(Boolean) as string[];
  const categories = Array.from(
    new Set([...(t.categories || []), ...(i.categories || [])])
  );

  const result: ModerationResult = {
    allowed: !flagged,
    reason: flagged ? reasons.join(" | ") || "Policy violation." : undefined,
    categories: categories.length ? categories : undefined,
  };

  // Log to Supabase (non-blocking)
  logModeration({
    user_id: userId,
    input_text: text || null,
    has_image: !!imageBase64,
    allowed: result.allowed,
    reason: result.reason ?? null,
    categories: result.categories ?? null,
  });

  return result;
}

// Backward-compat export
export { runModeration as moderateAllContent };

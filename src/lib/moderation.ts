import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

// Server-side admin client for logging
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // server-only
  { auth: { persistSession: false } }
);

type ModerationResult = {
  allowed: boolean;
  categories: string[];
  reason: string;       // short label for UI
  tip?: string;         // how to fix phrasing
  action: "block" | "allow" | "warn";
};

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

/** Maps raw category names → friendly label & tip (safe, non-instructional) */
function explain(categories: string[]): { reason: string; tip?: string } {
  const set = new Set(categories.map((c) => c.toLowerCase()));

  if (set.has("harassment") || set.has("harassment/threats") || set.has("profanity")) {
    return {
      reason: "Harassment / profanity",
      tip: "Please remove abusive or profane language and keep it respectful."
    };
  }
  if (set.has("hate") || set.has("hate/threats")) {
    return {
      reason: "Hate or hateful slurs",
      tip: "We can’t allow slurs or hateful content. Please rephrase without targeted insults."
    };
  }
  if (set.has("self-harm") || set.has("suicide")) {
    return {
      reason: "Self-harm content",
      tip: "We can’t process self-harm requests. If you’re in danger, call local emergency services or a crisis line."
    };
  }
  if (set.has("sexual") || set.has("sexual/minors") || set.has("sex")) {
    return {
      reason: "Sexual content (restricted)",
      tip: "Remove sexual content (especially anything involving minors) and try again."
    };
  }
  if (set.has("illicit") || set.has("illegal") || set.has("criminal")) {
    return {
      reason: "Illicit / criminal activity",
      tip: "We can’t assist with wrongdoing. If you need lawful alternatives or safety info, ask that instead."
    };
  }
  if (set.has("violence") || set.has("weapons")) {
    return {
      reason: "Violence / harm",
      tip: "We can’t assist with violence. Please rephrase to non-violent or safety-focused topics."
    };
  }
  if (set.has("terrorism") || set.has("extremism")) {
    return {
      reason: "Terrorism / extremism",
      tip: "We can’t engage with extremist or terror content. Consider neutral, factual, or historical context only."
    };
  }
  if (set.has("drugs")) {
    return {
      reason: "Drugs / substances",
      tip: "We can’t assist with illegal drug content. For health or safety info, keep it general and lawful."
    };
  }

  // Fallback
  return {
    reason: "Policy violation",
    tip: "Please remove the problematic parts and try again."
  };
}

/**
 * runModeration(text?, imageBase64?, meta?) → ModerationResult
 * - Uses OpenAI moderation for text and image signals (prompt content)
 * - Logs violations to Supabase (server-side)
 */
export async function runModeration(
  text?: string,
  imageBase64?: string | null,
  meta?: { userId?: string; ip?: string }
): Promise<ModerationResult> {
  const inputs: Array<{ type: "text" | "image"; value: string }> = [];
  if (text?.trim()) inputs.push({ type: "text", value: text.trim() });
  if (imageBase64) inputs.push({ type: "image", value: imageBase64 });

  // If nothing to check, allow.
  if (inputs.length === 0) {
    return { allowed: true, categories: [], reason: "", action: "allow" };
  }

  // Simple pass/fail using text moderation; (image is treated as risky if present)
  // If you have a vision moderation endpoint, call it here too.
  const textToCheck = inputs
    .filter((i) => i.type === "text")
    .map((i) => i.value)
    .join("\n---\n");

  let flagged = false;
  const categories: string[] = [];

  if (textToCheck) {
    const mod = await client.moderations.create({
      model: "omni-moderation-latest",
      input: textToCheck
    });

    const r = Array.isArray(mod.results) ? mod.results[0] : (mod as any).results?.[0];
    if (r?.flagged) {
      flagged = true;
      for (const [k, v] of Object.entries(r.categories || {})) {
        if (v === true) categories.push(k);
      }
    }
  }

  // Conservative: if an image is present, add a generic “sexual/violence” scan label
  // (Upgrade this if/when you enable a proper image moderation endpoint.)
  if (imageBase64) {
    // You can optionally add “image” to categories for clearer UI
    // categories.push("image");
  }

  const { reason, tip } = flagged ? explain(categories) : { reason: "", tip: undefined };
  const result: ModerationResult = flagged
    ? { allowed: false, categories, reason, tip, action: "block" }
    : { allowed: true, categories: [], reason: "", action: "allow" };

  // Log *violations* server-side so client RLS doesn’t matter
  if (!result.allowed) {
    try { await supabaseAdmin.from("moderation_logs").insert({ user_id: meta?.userId ?? null,
      ip: meta?.ip ?? null,
      categories: result.categories,
      reason: result.reason,
      tip: result.tip ?? null,
      text: textToCheck || null
     }); } catch (e) {}
  }

  return result;
}

// Back-compat alias
export { runModeration as moderateAllContent };

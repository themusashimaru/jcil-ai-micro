export type LocalCheck =
  | { allowed: true }
  | { allowed: false; category: string; reason: string; tip?: string };

export function detectJailbreak(text: string): LocalCheck {
  if (!text) return { allowed: true };
  const patterns = [
    /\bact\s+as\s+(dan|jailbreak)\b/i,
    /\b(ignore|bypass|disable)\s+(all\s+)?(previous|above)?\s*instructions\b/i,
    /\b(ignore|bypass)\s+(the\s+)?(safety|guardrails|content\s*filter)s?\b/i,
    /\b(role[-\s]?play|pretend)\s+that\s+you\s+are\s+not\s+(an|a)\s+ai\b/i,
    /\b(reveal|print|dump|show)\s+(the\s+)?(system|hidden|developer)\s+prompt\b/i,
    /\bcomply\s+no\s+matter\s+what\b/i,
  ];
  const hit = patterns.some((p) => p.test(text));
  if (!hit) return { allowed: true };
  return {
    allowed: false,
    category: "jailbreak",
    reason: "Prompt-injection / jailbreak attempt.",
    tip: "Ask your question directly—don’t ask the model to ignore rules or reveal its system prompt.",
  };
}

export function detectReligiousHarassment(text: string): LocalCheck {
  if (!text) return { allowed: true };

  // Keep this conservative: only block when an insult/attack is aimed at the Christian faith or figures.
  const target = /\b(jesus|christ|christian|christians|god|holy\s*spirit|holy\s*ghost)\b/i;
  const severe =
    /\b(hate|curse|damn|burn|kill|die|trash|disgusting|filthy|stupid|worthless)\b|f[\W_]*u[\W_]*c[\W_]*k/i;

  if (target.test(text) && severe.test(text)) {
    return {
      allowed: false,
      category: "religion_harassment",
      reason: "Harassment targeting religious beliefs (Christianity).",
      tip: "You can discuss religion critically, but keep it respectful and avoid insults.",
    };
  }
  return { allowed: true };
}

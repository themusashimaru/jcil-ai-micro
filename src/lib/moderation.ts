// src/lib/moderation.ts
import OpenAI from "openai";

export type ModerationItem = {
  kind: "text" | "image";
  summary: string;
  categories: string[];
  confidence: number; // 0..1
};

export type ModerationResult = {
  violates: boolean;
  items: ModerationItem[];
};

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

/**
 * Runs OpenAI omni moderation across text and/or a single image file.
 * Returns a structured result we can both show and log.
 */
export async function runModeration(opts: {
  text?: string;
  imageDataUrl?: string | null;
}): Promise<ModerationResult> {
  const content: any[] = [];

  // Always include at least one part so the schema will return something.
  content.push({
    type: "input_text",
    text:
      (opts.text && opts.text.trim().slice(0, 6000)) ||
      "(no text provided by user)",
  });

  if (opts.imageDataUrl) {
    content.push({
      type: "input_image",
      image_url: opts.imageDataUrl,
    });
  }

  // Ask for a strict JSON result we can reliably parse
  const schema = {
    name: "ModerationResult",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        violates: { type: "boolean" },
        items: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              kind: { type: "string", enum: ["text", "image"] },
              summary: { type: "string" },
              categories: {
                type: "array",
                items: { type: "string" },
              },
              confidence: { type: "number" },
            },
            required: ["kind", "summary", "categories", "confidence"],
          },
        },
      },
      required: ["violates", "items"],
    },
  } as const;

  const resp = await openai.responses.create({
    model: "omni-moderation-latest",
    input: [
      {
        role: "user",
        content,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: schema,
    },
  });

  const jsonText =
    resp.output?.[0]?.content?.[0]?.text ??
    resp.output_text ??
    '{"violates":false,"items":[]}';

  let parsed: ModerationResult;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    parsed = { violates: false, items: [] };
  }

  // Hard safety: if the model returned something unexpected, default safe.
  if (typeof parsed.violates !== "boolean" || !Array.isArray(parsed.items)) {
    parsed = { violates: false, items: [] };
  }

  return parsed;
}

/** Small helper to convert a File (Web) or Blob to data URL (server parses FormData). */
export async function fileToDataUrl(file: File): Promise<string> {
  const buf = Buffer.from(await file.arrayBuffer());
  const base64 = buf.toString("base64");
  const mime = file.type || "application/octet-stream";
  return `data:${mime};base64,${base64}`;
}

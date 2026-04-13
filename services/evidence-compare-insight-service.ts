import OpenAI from "openai";
import { z } from "zod";
import type { EvidenceCompareInsight } from "@/types/evidence-compare-insight";

const insightSchema: z.ZodType<EvidenceCompareInsight> = z.object({
  size_ratio: z.object({
    summary: z.string(),
    epistemic: z.enum(["approximate", "inferred", "uncertain"]),
  }),
  alignment: z.object({
    suggestions: z.array(z.string()),
    epistemic: z.enum(["inferred", "approximate", "uncertain"]),
  }),
  scaling_guidance: z.object({
    text: z.string(),
    epistemic: z.enum(["approximate", "inferred", "uncertain"]),
  }),
  similarities: z.object({
    text: z.string(),
    epistemic: z.enum(["inferred", "uncertain"]),
  }),
  differences: z.object({
    text: z.string(),
    epistemic: z.enum(["inferred", "uncertain"]),
  }),
});

export async function runEvidenceCompareInsight(input: {
  leftLabel: string;
  rightLabel: string;
  leftMime: string | null;
  rightMime: string | null;
  leftWidth?: number | null;
  leftHeight?: number | null;
  rightWidth?: number | null;
  rightHeight?: number | null;
}): Promise<EvidenceCompareInsight> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
  const openai = new OpenAI({ apiKey });

  const dims =
    input.leftWidth && input.leftHeight && input.rightWidth && input.rightHeight
      ? `Left reported dimensions (browser): ${input.leftWidth}×${input.leftHeight}px. Right: ${input.rightWidth}×${input.rightHeight}px.`
      : "Pixel dimensions were not provided or are incomplete — do not claim a precise numeric size ratio.";

  const system = `You assist investigators comparing two evidence files in a workspace UI.
Rules:
- Never claim forensic certainty, sub-pixel alignment, or exact real-world measurements unless the user provided verified metadata stating so (they did not here).
- Every field must include an epistemic tag: approximate (rough numeric/heuristic), inferred (logical guess from filenames/mime), or uncertain (little to go on).
- size_ratio: only discuss relative scale if dimensions are given; otherwise explain uncertainty briefly.
- alignment: practical tips for visually lining up two images (edges, horizons, margins) — all inferred/heuristic.
- Output strict JSON matching the schema the user message describes.`;

  const user = `Compare these two evidence items for a side-by-side / overlay review.

Left: ${input.leftLabel} (mime: ${input.leftMime ?? "unknown"})
Right: ${input.rightLabel} (mime: ${input.rightMime ?? "unknown"})

${dims}

Return JSON with this shape:
{
  "size_ratio": { "summary": string, "epistemic": "approximate"|"inferred"|"uncertain" },
  "alignment": { "suggestions": string[], "epistemic": "inferred"|"approximate"|"uncertain" },
  "scaling_guidance": { "text": string, "epistemic": "approximate"|"inferred"|"uncertain" },
  "similarities": { "text": string, "epistemic": "inferred"|"uncertain" },
  "differences": { "text": string, "epistemic": "inferred"|"uncertain" }
}`;

  const completion = await openai.chat.completions.create({
    model,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error("Empty model response");

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch {
    throw new Error("Model did not return valid JSON");
  }

  const parsed = insightSchema.safeParse(parsedJson);
  if (!parsed.success) {
    throw new Error("Model JSON did not match the compare-insight schema");
  }

  return parsed.data;
}

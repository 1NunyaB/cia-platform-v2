export type VisualTag = {
  tag: string;
  confidence: number;
  source: "heuristic";
};

const TAG_KEYWORDS: Array<{ tag: string; words: string[] }> = [
  { tag: "weapon", words: ["weapon", "gun", "pistol", "rifle", "knife", "blade"] },
  { tag: "face", words: ["face", "portrait", "selfie", "profile"] },
  { tag: "hands", words: ["hand", "hands", "palm", "glove"] },
  { tag: "clothing", words: ["clothing", "shirt", "jacket", "coat", "pants"] },
  { tag: "shoes", words: ["shoe", "sneaker", "boot", "footwear"] },
  { tag: "dress", words: ["dress", "gown"] },
  { tag: "lips", words: ["lip", "lips", "lipstick"] },
  { tag: "landmark", words: ["landmark", "monument", "bridge", "tower"] },
  { tag: "evidence_marker", words: ["marker", "label", "tag", "evidence"] },
  { tag: "clock", words: ["clock", "wall clock"] },
  { tag: "watch", words: ["watch", "wristwatch"] },
  { tag: "tie", words: ["tie", "necktie"] },
  { tag: "mirror", words: ["mirror", "reflection"] },
  { tag: "portrait", words: ["portrait", "headshot"] },
  { tag: "furniture", words: ["chair", "table", "desk", "sofa", "couch", "furniture"] },
];

export function detectVisualTags(input: {
  filename: string;
  ocrText: string;
  imageProfile: "text_first" | "photo_first_limited" | "photo_first_low_confidence" | null;
}): VisualTag[] {
  const haystack = `${input.filename}\n${input.ocrText}`.toLowerCase();
  const out: VisualTag[] = [];
  for (const spec of TAG_KEYWORDS) {
    const hitCount = spec.words.reduce((acc, w) => acc + (haystack.includes(w) ? 1 : 0), 0);
    if (hitCount === 0) continue;
    const profileBoost =
      input.imageProfile === "photo_first_limited" || input.imageProfile === "photo_first_low_confidence"
        ? 0.08
        : input.imageProfile === "text_first"
          ? -0.05
          : 0;
    const base = 0.42 + Math.min(hitCount, 3) * 0.12 + profileBoost;
    const confidence = Math.max(0.2, Math.min(0.9, Number(base.toFixed(3))));
    out.push({ tag: spec.tag, confidence, source: "heuristic" });
  }
  return out;
}


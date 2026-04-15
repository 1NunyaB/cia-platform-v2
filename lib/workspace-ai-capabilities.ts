export type WorkspacePageContext =
  | "dashboard"
  | "cases"
  | "case_detail"
  | "case_evidence"
  | "evidence"
  | "analyze"
  | "other";

export const AVAILABLE_CAPABILITIES = [
  "Review selected evidence metadata and image previews (when attached).",
  "Summarize observations, clues, and investigator next steps grounded in selected evidence.",
  "Suggest practical in-app actions: open evidence, compare two files, add to case, add to evidence stack(s), link to timeline/map.",
  "Use current case context when a case is active.",
] as const;

const UNAVAILABLE_PATTERNS: Array<{ re: RegExp; replacement: string }> = [
  {
    re: /\b(extract text|ocr extraction|run extraction|transcribe all documents)\b/i,
    replacement:
      "Text extraction workflows are not available in this assistant. Use evidence metadata, image previews, compare, and case/timeline/map linking workflows.",
  },
  {
    re: /\b(export report|pdf export|download report|share externally|public share link)\b/i,
    replacement:
      "That export/share workflow is not available here. You can continue investigation through case notes, evidence compare, and stack/case linking.",
  },
  {
    re: /\b(video ai analyzer|audio ai analyzer|auto clip detection|waveform analyzer)\b/i,
    replacement:
      "Advanced media analyzers are scaffolded but not fully available yet. Use the current video/audio starter pages for playback, timestamps, and notes.",
  },
];

export function evaluateCapabilityRequest(message: string): { blocked: true; reply: string } | null {
  const text = message.trim();
  if (!text) return null;
  for (const p of UNAVAILABLE_PATTERNS) {
    if (p.re.test(text)) {
      return {
        blocked: true,
        reply: `${p.replacement}\n\nAvailable now: ${AVAILABLE_CAPABILITIES.join(" ")}`,
      };
    }
  }
  return null;
}


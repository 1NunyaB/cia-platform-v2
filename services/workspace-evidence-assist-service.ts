import OpenAI from "openai";
import { AiNotConfiguredError, requireOpenAiApiKey } from "@/lib/openai-config";

export type WorkspaceEvidenceMeta = {
  id: string;
  label: string;
  mimeType: string | null;
  processingStatus: string | null;
  sourceType: string | null;
  sourcePlatform: string | null;
  sourceProgram: string | null;
  originalFilename: string;
  shortAlias: string | null;
  fileSequenceNumber: number | null;
};

function formatEvidenceMetaBlock(ev: WorkspaceEvidenceMeta, indexOneBased: number, total: number): string {
  const header = total > 1 ? `--- File ${indexOneBased} of ${total} ---` : "Selected file";
  const lines = [
    header,
    `Evidence id: ${ev.id}`,
    `Display label: ${ev.label}`,
    `Original filename: ${ev.originalFilename}`,
    ev.shortAlias ? `Short alias: ${ev.shortAlias}` : null,
    ev.fileSequenceNumber != null ? `Case file #: ${String(ev.fileSequenceNumber).padStart(3, "0")}` : null,
    `MIME type: ${ev.mimeType ?? "unknown"}`,
    `Processing status: ${ev.processingStatus ?? "unknown"}`,
    ev.sourceType ? `Source type: ${ev.sourceType}` : null,
    ev.sourcePlatform ? `Platform: ${ev.sourcePlatform}` : null,
    ev.sourceProgram ? `Program/title: ${ev.sourceProgram}` : null,
  ].filter(Boolean);
  return lines.join("\n");
}

/**
 * Investigator-facing assistant using evidence metadata and optional image previews.
 * Does not use extracted text — no extraction dependency.
 */
export async function runWorkspaceEvidenceAssist(input: {
  userMessage: string;
  evidence: WorkspaceEvidenceMeta | WorkspaceEvidenceMeta[];
  caseContext: string | null;
  pageContext?: string | null;
  /** Optional still images aligned to evidence ids (subset may have vision). */
  visionImages?: Array<{ evidenceId: string; base64: string; mimeType: string }>;
}): Promise<string> {
  let apiKey: string;
  try {
    apiKey = requireOpenAiApiKey();
  } catch (e) {
    if (e instanceof AiNotConfiguredError) throw e;
    throw new AiNotConfiguredError();
  }

  const list = Array.isArray(input.evidence) ? input.evidence : [input.evidence];
  if (list.length === 0) {
    throw new Error("No evidence selected.");
  }

  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
  const openai = new OpenAI({ apiKey });

  const multi = list.length > 1;
  const system = `You assist investigators reviewing evidence inside a CIS workspace.
Rules:
- Scope is strictly limited to evidence and investigation context provided in this request.
- Refuse requests about platform owner/admin identity, personal account details, private user data, or who runs/created the platform.
- If a request is out-of-scope, reply with: "I can only help with evidence and investigation-related questions."
- You receive file metadata for one or more items, and optionally still image previews for some image-type files. You do NOT receive PDF bytes, video, audio, or full documents except as labeled images below.
- Do not claim forensic certainty, hidden text recovery, or full document understanding when you only have metadata.
- For each attached image, describe only what is reasonably visible; note occlusion, blur, and limits. Label which file the image belongs to.
- Help with: brief summary, observations, clues (tentative), limitations, and practical next steps (e.g. compare in the compare workspace). When multiple files are selected, note relationships, contrasts, and what to verify across items.
- Use clear sections with short headings. Stay concise for a narrow side panel.
- Tone: professional, plain text (no markdown tables required).
- Never suggest unavailable or future-only app features as if they exist now.
- If user asks for unavailable app functionality, clearly say it is not available and redirect to currently available workflows in this context.`;

  const metaBlocks = list.map((ev, i) => formatEvidenceMetaBlock(ev, i + 1, list.length)).join("\n\n");

  const caseBlock = input.caseContext?.trim()
    ? `Investigation context:\n${input.caseContext.trim()}`
    : "No single case title was provided, or context is limited to per-file metadata below.";

  const pageBlock = input.pageContext?.trim()
    ? `Current workspace page context: ${input.pageContext.trim()}`
    : "Current workspace page context: unknown";

  let userText = `${caseBlock}
${pageBlock}

Selected evidence (${list.length} file${multi ? "s" : ""}) — metadata only describes names/types; not full file contents:
${metaBlocks}

Investigator question or request:
${input.userMessage.trim()}`;

  const visionImages = input.visionImages ?? [];
  const userContent: OpenAI.Chat.ChatCompletionContentPart[] = [{ type: "text", text: userText }];

  for (const img of visionImages) {
    const label = list.find((e) => e.id === img.evidenceId);
    const caption = label
      ? `\n\n[Still image preview for: ${label.label} (id ${img.evidenceId.slice(0, 8)}…)]`
      : `\n\n[Still image preview (id ${img.evidenceId.slice(0, 8)}…)]`;
    userContent.push({ type: "text", text: caption });
    userContent.push({
      type: "image_url",
      image_url: {
        url: `data:${img.mimeType};base64,${img.base64}`,
        detail: "auto",
      },
    });
  }

  let completion: OpenAI.Chat.ChatCompletion;
  try {
    completion = await openai.chat.completions.create({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: userContent },
      ],
      max_tokens: multi ? 1600 : 1200,
    });
  } catch (e) {
    if (e instanceof AiNotConfiguredError) throw e;
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[workspace-evidence-assist] OpenAI request failed:", msg);
    throw new AiNotConfiguredError();
  }

  const raw = completion.choices[0]?.message?.content;
  if (!raw?.trim()) throw new Error("Empty model response");
  return raw.trim();
}

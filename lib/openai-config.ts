/**
 * Validates OPENAI_API_KEY from the environment — no hardcoded keys in code.
 * Placeholder values often come from copying `.env.local.example` literally (`sk-your-openai-key`).
 */

const PLACEHOLDER_PATTERNS: RegExp[] = [
  /^sk-your-openai-key$/i,
  /^sk-your-.*key$/i,
  /placeholder/i,
  /example/i,
  /^sk-test$/i,
  /^sk-invalid$/i,
];

export class AiNotConfiguredError extends Error {
  constructor(message = "AI is not configured yet.") {
    super(message);
    this.name = "AiNotConfiguredError";
  }
}

export function isPlaceholderOrInvalidOpenAiKey(key: string | undefined | null): boolean {
  const t = (key ?? "").trim();
  if (!t) return true;
  if (!t.startsWith("sk-")) return true;
  if (t.length < 20) return true;
  for (const re of PLACEHOLDER_PATTERNS) {
    if (re.test(t)) return true;
  }
  return false;
}

/** Returns a usable key or throws AiNotConfiguredError (message safe for mapping to HTTP responses). */
export function requireOpenAiApiKey(): string {
  const raw = process.env.OPENAI_API_KEY;
  if (isPlaceholderOrInvalidOpenAiKey(raw)) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "[openai-config] OPENAI_API_KEY is missing, empty, or looks like a placeholder — set a real key in .env.local",
      );
    }
    throw new AiNotConfiguredError();
  }
  return raw!.trim();
}

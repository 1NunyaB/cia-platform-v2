import { UploadPolicyError } from "@/lib/evidence-upload-errors";

/** Default 50 MB; override with EVIDENCE_MAX_FILE_BYTES (integer, bytes). */
export const MAX_EVIDENCE_FILE_BYTES =
  (typeof process !== "undefined" && process.env.EVIDENCE_MAX_FILE_BYTES
    ? parseInt(process.env.EVIDENCE_MAX_FILE_BYTES, 10)
    : NaN) || 50 * 1024 * 1024;

/**
 * Extensions always rejected (executables and common malware carriers).
 * Archives are blocked unless you explicitly allow them later.
 */
const BLOCKED_EXTENSIONS = new Set([
  "exe",
  "dll",
  "com",
  "msi",
  "scr",
  "bat",
  "cmd",
  "pif",
  "vbs",
  "js",
  "jar",
  "app",
  "deb",
  "rpm",
  "dmg",
  "pkg",
  "apk",
  "bin",
  "run",
  "sh",
  "ps1",
  "hta",
  "lnk",
  "iso",
  "img",
  "vmdk",
  "zip",
  "rar",
  "7z",
  "tar",
  "gz",
]);

/** When the browser sends octet-stream or empty MIME, we only allow these extensions. */
const ALLOWED_EXTENSIONS_FALLBACK = new Set([
  "pdf",
  "txt",
  "md",
  "csv",
  "json",
  "xml",
  "html",
  "htm",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "ppt",
  "pptx",
  "odt",
  "ods",
  "odp",
  "rtf",
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "tiff",
  "tif",
  "bmp",
  "svg",
  "mp3",
  "wav",
  "ogg",
  "m4a",
  "flac",
  "mp4",
  "webm",
  "mov",
  "mkv",
  "mpeg",
  "mpg",
]);

/** MIME prefixes/types allowed for evidence uploads (investigation-safe formats). */
const ALLOWED_MIME_PREFIXES = [
  "application/pdf",
  "text/",
  "application/json",
  "application/xml",
  "image/",
  "audio/",
  "video/",
  "application/vnd.openxmlformats-officedocument",
  "application/msword",
  "application/vnd.ms-",
  "application/rtf",
  "application/epub",
];

function extensionOf(filename: string): string {
  const base = filename.split(/[/\\]/).pop() ?? "";
  const i = base.lastIndexOf(".");
  if (i <= 0) return "";
  return base.slice(i + 1).toLowerCase();
}

function mimeAllowed(mime: string): boolean {
  const m = mime.split(";")[0].trim().toLowerCase();
  return ALLOWED_MIME_PREFIXES.some((p) => (p.endsWith("/") ? m.startsWith(p) : m.startsWith(p) || m === p));
}

/**
 * Validate size, extension blocklist, and MIME allowlist before storage or scanning.
 */
export function assertEvidenceUploadAllowed(input: {
  buffer: Buffer;
  originalFilename: string;
  mimeType: string | null;
  declaredSize: number;
}): void {
  const { buffer, originalFilename, mimeType, declaredSize } = input;

  if (buffer.length > MAX_EVIDENCE_FILE_BYTES) {
    throw new UploadPolicyError(
      `File exceeds maximum size (${Math.floor(MAX_EVIDENCE_FILE_BYTES / (1024 * 1024))} MB).`,
    );
  }

  if (declaredSize > MAX_EVIDENCE_FILE_BYTES) {
    throw new UploadPolicyError("Reported file size is too large.");
  }

  const ext = extensionOf(originalFilename);
  if (ext && BLOCKED_EXTENSIONS.has(ext)) {
    throw new UploadPolicyError(
      `File type ".${ext}" is not allowed for evidence uploads (executables, scripts, and archives are blocked).`,
    );
  }

  const mt = (mimeType ?? "").split(";")[0].trim().toLowerCase();
  if (!mt || mt === "application/octet-stream") {
    if (!ext || !ALLOWED_EXTENSIONS_FALLBACK.has(ext)) {
      throw new UploadPolicyError(
        "Unrecognized file type. Use PDF, text, Office/OpenDocument, images, audio, or video with a supported extension.",
      );
    }
  } else if (!mimeAllowed(mt)) {
    throw new UploadPolicyError(`MIME type "${mt}" is not permitted for evidence uploads.`);
  }
}

/** Quick binary signals for obviously unsafe payloads (does not replace AV). */
export function hasExecutableMagicHeader(buffer: Buffer): boolean {
  if (buffer.length < 4) return false;
  // MZ (PE)
  if (buffer[0] === 0x4d && buffer[1] === 0x5a) return true;
  // ELF
  if (buffer[0] === 0x7f && buffer[1] === 0x45 && buffer[2] === 0x4c && buffer[3] === 0x46) return true;
  // Mach-O fat / magic
  if (buffer[0] === 0xcf && buffer[1] === 0xfa && buffer[2] === 0xed && buffer[3] === 0xfe) return true;
  if (buffer[0] === 0xce && buffer[1] === 0xfa && buffer[2] === 0xed && buffer[3] === 0xfe) return true;
  return false;
}

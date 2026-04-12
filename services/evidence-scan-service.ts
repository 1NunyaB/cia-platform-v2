import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { randomUUID } from "crypto";
import { spawn } from "child_process";
import { hasExecutableMagicHeader } from "@/lib/evidence-upload-policy";

export type EvidenceScanEngine = "clamav" | "heuristic" | "disabled";

export type EvidenceScanResult = {
  clean: boolean;
  detail: string;
  engine: EvidenceScanEngine;
};

/**
 * Pluggable antivirus step. Set CLAMSCAN_BIN to the `clamscan` executable path to enable ClamAV.
 * Without it, uses lightweight heuristics only — swap this module’s implementation or call an HTTP API.
 */
export async function scanEvidenceBuffer(input: {
  buffer: Buffer;
  filename: string;
  mimeType: string | null;
}): Promise<EvidenceScanResult> {
  if (hasExecutableMagicHeader(input.buffer)) {
    return {
      clean: false,
      detail: "File content resembles an executable binary (blocked).",
      engine: "heuristic",
    };
  }

  const clam = process.env.CLAMSCAN_BIN?.trim();
  if (clam) {
    const tmp = path.join(os.tmpdir(), `cia-evidence-scan-${randomUUID()}`);
    try {
      fs.writeFileSync(tmp, input.buffer);
      const code = await runClamScan(clam, tmp);
      if (code === 1) {
        return {
          clean: false,
          detail: "Antivirus scan reported a threat (ClamAV). File was not stored.",
          engine: "clamav",
        };
      }
      if (code === 0) {
        return { clean: true, detail: "", engine: "clamav" };
      }
      throw new Error(
        `Antivirus scanner exited with code ${code}. Try again or contact an administrator.`,
      );
    } finally {
      try {
        fs.unlinkSync(tmp);
      } catch {
        /* ignore */
      }
    }
  }

  return {
    clean: true,
    detail: "",
    engine: "disabled",
  };
}

function runClamScan(bin: string, filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, ["--no-summary", filePath], { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    child.stderr?.on("data", (c: Buffer) => {
      stderr += c.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === null) {
        reject(new Error(stderr || "clamscan exited"));
        return;
      }
      resolve(code);
    });
  });
}

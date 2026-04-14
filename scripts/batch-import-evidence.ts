import { ingestEvidenceFromUrl } from "@/services/case-evidence-ingest";
import { createServiceClient } from "@/lib/supabase/service";
import { EvidenceDuplicateError } from "@/lib/evidence-upload-errors";
import type { EvidenceSourcePayload, EvidenceSourceType } from "@/lib/evidence-source";

type CliOptions = {
  pageUrl: string;
  userId: string;
  sourceType: EvidenceSourceType;
  sourcePlatform?: string;
  sourceProgram?: string;
  sourceUrl?: string;
  extFilters: string[];
  nameRegex?: RegExp;
  limit?: number;
};

function parseArgs(argv: string[]): CliOptions {
  const kv = new Map<string, string>();
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (!a.startsWith("--")) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      kv.set(key, "true");
      continue;
    }
    kv.set(key, next);
    i += 1;
  }

  const pageUrl = kv.get("pageUrl") ?? "";
  const userId = kv.get("userId") ?? "";
  if (!pageUrl) {
    throw new Error("Missing --pageUrl");
  }
  if (!userId) {
    throw new Error("Missing --userId (uploaded_by owner for imported evidence)");
  }

  const extRaw = kv.get("ext") ?? ".pdf";
  const extFilters = extRaw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .map((s) => (s.startsWith(".") ? s : `.${s}`));

  const nameRegex = kv.get("nameRegex") ? new RegExp(kv.get("nameRegex")!, "i") : undefined;
  const limit = kv.get("limit") ? Number(kv.get("limit")) : undefined;

  return {
    pageUrl,
    userId,
    sourceType: (kv.get("sourceType") as EvidenceSourceType) ?? "article",
    sourcePlatform: kv.get("sourcePlatform") || undefined,
    sourceProgram: kv.get("sourceProgram") || undefined,
    sourceUrl: kv.get("sourceUrl") || undefined,
    extFilters,
    nameRegex,
    limit: Number.isFinite(limit) ? limit : undefined,
  };
}

function isLikelyFileUrl(url: URL, extFilters: string[]): boolean {
  const p = url.pathname.toLowerCase();
  return extFilters.some((ext) => p.endsWith(ext));
}

function extractAbsoluteLinksFromHtml(html: string, pageUrl: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const hrefRe = /href\s*=\s*["']([^"'#]+)["']/gi;
  let match: RegExpExecArray | null = null;
  while ((match = hrefRe.exec(html)) != null) {
    const raw = match[1]!.trim();
    if (!raw) continue;
    try {
      const abs = new URL(raw, pageUrl).toString();
      if (seen.has(abs)) continue;
      seen.add(abs);
      out.push(abs);
    } catch {
      // Ignore malformed hrefs.
    }
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const supabase = createServiceClient();

  console.log(`\n[import] Fetching source page: ${args.pageUrl}`);
  const pageRes = await fetch(args.pageUrl);
  if (!pageRes.ok) {
    throw new Error(`[import] Could not fetch page (${pageRes.status}): ${args.pageUrl}`);
  }
  const html = await pageRes.text();
  const links = extractAbsoluteLinksFromHtml(html, args.pageUrl);
  const candidates = links.filter((link) => {
    try {
      const u = new URL(link);
      if (!isLikelyFileUrl(u, args.extFilters)) return false;
      if (args.nameRegex && !args.nameRegex.test(u.pathname)) return false;
      return true;
    } catch {
      return false;
    }
  });

  const targets = args.limit ? candidates.slice(0, args.limit) : candidates;
  console.log(`[import] Found ${links.length} links; ${targets.length} matched filters.`);
  if (targets.length === 0) {
    console.log("[import] Nothing to import.");
    return;
  }

  const sourceBase: EvidenceSourcePayload = {
    source_type: args.sourceType,
    source_platform: args.sourcePlatform ?? null,
    source_program: args.sourceProgram ?? null,
    source_url: args.sourceUrl ?? args.pageUrl,
  };

  let imported = 0;
  let duplicates = 0;
  let failed = 0;

  for (let i = 0; i < targets.length; i++) {
    const fileUrl = targets[i]!;
    const indexLabel = `${i + 1}/${targets.length}`;
    process.stdout.write(`[import] ${indexLabel} ${fileUrl} ... `);
    try {
      const res = await ingestEvidenceFromUrl(supabase, {
        caseId: null,
        userId: args.userId,
        url: fileUrl,
        source: {
          ...sourceBase,
          source_url: args.sourceUrl ?? fileUrl,
        },
        audit: { uploadMethod: "url_import" },
      });
      imported += 1;
      if (res.warning) {
        console.log(`IMPORTED (warning: ${res.warning})`);
      } else {
        console.log("IMPORTED");
      }
    } catch (e) {
      if (e instanceof EvidenceDuplicateError) {
        duplicates += 1;
        console.log("SKIPPED (duplicate)");
      } else {
        failed += 1;
        const msg = e instanceof Error ? e.message : String(e);
        console.log(`FAILED (${msg})`);
      }
    }
  }

  console.log("\n[import] Summary");
  console.log(`- Imported: ${imported}`);
  console.log(`- Skipped duplicates: ${duplicates}`);
  console.log(`- Failed: ${failed}`);
}

main().catch((err) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`\n[import] Fatal error: ${msg}`);
  process.exit(1);
});


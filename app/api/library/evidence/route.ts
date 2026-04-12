import { createClient } from "@/lib/supabase/server";
import { ingestUploadedFile } from "@/services/case-evidence-ingest";
import { EvidenceDuplicateError, isClientSafeUploadError } from "@/lib/evidence-upload-errors";
import { parseEvidenceSourceFromFormData } from "@/lib/evidence-source";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export type BulkLibraryEvidenceItemResult = {
  filename: string;
  id?: string;
  warning?: string;
  error?: string;
  duplicate?: boolean;
  existing?: import("@/lib/evidence-upload-errors").DuplicateEvidenceMatch;
};

/** Upload evidence to the database without attaching a case (personal library). */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const source = parseEvidenceSourceFromFormData(formData);
  const forceDuplicate =
    formData.get("force_duplicate") === "true" || formData.get("force_duplicate") === "1";
  const multi = formData.getAll("files").filter((x): x is File => x instanceof File);
  const single = formData.get("file");

  if (multi.length > 0) {
    const results: BulkLibraryEvidenceItemResult[] = [];
    for (const file of multi) {
      try {
        const r = await ingestUploadedFile(supabase, {
          caseId: null,
          userId: user.id,
          file,
          source,
          forceDuplicate,
        });
        results.push({
          filename: file.name,
          id: r.id,
          ...(r.warning ? { warning: r.warning } : {}),
        });
      } catch (e) {
        if (e instanceof EvidenceDuplicateError) {
          results.push({
            filename: file.name,
            error: e.message,
            duplicate: true,
            existing: e.existing,
          });
        } else {
          const message = e instanceof Error ? e.message : "Upload failed";
          results.push({ filename: file.name, error: message });
        }
      }
    }
    return NextResponse.json({ results }, { status: 201 });
  }

  if (single instanceof File) {
    try {
      const r = await ingestUploadedFile(supabase, {
        caseId: null,
        userId: user.id,
        file: single,
        source,
        forceDuplicate,
      });
      if (r.warning) {
        return NextResponse.json({ id: r.id, warning: r.warning }, { status: 201 });
      }
      return NextResponse.json({ id: r.id }, { status: 201 });
    } catch (e) {
      if (e instanceof EvidenceDuplicateError) {
        return NextResponse.json(
          { error: e.message, duplicate: true, existing: e.existing },
          { status: 409 },
        );
      }
      const message = e instanceof Error ? e.message : "Upload failed";
      const status = isClientSafeUploadError(e) ? 400 : 500;
      return NextResponse.json({ error: message }, { status });
    }
  }

  return NextResponse.json({ error: "Missing file or files" }, { status: 400 });
}

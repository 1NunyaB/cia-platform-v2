"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { EvidenceFile } from "@/types";

type ImageCategoryRow = { name: string; label: string };

const CATEGORY_BLURB: Record<string, string> = {
  location: "Scenes, addresses, landmarks, and environmental context.",
  furnishings: "Interior layout, fixtures, and fixed assets visible in frame.",
  misc: "Items of interest that do not fit a tighter category.",
  transport: "Vehicles, plates, transit, and movement-related visuals.",
  people: "Individuals, groups, clothing, and identifiers (handled cautiously for privacy).",
};

export function AnalyzeImageAnalysisSection() {
  const [categories, setCategories] = useState<ImageCategoryRow[]>([]);
  /** null = all images (any category or none) */
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [evidence, setEvidence] = useState<EvidenceFile[]>([]);
  const [loadingCats, setLoadingCats] = useState(true);
  const [loadingList, setLoadingList] = useState(true);
  const [signedIn, setSignedIn] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingCats(true);
      const res = await fetch("/api/image-categories");
      if (cancelled) return;
      if (res.status === 401) {
        setSignedIn(false);
        setCategories([]);
        setLoadingCats(false);
        return;
      }
      if (!res.ok) {
        setCategories([]);
        setLoadingCats(false);
        return;
      }
      const data = (await res.json().catch(() => ({}))) as { categories?: ImageCategoryRow[] };
      setCategories(Array.isArray(data.categories) ? data.categories : []);
      setSignedIn(true);
      setLoadingCats(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadEvidence = useCallback(async () => {
    if (!signedIn) {
      setEvidence([]);
      setLoadingList(false);
      return;
    }
    setLoadingList(true);
    const q =
      activeCategory != null && activeCategory !== ""
        ? `?category=${encodeURIComponent(activeCategory)}`
        : "";
    const res = await fetch(`/api/evidence/image-hub${q}`);
    if (!res.ok) {
      setEvidence([]);
      setLoadingList(false);
      return;
    }
    const data = (await res.json().catch(() => ({}))) as { evidence?: EvidenceFile[] };
    setEvidence(Array.isArray(data.evidence) ? data.evidence : []);
    setLoadingList(false);
  }, [activeCategory, signedIn]);

  useEffect(() => {
    void loadEvidence();
  }, [loadEvidence]);

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || activeCategory == null) {
      setUploadError(activeCategory == null ? "Select a category folder first." : null);
      return;
    }
    setUploadError(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      fd.set("image_category", activeCategory);
      const res = await fetch("/api/library/evidence", { method: "POST", body: fd });
      const data = (await res.json().catch(() => ({}))) as { error?: string; id?: string };
      if (!res.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "Upload failed");
      }
      await loadEvidence();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-100">Categories</p>
      {!signedIn ? (
        <p className="text-xs text-slate-400">
          <Link href="/login" className="text-sky-400 underline-offset-2 hover:underline">
            Sign in
          </Link>{" "}
          to upload into category folders and filter your image evidence.
        </p>
      ) : null}

      <div className="space-y-1.5">
        <button
          type="button"
          onClick={() => setActiveCategory(null)}
          className="w-full cursor-pointer rounded-lg bg-[#0f172a] px-3 py-2.5 text-left transition-all"
          style={{
            border: activeCategory === null ? "1px solid #2563eb66" : "1px solid #1e293b",
          }}
        >
          <p className="mb-0.5 text-xs font-semibold text-white">All images</p>
          <p className="text-xs text-slate-300">Every image file in your library (any folder).</p>
        </button>
        {loadingCats ? (
          <p className="text-xs text-slate-500">Loading categories…</p>
        ) : null}
        {categories.map((c) => (
          <button
            key={c.name}
            type="button"
            onClick={() => setActiveCategory(c.name)}
            className="w-full cursor-pointer rounded-lg bg-[#0f172a] px-3 py-2.5 text-left transition-all"
            style={{
              border: activeCategory === c.name ? "1px solid #2563eb66" : "1px solid #1e293b",
            }}
          >
            <p className="mb-0.5 text-xs font-semibold text-white">{c.label}</p>
            <p className="text-xs text-slate-300">{CATEGORY_BLURB[c.name] ?? ""}</p>
          </button>
        ))}
      </div>

      {signedIn ? (
        <div className="mt-3 space-y-2">
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onPickFile} />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={uploading || activeCategory === null}
              onClick={() => fileInputRef.current?.click()}
              className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition-all disabled:cursor-not-allowed disabled:opacity-50"
              style={{ backgroundColor: "#1e40af", border: "1px solid #2563eb" }}
            >
              {uploading ? "Uploading…" : "Upload to selected folder"}
            </button>
            <span className="text-[10px] text-slate-500">
              {activeCategory === null ? "Pick a category above, then upload." : `Target: ${activeCategory}`}
            </span>
          </div>
          {uploadError ? <p className="text-xs text-rose-400">{uploadError}</p> : null}
        </div>
      ) : null}

      {signedIn ? (
        <div className="mt-3 rounded-lg border border-[#1e2d42] bg-[#0f172a] p-2">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            {activeCategory === null ? "All image evidence" : `Folder: ${activeCategory}`}
          </p>
          {loadingList ? (
            <p className="text-xs text-slate-500">Loading files…</p>
          ) : evidence.length === 0 ? (
            <p className="text-xs text-slate-500">No matching image files yet.</p>
          ) : (
            <ul className="max-h-40 space-y-1 overflow-y-auto">
              {evidence.map((ev) => (
                <li key={ev.id}>
                  <Link
                    href={`/evidence/${ev.id}`}
                    className="block truncate text-xs text-sky-400 underline-offset-2 hover:underline"
                  >
                    {(ev.display_filename ?? ev.original_filename).slice(0, 80)}
                    {ev.image_category ? (
                      <span className="ml-1 text-[10px] text-slate-500">({ev.image_category})</span>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      <div className="mt-1 flex items-start gap-2">
        <Link
          href="/analyze/image-shadow"
          className="inline-flex items-center justify-center rounded-lg border border-[#1e2d42] bg-[#1a2335] px-3 py-1.5 text-xs font-medium text-[#94a3b8] transition-all hover:border-[#334155] hover:bg-[#1e2d42] hover:text-[#e2e8f0]"
        >
          Open shadow mapping starter
        </Link>
      </div>
      <p className="mt-2 text-xs text-slate-300">
        Visual tags and OCR on uploads continue to work from the evidence detail view; this hub is the navigation frame
        for image-oriented review.
      </p>
    </div>
  );
}

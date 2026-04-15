"use client";
import Link from "next/link";
import { useState } from "react";
import type { ReactElement } from "react";
import {
  AudioWaveform,
  Brain,
  Check,
  FileText,
  Image,
  MapPin,
  Plus,
  Scale,
  Search,
  Upload,
  Video,
} from "lucide-react";

type EvidenceItem = {
  id: string;
  name: string;
  alias: string;
  type: "DOCUMENT" | "IMAGE" | "VIDEO" | "AUDIO";
  typeStatus: "Suggested type" | "Confirmed";
  reviewStatus: "Needs reviewing" | "Reviewed";
  caseId?: string;
};

const evidenceData: EvidenceItem[] = [
  {
    id: "ev-001",
    name: "import-en_wikipedia_org-Epstein_files-17761869339...",
    alias: "Wikipedia5",
    type: "DOCUMENT",
    typeStatus: "Suggested type",
    reviewStatus: "Needs reviewing",
  },
  {
    id: "ev-002",
    name: "import-en_wikipedia_org-Epstein_Files_Transparency...",
    alias: "Wikipedia4",
    type: "DOCUMENT",
    typeStatus: "Suggested type",
    reviewStatus: "Needs reviewing",
  },
  {
    id: "ev-003",
    name: "surveillance_footage_oct_12_2021.mp4",
    alias: "CCTV-A",
    type: "VIDEO",
    typeStatus: "Confirmed",
    reviewStatus: "Reviewed",
    caseId: "CIS-2024-001",
  },
  {
    id: "ev-004",
    name: "crime_scene_photo_meridian_falls.jpg",
    alias: "CSPhoto-01",
    type: "IMAGE",
    typeStatus: "Confirmed",
    reviewStatus: "Reviewed",
    caseId: "CIS-2024-001",
  },
  {
    id: "ev-005",
    name: "interview_recording_castellano_2022.wav",
    alias: "IntRec-01",
    type: "AUDIO",
    typeStatus: "Suggested type",
    reviewStatus: "Needs reviewing",
  },
];

const typeFilters = [
  { label: "All types", icon: null },
  { label: "Document", icon: <FileText className="h-4 w-4" /> },
  { label: "Image", icon: <Image className="h-4 w-4" /> },
  { label: "Video", icon: <Video className="h-4 w-4" /> },
  { label: "Audio", icon: <AudioWaveform className="h-4 w-4" /> },
];

const viewTabs = ["Evidence Library", "Unassigned evidence", "On a case"];

const typeColors: Record<string, string> = {
  DOCUMENT: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  IMAGE: "text-purple-400 bg-purple-500/10 border-purple-500/20",
  VIDEO: "text-orange-400 bg-orange-500/10 border-orange-500/20",
  AUDIO: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
};

const typeIconMap: Record<string, ReactElement> = {
  DOCUMENT: <FileText className="h-4 w-4" />,
  IMAGE: <Image className="h-4 w-4" />,
  VIDEO: <Video className="h-4 w-4" />,
  AUDIO: <AudioWaveform className="h-4 w-4" />,
};

export default function EvidenceLibrary() {
  const [search, setSearch] = useState("");
  const [activeType, setActiveType] = useState("All types");
  const [activeView, setActiveView] = useState("Evidence Library");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filtered = evidenceData.filter((e) => {
    const matchesType =
      activeType === "All types" ||
      e.type === activeType.toUpperCase();
    const matchesView =
      activeView === "Evidence Library"
        ? true
        : activeView === "Unassigned evidence"
        ? !e.caseId
        : !!e.caseId;
    const matchesSearch =
      !search ||
      e.name.toLowerCase().includes(search.toLowerCase()) ||
      e.alias.toLowerCase().includes(search.toLowerCase());
    return matchesType && matchesView && matchesSearch;
  });

  const allSelected =
    filtered.length > 0 && filtered.every((e) => selected.has(e.id));

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((e) => e.id)));
    }
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <div
      className="min-h-screen p-5 font-sans"
      style={{ backgroundColor: "#0f1623", color: "#e2e8f0" }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Evidence Library</h1>
          <p className="text-xs leading-relaxed max-w-md" style={{ color: "#64748b" }}>
            Your{" "}
            <span style={{ color: "#93c5fd" }}>evidence database</span> holds
            every file you can access. Use{" "}
            <span style={{ color: "#93c5fd" }}>Add to case</span> to put files
            on an investigation. Colored markers summarize assignment and review
            state.
          </p>
        </div>
        <div className="flex flex-shrink-0 flex-wrap items-center justify-end gap-2 ml-4">
          <Link
            href="/map"
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all"
            style={{ backgroundColor: "#1a2335", color: "#94a3b8", border: "1px solid #1e2d42" }}
          >
            <MapPin className="h-4 w-4" />
            Location map
          </Link>
          <button
            type="button"
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all"
            style={{ backgroundColor: "#1e40af", border: "1px solid #2563eb" }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#1d4ed8")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#1e40af")}
          >
            <Upload className="h-4 w-4" />
            Upload Evidence
          </button>
        </div>
      </div>

      {/* Search bar */}
      <div className="relative mb-4 mt-4">
        <span
          className="absolute left-3 top-1/2 -translate-y-1/2"
          style={{ color: "#475569" }}
        >
          <Search className="h-4 w-4" />
        </span>
        <input
          type="text"
          placeholder="Search library — names and aliases..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-xl pl-9 pr-4 py-2.5 text-sm outline-none transition-all"
          style={{
            backgroundColor: "#141e2e",
            border: "1px solid #1e2d42",
            color: "#e2e8f0",
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = "#2563eb88")}
          onBlur={(e) => (e.currentTarget.style.borderColor = "#1e2d42")}
        />
      </div>

      {/* Browse by type */}
      <div
        className="rounded-xl p-3 mb-3"
        style={{ backgroundColor: "#141e2e", border: "1px solid #1e2d42" }}
      >
        <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "#475569" }}>
          Browse by type
        </p>
        <p className="text-xs mb-3" style={{ color: "#334155" }}>
          {"Uses each file's stored type. "}
          <span style={{ color: "#475569" }}>Suggested type</span> is set at
          upload; <span style={{ color: "#94a3b8" }}>Confirmed</span> after you
          review.
        </p>
        <div className="flex flex-wrap gap-2">
          {typeFilters.map((t) => (
            <button
              key={t.label}
              onClick={() => setActiveType(t.label)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={
                activeType === t.label
                  ? {
                      backgroundColor: "#1e3a5f",
                      color: "#60a5fa",
                      border: "1px solid #2563eb44",
                    }
                  : {
                      backgroundColor: "#1a2335",
                      color: "#64748b",
                      border: "1px solid #1e2d42",
                    }
              }
            >
              {t.icon && <span>{t.icon}</span>}
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* View tabs */}
      <div className="flex gap-2 mb-4">
        {viewTabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveView(tab)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={
              activeView === tab
                ? {
                    backgroundColor: "#1e3a5f",
                    color: "#60a5fa",
                    border: "1px solid #2563eb44",
                  }
                : {
                    backgroundColor: "#141e2e",
                    color: "#64748b",
                    border: "1px solid #1e2d42",
                  }
            }
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Evidence list panel */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ border: "1px solid #1e2d42" }}
      >
        {/* Panel header */}
        <div
          className="px-4 py-3"
          style={{
            backgroundColor: "#141e2e",
            borderBottom: "1px solid #1e2d42",
          }}
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-white">
                {activeView}{" "}
                <span style={{ color: "#475569" }}>({filtered.length})</span>
              </h2>
              <p className="text-xs mt-0.5" style={{ color: "#475569" }}>
                Open a file for embedded viewing, zoom, crop, assign to a case,
                or compare.
              </p>
            </div>
            {selected.size > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs" style={{ color: "#64748b" }}>
                  {selected.size} selected
                </span>
                <button
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                  style={{
                    backgroundColor: "#1e3a5f",
                    color: "#60a5fa",
                    border: "1px solid #2563eb44",
                  }}
                >
                  <Plus className="h-4 w-4" />
                  Add to Case
                </button>
              </div>
            )}
          </div>

          {/* Select all row */}
          <label className="flex items-center gap-2 mt-3 cursor-pointer group">
            <div
              className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0 transition-all"
              style={{
                backgroundColor: allSelected ? "#2563eb" : "transparent",
                border: allSelected ? "1px solid #2563eb" : "1px solid #334155",
              }}
              onClick={toggleAll}
            >
              {allSelected && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} aria-hidden />}
            </div>
            <span className="text-xs" style={{ color: "#64748b" }}>
              Select all in this list
            </span>
          </label>
        </div>

        {/* Items */}
        <div style={{ backgroundColor: "#111827" }}>
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
                style={{ backgroundColor: "#1a2335", border: "1px solid #1e2d42", color: "#475569" }}
              >
                <FileText className="h-5 w-5" />
              </div>
              <p className="text-sm font-medium text-white mb-1">No evidence found</p>
              <p className="text-xs" style={{ color: "#64748b" }}>
                Try a different search or filter.
              </p>
            </div>
          ) : (
            filtered.map((item, i) => {
              const isSelected = selected.has(item.id);
              return (
                <div
                  key={item.id}
                  className="px-4 py-4 transition-all group cursor-pointer"
                  style={{
                    borderBottom: i < filtered.length - 1 ? "1px solid #1a2335" : "none",
                    backgroundColor: isSelected ? "#111f33" : "transparent",
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) e.currentTarget.style.backgroundColor = "#141e2e";
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) e.currentTarget.style.backgroundColor = "transparent";
                  }}
                >
                  <div className="flex items-start gap-3">
                    {/* Checkbox */}
                    <div
                      className="mt-0.5 w-4 h-4 rounded flex items-center justify-center flex-shrink-0 cursor-pointer transition-all"
                      style={{
                        backgroundColor: isSelected ? "#2563eb" : "transparent",
                        border: isSelected ? "1px solid #2563eb" : "1px solid #334155",
                      }}
                      onClick={() => toggleOne(item.id)}
                    >
                      {isSelected && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} aria-hidden />}
                    </div>

                    {/* File icon thumbnail */}
                    <div
                      className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{
                        backgroundColor: "#1a2335",
                        border: "1px dashed #263347",
                        color: "#475569",
                      }}
                    >
                      {typeIconMap[item.type]}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-sm font-semibold text-white truncate mb-0.5 group-hover:text-blue-300 transition-colors"
                        title={item.name}
                      >
                        {item.name}
                      </p>
                      <p className="text-xs mb-2" style={{ color: "#475569" }}>
                        {item.alias}
                      </p>

                      {/* Badges row */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-semibold tracking-wide border ${typeColors[item.type]}`}
                        >
                          {item.type}
                        </span>
                        <span
                          className="px-2 py-0.5 rounded text-xs font-medium border"
                          style={{
                            backgroundColor:
                              item.typeStatus === "Confirmed"
                                ? "#14532d22"
                                : "#78350f22",
                            color:
                              item.typeStatus === "Confirmed"
                                ? "#86efac"
                                : "#fbbf24",
                            borderColor:
                              item.typeStatus === "Confirmed"
                                ? "#16a34a33"
                                : "#d9770633",
                          }}
                        >
                          {item.typeStatus}
                        </span>
                        <span
                          className="px-2 py-0.5 rounded text-xs font-medium border"
                          style={{
                            backgroundColor:
                              item.reviewStatus === "Reviewed"
                                ? "#1e3a5f"
                                : "#1a1a2e",
                            color:
                              item.reviewStatus === "Reviewed"
                                ? "#60a5fa"
                                : "#94a3b8",
                            borderColor:
                              item.reviewStatus === "Reviewed"
                                ? "#2563eb33"
                                : "#334155",
                          }}
                        >
                          {item.reviewStatus}
                        </span>
                        {item.caseId && (
                          <span
                            className="px-2 py-0.5 rounded text-xs font-medium border"
                            style={{
                              backgroundColor: "#1a2335",
                              color: "#64748b",
                              borderColor: "#263347",
                            }}
                          >
                            {item.caseId}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Action row */}
                  <div className="flex items-center gap-2 mt-3 pl-19 ml-[76px]">
                    <button
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                      style={{
                        backgroundColor: "#1a2335",
                        color: "#64748b",
                        border: "1px solid #1e2d42",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = "#e2e8f0";
                        e.currentTarget.style.borderColor = "#334155";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = "#64748b";
                        e.currentTarget.style.borderColor = "#1e2d42";
                      }}
                    >
                      <Brain className="h-3.5 w-3.5" />
                      Send to AI
                    </button>
                    <button
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                      style={{
                        backgroundColor: "#1e2d42",
                        color: "#94a3b8",
                        border: "1px solid #263347",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = "#263347";
                        e.currentTarget.style.color = "#e2e8f0";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = "#1e2d42";
                        e.currentTarget.style.color = "#94a3b8";
                      }}
                    >
                      <Scale className="h-3.5 w-3.5" />
                      Compare
                    </button>
                    <button
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ml-auto"
                      style={{
                        backgroundColor: "#1e40af",
                        color: "#fff",
                        border: "1px solid #2563eb",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#1d4ed8")}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#1e40af")}
                    >
                      <Plus className="h-4 w-4" />
                      Add to Case
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <p className="text-xs mt-3 text-center" style={{ color: "#1e2d42" }}>
        {filtered.length} item{filtered.length !== 1 ? "s" : ""}
      </p>
    </div>
  );
}

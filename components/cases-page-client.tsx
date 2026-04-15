"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronDown, Filter, Folder, Plus, Search, X } from "lucide-react";

export type CasesPageRow = {
  id: string;
  title: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  created_by: string;
  incident_city: string | null;
  incident_state: string | null;
  investigation_started_at: string | null;
  investigation_on_hold_at: string | null;
  assigned_investigators: number;
};

type StatusFilter = "All" | "Created" | "Started" | "On hold";
type InvestigatorFilter = "Any" | "Assigned" | "Unassigned";
type CreatedWindow = "Any" | "30d" | "90d" | "365d";

const statusColors: Record<Exclude<StatusFilter, "All">, string> = {
  Created: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  Started: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  "On hold": "bg-amber-500/15 text-amber-400 border-amber-500/20",
};

const quickFilters: StatusFilter[] = ["All", "Created", "Started", "On hold"];

function caseStatus(c: CasesPageRow): Exclude<StatusFilter, "All"> {
  if (!c.investigation_started_at) return "Created";
  if (c.investigation_on_hold_at) return "On hold";
  return "Started";
}

function formatStamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Unknown";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function matchesCreatedWindow(createdAt: string, window: CreatedWindow): boolean {
  if (window === "Any") return true;
  const ts = Date.parse(createdAt);
  if (!Number.isFinite(ts)) return false;
  const ageMs = Date.now() - ts;
  const maxMs = window === "30d" ? 30 * 24 * 60 * 60 * 1000 : window === "90d" ? 90 * 24 * 60 * 60 * 1000 : 365 * 24 * 60 * 60 * 1000;
  return ageMs <= maxMs;
}

export function CasesPageClient({ rows }: { rows: CasesPageRow[] }) {
  const [keyword, setKeyword] = useState("");
  const [status, setStatus] = useState<StatusFilter>("All");
  const [jurisdiction, setJurisdiction] = useState("");
  const [createdWithin, setCreatedWithin] = useState<CreatedWindow>("Any");
  const [investigatorFilter, setInvestigatorFilter] = useState<InvestigatorFilter>("Any");
  const [showFilters, setShowFilters] = useState(false);

  const filteredCases = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    const j = jurisdiction.trim().toLowerCase();
    return rows.filter((c) => {
      const cStatus = caseStatus(c);
      if (status !== "All" && cStatus !== status) return false;
      if (!matchesCreatedWindow(c.created_at, createdWithin)) return false;
      if (investigatorFilter === "Assigned" && c.assigned_investigators === 0) return false;
      if (investigatorFilter === "Unassigned" && c.assigned_investigators > 0) return false;
      if (j) {
        const place = `${c.incident_city ?? ""} ${c.incident_state ?? ""}`.toLowerCase();
        if (!place.includes(j)) return false;
      }
      if (q) {
        const blob = `${c.title} ${c.description ?? ""} ${c.id}`.toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });
  }, [rows, keyword, status, jurisdiction, createdWithin, investigatorFilter]);

  const activeChips = useMemo(() => {
    const chips: string[] = [];
    if (keyword.trim()) chips.push(`Keyword: ${keyword.trim()}`);
    if (status !== "All") chips.push(`Status: ${status}`);
    if (jurisdiction.trim()) chips.push(`Jurisdiction: ${jurisdiction.trim()}`);
    if (createdWithin !== "Any") chips.push(`Created: ${createdWithin}`);
    if (investigatorFilter !== "Any") chips.push(`Investigators: ${investigatorFilter}`);
    return chips;
  }, [keyword, status, jurisdiction, createdWithin, investigatorFilter]);

  function clearAll() {
    setKeyword("");
    setStatus("All");
    setJurisdiction("");
    setCreatedWithin("Any");
    setInvestigatorFilter("Any");
  }

  function removeChip(chip: string) {
    if (chip.startsWith("Keyword:")) setKeyword("");
    if (chip.startsWith("Status:")) setStatus("All");
    if (chip.startsWith("Jurisdiction:")) setJurisdiction("");
    if (chip.startsWith("Created:")) setCreatedWithin("Any");
    if (chip.startsWith("Investigators:")) setInvestigatorFilter("Any");
  }

  return (
    <div className="min-h-screen p-5 font-sans" style={{ backgroundColor: "#0f1623", color: "#e2e8f0" }}>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="mb-1 text-2xl font-bold text-white">Cases</h1>
          <p className="text-sm" style={{ color: "#94a3b8" }}>
            Investigations you can access.
          </p>
        </div>
        <Link
          href="/cases/new"
          className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-all"
          style={{ backgroundColor: "#1e40af", border: "1px solid #2563eb" }}
        >
          <Plus className="h-4 w-4" />
          New Investigation
        </Link>
      </div>

      <div className="mb-4 flex gap-2">
        {quickFilters.map((f) => (
          <button
            key={f}
            onClick={() => setStatus(f)}
            className="rounded-md px-3 py-1.5 text-xs font-medium transition-all"
            style={
              status === f
                ? { backgroundColor: "#1e3a5f", color: "#60a5fa", border: "1px solid #2563eb44" }
                : { backgroundColor: "#1a2335", color: "#64748b", border: "1px solid #1e2d42" }
            }
          >
            {f}
          </button>
        ))}
        <button
          onClick={() => setShowFilters((s) => !s)}
          className="ml-auto flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all"
          style={{
            backgroundColor: showFilters ? "#1e3a5f" : "#1a2335",
            color: showFilters ? "#60a5fa" : "#64748b",
            border: showFilters ? "1px solid #2563eb44" : "1px solid #1e2d42",
          }}
        >
          <Filter className="h-4 w-4" />
          Filters
          {activeChips.length > 0 ? (
            <span
              className="ml-1 flex h-4 w-4 items-center justify-center rounded-full text-xs font-bold"
              style={{ backgroundColor: "#2563eb", color: "#fff" }}
            >
              {activeChips.length}
            </span>
          ) : null}
        </button>
      </div>

      {activeChips.length > 0 ? (
        <div className="mb-4 flex flex-wrap gap-2">
          {activeChips.map((chip) => (
            <span
              key={chip}
              className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
              style={{ backgroundColor: "#1e3a5f", color: "#93c5fd", border: "1px solid #2563eb33" }}
            >
              {chip}
              <button onClick={() => removeChip(chip)} className="opacity-60 transition-opacity hover:opacity-100">
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
          <button onClick={clearAll} className="rounded-full px-2 py-1 text-xs transition-all" style={{ color: "#64748b" }}>
            Clear all
          </button>
        </div>
      ) : null}

      {showFilters ? (
        <div
          className="mb-4 space-y-3 rounded-xl p-4"
          style={{ backgroundColor: "#141e2e", border: "1px solid #1e2d42" }}
        >
          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: "#64748b" }}>
              Title keyword
            </label>
            <input
              type="text"
              placeholder="Words in title, description, or case id..."
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-sm outline-none transition-all"
              style={{ backgroundColor: "#0f1623", border: "1px solid #1e2d42", color: "#e2e8f0" }}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium" style={{ color: "#64748b" }}>
                Status
              </label>
              <div className="relative">
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as StatusFilter)}
                  className="w-full appearance-none rounded-lg px-3 py-2 pr-7 text-sm outline-none"
                  style={{ backgroundColor: "#0f1623", border: "1px solid #1e2d42", color: "#e2e8f0" }}
                >
                  {quickFilters.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2" style={{ color: "#64748b" }}>
                  <ChevronDown className="h-3.5 w-3.5" />
                </span>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium" style={{ color: "#64748b" }}>
                Jurisdiction
              </label>
              <input
                type="text"
                placeholder="State or city"
                value={jurisdiction}
                onChange={(e) => setJurisdiction(e.target.value)}
                className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                style={{ backgroundColor: "#0f1623", border: "1px solid #1e2d42", color: "#e2e8f0" }}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium" style={{ color: "#64748b" }}>
                Created
              </label>
              <div className="relative">
                <select
                  value={createdWithin}
                  onChange={(e) => setCreatedWithin(e.target.value as CreatedWindow)}
                  className="w-full appearance-none rounded-lg px-3 py-2 pr-7 text-sm outline-none"
                  style={{ backgroundColor: "#0f1623", border: "1px solid #1e2d42", color: "#e2e8f0" }}
                >
                  <option value="Any">Any time</option>
                  <option value="30d">Last 30 days</option>
                  <option value="90d">Last 90 days</option>
                  <option value="365d">Last 365 days</option>
                </select>
                <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2" style={{ color: "#64748b" }}>
                  <ChevronDown className="h-3.5 w-3.5" />
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium" style={{ color: "#64748b" }}>
                Investigator assignment
              </label>
              <div className="relative">
                <select
                  value={investigatorFilter}
                  onChange={(e) => setInvestigatorFilter(e.target.value as InvestigatorFilter)}
                  className="w-full appearance-none rounded-lg px-3 py-2 pr-7 text-sm outline-none"
                  style={{ backgroundColor: "#0f1623", border: "1px solid #1e2d42", color: "#e2e8f0" }}
                >
                  <option value="Any">Any</option>
                  <option value="Assigned">Has assigned investigators</option>
                  <option value="Unassigned">No assigned investigators</option>
                </select>
                <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2" style={{ color: "#64748b" }}>
                  <ChevronDown className="h-3.5 w-3.5" />
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl" style={{ border: "1px solid #1e2d42" }}>
        <div
          className="flex items-center justify-between px-4 py-3"
          style={{ backgroundColor: "#141e2e", borderBottom: "1px solid #1e2d42" }}
        >
          <div>
            <h2 className="text-sm font-semibold text-white">Investigations</h2>
            <p className="mt-0.5 text-xs" style={{ color: "#64748b" }}>
              Open a case file you created or contribute to.
            </p>
          </div>
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: "#64748b" }}>
              <Search className="h-4 w-4" />
            </span>
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="Search cases..."
              className="w-44 rounded-lg py-1.5 pl-8 pr-3 text-xs outline-none"
              style={{ backgroundColor: "#0f1623", border: "1px solid #1e2d42", color: "#e2e8f0" }}
            />
          </div>
        </div>

        {filteredCases.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16" style={{ backgroundColor: "#111827" }}>
            <div
              className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl"
              style={{ backgroundColor: "#1a2335", border: "1px solid #1e2d42" }}
            >
              <Folder className="h-5 w-5" />
            </div>
            <p className="mb-1 text-sm font-medium text-white">No cases yet</p>
            <p className="mb-4 text-xs" style={{ color: "#64748b" }}>
              Start an investigation to get going.
            </p>
            <Link
              href="/cases/new"
              className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white"
              style={{ backgroundColor: "#1e40af" }}
            >
              <Plus className="h-4 w-4" />
              New Investigation
            </Link>
          </div>
        ) : (
          <div style={{ backgroundColor: "#111827" }}>
            {filteredCases.map((c, i) => {
              const statusLabel = caseStatus(c);
              const jurisdictionLabel = [c.incident_city, c.incident_state].filter(Boolean).join(", ");
              return (
                <div
                  key={c.id}
                  className="group flex cursor-pointer items-start gap-3 px-4 py-4 transition-all"
                  style={{ borderBottom: i < filteredCases.length - 1 ? "1px solid #1e2d42" : "none" }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#141e2e")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                >
                  <div
                    className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg"
                    style={{ backgroundColor: "#1a2335", border: "1px solid #1e2d42", color: "#60a5fa" }}
                  >
                    <Folder className="h-5 w-5" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      <span className="text-xs font-mono" style={{ color: "#475569" }}>
                        {c.id}
                      </span>
                      <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${statusColors[statusLabel]}`}>
                        {statusLabel}
                      </span>
                    </div>
                    <p className="mb-1.5 text-sm font-semibold leading-snug text-white transition-colors group-hover:text-blue-300">
                      {c.title}
                    </p>
                    {c.description ? (
                      <p className="mb-1.5 line-clamp-2 text-xs" style={{ color: "#94a3b8" }}>
                        {c.description}
                      </p>
                    ) : null}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs" style={{ color: "#64748b" }}>
                      {jurisdictionLabel ? (
                        <span>
                          <span style={{ color: "#475569" }}>Jurisdiction:</span>{" "}
                          <span style={{ color: "#94a3b8" }}>{jurisdictionLabel}</span>
                        </span>
                      ) : null}
                      <span>
                        <span style={{ color: "#475569" }}>Investigators:</span>{" "}
                        <span style={{ color: "#94a3b8" }}>{c.assigned_investigators}</span>
                      </span>
                      <span>
                        <span style={{ color: "#475569" }}>Created:</span>{" "}
                        <span style={{ color: "#94a3b8" }}>{formatStamp(c.created_at)}</span>
                      </span>
                      <span>
                        <span style={{ color: "#475569" }}>Updated:</span>{" "}
                        <span style={{ color: "#94a3b8" }}>{formatStamp(c.updated_at)}</span>
                      </span>
                    </div>
                  </div>

                  <div className="flex-shrink-0 text-right">
                    <p className="mb-2 text-xs" style={{ color: "#475569" }}>
                      by {c.created_by.slice(0, 8)}...
                    </p>
                    <Link
                      href={`/cases/${c.id}`}
                      className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white opacity-0 transition-all group-hover:opacity-100"
                      style={{ backgroundColor: "#1e3a5f", border: "1px solid #2563eb44", color: "#60a5fa" }}
                    >
                      Open Case
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <p className="mt-3 text-center text-xs" style={{ color: "#1e2d42" }}>
        {filteredCases.length} investigation{filteredCases.length !== 1 ? "s" : ""}
      </p>
    </div>
  );
}

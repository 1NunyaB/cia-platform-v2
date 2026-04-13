"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { resolveSourcePlatformForStorage } from "@/lib/source-platform";
import { ChevronDown, Loader2 } from "lucide-react";

type PlatformRow = { id: string; label: string; normalized: string };

function useBlurCanonicalizeDelay() {
  const ignoreBlurRef = useRef(false);
  const scheduleCanonicalize = useCallback((fn: () => void) => {
    window.setTimeout(() => {
      if (ignoreBlurRef.current) return;
      fn();
    }, 120);
  }, []);
  return { ignoreBlurRef, scheduleCanonicalize };
}

export function SourcePlatformCombobox({
  id,
  name = "source_platform",
  variant,
  defaultValue,
  "aria-describedby": ariaDescribedBy,
}: {
  id: string;
  name?: string;
  variant: "default" | "intake";
  defaultValue?: string;
  "aria-describedby"?: string;
}) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { ignoreBlurRef, scheduleCanonicalize } = useBlurCanonicalizeDelay();
  const [query, setQuery] = useState(defaultValue?.trim() ?? "");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<PlatformRow[]>([]);
  const [highlight, setHighlight] = useState(0);

  const inputClass =
    "border-input bg-form-field text-sm text-form-field-foreground placeholder:text-form-field-placeholder";

  const panelClass =
    "pointer-events-auto absolute z-[200] mt-1 max-h-56 w-full overflow-auto rounded-md border border-input bg-form-field py-1 text-form-field-foreground shadow-lg";

  const itemClass = (active: boolean) =>
    cn(
      "w-full cursor-pointer px-3 py-2 text-left text-sm text-black",
      active ? "bg-slate-100 text-black" : "hover:bg-slate-50",
    );

  const fetchOptions = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/source-platforms?q=${encodeURIComponent(q)}`, { credentials: "same-origin" });
      const json = (await res.json()) as { platforms?: PlatformRow[]; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Failed to load");
      setOptions(json.platforms ?? []);
    } catch {
      setOptions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void fetchOptions(query);
    }, 220);
    return () => window.clearTimeout(t);
  }, [query, fetchOptions]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const resolvedPreview = query.trim() ? resolveSourcePlatformForStorage(query) : null;
  const hasExactOption =
    resolvedPreview &&
    options.some(
      (o) =>
        o.normalized === resolvedPreview.normalized ||
        o.label.toLowerCase() === resolvedPreview.label.toLowerCase(),
    );

  const addNewLabel =
    resolvedPreview && resolvedPreview.normalized && !hasExactOption ? resolvedPreview.label : null;

  function selectPlatformRow(row: PlatformRow) {
    ignoreBlurRef.current = true;
    setQuery(row.label);
    setOpen(false);
    window.setTimeout(() => {
      ignoreBlurRef.current = false;
    }, 220);
  }

  async function selectAddNew() {
    if (!addNewLabel) return;
    ignoreBlurRef.current = true;
    setLoading(true);
    try {
      const res = await fetch("/api/source-platforms", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: query.trim() }),
      });
      const json = (await res.json()) as { label?: string; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Could not save");
      const label = json.label ?? addNewLabel;
      setQuery(label);
      setOpen(false);
      void fetchOptions("");
    } catch {
      /* keep query; user can retry */
    } finally {
      setLoading(false);
      window.setTimeout(() => {
        ignoreBlurRef.current = false;
      }, 220);
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open && (e.key === "ArrowDown" || e.key === "Enter")) {
      setOpen(true);
      return;
    }
    const rows = options.length + (addNewLabel ? 1 : 0);
    if (e.key === "Escape") {
      setOpen(false);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, Math.max(0, rows - 1)));
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    }
    if (e.key === "Enter" && open) {
      e.preventDefault();
      if (addNewLabel && highlight === options.length) {
        void selectAddNew();
        return;
      }
      const row = options[highlight];
      if (row) selectPlatformRow(row);
    }
  }

  return (
    <div ref={rootRef} className="relative z-[100]">
      <div className="relative">
        <Input
          ref={inputRef}
          id={id}
          name={name}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-describedby={ariaDescribedBy}
          autoComplete="off"
          placeholder="Search or type a platform (e.g. CNN, YouTube, C-SPAN)"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setHighlight(0);
          }}
          onFocus={() => {
            setOpen(true);
            void fetchOptions(query);
          }}
          onBlur={() => {
            const t = query.trim();
            if (!t) return;
            scheduleCanonicalize(() => {
              if (ignoreBlurRef.current) return;
              const cur = inputRef.current?.value ?? query;
              const trimmed = cur.trim();
              if (!trimmed) return;
              const { label } = resolveSourcePlatformForStorage(trimmed);
              setQuery(label);
            });
          }}
          onKeyDown={onKeyDown}
          className={cn("pr-9", inputClass)}
        />
        <button
          type="button"
          tabIndex={-1}
          className={cn(
            "absolute right-1 top-1/2 -translate-y-1/2 rounded p-1",
            "text-muted-foreground hover:bg-muted",
          )}
          aria-label="Show platform options"
          onMouseDown={(e) => {
            e.preventDefault();
            setOpen((o) => !o);
            inputRef.current?.focus();
          }}
        >
          <ChevronDown className="h-4 w-4" />
        </button>
      </div>

      {open ? (
        <div
          id={listId}
          role="listbox"
          className={panelClass}
          onMouseDownCapture={(e) => {
            e.preventDefault();
          }}
        >
          {loading && options.length === 0 ? (
            <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading…
            </div>
          ) : null}
          {options.map((row, i) => (
            <div
              key={row.id}
              role="option"
              aria-selected={highlight === i}
              className={itemClass(highlight === i)}
              onMouseEnter={() => setHighlight(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                selectPlatformRow(row);
              }}
            >
              {row.label}
            </div>
          ))}
          {addNewLabel ? (
            <div
              role="option"
              aria-selected={highlight === options.length}
              className={cn(
                itemClass(highlight === options.length),
                "border-t border-dashed",
                "border-border",
              )}
              onMouseEnter={() => setHighlight(options.length)}
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                void selectAddNew();
              }}
            >
              Add “{addNewLabel}”
            </div>
          ) : null}
          {!loading && options.length === 0 && !addNewLabel && query.trim() ? (
            <div className="px-3 py-2 text-xs text-muted-foreground">No matches. Type a name and pick “Add …”.</div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

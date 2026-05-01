"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { resolveFreeformCatalogLabel } from "@/lib/freeform-catalog-label";
import { ChevronDown, Loader2 } from "lucide-react";

type RoleRow = { id: string; label: string; normalized: string };

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

export function PersonRoleCombobox({
  id,
  value,
  onChange,
  className,
  placeholder = "Search or type a role",
  "aria-describedby": ariaDescribedBy,
}: {
  id: string;
  value: string;
  onChange: (next: string) => void;
  className?: string;
  placeholder?: string;
  "aria-describedby"?: string;
}) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { ignoreBlurRef, scheduleCanonicalize } = useBlurCanonicalizeDelay();
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<RoleRow[]>([]);
  const [highlight, setHighlight] = useState(0);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  const inputClass = cn(
    "border-input bg-form-field text-sm text-form-field-foreground placeholder:text-form-field-placeholder",
    className,
  );

  const panelClass =
    "pointer-events-auto absolute z-[220] mt-1 max-h-56 w-full overflow-auto rounded-md border border-input bg-form-field py-1 text-form-field-foreground shadow-lg";

  const itemClass = (active: boolean) =>
    cn(
      "w-full cursor-pointer px-3 py-2 text-left text-sm text-black",
      active ? "bg-slate-100 text-black" : "hover:bg-slate-50",
    );

  const fetchOptions = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/person-role-labels?q=${encodeURIComponent(q)}`, {
        credentials: "same-origin",
      });
      const json = (await res.json()) as { roles?: RoleRow[]; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Failed to load");
      setOptions(json.roles ?? []);
    } catch {
      setOptions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const delay = query.trim() ? 180 : 0;
    const t = window.setTimeout(() => {
      void fetchOptions(query);
    }, delay);
    return () => window.clearTimeout(t);
  }, [open, query, fetchOptions]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const resolvedPreview = query.trim() ? resolveFreeformCatalogLabel(query) : null;
  const hasExactOption =
    resolvedPreview &&
    options.some(
      (o) =>
        o.normalized === resolvedPreview.normalized ||
        o.label.toLowerCase() === resolvedPreview.label.toLowerCase(),
    );

  const addNewLabel =
    resolvedPreview && resolvedPreview.normalized && !hasExactOption ? resolvedPreview.label : null;

  function selectRow(row: RoleRow) {
    ignoreBlurRef.current = true;
    setQuery(row.label);
    onChange(row.label);
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
      const res = await fetch("/api/person-role-labels", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: query.trim() }),
      });
      const json = (await res.json()) as { label?: string; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Could not save");
      const label = json.label ?? addNewLabel;
      setQuery(label);
      onChange(label);
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
      if (row) selectRow(row);
    }
  }

  return (
    <div ref={rootRef} className="relative z-[120]">
      <div className="relative">
        <Input
          ref={inputRef}
          id={id}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-describedby={ariaDescribedBy}
          autoComplete="off"
          placeholder={placeholder}
          value={query}
          onChange={(e) => {
            const v = e.target.value;
            setQuery(v);
            onChange(v);
            setOpen(true);
            setHighlight(0);
          }}
          onFocus={() => {
            setOpen(true);
            void fetchOptions(query);
          }}
          onBlur={() => {
            const t = query.trim();
            if (!t) {
              onChange("");
              return;
            }
            scheduleCanonicalize(() => {
              if (ignoreBlurRef.current) return;
              const cur = inputRef.current?.value ?? query;
              const trimmed = cur.trim();
              if (!trimmed) {
                onChange("");
                return;
              }
              const { label } = resolveFreeformCatalogLabel(trimmed);
              setQuery(label);
              onChange(label);
              void fetch("/api/person-role-labels", {
                method: "POST",
                credentials: "same-origin",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ label }),
              }).catch(() => {
                /* catalog optional; role still on incident */
              });
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
          aria-label="Show role options"
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
                selectRow(row);
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
            <div className="px-3 py-2 text-xs text-muted-foreground">No matches. Type a role and pick “Add …”.</div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

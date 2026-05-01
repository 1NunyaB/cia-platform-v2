"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { CaseIncident } from "@/lib/case-directory";
import { Plus, Trash2 } from "lucide-react";

const inputClass = "border-input bg-form-field text-form-field-foreground";

function IncidentRowEditor({
  row,
  onChange,
  onRemove,
}: {
  row: CaseIncident;
  onChange: (next: CaseIncident) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-md border border-border bg-panel/40 p-3 space-y-3">
      <div className="flex justify-end">
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={onRemove} aria-label="Remove incident">
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      <div className="space-y-2">
        <Label className="text-foreground">Description</Label>
        <Textarea
          className={`${inputClass} min-h-[88px]`}
          placeholder="What happened, where, and any key facts for this incident."
          value={row.description}
          onChange={(e) => onChange({ ...row, description: e.target.value })}
        />
      </div>
      <div className="space-y-2 max-w-[14rem]">
        <Label className="text-foreground">Date (optional)</Label>
        <Input
          className={inputClass}
          type="date"
          value={row.date ?? ""}
          onChange={(e) => onChange({ ...row, date: e.target.value.trim() ? e.target.value : null })}
        />
      </div>
    </div>
  );
}

export function CaseIncidentRows({
  value,
  onChange,
}: {
  value: CaseIncident[];
  onChange: (next: CaseIncident[]) => void;
}) {
  const rows = value;

  return (
    <div className="space-y-3 rounded-md border border-border/80 bg-panel/20 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Incidents</h3>
          <p className="text-xs text-muted-foreground">Add one row per distinct incident or occurrence.</p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onChange([...rows, { description: "", date: null }])}
        >
          <Plus className="h-4 w-4 mr-1" />
          Add incident
        </Button>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No incidents listed yet.</p>
      ) : (
        rows.map((row, i) => (
          <IncidentRowEditor
            key={i}
            row={row}
            onChange={(next) => {
              const copy = [...rows];
              copy[i] = next;
              onChange(copy);
            }}
            onRemove={() => onChange(rows.filter((_, j) => j !== i))}
          />
        ))
      )}
    </div>
  );
}

"use client";

import { useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LegalActionCombobox } from "@/components/legal-action-combobox";
import type { CaseLegalMilestone } from "@/lib/case-directory";
import { legalActionIsConviction } from "@/lib/case-directory";
import {
  joinMonthYear,
  MONTH_SELECT_OPTIONS,
  splitMonthYear,
  YEAR_SELECT_OPTIONS,
} from "@/lib/case-month-year";
import { Plus, Trash2 } from "lucide-react";

const inputClass = "border-input bg-form-field text-form-field-foreground";

const NONE = "__none__";

function MilestoneRow({
  row,
  onChange,
  onRemove,
}: {
  row: CaseLegalMilestone;
  onChange: (next: CaseLegalMilestone) => void;
  onRemove: () => void;
}) {
  const actionFieldId = useId();
  const showSentence = legalActionIsConviction(row.type);

  /** Month/year drafts: `joinMonthYear` only produces a string when both are set, so we keep partial picks locally until then. */
  const parsed = splitMonthYear(row.month_year);
  const [monthDraft, setMonthDraft] = useState(parsed.month);
  const [yearDraft, setYearDraft] = useState(parsed.year);

  useEffect(() => {
    const s = splitMonthYear(row.month_year);
    setMonthDraft(s.month);
    setYearDraft(s.year);
  }, [row.month_year]);

  function pushMonthYear(nextMonth: string, nextYear: string) {
    setMonthDraft(nextMonth);
    setYearDraft(nextYear);
    const my = joinMonthYear(nextMonth, nextYear);
    onChange({ ...row, month_year: my });
  }

  return (
    <div className="rounded-md border border-border bg-panel/40 p-3 space-y-3">
      <div className="flex justify-end">
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={onRemove} aria-label="Remove">
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-2 sm:col-span-1">
          <Label htmlFor={actionFieldId} className="text-foreground">
            Action
          </Label>
          <LegalActionCombobox
            id={actionFieldId}
            value={row.type}
            onChange={(nextType) =>
              onChange({
                ...row,
                type: nextType,
                sentence_detail: legalActionIsConviction(nextType) ? row.sentence_detail : null,
              })
            }
            className={inputClass}
            placeholder="Search saved actions or type a new one"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-foreground">Month</Label>
          <Select
            value={monthDraft || NONE}
            onValueChange={(m) => {
              const nextM = m === NONE ? "" : m;
              pushMonthYear(nextM, yearDraft);
            }}
          >
            <SelectTrigger className={inputClass}>
              <SelectValue placeholder="Month" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>—</SelectItem>
              {MONTH_SELECT_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-foreground">Year</Label>
          <Select
            value={yearDraft || NONE}
            onValueChange={(y) => {
              const nextY = y === NONE ? "" : y;
              pushMonthYear(monthDraft, nextY);
            }}
          >
            <SelectTrigger className={inputClass}>
              <SelectValue placeholder="Year" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>—</SelectItem>
              {YEAR_SELECT_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      {showSentence ? (
        <div className="space-y-2">
          <Label className="text-foreground">Sentence (optional)</Label>
          <Textarea
            className={`${inputClass} min-h-[72px]`}
            placeholder="Disposition, term, or notes for this conviction."
            value={row.sentence_detail ?? ""}
            onChange={(e) => onChange({ ...row, sentence_detail: e.target.value.trim() ? e.target.value : null })}
          />
        </div>
      ) : null}
    </div>
  );
}

export function CaseLegalMilestoneRows({
  value,
  onChange,
}: {
  value: CaseLegalMilestone[];
  onChange: (next: CaseLegalMilestone[]) => void;
}) {
  return (
    <div className="space-y-3 rounded-md border border-border/80 bg-panel/20 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Legal actions</h3>
          <p className="text-xs text-muted-foreground">
            Actions use the same saved list as other incidents; pick one or type a new action to save it for next time.
            Stored as month/year (MM/YYYY). Add more rows as needed.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            onChange([
              ...value,
              { type: "Investigation Opened", month_year: "", sentence_detail: null },
            ])
          }
        >
          <Plus className="h-4 w-4 mr-1" />
          Add legal action
        </Button>
      </div>
      {value.length === 0 ? (
        <p className="text-sm text-muted-foreground">No milestones yet.</p>
      ) : (
        value.map((row, i) => (
          <MilestoneRow
            key={i}
            row={row}
            onChange={(next) => {
              const copy = [...value];
              copy[i] = next;
              onChange(copy);
            }}
            onRemove={() => onChange(value.filter((_, j) => j !== i))}
          />
        ))
      )}
    </div>
  );
}

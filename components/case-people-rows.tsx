"use client";

import { useId } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { CasePerson } from "@/lib/case-directory";
import { PersonNameCombobox } from "@/components/person-name-combobox";
import { PersonRoleCombobox } from "@/components/person-role-combobox";
import { Plus, Trash2 } from "lucide-react";

const inputClass = "border-input bg-form-field text-form-field-foreground";

function PersonRowEditor({
  row,
  onChange,
  onRemove,
}: {
  row: CasePerson;
  onChange: (next: CasePerson) => void;
  onRemove: () => void;
}) {
  const nameFieldId = useId();
  const roleFieldId = useId();

  return (
    <div className="rounded-md border border-border bg-panel/40 p-3 space-y-3">
      <div className="flex justify-end">
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={onRemove} aria-label="Remove person">
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={nameFieldId} className="text-foreground">
            Name
          </Label>
          <PersonNameCombobox
            id={nameFieldId}
            value={row.name}
            onChange={(name) => onChange({ ...row, name })}
            className={inputClass}
            placeholder="Search saved names or type a new name"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={roleFieldId} className="text-foreground">
            Role
          </Label>
          <PersonRoleCombobox
            id={roleFieldId}
            value={row.role}
            onChange={(role) => onChange({ ...row, role })}
            className={inputClass}
            placeholder="Search saved roles or type a new role"
          />
        </div>
      </div>
    </div>
  );
}

export function CasePeopleRows({
  value,
  onChange,
}: {
  value: CasePerson[];
  onChange: (next: CasePerson[]) => void;
}) {
  const rows = value;

  return (
    <div className="space-y-3 rounded-md border border-border/80 bg-panel/20 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-foreground">People</h3>
          <p className="text-xs text-muted-foreground">
            Names and roles use the same saved lists as other incidents; pick one or type a new value to save it for next time.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onChange([...rows, { name: "", role: "Victim/Accuser" }])}
        >
          <Plus className="h-4 w-4 mr-1" />
          Add person
        </Button>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No people listed yet.</p>
      ) : (
        rows.map((row, i) => (
          <PersonRowEditor
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

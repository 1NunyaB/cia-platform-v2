"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { CaseVisibility } from "@/types";

export function CreateCaseDialog({
  children,
  disabled,
}: {
  children: React.ReactNode;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<CaseVisibility>("private");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submitGuard = useRef(false);
  const idempotencyKeyRef = useRef(crypto.randomUUID());

  useEffect(() => {
    if (open) {
      idempotencyKeyRef.current = crypto.randomUUID();
    }
  }, [open]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitGuard.current) return;
    submitGuard.current = true;
    setError(null);
    setLoading(true);
    const res = await fetch("/api/cases", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKeyRef.current,
      },
      body: JSON.stringify({ title, description: description || null, visibility }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      submitGuard.current = false;
      idempotencyKeyRef.current = crypto.randomUUID();
      const err = (data as { error?: unknown }).error;
      setError(typeof err === "string" ? err : JSON.stringify(err ?? "Failed to create case"));
      return;
    }
    // Success: keep submitGuard true — dialog closing must not allow a second POST.
    setOpen(false);
    setTitle("");
    setDescription("");
    setVisibility("private");
    router.push(`/cases/${(data as { id: string }).id}`);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild disabled={disabled}>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-md gap-0 overflow-hidden p-0 sm:max-w-md">
        <div className="border-b border-border/80 bg-muted/10 px-6 py-5">
          <DialogHeader>
            <DialogTitle>New case</DialogTitle>
            <DialogDescription>
              Create an investigation file. You can add evidence and structured entities afterward.
            </DialogDescription>
          </DialogHeader>
        </div>
        <form onSubmit={onSubmit} className="space-y-4 px-6 py-5">
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="create-case-title">Title</Label>
            <Input
              id="create-case-title"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Short, operational title"
              className="bg-background/60"
              autoComplete="off"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="create-case-desc">Summary / scope</Label>
            <Textarea
              id="create-case-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="What are you establishing or disproving?"
              className="resize-y bg-background/60 min-h-[88px]"
            />
          </div>
          <div className="space-y-2">
            <Label>Visibility</Label>
            <Select value={visibility} onValueChange={(v) => setVisibility(v as CaseVisibility)}>
              <SelectTrigger className="bg-background/60">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="private">Private — workspace only</SelectItem>
                <SelectItem value="team">Team — same as private in MVP</SelectItem>
                <SelectItem value="public">Public — listed on /explore</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter className="gap-2 pt-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Creating…" : "Create case"}
            </Button>
          </DialogFooter>
          <p className="text-center text-xs text-muted-foreground">
            Prefer a full page?{" "}
            <Link href="/cases/new" className="text-primary underline-offset-4 hover:underline">
              Open expanded form
            </Link>
          </p>
        </form>
      </DialogContent>
    </Dialog>
  );
}

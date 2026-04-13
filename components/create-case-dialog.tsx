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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SimilarCasesModal } from "@/components/similar-cases-modal";
import { fetchCaseSuggestions } from "@/lib/create-case-client";
import type { CaseSimilarSuggestion } from "@/services/case-suggestions";

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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submitGuard = useRef(false);
  const idempotencyKeyRef = useRef(crypto.randomUUID());
  const [similarOpen, setSimilarOpen] = useState(false);
  const [similarCases, setSimilarCases] = useState<CaseSimilarSuggestion[]>([]);

  useEffect(() => {
    if (open) {
      idempotencyKeyRef.current = crypto.randomUUID();
      submitGuard.current = false;
    }
  }, [open]);

  function resetForm() {
    setTitle("");
    setDescription("");
  }

  async function doPostCase() {
    if (submitGuard.current) return;
    submitGuard.current = true;
    setSimilarOpen(false);
    setError(null);
    setLoading(true);
    const res = await fetch("/api/cases", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKeyRef.current,
      },
      body: JSON.stringify({ title, description: description || null }),
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
    setOpen(false);
    setSimilarOpen(false);
    resetForm();
    router.push(`/cases/${(data as { id: string }).id}`);
    router.refresh();
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitGuard.current && !similarOpen) return;
    setError(null);
    setLoading(true);

    try {
      const sug = await fetchCaseSuggestions(title);
      if (sug?.exactMatch) {
        setLoading(false);
        setOpen(false);
        resetForm();
        router.push(`/cases/${sug.exactMatch.id}`);
        router.refresh();
        return;
      }
      if (sug && sug.similar.length > 0) {
        setSimilarCases(sug.similar);
        setSimilarOpen(true);
        setLoading(false);
        return;
      }
    } catch {
      // continue to create if suggestions fail
    }

    await doPostCase();
  }

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild disabled={disabled}>
          {children}
        </DialogTrigger>
        <DialogContent className="max-w-md gap-0 overflow-hidden p-0 sm:max-w-md">
          <div className="border-b border-border/80 bg-muted/10 px-6 py-5">
            <DialogHeader>
              <DialogTitle>New investigation</DialogTitle>
              <DialogDescription>
                Start a shared investigation. Others can participate when they have access; sign-in is required for case
                contributions so Row Level Security and activity history can use your account id — it is not about
                excluding collaborators.
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
                className="resize-y min-h-[88px]"
              />
            </div>
            <DialogFooter className="gap-2 pt-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading || similarOpen}>
                {loading ? "Checking…" : "Continue"}
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

      <SimilarCasesModal
        open={similarOpen}
        onOpenChange={setSimilarOpen}
        draftTitle={title}
        suggestions={similarCases}
        busy={loading}
        onJoin={(caseId) => {
          setSimilarOpen(false);
          setOpen(false);
          resetForm();
          router.push(`/cases/${caseId}`);
          router.refresh();
        }}
        onCreateAnyway={() => {
          void doPostCase();
        }}
      />
    </>
  );
}

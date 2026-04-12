"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { CaseVisibility } from "@/types";

export default function NewCasePage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<CaseVisibility>("private");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submitGuard = useRef(false);
  const idempotencyKeyRef = useRef(crypto.randomUUID());

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
      setError(JSON.stringify((data as { error?: unknown }).error ?? "Failed"));
      return;
    }
    // Success: keep submitGuard true so this page cannot POST again (e.g. double Enter / race).
    router.push(`/cases/${(data as { id: string }).id}`);
    router.refresh();
  }

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <Link href="/cases" className="text-sm text-muted-foreground hover:underline">
          ← Cases
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">New case</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Case details</CardTitle>
          <CardDescription>Visibility controls who can see the case in lists and search.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Visibility</Label>
              <Select value={visibility} onValueChange={(v) => setVisibility(v as CaseVisibility)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="private">Private (members only)</SelectItem>
                  <SelectItem value="team">Team (members — same as private in MVP)</SelectItem>
                  <SelectItem value="public">Public (browseable)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" disabled={loading}>
              {loading ? "Creating…" : "Create case"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function InvestigatorIdentitySettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [optIn, setOptIn] = useState(false);
  const [alias, setAlias] = useState("");
  const [tagline, setTagline] = useState("");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const res = await fetch("/api/profile/investigator");
      const data = await res.json().catch(() => ({}));
      if (!cancelled && res.ok) {
        setOptIn(Boolean(data.investigator_opt_in));
        setAlias(String(data.investigator_alias ?? ""));
        setTagline(String(data.investigator_tagline ?? ""));
        const u = (data.investigator_avatar_url as string | null)?.trim();
        setAvatarPreview(u || null);
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const res = await fetch("/api/profile/investigator", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        investigator_opt_in: optIn,
        investigator_alias: alias,
        investigator_tagline: tagline,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError((data as { error?: string }).error ?? "Could not save");
      return;
    }
    window.location.reload();
  }

  async function onAvatarFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !optIn) return;
    setError(null);
    setAvatarBusy(true);
    const fd = new FormData();
    fd.set("file", file);
    const res = await fetch("/api/profile/investigator/avatar", {
      method: "POST",
      body: fd,
    });
    const data = await res.json().catch(() => ({}));
    setAvatarBusy(false);
    if (!res.ok) {
      setError((data as { error?: string }).error ?? "Could not upload avatar");
      return;
    }
    const url = (data as { investigator_avatar_url?: string }).investigator_avatar_url;
    if (typeof url === "string") setAvatarPreview(url);
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  return (
    <form onSubmit={onSave} className="space-y-4 max-w-lg">
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <label className="flex items-start gap-2 text-sm cursor-pointer">
        <input
          type="checkbox"
          className="mt-1"
          checked={optIn}
          onChange={(e) => setOptIn(e.target.checked)}
        />
        <span>
          <span className="font-medium text-foreground">Show me on the Investigators wall</span>
          <span className="block text-xs text-muted-foreground mt-0.5">
            Optional. Uses your investigator alias and avatar in chat and comments when enabled — not your legal name.
          </span>
        </span>
      </label>
      <div className="space-y-2">
        <Label htmlFor="inv-alias">Investigator alias</Label>
        <Input
          id="inv-alias"
          value={alias}
          onChange={(e) => setAlias(e.target.value)}
          placeholder="e.g. BlueNotebook"
          disabled={!optIn}
          required={optIn}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="inv-avatar-file">Avatar image</Label>
        <p className="text-xs text-muted-foreground">
          Upload a square image (JPEG, PNG, WebP, or GIF, max 2 MB). No URL entry — file upload only.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          {avatarPreview ? (
            <img
              src={avatarPreview}
              alt=""
              className="h-16 w-16 rounded-full border border-border object-cover bg-muted"
            />
          ) : (
            <div className="h-16 w-16 rounded-full border border-dashed border-border bg-muted/50" aria-hidden />
          )}
          <Input
            id="inv-avatar-file"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            disabled={!optIn || avatarBusy}
            className="max-w-xs cursor-pointer border-input bg-form-field text-form-field-foreground file:mr-3 file:rounded file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:text-black"
            onChange={(e) => void onAvatarFile(e)}
          />
        </div>
        {avatarBusy ? <p className="text-xs text-muted-foreground">Uploading…</p> : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="inv-tag">Tagline or role (optional)</Label>
        <Textarea
          id="inv-tag"
          value={tagline}
          onChange={(e) => setTagline(e.target.value)}
          rows={2}
          placeholder="Short line under your alias on the wall"
          disabled={!optIn}
        />
      </div>
      <Button type="submit" disabled={saving}>
        {saving ? "Saving…" : "Save investigator identity"}
      </Button>
    </form>
  );
}

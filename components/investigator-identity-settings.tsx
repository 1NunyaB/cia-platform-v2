"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { InvestigatorIdentityProfile } from "@/lib/investigator-profile";

const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

type PatchResponse = {
  ok?: boolean;
  error?: string;
  profile?: InvestigatorIdentityProfile;
};

export function InvestigatorIdentitySettings({
  onIdentitySaved,
  onAfterPersist,
}: {
  onIdentitySaved?: (profile: InvestigatorIdentityProfile) => void;
  onAfterPersist?: () => void;
}) {
  const [loading, setLoading] = useState(true);
  /** GET returned 401 — do not allow save/upload (guests never mount this; stale session). */
  const [sessionInvalid, setSessionInvalid] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [optIn, setOptIn] = useState(false);
  const [alias, setAlias] = useState("");
  const [tagline, setTagline] = useState("");
  /** Display URL: server public URL or a temporary object URL for a staged file. */
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [pendingAvatarFile, setPendingAvatarFile] = useState<File | null>(null);
  const stagedObjectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/profile/investigator", { credentials: "same-origin" });
      const data = await res.json().catch(() => ({}));
      if (!cancelled) {
        if (res.ok) {
          setOptIn(Boolean(data.investigator_opt_in));
          setAlias(String(data.investigator_alias ?? ""));
          setTagline(String(data.investigator_tagline ?? ""));
          const u = (data.investigator_avatar_url as string | null)?.trim();
          setAvatarPreview(u || null);
          setPendingAvatarFile(null);
          if (stagedObjectUrlRef.current) {
            URL.revokeObjectURL(stagedObjectUrlRef.current);
            stagedObjectUrlRef.current = null;
          }
        } else if (res.status === 401) {
          setSessionInvalid(true);
          setError("Session expired — sign in again.");
        } else {
          setError((data as { error?: string }).error ?? "Could not load investigator profile.");
        }
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (stagedObjectUrlRef.current) {
        URL.revokeObjectURL(stagedObjectUrlRef.current);
      }
    };
  }, []);

  function stageAvatarFile(file: File) {
    if (!ALLOWED.has(file.type)) {
      setError("Use JPEG, PNG, WebP, or GIF for your avatar image.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("Image must be 2 MB or smaller.");
      return;
    }
    setError(null);
    setSuccess(null);
    if (stagedObjectUrlRef.current) {
      URL.revokeObjectURL(stagedObjectUrlRef.current);
      stagedObjectUrlRef.current = null;
    }
    setPendingAvatarFile(file);
    const ou = URL.createObjectURL(file);
    stagedObjectUrlRef.current = ou;
    setAvatarPreview(ou);
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (sessionInvalid) return;
    setError(null);
    setSuccess(null);
    if (optIn && !alias.trim()) {
      setError(
        'Enter an investigator alias to appear on the wall, or turn off "Show me on the Investigators wall".',
      );
      return;
    }
    if (pendingAvatarFile) {
      if (!ALLOWED.has(pendingAvatarFile.type)) {
        setError("Use JPEG, PNG, WebP, or GIF for your avatar image.");
        return;
      }
      if (pendingAvatarFile.size > MAX_BYTES) {
        setError("Image must be 2 MB or smaller.");
        return;
      }
    }

    setSaving(true);
    try {
      if (pendingAvatarFile) {
        const fd = new FormData();
        fd.set("file", pendingAvatarFile);
        const up = await fetch("/api/profile/investigator/avatar", {
          method: "POST",
          body: fd,
          credentials: "same-origin",
        });
        const upData = await up.json().catch(() => ({}));
        if (!up.ok) {
          setError((upData as { error?: string }).error ?? "Could not upload avatar");
          return;
        }
        const url = (upData as { investigator_avatar_url?: string }).investigator_avatar_url;
        if (typeof url === "string" && url.trim()) {
          setAvatarPreview(url.trim());
        }
        if (stagedObjectUrlRef.current) {
          URL.revokeObjectURL(stagedObjectUrlRef.current);
          stagedObjectUrlRef.current = null;
        }
        setPendingAvatarFile(null);
      }

      const res = await fetch("/api/profile/investigator", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          investigator_opt_in: optIn,
          investigator_alias: alias,
          investigator_tagline: tagline,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as PatchResponse;
      if (!res.ok) {
        setError(data.error ?? "Could not save");
        return;
      }
      if (data.profile && onIdentitySaved) {
        onIdentitySaved(data.profile);
      }
      setSuccess("Saved investigator identity.");
      onAfterPersist?.();
    } finally {
      setSaving(false);
    }
  }

  function onAvatarFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (sessionInvalid) return;
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    stageAvatarFile(file);
  }

  const disabled = saving || sessionInvalid;

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  return (
    <form onSubmit={(ev) => void onSave(ev)} className="space-y-4 max-w-lg">
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {success ? (
        <Alert className="border-emerald-500/40 bg-emerald-500/10 text-foreground">
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      ) : null}
      <label className="flex items-start gap-2 text-sm cursor-pointer">
        <input
          type="checkbox"
          className="mt-1"
          checked={optIn}
          disabled={disabled}
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
          required={optIn}
          aria-required={optIn}
          disabled={disabled}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="inv-avatar-file">Avatar image</Label>
        <p className="text-xs text-muted-foreground">
          JPEG, PNG, WebP, or GIF, max 2 MB. Stored in the avatars bucket at{" "}
          <code className="text-[11px]">investigators/avatars/&lt;your-user-id&gt;/…</code> (not with evidence files).
          {pendingAvatarFile ? (
            <span className="block mt-1 text-amber-700 dark:text-amber-400">
              New image selected — it will upload when you save.
            </span>
          ) : null}
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
            disabled={disabled}
            className="max-w-xs cursor-pointer border-input bg-form-field text-form-field-foreground file:mr-3 file:rounded file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:text-black"
            onChange={(e) => onAvatarFileChange(e)}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="inv-tag">Tagline or role (optional)</Label>
        <Textarea
          id="inv-tag"
          value={tagline}
          onChange={(e) => setTagline(e.target.value)}
          rows={2}
          placeholder="Short line under your alias on the wall"
          disabled={disabled}
        />
      </div>
      <Button type="submit" disabled={disabled}>
        {saving ? "Saving…" : "Save investigator identity"}
      </Button>
    </form>
  );
}

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function LandingSuggestionBox() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [submittedAt] = useState(() => String(Date.now()));

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setOk(false);
    if (!message.trim()) {
      setError("Message is required.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          message: message.trim(),
          website,
          submittedAt,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not send suggestion.");
        return;
      }
      setMessage("");
      setOk(true);
    } catch {
      setError("Could not send suggestion.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mt-8 rounded-2xl border border-white/10 bg-slate-900/75 p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300">Suggestion Box</p>
      <h2 className="mt-2 text-xl font-semibold tracking-tight text-white">Have an idea or feature request? Tell us.</h2>
      <form onSubmit={onSubmit} className="mt-4 grid gap-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="suggest-name" className="text-slate-100">
              Name (optional)
            </Label>
            <Input
              id="suggest-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="border-white/20 bg-slate-950/70 text-slate-100 placeholder:text-slate-400"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="suggest-email" className="text-slate-100">
              Email (optional)
            </Label>
            <Input
              id="suggest-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="border-white/20 bg-slate-950/70 text-slate-100 placeholder:text-slate-400"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="suggest-message" className="text-slate-100">
            Message
          </Label>
          <Textarea
            id="suggest-message"
            required
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Share your idea, feature request, or improvement..."
            className="min-h-[120px] border-white/20 bg-slate-950/70 text-slate-100 placeholder:text-slate-400"
          />
        </div>
        <div className="hidden">
          <Label htmlFor="suggest-website">Website</Label>
          <Input id="suggest-website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
        </div>
        {error ? <p className="text-sm text-rose-300">{error}</p> : null}
        {ok ? <p className="text-sm text-emerald-300">Suggestion sent successfully</p> : null}
        <div>
          <Button type="submit" disabled={loading} className="bg-sky-400 text-slate-950 hover:bg-sky-300">
            {loading ? "Sending..." : "Send suggestion"}
          </Button>
        </div>
      </form>
    </section>
  );
}


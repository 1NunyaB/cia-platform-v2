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
    <section
      id="suggest"
      className="mt-12 rounded-3xl border border-red-300/42 bg-[linear-gradient(145deg,rgba(17,27,49,0.96),rgba(33,29,41,0.95))] p-6 shadow-[0_0_36px_rgba(239,68,68,0.18)] sm:p-8"
    >
      <div className="grid gap-6 lg:grid-cols-2 lg:gap-8">
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-yellow-300">Suggestion box</p>
          <h2 className="text-3xl font-bold tracking-tight text-slate-50 [font-family:Georgia,'Times_New_Roman',serif]">
            Got a lead? Tell us.
          </h2>
          <p className="text-sm leading-relaxed text-slate-100">
            Share product ideas, investigation workflow needs, or field feedback. We review submissions for roadmap
            planning and operational improvements.
          </p>
          <p className="text-sm text-yellow-200">
            Direct contact:{" "}
            <a className="underline decoration-yellow-300/70 underline-offset-2 hover:text-yellow-100" href="mailto:fourmiapps@gmail.com">
              fourmiapps@gmail.com
            </a>
          </p>
        </div>

        <form onSubmit={onSubmit} className="grid gap-3">
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
              className="border-white/25 bg-slate-900/70 text-slate-50 placeholder:text-slate-300"
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
              className="border-white/25 bg-slate-900/70 text-slate-50 placeholder:text-slate-300"
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
            className="min-h-[120px] border-white/25 bg-slate-900/70 text-slate-50 placeholder:text-slate-300"
          />
        </div>
        <div className="hidden">
          <Label htmlFor="suggest-website">Website</Label>
          <Input id="suggest-website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
        </div>
        {error ? <p className="text-sm text-rose-300">{error}</p> : null}
        {ok ? <p className="text-sm text-emerald-300">Suggestion sent successfully</p> : null}
        <div>
          <Button
            type="submit"
            disabled={loading}
            className="bg-red-500 text-white shadow-[0_0_26px_rgba(239,68,68,0.5)] transition-all hover:bg-red-400 hover:shadow-[0_0_34px_rgba(248,113,113,0.62)]"
          >
            {loading ? "Sending..." : "Send suggestion"}
          </Button>
        </div>
        </form>
      </div>
    </section>
  );
}


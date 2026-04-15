"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SimilarCasesModal } from "@/components/similar-cases-modal";
import { fetchCaseSuggestions } from "@/lib/create-case-client";
import type { CaseSimilarSuggestion } from "@/services/case-suggestions";

const DESCRIPTION_PLACEHOLDER = `Example structure (edit freely):

Victim(s): [names or roles]
Accused: [name or label]
Alleged crime: [short factual description of what the accused is said to have done]

Add context, sources, or uncertainties below.`;

export default function NewCasePage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [incidentYear, setIncidentYear] = useState("");
  const [incidentCity, setIncidentCity] = useState("");
  const [incidentState, setIncidentState] = useState("");
  const [accusedLabel, setAccusedLabel] = useState("");
  const [victimLabels, setVictimLabels] = useState("");
  const [knownWeapon, setKnownWeapon] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submitGuard = useRef(false);
  const idempotencyKeyRef = useRef(crypto.randomUUID());
  const [similarOpen, setSimilarOpen] = useState(false);
  const [similarCases, setSimilarCases] = useState<CaseSimilarSuggestion[]>([]);
  const [createdCaseId, setCreatedCaseId] = useState<string | null>(null);

  useEffect(() => {
    idempotencyKeyRef.current = crypto.randomUUID();
    submitGuard.current = false;
  }, []);

  function buildCreateBody() {
    let y: number | null = null;
    if (incidentYear.trim()) {
      const n = Number.parseInt(incidentYear.trim(), 10);
      if (Number.isFinite(n) && n >= 1000 && n <= 9999) y = n;
    }
    return {
      title,
      description: description.trim() || null,
      incident_year: y,
      incident_city: incidentCity.trim() || null,
      incident_state: incidentState.trim() || null,
      accused_label: accusedLabel.trim() || null,
      victim_labels: victimLabels.trim() || null,
      known_weapon: knownWeapon.trim() || null,
    };
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
      body: JSON.stringify(buildCreateBody()),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      submitGuard.current = false;
      idempotencyKeyRef.current = crypto.randomUUID();
      setError(JSON.stringify((data as { error?: unknown }).error ?? "Failed"));
      return;
    }
    setCreatedCaseId((data as { id: string }).id);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading || similarOpen) return;
    setError(null);
    setLoading(true);

    try {
      const sug = await fetchCaseSuggestions(title);
      if (sug?.exactMatch) {
        setLoading(false);
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
      // fall through
    }

    await doPostCase();
  }

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <Link href="/cases" className="text-sm text-muted-foreground hover:underline">
          ← Cases
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">New investigation</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Investigations are shared. Your account records contributions and activity; it does not lock others out.
        </p>
      </div>
      <Card className="border-border shadow-sm">
        <CardHeader>
          <CardTitle className="text-foreground">Case details</CardTitle>
          <CardDescription className="text-foreground/90">
            Describe the scope. We will flag related investigations before creating a new file.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="title" className="text-foreground">
                Title
              </Label>
              <Input
                id="title"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="border-input bg-form-field text-form-field-foreground"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="incident-year" className="text-foreground">
                Incident year <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Input
                id="incident-year"
                type="number"
                min={1800}
                max={2100}
                placeholder="Leave blank if unknown"
                value={incidentYear}
                onChange={(e) => setIncidentYear(e.target.value)}
                className="border-input bg-form-field text-form-field-foreground"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="incident-city" className="text-foreground">
                  City <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                <Input
                  id="incident-city"
                  value={incidentCity}
                  onChange={(e) => setIncidentCity(e.target.value)}
                  placeholder="If known"
                  className="border-input bg-form-field text-form-field-foreground"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="incident-state" className="text-foreground">
                  State / region <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                <Input
                  id="incident-state"
                  value={incidentState}
                  onChange={(e) => setIncidentState(e.target.value)}
                  placeholder="e.g. TX or Texas"
                  className="border-input bg-form-field text-form-field-foreground"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="accused" className="text-foreground">
                Accused / defendant <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Input
                id="accused"
                value={accusedLabel}
                onChange={(e) => setAccusedLabel(e.target.value)}
                placeholder="Primary accused — helps directory search"
                className="border-input bg-form-field text-form-field-foreground"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="victims" className="text-foreground">
                Victim(s) <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Input
                id="victims"
                value={victimLabels}
                onChange={(e) => setVictimLabels(e.target.value)}
                placeholder="Names or labels, comma-separated"
                className="border-input bg-form-field text-form-field-foreground"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="weapon" className="text-foreground">
                Known murder weapon <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Input
                id="weapon"
                value={knownWeapon}
                onChange={(e) => setKnownWeapon(e.target.value)}
                placeholder="If relevant to the investigation"
                className="border-input bg-form-field text-form-field-foreground"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="text-foreground">
                Description
              </Label>
              <div
                id="description-guidance"
                className="rounded-md border border-border bg-panel px-3 py-2.5 text-sm text-foreground leading-relaxed"
                role="note"
              >
                <p className="font-semibold text-foreground mb-1.5">Include in your description:</p>
                <ul className="list-disc pl-5 space-y-0.5 marker:text-sky-700">
                  <li>
                    <span className="font-medium">Who</span> — victim(s)
                  </li>
                  <li>
                    <span className="font-medium">Who</span> — accused or defendant
                  </li>
                  <li>
                    <span className="font-medium">Crime</span> — what the accused is alleged to have done (factual,
                    neutral phrasing)
                  </li>
                </ul>
              </div>
              <Textarea
                id="description"
                aria-describedby="description-guidance"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={6}
                placeholder={DESCRIPTION_PLACEHOLDER}
                className="border-input bg-form-field text-form-field-foreground placeholder:text-muted-foreground min-h-[140px]"
              />
            </div>
            <Button type="submit" disabled={loading || similarOpen || !!createdCaseId} className="bg-primary text-primary-foreground">
              {loading ? "Checking…" : "Continue"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {createdCaseId ? (
        <Card className="border-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-foreground">Investigation created</CardTitle>
            <CardDescription className="text-foreground/90">
              Do you want to add evidence now or later?
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button
              type="button"
              className="bg-primary text-primary-foreground"
              onClick={() => {
                router.push(`/cases/${createdCaseId}/evidence/add`);
                router.refresh();
              }}
            >
              Add evidence now
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                router.push(`/cases/${createdCaseId}`);
                router.refresh();
              }}
            >
              Add evidence later
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <SimilarCasesModal
        open={similarOpen}
        onOpenChange={setSimilarOpen}
        draftTitle={title}
        suggestions={similarCases}
        busy={loading}
        onJoin={(caseId) => {
          setSimilarOpen(false);
          router.push(`/cases/${caseId}`);
          router.refresh();
        }}
        onCreateAnyway={() => {
          void doPostCase();
        }}
      />
    </div>
  );
}

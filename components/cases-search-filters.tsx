import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  q: string;
  accused: string;
  victim: string;
  state: string;
  weapon: string;
  year: string;
};

/**
 * GET form to `/cases` — filters investigations using structured case fields plus keyword search.
 * Evolvable toward server-side SQL filters without changing the URL shape.
 */
export function CasesSearchFilters(props: Props) {
  return (
    <Card className="border-border shadow-sm">
      <CardHeader className="space-y-1 pb-2">
        <CardTitle className="text-base text-foreground">Search investigations</CardTitle>
        <CardDescription className="text-foreground/90 leading-relaxed">
          Filter by people, location, weapon, or a phrase. Matches stored case metadata and description.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form method="get" action="/cases" className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cases-q" className="text-foreground">
              Keyword or phrase
            </Label>
            <Input
              id="cases-q"
              name="q"
              type="search"
              placeholder="Words in title, description, or metadata…"
              defaultValue={props.q}
              className="border-input bg-form-field text-form-field-foreground"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="cases-accused" className="text-foreground">
                Accused / defendant
              </Label>
              <Input
                id="cases-accused"
                name="accused"
                placeholder="Name or label"
                defaultValue={props.accused}
                autoComplete="off"
                className="border-input bg-form-field text-form-field-foreground"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cases-victim" className="text-foreground">
                Victim(s)
              </Label>
              <Input
                id="cases-victim"
                name="victim"
                placeholder="Name(s)"
                defaultValue={props.victim}
                autoComplete="off"
                className="border-input bg-form-field text-form-field-foreground"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="cases-state" className="text-foreground">
                State / region
              </Label>
              <Input
                id="cases-state"
                name="state"
                placeholder="e.g. TX or Texas"
                defaultValue={props.state}
                autoComplete="off"
                className="border-input bg-form-field text-form-field-foreground"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cases-weapon" className="text-foreground">
                Known murder weapon
              </Label>
              <Input
                id="cases-weapon"
                name="weapon"
                placeholder="e.g. knife, firearm…"
                defaultValue={props.weapon}
                autoComplete="off"
                className="border-input bg-form-field text-form-field-foreground"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cases-year" className="text-foreground">
                Incident year
              </Label>
              <Input
                id="cases-year"
                name="year"
                type="number"
                min={1800}
                max={2100}
                placeholder="Any"
                defaultValue={props.year}
                className="border-input bg-form-field text-form-field-foreground"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="sm">
              Apply filters
            </Button>
            <Button type="button" variant="outline" size="sm" asChild>
              <Link href="/cases">Clear</Link>
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

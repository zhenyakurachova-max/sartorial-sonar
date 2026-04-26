import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/BrandMark";
import { copy } from "@/lib/copy";

type Profile = {
  style_summary: string | null;
  colour_palette: string[];
  style_archetypes: string[];
  avoid_list: string[];
  budget_ceiling: number | null;
  interview_complete: boolean;
};

export default function InterviewComplete() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("style_summary, colour_palette, style_archetypes, avoid_list, budget_ceiling, interview_complete")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        setProfile((data ?? null) as Profile | null);
        setLoading(false);
      });
  }, [user]);

  if (!loading && profile && !profile.interview_complete) {
    return <Navigate to="/app/interview" replace />;
  }

  return (
    <main className="min-h-screen bg-background flex flex-col">
      <header className="px-6 pt-8">
        <BrandMark />
      </header>

      <section className="flex-1 px-6 pt-16 pb-12 max-w-md mx-auto w-full">
        <h1 className="font-serif text-4xl text-balance">{copy.complete.heading}</h1>
        <p className="mt-3 text-muted-foreground">{copy.complete.sub}</p>

        {loading ? (
          <p className="mt-10 text-muted-foreground">…</p>
        ) : profile ? (
          <div className="mt-10 space-y-8">
            {profile.style_summary && (
              <p className="font-serif text-xl leading-snug text-pretty">
                {profile.style_summary}
              </p>
            )}

            <Row label="Archetypes" value={profile.style_archetypes.join(" · ") || "—"} />

            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Palette</p>
              {profile.colour_palette.length ? (
                <div className="flex flex-wrap gap-2">
                  {profile.colour_palette.map((c) => (
                    <span
                      key={c}
                      className="px-3 py-1 text-sm border border-foreground/15 rounded-sm"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm">—</p>
              )}
            </div>

            <Row
              label="Budget ceiling"
              value={profile.budget_ceiling ? `${profile.budget_ceiling}` : "—"}
            />
            <Row label="Avoid" value={profile.avoid_list.slice(0, 3).join(" · ") || "—"} />
          </div>
        ) : null}

        <Button asChild className="mt-12 rounded-sm h-12 w-full">
          <Link to="/app/wardrobe">{copy.complete.cta}</Link>
        </Button>
      </section>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">{label}</p>
      <p className="text-base">{value}</p>
    </div>
  );
}

import { useEffect, useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type Profile = {
  style_summary: string | null;
  style_archetypes: string[];
  colour_palette: string[];
  avoid_list: string[];
  proportions: string | null;
  budget_ceiling: number | null;
};

export default function ProfileStub() {
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("style_summary, style_archetypes, colour_palette, avoid_list, proportions, budget_ceiling")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) console.error("[profile] load", error);
        setProfile((data as Profile) ?? null);
      });
  }, [user]);

  return (
    <main className="min-h-screen bg-background pb-24">
      <header className="px-6 pt-8">
        <BrandMark />
      </header>
      <section className="mx-auto w-full max-w-md px-6 pt-10">
        <h1 className="font-serif text-3xl">Profile</h1>
        <div className="mt-8 space-y-6">
          {profile?.style_summary && (
            <p className="font-serif text-xl leading-snug text-pretty">{profile.style_summary}</p>
          )}
          <Row label="Archetypes" value={profile?.style_archetypes?.join(" · ") || "—"} />
          <Row label="Palette" value={profile?.colour_palette?.join(" · ") || "—"} />
          <Row label="Proportions" value={profile?.proportions || "—"} />
          <Row label="Budget ceiling" value={profile?.budget_ceiling ? `€${profile.budget_ceiling}` : "—"} />
          <Row label="Avoid" value={profile?.avoid_list?.join(" · ") || "—"} />
        </div>
        <Button onClick={signOut} variant="outline" className="mt-10 h-12 w-full rounded-sm">
          Sign out
        </Button>
      </section>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-sm leading-relaxed">{value}</p>
    </div>
  );
}
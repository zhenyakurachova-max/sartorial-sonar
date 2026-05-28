import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Pencil } from "lucide-react";
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
  const navigate = useNavigate();
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

  const redoInterview = async () => {
    if (!user) return;
    const ok = window.confirm("This will erase your answers and profile, and restart the interview from Q1. Continue?");
    if (!ok) return;
    await supabase.from("interview_answers").delete().eq("user_id", user.id);
    await supabase.from("profiles").update({
      style_summary: null,
      colour_palette: [],
      style_archetypes: [],
      avoid_list: [],
      body_notes: null,
      proportions: null,
      budget_ceiling: null,
      currency: null,
      style_rules: null,
      style_icons: null,
      interview_complete: false,
    }).eq("id", user.id);
    navigate("/app/interview", { replace: true });
  };

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
          <Row label="Proportions" value={profile?.proportions || "—"} />
          <Row label="Palette" value={profile?.colour_palette?.join(" · ") || "—"} />
          <Row label="Budget ceiling" value={profile?.budget_ceiling ? `€${profile.budget_ceiling}` : "—"} />
          <Row label="Avoid" value={profile?.avoid_list?.join(" · ") || "—"} />
        </div>

        <Button
          onClick={redoInterview}
          variant="outline"
          className="mt-10 h-12 w-full rounded-sm border-foreground/20 gap-2"
        >
          <Pencil className="h-4 w-4" />
          Update your style profile
        </Button>

        <button
          type="button"
          onClick={redoInterview}
          className="mt-4 w-full text-sm underline underline-offset-4 text-muted-foreground hover:text-foreground"
        >
          Redo my interview
        </button>

        <Button onClick={signOut} variant="ghost" className="mt-6 h-12 w-full rounded-sm text-muted-foreground">
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
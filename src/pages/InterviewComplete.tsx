import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
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
  proportions: string | null;
  interview_complete: boolean;
};

type StoredAnswer = { question_index: number; question: string; answer: string };

export default function InterviewComplete() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [phase, setPhase] = useState<"loading" | "building" | "ready" | "redirect" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      // 1. Check if profile already complete.
      const { data: prof, error: profErr } = await supabase
        .from("profiles")
        .select("style_summary, colour_palette, style_archetypes, avoid_list, budget_ceiling, proportions, interview_complete")
        .eq("id", user.id)
        .maybeSingle();
      if (cancelled) return;
      if (profErr) console.error("[complete] profile fetch", profErr);

      if (prof?.interview_complete) {
        setProfile(prof as Profile);
        setPhase("ready");
        return;
      }

      // 2. Need to synthesise. Make sure we have all 10 answers.
      const { data: ans, error: ansErr } = await supabase
        .from("interview_answers")
        .select("question_index, question, answer")
        .eq("user_id", user.id)
        .order("question_index", { ascending: true });
      if (cancelled) return;
      if (ansErr) console.error("[complete] answers fetch", ansErr);

      const history = (ans ?? []) as StoredAnswer[];
      if (history.length < 11) {
        setPhase("redirect");
        return;
      }

      setPhase("building");
      const { data, error: fnErr } = await supabase.functions.invoke("interview", {
        body: { history },
      });
      if (cancelled) return;
      if (fnErr || !data?.profile) {
        console.error("[complete] synthesise error", fnErr, data);
        setErrorMsg(data?.error ?? "Couldn't build your profile. Try again in a moment.");
        setPhase("error");
        return;
      }

      const p = data.profile;
      const { error: upErr } = await supabase
        .from("profiles")
        .update({
          style_summary: p.style_summary ?? null,
          colour_palette: p.colour_palette ?? [],
          style_archetypes: p.style_archetypes ?? [],
          avoid_list: p.avoid_list ?? [],
          body_notes: p.body_notes ?? null,
          proportions: p.proportions ?? null,
          budget_ceiling: p.budget_ceiling ?? null,
          interview_complete: true,
        })
        .eq("id", user.id);
      if (cancelled) return;
      if (upErr) {
        console.error("[complete] save profile error", upErr);
        setErrorMsg("Couldn't save your profile. Try again.");
        setPhase("error");
        return;
      }

      setProfile({
        style_summary: p.style_summary ?? null,
        colour_palette: p.colour_palette ?? [],
        style_archetypes: p.style_archetypes ?? [],
        avoid_list: p.avoid_list ?? [],
        budget_ceiling: p.budget_ceiling ?? null,
        proportions: p.proportions ?? null,
        interview_complete: true,
      });
      setPhase("ready");
    })();
    return () => { cancelled = true; };
  }, [user]);

  const retry = async () => {
    setErrorMsg(null);
    setPhase("loading");
    navigate(0);
  };

  const redoInterview = async () => {
    if (!user) return;
    const ok = window.confirm("This will erase your answers and profile, and restart the interview from Q1. Continue?");
    if (!ok) return;
    setPhase("loading");
    const { error: delAns } = await supabase
      .from("interview_answers")
      .delete()
      .eq("user_id", user.id);
    if (delAns) console.error("[redo] delete answers", delAns);
    const { error: upProf } = await supabase
      .from("profiles")
      .update({
        style_summary: null,
        colour_palette: [],
        style_archetypes: [],
        avoid_list: [],
        body_notes: null,
        proportions: null,
        budget_ceiling: null,
        interview_complete: false,
      })
      .eq("id", user.id);
    if (upProf) console.error("[redo] reset profile", upProf);
    navigate("/app/interview", { replace: true });
  };

  if (phase === "redirect") return <Navigate to="/app/interview" replace />;

  return (
    <main className="min-h-screen bg-background flex flex-col">
      <header className="px-6 pt-8">
        <BrandMark />
      </header>

      <section className="flex-1 px-6 pt-16 pb-24 max-w-md mx-auto w-full">
        {phase === "loading" || phase === "building" ? (
          <>
            <h1 className="font-serif text-3xl text-balance">Building your style profile…</h1>
            <p className="mt-3 text-muted-foreground">
              Pulling the threads together. This takes about ten seconds.
            </p>
            <div className="mt-10 h-px bg-border overflow-hidden">
              <div className="h-full w-1/3 bg-primary animate-pulse" />
            </div>
          </>
        ) : phase === "error" ? (
          <>
            <h1 className="font-serif text-3xl text-balance">Something tripped up.</h1>
            <p className="mt-3 text-muted-foreground">{errorMsg}</p>
            <Button onClick={retry} className="mt-8 rounded-sm h-12">Try again</Button>
          </>
        ) : profile ? (
          <>
            <h1 className="font-serif text-4xl text-balance">{copy.complete.heading}</h1>
            <p className="mt-3 text-muted-foreground">{copy.complete.sub}</p>

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
                      <span key={c} className="px-3 py-1 text-sm border border-foreground/15 rounded-sm">
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
                value={profile.budget_ceiling ? `€${profile.budget_ceiling}` : "—"}
              />
              <Row label="Avoid" value={profile.avoid_list.slice(0, 3).join(" · ") || "—"} />
            </div>

            <Button asChild className="mt-12 rounded-sm h-12 w-full">
              <Link to="/app/wardrobe">{copy.complete.cta}</Link>
            </Button>
            <button
              type="button"
              onClick={redoInterview}
              className="mt-4 w-full text-sm underline underline-offset-4 text-muted-foreground hover:text-foreground"
            >
              Redo my interview
            </button>
          </>
        ) : null}
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

import { useEffect, useState } from "react";
import { Loader2, RefreshCw, Search, ShoppingBag } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

type Gap = { title?: string; description: string; priority?: "high" | "medium" | "low" };
type Recommendation = {
  designer: string;
  piece_name: string;
  reason: string;
  price_eur: string;
  search_query: string;
  affiliate_url: string | null;
};
type SectionPhase = "loading" | "ready" | "error";
type GapSection = {
  gap: Gap;
  recs: Recommendation[];
  phase: SectionPhase;
  err?: string;
};

async function fetchRecsForGap(gap: Gap, token: string | undefined): Promise<Recommendation[]> {
  const { data, error } = await supabase.functions.invoke("wardrobe-recommendations", {
    body: { gap },
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (error || data?.error) {
    const msg = data?.error ?? error?.message ?? "Couldn't load recommendations.";
    throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
  }
  return (data?.recommendations ?? []) as Recommendation[];
}

export default function RecommendationsStub() {
  const [pagePhase, setPagePhase] = useState<"loading" | "ready" | "no-gap">("loading");
  const [sections, setSections] = useState<GapSection[]>([]);

  const loadAll = async () => {
    setPagePhase("loading");
    setSections([]);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setPagePhase("no-gap"); return; }

    const { data } = await supabase
      .from("gap_summaries" as any)
      .select("gaps")
      .eq("user_id", session.user.id)
      .maybeSingle();
    const gaps = (data?.gaps ?? []) as Gap[];
    if (gaps.length === 0) { setPagePhase("no-gap"); return; }

    const initial: GapSection[] = gaps.map((gap) => ({ gap, recs: [], phase: "loading" }));
    setSections(initial);
    setPagePhase("ready");

    await Promise.all(
      gaps.map(async (gap, i) => {
        try {
          const recs = await fetchRecsForGap(gap, session.access_token);
          setSections((prev) => prev.map((s, idx) => idx === i ? { ...s, recs, phase: "ready" } : s));
        } catch (e: any) {
          setSections((prev) => prev.map((s, idx) => idx === i ? { ...s, phase: "error", err: e.message } : s));
        }
      }),
    );
  };

  const refreshSection = async (index: number) => {
    const section = sections[index];
    if (!section) return;
    setSections((prev) => prev.map((s, i) => i === index ? { ...s, phase: "loading", err: undefined } : s));
    const { data: { session } } = await supabase.auth.getSession();
    try {
      const recs = await fetchRecsForGap(section.gap, session?.access_token);
      setSections((prev) => prev.map((s, i) => i === index ? { ...s, recs, phase: "ready" } : s));
    } catch (e: any) {
      setSections((prev) => prev.map((s, i) => i === index ? { ...s, phase: "error", err: e.message } : s));
    }
  };

  useEffect(() => {
    loadAll();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <main className="min-h-screen bg-background pb-24">
      <header className="px-6 pt-8">
        <BrandMark />
      </header>
      <section className="mx-auto w-full max-w-2xl px-6 pt-10">
        <h1 className="font-serif text-3xl">What to buy next.</h1>

        {pagePhase === "loading" && (
          <div className="mt-16 flex justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {pagePhase === "no-gap" && (
          <p className="mt-12 text-muted-foreground text-pretty">
            No gaps found yet. Head to the Wardrobe tab and tap "Find my gaps" first.
          </p>
        )}

        {pagePhase === "ready" && (
          <>
            {sections.map((section, i) => (
              <div key={i} className="mt-10">
                {/* Sticky gap section header */}
                <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm py-3 -mx-6 px-6 border-b border-border/40 mb-5">
                  <div className="flex items-center justify-between">
                    <h2 className="font-serif text-xl leading-snug">{section.gap.title || "Gap"}</h2>
                    {section.gap.priority && (
                      <span className={[
                        "shrink-0 text-[11px] uppercase tracking-wider font-medium px-2.5 py-1 rounded-full",
                        section.gap.priority === "high" ? "bg-primary text-primary-foreground" :
                        section.gap.priority === "medium" ? "bg-[hsl(var(--verdict-gap))] text-foreground" :
                        "bg-muted text-muted-foreground border border-border",
                      ].join(" ")}>
                        {section.gap.priority}
                      </span>
                    )}
                  </div>
                  {section.gap.description && (
                    <p className="mt-1 text-sm text-muted-foreground text-pretty">{section.gap.description}</p>
                  )}
                </div>

                {section.phase === "loading" && (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                )}

                {section.phase === "error" && (
                  <div className="py-4">
                    <p className="text-sm text-destructive">{section.err}</p>
                    <Button variant="ghost" onClick={() => refreshSection(i)} className="mt-2 rounded-sm text-sm">
                      Try again
                    </Button>
                  </div>
                )}

                {section.phase === "ready" && (
                  <>
                    {/* Cards row */}
                    <div className="flex gap-3 overflow-x-auto pb-1">
                      {section.recs.map((rec, j) => (
                        <article
                          key={`${rec.designer}-${j}`}
                          className="flex-1 min-w-[200px] border border-border bg-muted/30 p-4 rounded-sm flex flex-col"
                        >
                          <p className="text-xs uppercase tracking-wider text-muted-foreground">{rec.designer}</p>
                          <h3 className="mt-2 font-serif text-lg leading-snug">{rec.piece_name}</h3>
                          <p className="mt-2 text-sm text-muted-foreground text-pretty flex-1">{rec.reason}</p>
                          <p className="mt-3 text-sm font-medium">{rec.price_eur}</p>
                          <p className="mt-1 text-[11px] text-muted-foreground/70">
                            Price is approximate. Click below to check current availability.
                          </p>
                          <div className="mt-3">
                            {rec.affiliate_url ? (
                              <Button asChild className="h-9 w-full rounded-sm text-sm">
                                <a href={rec.affiliate_url} target="_blank" rel="noreferrer">
                                  <ShoppingBag className="mr-2 h-3.5 w-3.5" /> Shop now
                                </a>
                              </Button>
                            ) : (
                              <Button asChild className="h-9 w-full rounded-sm text-sm">
                                <a
                                  href={`https://www.google.com/search?q=${encodeURIComponent(rec.search_query)}`}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  <Search className="mr-2 h-3.5 w-3.5" /> Find this piece
                                </a>
                              </Button>
                            )}
                          </div>
                        </article>
                      ))}
                    </div>
                    <Button
                      variant="ghost"
                      onClick={() => refreshSection(i)}
                      className="mt-3 w-full rounded-sm text-muted-foreground text-sm"
                    >
                      <RefreshCw className="mr-2 h-3.5 w-3.5" />
                      Refresh these picks
                    </Button>
                  </>
                )}
              </div>
            ))}

            <Button
              variant="ghost"
              onClick={loadAll}
              className="mt-10 w-full rounded-sm text-muted-foreground"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh all recommendations
            </Button>
          </>
        )}
      </section>
    </main>
  );
}

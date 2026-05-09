import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
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

type Phase = "loading" | "ready" | "error" | "no-gap";

export default function RecommendationsStub() {
  const location = useLocation();
  const navGap = (location.state as { gap?: Gap } | null)?.gap ?? null;

  const [activeGap, setActiveGap] = useState<Gap | null>(navGap);
  const [phase, setPhase] = useState<Phase>("loading");
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const fetchRecs = async (gapToFetch: Gap) => {
    setPhase("loading");
    setErr(null);
    const { data: { session } } = await supabase.auth.getSession();
    const { data, error } = await supabase.functions.invoke("wardrobe-recommendations", {
      body: { gap: gapToFetch },
      headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined,
    });
    if (error || data?.error) {
      const msg = data?.error ?? error?.message ?? "Couldn't build recommendations.";
      setErr(typeof msg === "string" ? msg : JSON.stringify(msg));
      setPhase("error");
      return;
    }
    setRecommendations((data?.recommendations ?? []) as Recommendation[]);
    setPhase("ready");
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (navGap) {
        if (!cancelled) await fetchRecs(navGap);
        return;
      }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || cancelled) { setPhase("no-gap"); return; }
      const { data } = await supabase
        .from("gap_summaries" as any)
        .select("gaps")
        .eq("user_id", session.user.id)
        .maybeSingle();
      if (cancelled) return;
      const gaps = (data?.gaps ?? []) as Gap[];
      if (gaps.length === 0) { setPhase("no-gap"); return; }
      const topGap = gaps[0];
      setActiveGap(topGap);
      if (!cancelled) await fetchRecs(topGap);
    })();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const gapText = activeGap?.description || activeGap?.title || "";

  return (
    <main className="min-h-screen bg-background pb-24">
      <header className="px-6 pt-8">
        <BrandMark />
      </header>
      <section className="mx-auto w-full max-w-2xl px-6 pt-10">
        <h1 className="font-serif text-3xl">What to buy next.</h1>
        {gapText && <p className="mt-3 text-muted-foreground text-pretty">{gapText}</p>}

        {phase === "loading" && (
          <div className="mt-16 flex justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {phase === "no-gap" && (
          <p className="mt-12 text-muted-foreground text-pretty">
            No gaps found yet. Head to the Wardrobe tab and tap "Find my gaps" first.
          </p>
        )}

        {phase === "error" && (
          <div className="mt-12">
            <p className="text-sm text-destructive">{err}</p>
            {activeGap && (
              <Button variant="ghost" onClick={() => fetchRecs(activeGap)} className="mt-4 rounded-sm">
                Try again
              </Button>
            )}
          </div>
        )}

        {phase === "ready" && (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: 0, marginTop: "40px" }}>
              <div style={{ display: "flex", gap: "16px" }}>
                {recommendations.map((rec, i) => (
                  <article
                    key={`${rec.designer}-${i}`}
                    style={{ flex: 1, border: "1px solid #e5e7eb", backgroundColor: "rgba(249,250,251,0.3)", padding: "20px", borderRadius: "4px" }}
                  >
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">{rec.designer}</p>
                    <h2 className="mt-2 font-serif text-xl leading-snug">{rec.piece_name}</h2>
                    <p className="mt-3 text-sm text-muted-foreground text-pretty">{rec.reason}</p>
                    <p className="mt-4 text-sm font-medium">{rec.price_eur}</p>
                  </article>
                ))}
              </div>
              <div style={{ display: "flex", gap: "16px", marginTop: "12px" }}>
                {recommendations.map((rec, i) => (
                  <div key={`btn-${rec.designer}-${i}`} style={{ flex: 1 }}>
                    {rec.affiliate_url ? (
                      <Button asChild className="h-10 w-full rounded-sm">
                        <a href={rec.affiliate_url} target="_blank" rel="noreferrer">
                          <ShoppingBag className="mr-2 h-4 w-4" /> Shop now
                        </a>
                      </Button>
                    ) : (
                      <Button asChild className="h-10 w-full rounded-sm">
                        <a
                          href={`https://www.google.com/search?q=${encodeURIComponent(rec.search_query)}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <Search className="mr-2 h-4 w-4" /> Find this piece
                        </a>
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {activeGap && (
              <Button
                variant="ghost"
                onClick={() => fetchRecs(activeGap)}
                className="mt-8 w-full rounded-sm text-muted-foreground"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh recommendations
              </Button>
            )}
          </>
        )}
      </section>
    </main>
  );
}

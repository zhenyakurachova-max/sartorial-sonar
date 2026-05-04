import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { Loader2, Search, ShoppingBag } from "lucide-react";
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

export default function RecommendationsStub() {
  const location = useLocation();
  const gap = (location.state as { gap?: Gap } | null)?.gap;
  const [phase, setPhase] = useState<"idle" | "loading" | "ready" | "error">(gap ? "loading" : "idle");
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const gapText = useMemo(() => gap?.description || gap?.title || "", [gap]);

  useEffect(() => {
    if (!gapText) return;
    let cancelled = false;
    setPhase("loading");
    setErr(null);
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      return supabase.functions.invoke("wardrobe-recommendations", {
        body: { gap },
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined,
      });
    })().then(({ data, error }) => {
      if (cancelled) return;
      if (error || data?.error) {
        const msg = data?.error ?? error?.message ?? "Couldn't build recommendations.";
        console.error("[recommendations]", error, data);
        setErr(typeof msg === "string" ? msg : JSON.stringify(msg));
        setPhase("error");
        return;
      }
      setRecommendations((data?.recommendations ?? []) as Recommendation[]);
      setPhase("ready");
    });
    return () => {
      cancelled = true;
    };
  }, [gap, gapText]);

  return (
    <main className="min-h-screen bg-background pb-24">
      <header className="px-6 pt-8">
        <BrandMark />
      </header>
      <section className="mx-auto w-full max-w-2xl px-6 pt-10">
        <h1 className="font-serif text-3xl">What to buy next.</h1>
        {gapText && <p className="mt-3 text-muted-foreground text-pretty">{gapText}</p>}

        {phase === "idle" && (
          <p className="mt-12 text-muted-foreground">Choose a gap first to get specific pieces.</p>
        )}
        {phase === "loading" && (
          <div className="mt-16 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        )}
        {phase === "error" && (
          <div className="mt-12"><p className="text-sm text-destructive">{err}</p></div>
        )}
        {phase === "ready" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 0, marginTop: "40px" }}>
            {/* Cards row */}
            <div style={{ display: "flex", gap: "16px" }}>
              {recommendations.map((rec, i) => (
                <article key={`${rec.designer}-${i}`} style={{ flex: 1, border: "1px solid #e5e7eb", backgroundColor: "rgba(249,250,251,0.3)", padding: "20px", borderRadius: "4px" }}>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">{rec.designer}</p>
                  <h2 className="mt-2 font-serif text-xl leading-snug">{rec.piece_name}</h2>
                  <p className="mt-3 text-sm text-muted-foreground text-pretty">{rec.reason}</p>
                  <p className="mt-4 text-sm font-medium">{rec.price_eur}</p>
                </article>
              ))}
            </div>
            {/* Buttons row */}
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
                      <a href={`https://www.google.com/search?q=${encodeURIComponent(rec.search_query)}`} target="_blank" rel="noreferrer">
                        <Search className="mr-2 h-4 w-4" /> Find this piece
                      </a>
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

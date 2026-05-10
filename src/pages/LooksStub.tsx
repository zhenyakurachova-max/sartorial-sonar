import { useEffect, useState } from "react";
import { Loader2, RefreshCw, Sparkles } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

type Look = {
  title: string;
  item_ids: string[];
  pieces: string[];
  styling_note: string;
};

type Phase = "loading" | "ready" | "empty" | "error";

export default function LooksStub() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [looks, setLooks] = useState<Look[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [thumbUrls, setThumbUrls] = useState<Record<string, string>>({});

  const fetchLooks = async () => {
    setPhase("loading");
    setErr(null);
    const { data: { session } } = await supabase.auth.getSession();
    const { data, error } = await supabase.functions.invoke("wardrobe-looks", {
      headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined,
    });
    if (error || data?.error) {
      const msg = data?.error ?? error?.message ?? "";
      const text = typeof msg === "string" ? msg : JSON.stringify(msg);
      if (text.includes("3 kept") || text.includes("least 3")) {
        setPhase("empty");
      } else {
        setErr(text || "Couldn't generate looks.");
        setPhase("error");
      }
      return;
    }
    const newLooks = (data?.looks ?? []) as Look[];
    setLooks(newLooks);
    setPhase("ready");
  };

  // Load thumbnail images for item_ids returned by the API
  useEffect(() => {
    if (!looks.length) return;
    const allIds = [...new Set(looks.flatMap((l) => l.item_ids ?? []))];
    if (!allIds.length) return;
    let cancelled = false;
    (async () => {
      const { data: rows } = await supabase
        .from("wardrobe_items")
        .select("id, image_path")
        .in("id", allIds);
      if (cancelled || !rows) return;
      const pathMap: Record<string, string> = Object.fromEntries(rows.map((r: any) => [r.id, r.image_path]));
      const next: Record<string, string> = {};
      await Promise.all(
        allIds.map(async (id) => {
          const path = pathMap[id];
          if (!path) return;
          const { data: url } = await supabase.storage.from("wardrobe").createSignedUrl(path, 60 * 60);
          if (url?.signedUrl) next[id] = url.signedUrl;
        }),
      );
      if (cancelled) return;
      setThumbUrls((u) => ({ ...u, ...next }));
    })();
    return () => { cancelled = true; };
  }, [looks]);

  useEffect(() => {
    fetchLooks();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <main className="min-h-screen bg-background pb-24">
      <header className="px-6 pt-8">
        <BrandMark />
      </header>
      <section className="mx-auto w-full max-w-2xl px-6 pt-10">
        <h1 className="font-serif text-3xl">Looks.</h1>

        {phase === "loading" && (
          <div className="mt-16 flex justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {phase === "empty" && (
          <div className="mt-24 flex flex-col items-center text-center gap-5">
            <Sparkles className="h-8 w-8 text-muted-foreground/30" />
            <p className="text-muted-foreground max-w-xs text-pretty">
              Add at least 3 kept items to your wardrobe to see outfit suggestions.
            </p>
          </div>
        )}

        {phase === "error" && (
          <div className="mt-12">
            <p className="text-sm text-destructive">{err}</p>
            <Button variant="ghost" onClick={fetchLooks} className="mt-4 rounded-sm">
              Try again
            </Button>
          </div>
        )}

        {phase === "ready" && (
          <>
            <div className="mt-8 space-y-5">
              {looks.map((look, i) => (
                <article key={i} className="rounded-sm border border-border bg-muted/30 px-5 py-5">
                  {/* Overlapping circular thumbnails */}
                  {(look.item_ids?.length ?? 0) > 0 && (
                    <div className="flex items-center mb-4" style={{ paddingLeft: "4px" }}>
                      {(look.item_ids ?? []).slice(0, 4).map((id, j) => (
                        <div
                          key={id}
                          className="h-10 w-10 rounded-full border-2 border-background overflow-hidden bg-muted shrink-0"
                          style={{ marginLeft: j === 0 ? 0 : "-10px", zIndex: 4 - j, position: "relative" }}
                        >
                          {thumbUrls[id] ? (
                            <img src={thumbUrls[id]} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <div className="h-full w-full bg-muted" />
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  <h2 className="font-serif text-xl leading-snug">{look.title}</h2>
                  <ul className="mt-3 space-y-1.5">
                    {look.pieces.map((piece, j) => (
                      <li key={j} className="text-sm text-muted-foreground flex items-start gap-2">
                        <span className="mt-2 h-1 w-1 rounded-full bg-muted-foreground/40 shrink-0" />
                        {piece}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-4 text-sm italic text-foreground/70 text-pretty">{look.styling_note}</p>
                </article>
              ))}
            </div>
            <Button
              variant="ghost"
              onClick={fetchLooks}
              className="mt-8 w-full rounded-sm text-muted-foreground"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh looks
            </Button>
          </>
        )}
      </section>
    </main>
  );
}

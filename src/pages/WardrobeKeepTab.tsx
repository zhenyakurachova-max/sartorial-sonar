import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, ShoppingBag, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { BrandMark } from "@/components/BrandMark";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

type KeepItem = {
  id: string;
  image_path: string;
  category: string;
  reason: string | null;
  tags: string[];
};

type Gap = {
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
};

export default function WardrobeKeepTab() {
  const { user } = useAuth();
  const [items, setItems] = useState<KeepItem[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [gaps, setGaps] = useState<Gap[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailItem, setDetailItem] = useState<KeepItem | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const [{ data: keptItems }, { data: gapSummary }] = await Promise.all([
        supabase
          .from("wardrobe_items")
          .select("id, image_path, category, reason, tags")
          .eq("user_id", user.id)
          .eq("status", "analysed")
          .eq("verdict", "keep")
          .order("created_at", { ascending: false }),
        supabase
          .from("gap_summaries" as any)
          .select("gaps")
          .eq("user_id", user.id)
          .maybeSingle(),
      ]);
      if (cancelled) return;
      setItems((keptItems ?? []) as KeepItem[]);
      setGaps((gapSummary?.gaps ?? []) as Gap[]);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const missing = items.filter((i) => !urls[i.image_path]).map((i) => i.image_path);
      if (!missing.length) return;
      const next: Record<string, string> = {};
      await Promise.all(
        missing.map(async (path) => {
          const { data } = await supabase.storage.from("wardrobe").createSignedUrl(path, 60 * 60);
          if (data?.signedUrl) next[path] = data.signedUrl;
        }),
      );
      if (cancelled) return;
      if (Object.keys(next).length) setUrls((u) => ({ ...u, ...next }));
    })();
    return () => { cancelled = true; };
  }, [items]); // eslint-disable-line react-hooks/exhaustive-deps

  const onDelete = async (itemId: string) => {
    if (!confirm("Remove this item from your wardrobe?")) return;
    await supabase.from("wardrobe_items").delete().eq("id", itemId);
    setItems((prev) => prev.filter((it) => it.id !== itemId));
    setDetailItem(null);
  };

  return (
    <main className="min-h-screen bg-background flex flex-col">
      <header className="px-6 pt-8">
        <BrandMark />
      </header>
      <section className="flex-1 px-6 pt-10 pb-24 max-w-2xl mx-auto w-full">
        <h1 className="font-serif text-3xl">Your wardrobe.</h1>
        <p className="mt-2 text-sm text-muted-foreground">Pieces worth keeping.</p>

        {loading ? (
          <div className="mt-16 flex justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {items.length === 0 ? (
              <p className="mt-12 text-muted-foreground text-pretty">
                No kept items yet. Photograph your wardrobe in the Audit tab and we'll sort them for you.
              </p>
            ) : (
              <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 gap-3">
                {items.map((it) => (
                  <button
                    key={it.id}
                    onClick={() => setDetailItem(it)}
                    className="relative aspect-square w-full overflow-hidden rounded-sm bg-muted"
                    aria-label={`View ${it.category}`}
                  >
                    {urls[it.image_path] ? (
                      <img
                        src={urls[it.image_path]}
                        alt={it.category}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="h-full w-full bg-muted" />
                    )}
                    <div className="absolute bottom-2 left-2 pointer-events-none">
                      <span className="inline-flex items-center rounded-full bg-verdict-keep text-primary-foreground px-2 py-1 text-[11px] font-medium uppercase tracking-wider">
                        Keep
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {gaps.length > 0 && (
              <div className="mt-14">
                <h2 className="font-serif text-2xl">What you're missing.</h2>
                <div className="mt-6 space-y-4">
                  {gaps.map((g, i) => (
                    <article key={i} className="rounded-sm border border-border bg-muted/30 px-5 py-5">
                      <div className="flex items-start justify-between gap-4">
                        <h3 className="font-serif text-xl leading-snug">{g.title}</h3>
                        <PriorityPill priority={g.priority} />
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground text-pretty">{g.description}</p>
                      <Button asChild className="mt-4 h-10 rounded-sm">
                        <Link to="/app/buy" state={{ gap: g }}>
                          <ShoppingBag className="mr-2 h-4 w-4" /> Find pieces
                        </Link>
                      </Button>
                    </article>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </section>

      <Sheet open={!!detailItem} onOpenChange={(o) => !o && setDetailItem(null)}>
        <SheetContent
          side="bottom"
          className="rounded-t-xl bg-background border-border p-0 max-h-[85vh] overflow-y-auto"
        >
          {detailItem && (
            <div>
              <div className="relative">
                <div className="aspect-square w-full bg-muted overflow-hidden">
                  {urls[detailItem.image_path] && (
                    <img
                      src={urls[detailItem.image_path]}
                      alt={detailItem.category}
                      className="h-full w-full object-cover"
                    />
                  )}
                </div>
                <button
                  onClick={() => setDetailItem(null)}
                  aria-label="Close"
                  className="absolute top-3 right-3 h-9 w-9 rounded-full bg-background/90 flex items-center justify-center shadow-sm"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="px-6 py-6 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">
                    {detailItem.category}
                  </p>
                  <span className="inline-flex items-center rounded-full bg-verdict-keep text-primary-foreground px-3 py-1 text-xs font-medium uppercase tracking-wider">
                    Keep
                  </span>
                </div>
                {detailItem.reason && (
                  <p className="font-serif text-lg italic leading-snug text-pretty">
                    {detailItem.reason}
                  </p>
                )}
                {detailItem.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-2">
                    {detailItem.tags.map((t) => (
                      <span key={t} className="px-2.5 py-1 text-xs rounded-full bg-muted text-muted-foreground">
                        {t}
                      </span>
                    ))}
                  </div>
                )}
                <Button
                  variant="ghost"
                  onClick={() => onDelete(detailItem.id)}
                  className="w-full rounded-sm text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  Remove item
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </main>
  );
}

function PriorityPill({ priority }: { priority: Gap["priority"] }) {
  const styles =
    priority === "high"
      ? "bg-primary text-primary-foreground"
      : priority === "medium"
        ? "bg-[hsl(var(--verdict-gap))] text-foreground"
        : "bg-muted text-muted-foreground border border-border";
  return (
    <span
      className={cn(
        "shrink-0 inline-flex items-center rounded-full px-2.5 py-1 text-[11px] uppercase tracking-wider font-medium",
        styles,
      )}
    >
      {priority}
    </span>
  );
}

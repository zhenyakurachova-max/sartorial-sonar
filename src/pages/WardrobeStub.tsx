import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, X, Camera, Image as ImageIcon, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { BrandMark } from "@/components/BrandMark";
import { copy } from "@/lib/copy";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type Verdict = "keep" | "dump" | "gap";
type Status = "pending" | "analysed" | "failed";

type Item = {
  id: string;
  image_path: string;
  category: string;
  status: Status;
  verdict: Verdict | null;
  reason: string | null;
  tags: string[];
  created_at: string;
};

const CATEGORIES = ["Top", "Bottom", "Dress", "Outerwear", "Shoes", "Bag", "Accessory"] as const;
type Category = (typeof CATEGORIES)[number];

export default function WardrobeStub() {
  const { user, signOut } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const [addOpen, setAddOpen] = useState(false);
  const [detailItem, setDetailItem] = useState<Item | null>(null);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  // Pending upload state (after photo chosen, before category picked)
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingPreview, setPendingPreview] = useState<string | null>(null);
  const [pendingCategory, setPendingCategory] = useState<Category | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Load items
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("wardrobe_items")
        .select("id, image_path, category, status, verdict, reason, tags, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (cancelled) return;
      if (error) console.error("[wardrobe] load", error);
      setItems((data ?? []) as Item[]);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Sign URLs for thumbnails whenever items change
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
    return () => {
      cancelled = true;
    };
  }, [items]); // eslint-disable-line react-hooks/exhaustive-deps

  const onPick = (mode: "camera" | "gallery") => {
    (mode === "camera" ? cameraInputRef : galleryInputRef).current?.click();
  };

  const onFileChosen = (file: File | null) => {
    if (!file) return;
    setPendingFile(file);
    setPendingPreview(URL.createObjectURL(file));
    setPendingCategory(null);
  };

  const resetAddSheet = () => {
    setAddOpen(false);
    setPendingFile(null);
    if (pendingPreview) URL.revokeObjectURL(pendingPreview);
    setPendingPreview(null);
    setPendingCategory(null);
    setSubmitting(false);
  };

  const runAnalysis = async (itemId: string) => {
    setItems((prev) =>
      prev.map((it) => (it.id === itemId ? { ...it, status: "pending" } : it)),
    );
    const { data, error } = await supabase.functions.invoke("analyse-item", {
      body: { item_id: itemId },
    });

    let errMessage: string | null = null;
    if (error) {
      // FunctionsHttpError: read the actual response body for the real error
      try {
        const ctx = (error as any).context;
        if (ctx && typeof ctx.json === "function") {
          const body = await ctx.json();
          errMessage = body?.error ?? JSON.stringify(body);
        } else if (ctx && typeof ctx.text === "function") {
          errMessage = await ctx.text();
        } else {
          errMessage = error.message;
        }
      } catch {
        errMessage = error.message;
      }
    } else if (data?.error) {
      errMessage = typeof data.error === "string" ? data.error : JSON.stringify(data.error);
    }

    if (errMessage) {
      console.error("[analyse-item]", errMessage);
      setItems((prev) =>
        prev.map((it) => (it.id === itemId ? { ...it, status: "failed" } : it)),
      );
      toast({
        title: "Couldn't analyse that photo",
        description: errMessage,
      });
      return;
    }

    setItems((prev) =>
      prev.map((it) =>
        it.id === itemId
          ? {
              ...it,
              status: "analysed",
              verdict: data.verdict,
              reason: data.reason,
              tags: data.tags ?? [],
            }
          : it,
      ),
    );
  };

  const onRetry = async (itemId: string) => {
    await supabase.from("wardrobe_items").update({ status: "pending" }).eq("id", itemId);
    runAnalysis(itemId);
  };

  const onAnalyse = async () => {
    if (!user || !pendingFile || !pendingCategory) return;
    setSubmitting(true);
    try {
      const ext = (pendingFile.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("wardrobe")
        .upload(path, pendingFile, { contentType: pendingFile.type || "image/jpeg" });
      if (upErr) throw upErr;

      const { data: inserted, error: insErr } = await supabase
        .from("wardrobe_items")
        .insert({
          user_id: user.id,
          image_path: path,
          category: pendingCategory,
          status: "pending",
        })
        .select("id, image_path, category, status, verdict, reason, tags, created_at")
        .single();
      if (insErr) throw insErr;

      const newItem = inserted as Item;
      setItems((prev) => [newItem, ...prev]);
      resetAddSheet();

      runAnalysis(newItem.id);
    } catch (e: any) {
      console.error("[wardrobe] add item", e);
      toast({ title: "Couldn't add that item", description: e?.message ?? "Try again." });
      setSubmitting(false);
    }
  };

  const analysedCount = items.filter((i) => i.status === "analysed").length;
  const showGapsBanner = analysedCount >= 3;

  const hasItems = items.length > 0;

  return (
    <main className="min-h-screen bg-background flex flex-col">
      <header className="px-6 pt-8 flex items-center justify-between">
        <BrandMark />
        <div className="flex items-center gap-4">
          {hasItems && (
            <button
              onClick={() => setAddOpen(true)}
              aria-label="Add item"
              className="h-10 w-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-sm"
            >
              <Plus className="h-5 w-5" />
            </button>
          )}
          <button
            onClick={signOut}
            className="text-xs uppercase tracking-wider text-muted-foreground"
          >
            Sign out
          </button>
        </div>
      </header>

      <section className="flex-1 px-6 pt-10 pb-16 max-w-2xl mx-auto w-full">
        <h1 className="font-serif text-3xl">Your wardrobe</h1>

        {loading ? (
          <div className="mt-16 flex justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : !hasItems ? (
          <div className="mt-12 max-w-md">
            <p className="text-muted-foreground text-pretty">
              Nothing here yet. Start by photographing something you own — one piece at a time.
            </p>
            <Button
              onClick={() => setAddOpen(true)}
              className="mt-10 rounded-sm h-12 w-full"
            >
              Add your first item
            </Button>
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-2 gap-3">
            {items.map((it) => (
              <ItemTile
                key={it.id}
                item={it}
                src={urls[it.image_path]}
                onClick={() => setDetailItem(it)}
                onRetry={() => onRetry(it.id)}
              />
            ))}
          </div>
        )}

        {showGapsBanner && (
          <div className="mt-12 rounded-sm border border-border bg-muted/40 px-5 py-5 flex items-center justify-between gap-4">
            <p className="font-serif text-lg leading-snug">Ready to see your gaps?</p>
            <Link
              to="/app/gaps"
              className="shrink-0 inline-flex items-center justify-center rounded-sm bg-primary text-primary-foreground h-10 px-4 text-sm"
            >
              See my results
            </Link>
          </div>
        )}
      </section>

      {/* Hidden file inputs */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => onFileChosen(e.target.files?.[0] ?? null)}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => onFileChosen(e.target.files?.[0] ?? null)}
      />

      {/* Add item bottom sheet */}
      <Sheet open={addOpen} onOpenChange={(o) => (o ? setAddOpen(true) : resetAddSheet())}>
        <SheetContent side="bottom" className="rounded-t-xl bg-background border-border p-6 max-h-[92vh] overflow-y-auto">
          <SheetHeader className="text-left">
            <SheetTitle className="font-serif text-2xl font-normal">
              {pendingPreview ? "Categorise this piece" : "Add an item"}
            </SheetTitle>
          </SheetHeader>

          {!pendingPreview ? (
            <div className="mt-6 space-y-3">
              <button
                onClick={() => onPick("camera")}
                className="w-full flex items-center gap-3 px-4 py-4 border border-border rounded-sm text-left hover:bg-muted transition"
              >
                <Camera className="h-5 w-5 text-primary" />
                <span>Take a photo</span>
              </button>
              <button
                onClick={() => onPick("gallery")}
                className="w-full flex items-center gap-3 px-4 py-4 border border-border rounded-sm text-left hover:bg-muted transition"
              >
                <ImageIcon className="h-5 w-5 text-primary" />
                <span>Choose from gallery</span>
              </button>
            </div>
          ) : (
            <div className="mt-6 space-y-6">
              <div className="aspect-square w-full overflow-hidden rounded-sm bg-muted">
                <img src={pendingPreview} alt="" className="h-full w-full object-cover" />
              </div>

              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
                  What is it?
                </p>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map((c) => {
                    const selected = pendingCategory === c;
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setPendingCategory(c)}
                        className={cn(
                          "px-4 py-2 rounded-full text-sm border transition",
                          selected
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background text-foreground border-border hover:border-primary/40",
                        )}
                      >
                        {c}
                      </button>
                    );
                  })}
                </div>
              </div>

              <Button
                onClick={onAnalyse}
                disabled={!pendingCategory || submitting}
                className="rounded-sm h-12 w-full"
              >
                {submitting ? "Uploading…" : "Analyse this item"}
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Item detail drawer */}
      <Sheet
        open={!!detailItem}
        onOpenChange={(o) => !o && setDetailItem(null)}
      >
        <SheetContent
          side="bottom"
          className="rounded-t-xl bg-background border-border p-0 max-h-[92vh] overflow-y-auto"
        >
          {detailItem && (
            <ItemDetail
              item={detailItem}
              src={urls[detailItem.image_path]}
              onClose={() => setDetailItem(null)}
              onRetry={() => {
                onRetry(detailItem.id);
                setDetailItem(null);
              }}
            />
          )}
        </SheetContent>
      </Sheet>
    </main>
  );
}

function ItemTile({
  item,
  src,
  onClick,
  onRetry,
}: {
  item: Item;
  src?: string;
  onClick: () => void;
  onRetry: () => void;
}) {
  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-sm bg-muted group">
      <button
        onClick={onClick}
        className="absolute inset-0 w-full h-full"
        aria-label={`View ${item.category}`}
      >
        {src ? (
          <img
            src={src}
            alt={item.category}
            className="h-full w-full object-cover transition group-active:scale-[0.98]"
          />
        ) : (
          <div className="h-full w-full bg-muted" />
        )}
      </button>
      {item.status === "pending" && (
        <div className="absolute inset-0 bg-background/40 flex items-center justify-center pointer-events-none">
          <Loader2 className="h-5 w-5 animate-spin text-foreground/70" />
        </div>
      )}
      {item.status === "analysed" && item.verdict && (
        <div className="absolute bottom-2 left-2 pointer-events-none">
          <VerdictPill verdict={item.verdict} />
        </div>
      )}
      {item.status === "failed" && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRetry();
          }}
          className="absolute bottom-2 left-2 px-2 py-1 rounded-full bg-[hsl(var(--verdict-gap))] text-foreground text-[11px] uppercase tracking-wider font-medium hover:opacity-90"
        >
          Retry
        </button>
      )}
    </div>
  );
}

function VerdictPill({ verdict, large = false }: { verdict: Verdict; large?: boolean }) {
  const label = verdict === "keep" ? "Keep" : verdict === "dump" ? "Dump" : "Gap";
  const styles =
    verdict === "keep"
      ? "bg-[hsl(var(--verdict-keep))] text-primary-foreground"
      : verdict === "dump"
        ? "bg-[hsl(var(--verdict-dump))] text-primary-foreground"
        : "bg-[hsl(var(--verdict-gap))] text-foreground";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-medium uppercase tracking-wider",
        large ? "px-3 py-1 text-xs" : "px-2 py-1 text-[11px]",
        styles,
      )}
    >
      {label}
    </span>
  );
}

function ItemDetail({
  item,
  src,
  onClose,
  onRetry,
}: {
  item: Item;
  src?: string;
  onClose: () => void;
  onRetry: () => void;
}) {
  return (
    <div>
      <div className="relative">
        <div className="aspect-square w-full bg-muted overflow-hidden">
          {src ? (
            <img src={src} alt={item.category} className="h-full w-full object-cover" />
          ) : null}
        </div>
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 h-9 w-9 rounded-full bg-background/90 flex items-center justify-center shadow-sm"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="px-6 py-6 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            {item.category}
          </p>
          {item.status === "analysed" && item.verdict && (
            <VerdictPill verdict={item.verdict} large />
          )}
          {item.status === "pending" && (
            <span className="text-xs text-muted-foreground inline-flex items-center gap-2">
              <Loader2 className="h-3 w-3 animate-spin" /> Analysing…
            </span>
          )}
          {item.status === "failed" && (
            <button
              onClick={onRetry}
              className="px-3 py-1 rounded-full bg-[hsl(var(--verdict-gap))] text-foreground text-xs uppercase tracking-wider font-medium"
            >
              Retry
            </button>
          )}
        </div>

        {item.reason && (
          <p className="font-serif text-lg italic leading-snug text-pretty">
            {item.reason}
          </p>
        )}

        {item.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-2">
            {item.tags.map((t) => (
              <span
                key={t}
                className="px-2.5 py-1 text-xs rounded-full bg-muted text-muted-foreground"
              >
                {t}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

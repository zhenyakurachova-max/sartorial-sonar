import { useEffect, useRef, useState } from "react";
import { Plus, X, Camera, Image as ImageIcon, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { BrandMark } from "@/components/BrandMark";
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

type AnalysisResult = {
  id?: string;
  image_path?: string;
  category?: string;
  status?: Status;
  created_at?: string;
  item?: Item | null;
  verdict?: Verdict;
  reason?: string | null;
  tags?: string[] | null;
  error?: unknown;
};

const CATEGORIES = ["Top", "Bottom", "Dress", "Outerwear", "Shoes", "Bag", "Accessory"] as const;
type Category = (typeof CATEGORIES)[number];

const ANALYSIS_TIMEOUT_MS = 30_000;
const FILE_SIZE_LIMIT = 50 * 1024 * 1024; // 50 MB

const isVerdict = (value: unknown): value is Verdict =>
  value === "keep" || value === "dump" || value === "gap";

const analysisTimeout = () =>
  new Promise<never>((_, reject) => {
    window.setTimeout(() => reject(new Error("Analysis timed out after 30 seconds.")), ANALYSIS_TIMEOUT_MS);
  });

export default function WardrobeStub() {
  const { user } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const [addOpen, setAddOpen] = useState(false);
  const [detailItem, setDetailItem] = useState<Item | null>(null);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  // Single-file pending state
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingPreview, setPendingPreview] = useState<string | null>(null);
  const [pendingCategory, setPendingCategory] = useState<Category | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [fileTooLarge, setFileTooLarge] = useState(false);

  // Batch upload state
  const [batchFiles, setBatchFiles] = useState<File[]>([]);
  const [batchPreviews, setBatchPreviews] = useState<string[]>([]);
  const [batchCategories, setBatchCategories] = useState<(Category | null)[]>([]);
  const [batchProgress, setBatchProgress] = useState<{ done: number; total: number } | null>(null);

  // Stale pending items
  const [staleIds, setStaleIds] = useState<Set<string>>(new Set());
  const pendingSince = useRef<Record<string, number>>({});

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
    return () => { cancelled = true; };
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
    return () => { cancelled = true; };
  }, [items]); // eslint-disable-line react-hooks/exhaustive-deps

  // Track stale pending items
  useEffect(() => {
    const itemIds = new Set(items.map((i) => i.id));
    Object.keys(pendingSince.current).forEach((id) => {
      if (!itemIds.has(id)) delete pendingSince.current[id];
    });
    items.forEach((item) => {
      if (item.status === "pending" && !pendingSince.current[item.id]) {
        pendingSince.current[item.id] = new Date(item.created_at).getTime();
      } else if (item.status !== "pending") {
        delete pendingSince.current[item.id];
      }
    });
    const check = () => {
      const now = Date.now();
      setStaleIds(new Set(
        Object.entries(pendingSince.current)
          .filter(([, since]) => now - since > 30_000)
          .map(([id]) => id),
      ));
    };
    check();
    const timer = setInterval(check, 5_000);
    return () => clearInterval(timer);
  }, [items]);

  const onPick = (mode: "camera" | "gallery") => {
    (mode === "camera" ? cameraInputRef : galleryInputRef).current?.click();
  };

  const onFileChosen = (file: File | null) => {
    if (!file) return;
    if (file.size > FILE_SIZE_LIMIT) {
      setFileTooLarge(true);
      return;
    }
    setFileTooLarge(false);
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
    setFileTooLarge(false);
    setBatchFiles([]);
    batchPreviews.forEach((p) => URL.revokeObjectURL(p));
    setBatchPreviews([]);
    setBatchCategories([]);
    setBatchProgress(null);
  };

  const runAnalysis = async (itemId: string) => {
    setItems((prev) =>
      prev.map((it) => (it.id === itemId ? { ...it, status: "pending" } : it)),
    );
    setDetailItem((current) => (current?.id === itemId ? { ...current, status: "pending" } : current));

    let data: AnalysisResult | null = null;
    let error: any = null;
    let timedOut = false;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response: any = await Promise.race([
        supabase.functions.invoke("analyse-item", {
          body: { item_id: itemId },
          headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined,
        }),
        analysisTimeout().catch((e) => { timedOut = true; throw e; }),
      ]);
      data = (response?.data ?? null) as AnalysisResult | null;
      error = response?.error ?? null;
    } catch (e: any) {
      error = e;
    }

    const applyAnalysedItem = (nextItem: Item) => {
      setItems((prev) => prev.map((it) => (it.id === itemId ? nextItem : it)));
      setDetailItem((current) => (current?.id === itemId ? nextItem : current));
    };

    let errMessage: string | null = null;
    if (error) {
      try {
        const ctx = (error as any).context;
        if (ctx && typeof ctx.json === "function") {
          const body = await ctx.json();
          errMessage = body?.error ?? JSON.stringify(body);
        } else if (ctx && typeof ctx.text === "function") {
          errMessage = await ctx.text();
        } else {
          errMessage = error.message ?? String(error);
        }
      } catch {
        errMessage = error.message ?? String(error);
      }
    } else if (data?.error) {
      errMessage = typeof data.error === "string" ? data.error : JSON.stringify(data.error);
    } else if (data?.item && data.item.status === "analysed" && isVerdict(data.item.verdict)) {
      applyAnalysedItem(data.item);
      return;
    } else if (data?.id === itemId && data.status === "analysed" && isVerdict(data.verdict)) {
      applyAnalysedItem(data as unknown as Item);
      return;
    } else if (!isVerdict(data?.verdict)) {
      const { data: refreshed } = await supabase
        .from("wardrobe_items")
        .select("id, image_path, category, status, verdict, reason, tags, created_at")
        .eq("id", itemId)
        .single();
      if (refreshed && refreshed.status === "analysed" && isVerdict(refreshed.verdict)) {
        applyAnalysedItem(refreshed as Item);
        return;
      }
      errMessage = timedOut ? "Analysis timed out after 30 seconds." : "Analysis returned no verdict.";
    }

    if (errMessage) {
      setItems((prev) => prev.map((it) => (it.id === itemId ? { ...it, status: "failed" } : it)));
      setDetailItem((current) => (current?.id === itemId ? { ...current, status: "failed" } : current));
      toast({ title: "Couldn't analyse that photo", description: errMessage });
      return;
    }

    const verdict = data!.verdict!;
    const reason = data!.reason ?? null;
    const tags = data!.tags ?? [];
    const analysedItem: Item | null = data?.item && data.item.id === itemId ? data.item : null;
    const fallbackItem = items.find((it) => it.id === itemId);
    const nextItem = analysedItem ?? (fallbackItem ? { ...fallbackItem, status: "analysed" as const, verdict, reason, tags } : null);
    if (nextItem) applyAnalysedItem(nextItem);
  };

  const onRetry = async (itemId: string) => {
    await supabase.from("wardrobe_items").update({ status: "pending" }).eq("id", itemId);
    runAnalysis(itemId);
  };

  const onDelete = async (itemId: string) => {
    if (!confirm("Remove this item from your wardrobe?")) return;
    await supabase.from("wardrobe_items").delete().eq("id", itemId);
    setItems((prev) => prev.filter((it) => it.id !== itemId));
    setDetailItem(null);
  };

  const uploadFile = async (file: File, category: Category): Promise<Item> => {
    const mimeType = file.type || "image/jpeg";
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = `${user!.id}/${crypto.randomUUID()}.${ext}`;

    // Read as ArrayBuffer for iOS Safari compatibility
    const buffer = await file.arrayBuffer();
    const { error: upErr } = await supabase.storage
      .from("wardrobe")
      .upload(path, buffer, { contentType: mimeType });
    if (upErr) throw new Error(upErr.message || "Upload failed");

    const { data: inserted, error: insErr } = await supabase
      .from("wardrobe_items")
      .insert({ user_id: user!.id, image_path: path, category, status: "pending" })
      .select("id, image_path, category, status, verdict, reason, tags, created_at")
      .single();
    if (insErr) throw new Error(insErr.message || "Failed to save item");

    return inserted as Item;
  };

  const onAnalyse = async () => {
    if (!user || !pendingFile || !pendingCategory) return;
    setSubmitting(true);
    try {
      const newItem = await uploadFile(pendingFile, pendingCategory);
      setItems((prev) => [newItem, ...prev]);
      resetAddSheet();
      runAnalysis(newItem.id);
    } catch (e: any) {
      const msg = e?.message === "Failed to fetch"
        ? "Network error. Check your connection and try again."
        : (e?.message || "Upload failed. Please try again.");
      toast({ title: "Couldn't add that item", description: msg });
      setSubmitting(false);
    }
  };

  const onBatchUpload = async () => {
    if (!user || batchFiles.length === 0 || batchCategories.some((c) => !c)) return;
    setSubmitting(true);
    setBatchProgress({ done: 0, total: batchFiles.length });

    const newItems: Item[] = [];
    let failed = 0;

    for (let i = 0; i < batchFiles.length; i++) {
      try {
        const newItem = await uploadFile(batchFiles[i], batchCategories[i]!);
        newItems.push(newItem);
        setItems((prev) => [newItem, ...prev]);
      } catch (e: any) {
        console.error(`[batch] failed file ${i}`, e);
        failed++;
      }
      setBatchProgress({ done: i + 1, total: batchFiles.length });
    }

    resetAddSheet();

    if (failed > 0) {
      toast({
        title: "Some uploads failed",
        description: `${newItems.length} of ${batchFiles.length} items uploaded.`,
      });
    }

    for (const item of newItems) {
      runAnalysis(item.id);
    }
  };

  const hasItems = items.length > 0;

  return (
    <main className="min-h-screen bg-background flex flex-col">
      <header className="px-6 pt-8 flex items-center justify-between">
        <BrandMark />
      </header>

      <section className="flex-1 px-6 pt-10 pb-24 max-w-2xl mx-auto w-full">
        <h1 className="font-serif text-3xl">Your audit.</h1>

        {loading ? (
          <div className="mt-16 flex justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : !hasItems ? (
          <div className="mt-12 max-w-md">
            <p className="text-muted-foreground text-pretty">
              Nothing here yet. Start by photographing something you own — one piece at a time.
            </p>
            <Button onClick={() => setAddOpen(true)} className="mt-10 rounded-sm h-12 w-full">
              Add your first item
            </Button>
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 gap-3">
            {items.map((it) => (
              <ItemTile
                key={it.id}
                item={it}
                src={urls[it.image_path]}
                onClick={() => setDetailItem(it)}
                onRetry={() => onRetry(it.id)}
                onRemove={() => onDelete(it.id)}
                isStale={staleIds.has(it.id)}
              />
            ))}
          </div>
        )}

        {hasItems && (
          <p className="mt-10 text-sm text-muted-foreground">
            Kept pieces and gap suggestions are in your Wardrobe tab.
          </p>
        )}
      </section>

      {hasItems && !submitting && (
        <button
          onClick={() => setAddOpen(true)}
          aria-label="Add item"
          title="Add item"
          className="fixed bottom-20 right-5 z-50 h-14 w-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg"
        >
          <Plus className="h-6 w-6" />
        </button>
      )}

      {/* Hidden file inputs */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          onFileChosen(e.target.files?.[0] ?? null);
          e.target.value = "";
        }}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          if (!files.length) return;
          if (files.length === 1) {
            onFileChosen(files[0]);
          } else {
            setFileTooLarge(false);
            setBatchFiles(files);
            setBatchPreviews(files.map((f) => URL.createObjectURL(f)));
            setBatchCategories(new Array(files.length).fill(null));
            setAddOpen(true);
          }
        }}
      />

      {/* Add item bottom sheet */}
      <Sheet open={addOpen} onOpenChange={(o) => (o ? setAddOpen(true) : resetAddSheet())}>
        <SheetContent side="bottom" className="rounded-t-xl bg-background border-border p-6 max-h-[92vh] overflow-y-auto">
          <SheetHeader className="text-left">
            <SheetTitle className="font-serif text-2xl font-normal">
              {batchFiles.length > 0
                ? `Categorise ${batchFiles.length} items`
                : pendingPreview
                  ? "Categorise this piece"
                  : "Add an item"}
            </SheetTitle>
          </SheetHeader>

          {fileTooLarge ? (
            <div className="mt-6 space-y-4">
              <p className="text-sm text-destructive">
                This photo is too large (over 50 MB). Please use a smaller image.
              </p>
              <Button variant="outline" onClick={resetAddSheet} className="rounded-sm h-12 w-full">
                Dismiss
              </Button>
            </div>
          ) : batchFiles.length > 0 ? (
            <div className="mt-6">
              {batchProgress ? (
                <div className="space-y-3">
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-300"
                      style={{ width: `${(batchProgress.done / batchProgress.total) * 100}%` }}
                    />
                  </div>
                  <p className="text-sm text-center text-muted-foreground">
                    {batchProgress.done} of {batchProgress.total} uploaded
                  </p>
                </div>
              ) : (
                <>
                  {/* Per-item list */}
                  <div className="space-y-6 max-h-[55vh] overflow-y-auto pr-1 pb-2">
                    {batchFiles.map((_, i) => (
                      <div key={i}>
                        <div className="aspect-square w-full overflow-hidden rounded-sm bg-muted">
                          {batchPreviews[i] && (
                            <img
                              src={batchPreviews[i]}
                              alt={`Photo ${i + 1}`}
                              className="h-full w-full object-cover"
                            />
                          )}
                        </div>
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {CATEGORIES.map((c) => {
                            const selected = batchCategories[i] === c;
                            return (
                              <button
                                key={c}
                                type="button"
                                onClick={() =>
                                  setBatchCategories((prev) =>
                                    prev.map((cat, idx) => (idx === i ? c : cat)),
                                  )
                                }
                                className={cn(
                                  "px-3 py-1.5 rounded-full text-xs border transition",
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
                    ))}
                  </div>
                  {/* Footer */}
                  <div className="mt-4">
                    <p className="text-xs text-center text-muted-foreground mb-3">
                      {batchCategories.filter(Boolean).length} of {batchFiles.length} categorised
                    </p>
                    <Button
                      onClick={onBatchUpload}
                      disabled={batchCategories.some((c) => !c)}
                      className="rounded-sm h-12 w-full"
                    >
                      Analyse all {batchFiles.length} items
                    </Button>
                  </div>
                </>
              )}
            </div>
          ) : !pendingPreview ? (
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
      <Sheet open={!!detailItem} onOpenChange={(o) => !o && setDetailItem(null)}>
        <SheetContent
          side="bottom"
          className="rounded-t-xl bg-background border-border p-0 max-h-[92vh] overflow-y-auto"
        >
          {detailItem && (
            <ItemDetail
              item={detailItem}
              src={urls[detailItem.image_path]}
              onClose={() => setDetailItem(null)}
              onRetry={() => { onRetry(detailItem.id); setDetailItem(null); }}
              onDelete={() => onDelete(detailItem.id)}
            />
          )}
        </SheetContent>
      </Sheet>
    </main>
  );
}

function ItemTile({
  item, src, onClick, onRetry, onRemove, isStale,
}: {
  item: Item; src?: string; onClick: () => void; onRetry: () => void; onRemove: () => void; isStale: boolean;
}) {
  const showRemove = item.status === "failed" || (item.status === "pending" && isStale);
  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-sm bg-muted group">
      <button
        onClick={onClick}
        className="absolute inset-0 w-full h-full"
        aria-label={`View ${item.category}`}
      >
        {src ? (
          <img src={src} alt={item.category} className="h-full w-full object-cover transition group-active:scale-[0.98]" />
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
          onClick={(e) => { e.stopPropagation(); onRetry(); }}
          className="absolute bottom-2 left-2 px-2 py-1 rounded-full bg-verdict-gap text-foreground text-[11px] uppercase tracking-wider font-medium hover:opacity-90"
        >
          Retry
        </button>
      )}
      {showRemove && (
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          aria-label="Remove item"
          className="absolute top-2 right-2 h-6 w-6 rounded-full bg-background/90 flex items-center justify-center shadow-sm"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

function VerdictPill({ verdict, large = false }: { verdict: Verdict; large?: boolean }) {
  const label = verdict === "keep" ? "Keep" : verdict === "dump" ? "Dump" : "Gap";
  const styles =
    verdict === "keep"
      ? "bg-verdict-keep text-primary-foreground"
      : verdict === "dump"
        ? "bg-verdict-dump text-primary-foreground"
        : "bg-verdict-gap text-foreground";
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
  item, src, onClose, onRetry, onDelete,
}: {
  item: Item; src?: string; onClose: () => void; onRetry: () => void; onDelete: () => void;
}) {
  const [styleOpen, setStyleOpen] = useState(false);
  return (
    <div>
      <div className="relative">
        <div className="aspect-square w-full bg-muted overflow-hidden">
          {src ? <img src={src} alt={item.category} className="h-full w-full object-cover" /> : null}
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
          <p className="text-xs uppercase tracking-wider text-muted-foreground">{item.category}</p>
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
              className="px-3 py-1 rounded-full bg-verdict-gap text-foreground text-xs uppercase tracking-wider font-medium"
            >
              Retry
            </button>
          )}
        </div>

        {item.reason && (
          <p className="font-serif text-lg italic leading-snug text-pretty">{item.reason}</p>
        )}

        {item.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-2">
            {item.tags.map((t) => (
              <span key={t} className="px-2.5 py-1 text-xs rounded-full bg-muted text-muted-foreground">{t}</span>
            ))}
          </div>
        )}

        {item.status === "analysed" && (
          <Button onClick={() => setStyleOpen(true)} className="mt-4 rounded-sm h-12 w-full">
            Style this
          </Button>
        )}

        <Button
          variant="ghost"
          onClick={onDelete}
          className="w-full rounded-sm text-destructive hover:text-destructive hover:bg-destructive/10"
        >
          Remove item
        </Button>
      </div>

      <Sheet open={styleOpen} onOpenChange={setStyleOpen}>
        <SheetContent side="bottom" className="rounded-t-xl bg-background border-border p-8 max-h-[60vh]">
          <SheetHeader className="text-left">
            <SheetTitle className="font-serif text-2xl font-normal">
              Outfit suggestions coming soon.
            </SheetTitle>
          </SheetHeader>
          <p className="mt-4 text-muted-foreground">
            We'll style this piece with the rest of your wardrobe in a moment.
          </p>
          <Button onClick={() => setStyleOpen(false)} variant="ghost" className="mt-6 w-full">
            Close
          </Button>
        </SheetContent>
      </Sheet>
    </div>
  );
}

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, ShoppingBag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { BrandMark } from "@/components/BrandMark";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Gap = {
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
};

export default function GapsStub() {
  const { user } = useAuth();
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [gaps, setGaps] = useState<Gap[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const load = async () => {
    if (!user) return;
    setPhase("loading");
    setErr(null);
    const { data, error } = await supabase.functions.invoke("wardrobe-gaps", { body: {} });
    if (error || data?.error) {
      const msg = data?.error ?? error?.message ?? "Couldn't build your gap list.";
      console.error("[gaps]", msg);
      setErr(typeof msg === "string" ? msg : JSON.stringify(msg));
      setPhase("error");
      return;
    }
    setGaps((data?.gaps ?? []) as Gap[]);
    setPhase("ready");
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  return (
    <main className="min-h-screen bg-background flex flex-col">
      <header className="px-6 pt-8 flex items-center justify-between">
        <BrandMark />
      </header>
      <section className="flex-1 px-6 pt-10 pb-24 max-w-2xl mx-auto w-full">
        <h1 className="font-serif text-3xl">Your gaps</h1>
        <p className="mt-3 text-muted-foreground">
          The pieces missing from your wardrobe, in priority order.
        </p>

        {phase === "loading" && (
          <div className="mt-16 flex justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {phase === "error" && (
          <div className="mt-12">
            <p className="text-sm text-destructive">{err}</p>
            <Button onClick={load} className="mt-6 rounded-sm h-11">
              Try again
            </Button>
          </div>
        )}

        {phase === "ready" && (
          <div className="mt-10 space-y-4">
            {gaps.map((g, i) => (
              <article
                key={i}
                className="rounded-sm border border-border bg-muted/30 px-5 py-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <h2 className="font-serif text-xl leading-snug">{g.title}</h2>
                  <PriorityPill priority={g.priority} />
                </div>
                <p className="mt-2 text-muted-foreground text-pretty">{g.description}</p>
                <Button asChild className="mt-5 h-10 rounded-sm">
                  <Link to="/app/recommendations" state={{ gap: g }}>
                    <ShoppingBag className="mr-2 h-4 w-4" /> What should I buy?
                  </Link>
                </Button>
              </article>
            ))}
          </div>
        )}
      </section>
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

import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { BrandMark } from "@/components/BrandMark";
import { copy } from "@/lib/copy";
import {
  FIXED_QUESTIONS,
  FIXED_OPEN_QUESTIONS,
  getCurrencySymbol,
  getBudgetOptions,
  CURRENCY_OPTIONS,
  type Question,
} from "@/lib/interview-questions";

const TOTAL = 13;

function detectCurrency(): string {
  try {
    const lang = navigator.language ?? "";
    if (lang.startsWith("en-GB")) return "GBP — £";
    if (lang.startsWith("en-US")) return "USD — $";
    if (lang.includes("-AE")) return "AED — AED";
  } catch {}
  return "EUR — €";
}

type StoredAnswer = { question_index: number; question: string; answer: string };

export default function Interview() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [answers, setAnswers] = useState<StoredAnswer[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [hydrating, setHydrating] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [chosen, setChosen] = useState<string | null>(null);
  const [otherText, setOtherText] = useState("");
  const [multiAnswers, setMultiAnswers] = useState<Record<string, string>>({});
  const [multiOther, setMultiOther] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState("");
  const [openChipSelected, setOpenChipSelected] = useState<string[]>([]);
  const [openChipOther, setOpenChipOther] = useState("");
  const taRef = useRef<HTMLTextAreaElement>(null);

  // Hydrate
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data, error: selErr } = await supabase
        .from("interview_answers")
        .select("question_index, question, answer")
        .eq("user_id", user.id)
        .order("question_index", { ascending: true });
      if (cancelled) return;
      if (selErr) console.error("[interview] hydrate error", selErr);
      const existing = (data ?? []) as StoredAnswer[];
      setAnswers(existing);
      const next = existing.length;
      if (next >= TOTAL) {
        navigate("/app/interview/complete", { replace: true });
        return;
      }
      setCurrentIndex(next);
      setHydrating(false);
    })();
    return () => { cancelled = true; };
  }, [user, navigate]);

  // Auto-detect currency on Q0
  useEffect(() => {
    if (hydrating || currentIndex !== 0 || chosen !== null) return;
    setChosen(detectCurrency());
  }, [hydrating, currentIndex, chosen]);

  const progress = useMemo(
    () => Math.round((currentIndex / TOTAL) * 100),
    [currentIndex],
  );

  // Budget question (index 2) options depend on currency chosen at Q0
  const budgetOptions = useMemo(() => {
    if (currentIndex !== 2) return null;
    const currencyAns = answers.find((a) => a.question_index === 0)?.answer ?? chosen ?? "";
    return getBudgetOptions(getCurrencySymbol(currencyAns));
  }, [currentIndex, answers, chosen]);

  const currentFixed: Question | null =
    currentIndex < FIXED_QUESTIONS.length ? FIXED_QUESTIONS[currentIndex] : null;

  const currentOpen = currentIndex >= FIXED_QUESTIONS.length
    ? FIXED_OPEN_QUESTIONS[currentIndex - FIXED_QUESTIONS.length] ?? null
    : null;

  const headlineQuestion = currentFixed
    ? currentFixed.kind === "multi"
      ? "A few quick things about you."
      : currentFixed.prompt
    : currentOpen?.prompt ?? "";

  function buildAnswerText(): string | null {
    if (currentFixed?.kind === "choice") {
      if (chosen === "__other__") return otherText.trim() || null;
      return chosen;
    }
    if (currentFixed?.kind === "multi") {
      const parts = currentFixed.parts.map((p) => {
        const v = multiAnswers[p.id];
        if (!v) return null;
        const final = v === "__other__" ? multiOther[p.id]?.trim() : v;
        return final ? `${p.prompt} — ${final}` : null;
      });
      if (parts.some((x) => !x)) return null;
      return parts.join("\n");
    }
    if (currentOpen?.chips) {
      const others = openChipSelected.includes("__other__")
        ? [openChipOther.trim()].filter(Boolean)
        : [];
      const picks = openChipSelected.filter((v) => v !== "__other__");
      const all = [...picks, ...others];
      if (all.length === 0) return null;
      return all.join(", ");
    }
    return draft.trim() || null;
  }

  function questionTextForStorage(): string {
    if (currentFixed?.kind === "choice") return currentFixed.prompt;
    if (currentFixed?.kind === "multi") {
      return currentFixed.parts.map((p) => p.prompt).join(" / ");
    }
    return currentOpen?.prompt ?? "";
  }

  const submit = async () => {
    if (!user || busy) return;
    const answerText = buildAnswerText();
    if (!answerText) return;

    const entry: StoredAnswer = {
      question_index: currentIndex,
      question: questionTextForStorage(),
      answer: answerText,
    };
    setBusy(true);
    setError(null);
    const { error: insErr } = await supabase
      .from("interview_answers")
      .upsert({ ...entry, user_id: user.id }, { onConflict: "user_id,question_index" });
    if (insErr) {
      console.error("[interview] save error", insErr);
      setBusy(false);
      setError(copy.interview.errorSaving);
      return;
    }
    const newHistory = [...answers.filter((a) => a.question_index !== currentIndex), entry]
      .sort((a, b) => a.question_index - b.question_index);
    setAnswers(newHistory);

    setChosen(null);
    setOtherText("");
    setMultiAnswers({});
    setMultiOther({});
    setDraft("");
    setOpenChipSelected([]);
    setOpenChipOther("");

    const nextIndex = currentIndex + 1;
    if (nextIndex >= TOTAL) {
      // Hand off to the complete page, which will run synthesis with a loading state.
      navigate("/app/interview/complete", { replace: true });
      return;
    }
    setCurrentIndex(nextIndex);
    setBusy(false);
    requestAnimationFrame(() => taRef.current?.focus());
  };

  const goBack = () => {
    if (currentIndex === 0 || busy) return;
    setCurrentIndex(currentIndex - 1);
    setChosen(null);
    setOtherText("");
    setMultiAnswers({});
    setMultiOther({});
    setDraft("");
    setOpenChipSelected([]);
    setOpenChipOther("");
    setError(null);
  };

  const canSubmit = !!buildAnswerText() && !busy;

  return (
    <main className="min-h-screen bg-background flex flex-col">
      <header className="px-6 pt-8">
        <div className="flex items-center justify-between">
          <BrandMark />
          <span className="text-xs uppercase tracking-wider text-muted-foreground">
            {copy.interview.progress(Math.min(currentIndex + 1, TOTAL), TOTAL)}
          </span>
        </div>
        <Progress value={progress} className="mt-4 h-1 bg-muted [&>div]:bg-primary" />
      </header>

      <section className="flex-1 px-6 pt-12 pb-24 max-w-md mx-auto w-full">
        {hydrating && currentIndex === 0 && answers.length === 0 ? (
          <p className="text-muted-foreground mb-6">{copy.interview.intro}</p>
        ) : null}

        <h1
          key={currentIndex}
          className="font-serif text-3xl leading-snug text-balance animate-in fade-in slide-in-from-bottom-2 duration-500"
        >
          {headlineQuestion}
        </h1>

        {currentFixed?.kind === "choice" && (
          <div className="mt-8 space-y-3">
            {(budgetOptions ?? currentFixed.options).map((opt) => (
              <ChoiceChip
                key={opt}
                label={opt}
                selected={chosen === opt}
                onClick={() => setChosen(opt)}
              />
            ))}
            {currentFixed.allowOther && (
              <>
                <ChoiceChip
                  label="Other (type your own)"
                  selected={chosen === "__other__"}
                  onClick={() => setChosen("__other__")}
                />
                {chosen === "__other__" && (
                  <Input
                    autoFocus
                    value={otherText}
                    onChange={(e) => setOtherText(e.target.value)}
                    placeholder={copy.interview.otherPlaceholder}
                    className="mt-2 h-12 rounded-sm border-foreground/20 bg-transparent focus-visible:ring-primary"
                  />
                )}
              </>
            )}
          </div>
        )}

        {currentFixed?.kind === "multi" && (
          <div className="mt-8 space-y-8">
            {currentFixed.parts.map((part) => (
              <div key={part.id}>
                <p className="font-serif text-lg leading-snug">{part.prompt}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {part.options.map((opt) => (
                    <PillChip
                      key={opt}
                      label={opt}
                      selected={multiAnswers[part.id] === opt}
                      onClick={() => setMultiAnswers((m) => ({ ...m, [part.id]: opt }))}
                    />
                  ))}
                  {part.allowOther && (
                    <PillChip
                      label="Other"
                      selected={multiAnswers[part.id] === "__other__"}
                      onClick={() => setMultiAnswers((m) => ({ ...m, [part.id]: "__other__" }))}
                    />
                  )}
                </div>
                {multiAnswers[part.id] === "__other__" && (
                  <Input
                    autoFocus
                    value={multiOther[part.id] ?? ""}
                    onChange={(e) =>
                      setMultiOther((m) => ({ ...m, [part.id]: e.target.value }))
                    }
                    placeholder={copy.interview.otherPlaceholder}
                    className="mt-3 h-11 rounded-sm border-foreground/20 bg-transparent focus-visible:ring-primary"
                  />
                )}
              </div>
            ))}
          </div>
        )}

        {!currentFixed && currentOpen?.chips && (
          <div className="mt-4">
            {currentOpen.chips.helperText && (
              <p className="text-xs text-muted-foreground -mt-2 mb-4">
                {currentOpen.chips.helperText}
                {currentOpen.chips.select === "multi" && currentOpen.chips.maxSelect ? (
                  <span className="ml-2">
                    ({openChipSelected.length} of {currentOpen.chips.maxSelect} selected)
                  </span>
                ) : null}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              {currentOpen.chips.options.map((opt) => {
                const selected = openChipSelected.includes(opt);
                const max = currentOpen.chips!.maxSelect;
                const totalSelected = openChipSelected.length;
                const atLimit =
                  currentOpen.chips!.select === "multi" && !!max && totalSelected >= max;
                const disabled = !selected && atLimit;
                return (
                  <PillChip
                    key={opt}
                    label={opt}
                    selected={selected}
                    disabled={disabled}
                    onClick={() => {
                      if (currentOpen.chips!.select === "single") {
                        setOpenChipSelected(selected ? [] : [opt]);
                      } else {
                        setOpenChipSelected((prev) => {
                          if (selected) return prev.filter((v) => v !== opt);
                          if (max && prev.length >= max) return prev;
                          return [...prev, opt];
                        });
                      }
                    }}
                  />
                );
              })}
              {currentOpen.chips.allowOther && (() => {
                const isSel = openChipSelected.includes("__other__");
                const max = currentOpen.chips!.maxSelect;
                const atLimit =
                  currentOpen.chips!.select === "multi" && !!max && openChipSelected.length >= max;
                const disabled = !isSel && atLimit;
                return (
                  <PillChip
                    label="Other (type your own)"
                    selected={isSel}
                    disabled={disabled}
                    onClick={() => {
                      if (currentOpen.chips!.select === "single") {
                        setOpenChipSelected(isSel ? [] : ["__other__"]);
                      } else {
                        setOpenChipSelected((prev) => {
                          if (isSel) return prev.filter((v) => v !== "__other__");
                          if (max && prev.length >= max) return prev;
                          return [...prev, "__other__"];
                        });
                      }
                    }}
                  />
                );
              })()}
            </div>
            {openChipSelected.includes("__other__") && (
              <Input
                autoFocus
                value={openChipOther}
                onChange={(e) => setOpenChipOther(e.target.value)}
                placeholder={copy.interview.otherPlaceholder}
                className="mt-3 h-12 rounded-sm border-foreground/20 bg-transparent focus-visible:ring-primary"
              />
            )}
          </div>
        )}

        {!currentFixed && !currentOpen?.chips && (
          <Textarea
            ref={taRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={copy.interview.placeholder}
            rows={4}
            className="mt-8 rounded-sm border-foreground/20 bg-transparent text-base focus-visible:ring-primary resize-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
            }}
          />
        )}

        {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

        <div className="mt-10 flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={goBack}
            disabled={currentIndex === 0 || busy}
            className="text-muted-foreground"
          >
            {copy.interview.back}
          </Button>
          <Button
            type="button"
            onClick={submit}
            disabled={!canSubmit}
            className="rounded-sm h-11 px-6"
          >
            {busy
              ? copy.interview.thinking
              : (currentIndex + 1 === TOTAL ? copy.interview.finish : copy.interview.next)}
          </Button>
        </div>
      </section>
    </main>
  );
}

function ChoiceChip({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "w-full text-left px-5 py-4 rounded-sm border transition-colors",
        selected
          ? "border-primary bg-primary/5 text-foreground"
          : "border-foreground/15 hover:border-foreground/40 text-foreground",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

function PillChip({ label, selected, onClick, disabled }: { label: string; selected: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        "px-4 py-2 rounded-full border text-sm transition-colors",
        selected
          ? "border-primary bg-primary text-primary-foreground"
          : disabled
            ? "border-foreground/10 text-foreground/30 cursor-not-allowed"
            : "border-foreground/20 hover:border-foreground/50 text-foreground",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

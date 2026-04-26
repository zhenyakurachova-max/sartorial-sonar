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
  FALLBACK_QUESTIONS,
  type Question,
} from "@/lib/interview-questions";

const TOTAL = 10;

type StoredAnswer = { question_index: number; question: string; answer: string };

export default function Interview() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [answers, setAnswers] = useState<StoredAnswer[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [adaptiveQuestion, setAdaptiveQuestion] = useState<string>("");
  const [hydrating, setHydrating] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // For choice / multi questions
  const [chosen, setChosen] = useState<string | null>(null);
  const [otherText, setOtherText] = useState("");
  const [multiAnswers, setMultiAnswers] = useState<Record<string, string>>({});
  const [multiOther, setMultiOther] = useState<Record<string, string>>({});
  // For open / adaptive question
  const [draft, setDraft] = useState("");
  const taRef = useRef<HTMLTextAreaElement>(null);

  // Hydrate
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("interview_answers")
        .select("question_index, question, answer")
        .eq("user_id", user.id)
        .order("question_index", { ascending: true });
      if (cancelled) return;
      const existing = (data ?? []) as StoredAnswer[];
      setAnswers(existing);
      const next = existing.length;
      if (next >= TOTAL) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("interview_complete")
          .eq("id", user.id)
          .maybeSingle();
        if (prof?.interview_complete) {
          navigate("/app/interview/complete", { replace: true });
          return;
        }
        await synthesise(existing);
        return;
      }
      setCurrentIndex(next);
      if (next >= FIXED_QUESTIONS.length) {
        await fetchAdaptive(existing, next);
      }
      setHydrating(false);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const progress = useMemo(
    () => Math.round((currentIndex / TOTAL) * 100),
    [currentIndex],
  );

  const currentFixed: Question | null =
    currentIndex < FIXED_QUESTIONS.length ? FIXED_QUESTIONS[currentIndex] : null;

  const adaptiveIndex = currentIndex - FIXED_QUESTIONS.length;
  const fallback =
    FALLBACK_QUESTIONS[adaptiveIndex] ??
    FALLBACK_QUESTIONS[FALLBACK_QUESTIONS.length - 1];
  const headlineQuestion = currentFixed
    ? currentFixed.kind === "multi"
      ? "A few quick things about fit."
      : currentFixed.prompt
    : adaptiveQuestion || fallback;

  async function fetchAdaptive(history: StoredAnswer[], index: number) {
    setBusy(true);
    setError(null);
    const fbIdx = index - FIXED_QUESTIONS.length;
    const fb = FALLBACK_QUESTIONS[fbIdx] ?? FALLBACK_QUESTIONS[FALLBACK_QUESTIONS.length - 1];
    try {
      const { data, error: fnError } = await supabase.functions.invoke("interview", {
        body: { mode: "next_question", history, total: TOTAL },
      });
      if (fnError || !data?.question) {
        setAdaptiveQuestion(fb);
      } else {
        setAdaptiveQuestion(data.question as string);
      }
    } catch {
      setAdaptiveQuestion(fb);
    }
    setBusy(false);
    requestAnimationFrame(() => taRef.current?.focus());
  }

  async function synthesise(history: StoredAnswer[]) {
    if (!user) return;
    setBusy(true);
    setError(null);
    const { data, error: fnError } = await supabase.functions.invoke("interview", {
      body: { mode: "synthesise", history },
    });
    if (fnError || !data?.profile) {
      setBusy(false);
      setError(copy.interview.errorSaving);
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
        budget_ceiling: p.budget_ceiling ?? null,
        interview_complete: true,
      })
      .eq("id", user.id);
    setBusy(false);
    if (upErr) {
      setError(copy.interview.errorSaving);
      return;
    }
    navigate("/app/interview/complete", { replace: true });
  }

  function buildAnswerText(): string | null {
    if (currentFixed?.kind === "choice") {
      if (chosen === "__other__") {
        const t = otherText.trim();
        return t || null;
      }
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
    return draft.trim() || null;
  }

  function questionTextForStorage(): string {
    if (currentFixed?.kind === "choice") return currentFixed.prompt;
    if (currentFixed?.kind === "multi") {
      return currentFixed.parts.map((p) => p.prompt).join(" / ");
    }
    return adaptiveQuestion || fallback;
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
      setBusy(false);
      setError(copy.interview.errorSaving);
      return;
    }
    const newHistory = [...answers.filter((a) => a.question_index !== currentIndex), entry]
      .sort((a, b) => a.question_index - b.question_index);
    setAnswers(newHistory);

    // Reset inputs
    setChosen(null);
    setOtherText("");
    setMultiAnswers({});
    setMultiOther({});
    setDraft("");
    setAdaptiveQuestion("");

    const nextIndex = currentIndex + 1;
    if (nextIndex >= TOTAL) {
      await synthesise(newHistory);
      return;
    }
    setCurrentIndex(nextIndex);
    if (nextIndex >= FIXED_QUESTIONS.length) {
      await fetchAdaptive(newHistory, nextIndex);
    } else {
      setBusy(false);
    }
  };

  const goBack = () => {
    if (currentIndex === 0 || busy) return;
    const prevIndex = currentIndex - 1;
    setCurrentIndex(prevIndex);
    setChosen(null);
    setOtherText("");
    setMultiAnswers({});
    setMultiOther({});
    setDraft("");
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
        <Progress value={progress} className="mt-4 h-px bg-border" />
      </header>

      <section className="flex-1 px-6 pt-12 pb-10 max-w-md mx-auto w-full">
        {hydrating && currentIndex === 0 && answers.length === 0 ? (
          <p className="text-muted-foreground mb-6">{copy.interview.intro}</p>
        ) : null}

        <h1
          key={currentIndex}
          className="font-serif text-3xl leading-snug text-balance animate-in fade-in slide-in-from-bottom-2 duration-500"
        >
          {busy && !adaptiveQuestion && !currentFixed ? copy.interview.thinking : headlineQuestion}
        </h1>

        {/* Choice */}
        {currentFixed?.kind === "choice" && (
          <div className="mt-8 space-y-3">
            {currentFixed.options.map((opt) => (
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

        {/* Multi-part */}
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
                      onClick={() =>
                        setMultiAnswers((m) => ({ ...m, [part.id]: opt }))
                      }
                    />
                  ))}
                  {part.allowOther && (
                    <PillChip
                      label="Other"
                      selected={multiAnswers[part.id] === "__other__"}
                      onClick={() =>
                        setMultiAnswers((m) => ({ ...m, [part.id]: "__other__" }))
                      }
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

        {/* Open / adaptive */}
        {!currentFixed && (
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
              ? (currentIndex + 1 >= TOTAL ? copy.interview.saving : copy.interview.thinking)
              : (currentIndex + 1 === TOTAL ? copy.interview.finish : copy.interview.next)}
          </Button>
        </div>
      </section>
    </main>
  );
}

function ChoiceChip({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
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

function PillChip({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "px-4 py-2 rounded-full border text-sm transition-colors",
        selected
          ? "border-primary bg-primary text-primary-foreground"
          : "border-foreground/20 hover:border-foreground/50 text-foreground",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { BrandMark } from "@/components/BrandMark";
import { copy } from "@/lib/copy";

const TOTAL = 10;

const FIXED_QUESTIONS = [
  "Where do you spend most of your week — and what do you wear there?",
  "What's your budget ceiling for a single piece you'd actually buy?",
  "Anything about your body or how clothes fit that I should know?",
];

type Answer = { question_index: number; question: string; answer: string };

export default function Interview() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [answers, setAnswers] = useState<Answer[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState<string>(FIXED_QUESTIONS[0]);
  const [draft, setDraft] = useState("");
  const [hydrating, setHydrating] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  // Hydrate from DB so user can resume.
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
      const existing = (data ?? []) as Answer[];
      setAnswers(existing);
      const next = existing.length;
      if (next >= TOTAL) {
        // Already done — synthesise (or jump to complete if profile already exists)
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
      if (next < FIXED_QUESTIONS.length) {
        setCurrentQuestion(FIXED_QUESTIONS[next]);
      } else {
        await fetchNextQuestion(existing);
      }
      setHydrating(false);
      requestAnimationFrame(() => taRef.current?.focus());
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const progress = useMemo(() => Math.round((currentIndex / TOTAL) * 100), [currentIndex]);

  async function fetchNextQuestion(history: Answer[]) {
    setBusy(true);
    setError(null);
    const { data, error: fnError } = await supabase.functions.invoke("interview", {
      body: { mode: "next_question", history, total: TOTAL },
    });
    setBusy(false);
    if (fnError || !data?.question) {
      setError(copy.interview.errorThinking);
      return;
    }
    setCurrentQuestion(data.question as string);
  }

  async function synthesise(history: Answer[]) {
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

  const submit = async () => {
    if (!user || !draft.trim() || busy) return;
    const entry: Answer = {
      question_index: currentIndex,
      question: currentQuestion,
      answer: draft.trim(),
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
    const newHistory = [...answers, entry];
    setAnswers(newHistory);
    setDraft("");

    const nextIndex = currentIndex + 1;
    if (nextIndex >= TOTAL) {
      await synthesise(newHistory);
      return;
    }
    setCurrentIndex(nextIndex);
    if (nextIndex < FIXED_QUESTIONS.length) {
      setCurrentQuestion(FIXED_QUESTIONS[nextIndex]);
      setBusy(false);
    } else {
      await fetchNextQuestion(newHistory);
    }
    requestAnimationFrame(() => taRef.current?.focus());
  };

  const goBack = () => {
    if (currentIndex === 0 || busy) return;
    const prevIndex = currentIndex - 1;
    const prev = answers[prevIndex];
    if (!prev) return;
    setAnswers(answers.slice(0, prevIndex));
    setCurrentIndex(prevIndex);
    setCurrentQuestion(prev.question);
    setDraft(prev.answer);
  };

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

      <section className="flex-1 px-6 pt-16 pb-10 max-w-md mx-auto w-full">
        {hydrating && currentIndex === 0 && answers.length === 0 ? (
          <p className="text-muted-foreground">{copy.interview.intro}</p>
        ) : null}

        <h1
          key={currentIndex}
          className="font-serif text-3xl leading-snug text-balance animate-in fade-in slide-in-from-bottom-2 duration-500"
        >
          {busy && !currentQuestion ? copy.interview.thinking : currentQuestion}
        </h1>

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

        {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

        <div className="mt-8 flex items-center justify-between">
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
            disabled={!draft.trim() || busy}
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

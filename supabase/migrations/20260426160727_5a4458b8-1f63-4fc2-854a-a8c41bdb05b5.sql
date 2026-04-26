-- Make interview answer ownership policies explicit for logged-in users
ALTER TABLE public.interview_answers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users insert own answers" ON public.interview_answers;
DROP POLICY IF EXISTS "Users view own answers" ON public.interview_answers;
DROP POLICY IF EXISTS "Users update own answers" ON public.interview_answers;
DROP POLICY IF EXISTS "Users delete own answers" ON public.interview_answers;

CREATE POLICY "Authenticated users can insert own answers"
ON public.interview_answers
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authenticated users can view own answers"
ON public.interview_answers
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users can update own answers"
ON public.interview_answers
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authenticated users can delete own answers"
ON public.interview_answers
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.interview_answers TO authenticated;

-- updated_at helper
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- profiles table (PK = auth user id)
CREATE TABLE public.profiles (
  id UUID NOT NULL PRIMARY KEY,
  style_summary TEXT,
  colour_palette TEXT[] NOT NULL DEFAULT '{}',
  style_archetypes TEXT[] NOT NULL DEFAULT '{}',
  avoid_list TEXT[] NOT NULL DEFAULT '{}',
  body_notes TEXT,
  budget_ceiling INT,
  interview_complete BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- auto-create profile row on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id) VALUES (NEW.id)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- interview answers
CREATE TABLE public.interview_answers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  question_index INT NOT NULL,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, question_index)
);

CREATE INDEX idx_interview_answers_user ON public.interview_answers(user_id, question_index);

ALTER TABLE public.interview_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own answers"
  ON public.interview_answers FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own answers"
  ON public.interview_answers FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own answers"
  ON public.interview_answers FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own answers"
  ON public.interview_answers FOR DELETE
  USING (auth.uid() = user_id);

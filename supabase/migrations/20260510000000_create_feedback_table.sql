create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  rating smallint not null check (rating between 1 and 5),
  message text,
  created_at timestamptz default now()
);

alter table public.feedback enable row level security;

-- Users can submit their own feedback
create policy "Users can insert own feedback"
  on public.feedback for insert
  with check (auth.uid() = user_id);

-- Only service role reads all (via dashboard / Table Editor)

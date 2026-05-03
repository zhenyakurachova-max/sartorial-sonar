create table public.gap_summaries (
  id uuid not null default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  gaps jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

alter table public.gap_summaries enable row level security;

create policy "Users view own gap summary"
  on public.gap_summaries for select
  using (auth.uid() = user_id);

create policy "Users delete own gap summary"
  on public.gap_summaries for delete
  using (auth.uid() = user_id);

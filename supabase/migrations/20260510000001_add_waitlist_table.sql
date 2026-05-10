create table if not exists public.waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  created_at timestamptz default now()
);

alter table public.waitlist enable row level security;
-- Only service role can read/write waitlist entries

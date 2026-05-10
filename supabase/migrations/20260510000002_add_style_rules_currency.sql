alter table public.profiles
  add column if not exists style_rules text,
  add column if not exists currency text;

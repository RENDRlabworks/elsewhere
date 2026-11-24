-- Ideas inbox: quick notes, links and photos captured on the go, waiting to become scenes.
-- Safe to run more than once. Until it runs, the inbox explains that it needs this migration
-- and the rest of Elsewhere works as before.
create table if not exists public.ideas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  text text not null default '' check (char_length(text) <= 4000),
  url text check (url is null or char_length(url) <= 2000),
  asset_id uuid references public.assets (id) on delete set null,
  source text not null default 'typed' check (source in ('typed', 'shared', 'photo')),
  status text not null default 'inbox' check (status in ('inbox', 'used', 'archived')),
  scene_id uuid references public.scenes (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ideas_user_status_idx on public.ideas (user_id, status, created_at desc);

drop trigger if exists ideas_updated_at on public.ideas;
create trigger ideas_updated_at before update on public.ideas
  for each row execute function public.set_updated_at();

alter table public.ideas enable row level security;
drop policy if exists ideas_owner on public.ideas;
create policy ideas_owner on public.ideas
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and (asset_id is null or exists (select 1 from public.assets a where a.id = asset_id and a.user_id = (select auth.uid())))
    and (scene_id is null or exists (select 1 from public.scenes s where s.id = scene_id and s.user_id = (select auth.uid())))
  );


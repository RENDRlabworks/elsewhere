-- Elsewhere: initial schema
-- Every table is owned by a user (user_id = auth.uid()) and protected by Row Level Security.
-- Column names are snake_case; the application maps them to camelCase.

create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Users
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique default auth.uid() references auth.users (id) on delete cascade,
  display_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique default auth.uid() references auth.users (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  bootstrap_version integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Create a profile row when a user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, display_name)
  values (new.id, coalesce(split_part(new.email, '@', 1), 'Artist'))
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Style DNA
-- ---------------------------------------------------------------------------

create table public.style_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  description text not null default '',
  attributes jsonb not null,
  locked_attributes text[] not null default '{}',
  locked boolean not null default false,
  archived boolean not null default false,
  preset_key text,
  default_palette jsonb not null default '[]'::jsonb,
  current_version integer not null default 0,
  current_version_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index style_profiles_user_preset_idx on public.style_profiles (user_id, preset_key) where preset_key is not null;
create index style_profiles_user_idx on public.style_profiles (user_id, created_at);

-- Immutable snapshots: no update or delete policies exist for this table.
create table public.style_profile_versions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  profile_id uuid not null references public.style_profiles (id) on delete cascade,
  version integer not null check (version > 0),
  snapshot jsonb not null,
  created_at timestamptz not null default now(),
  unique (profile_id, version)
);
create index style_profile_versions_profile_idx on public.style_profile_versions (user_id, profile_id, version desc);

alter table public.style_profiles
  add constraint style_profiles_current_version_fk
  foreign key (current_version_id) references public.style_profile_versions (id) on delete set null;

-- ---------------------------------------------------------------------------
-- Assets and references
-- ---------------------------------------------------------------------------

create table public.assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('generation', 'reference', 'import')),
  bucket text not null check (bucket in ('generations', 'references', 'imports')),
  path text not null,
  thumb_path text,
  mime_type text not null,
  width integer not null check (width > 0),
  height integer not null check (height > 0),
  bytes bigint not null check (bytes >= 0),
  dominant_colors text[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (bucket, path)
);
create index assets_user_idx on public.assets (user_id, kind);

create table public.reference_images (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  profile_id uuid references public.style_profiles (id) on delete set null,
  asset_id uuid not null references public.assets (id) on delete cascade,
  role text not null check (role in ('style', 'composition', 'lighting', 'color', 'texture', 'subject', 'environment')),
  label text not null default '',
  notes text not null default '',
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index reference_images_profile_idx on public.reference_images (user_id, profile_id);

-- ---------------------------------------------------------------------------
-- Scenes, palettes, templates
-- ---------------------------------------------------------------------------

create table public.prompt_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  description text not null default '',
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.scenes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null default 'Untitled scene',
  description text not null default '',
  free_direction text not null default '',
  environment text not null default '',
  subject jsonb not null,
  secondary_subject jsonb,
  natural_element text not null default '',
  phenomenon text not null default '',
  emotional_tone text not null default '',
  atmosphere text not null default '',
  time_of_day text not null default 'unspecified',
  materials text not null default '',
  lighting text not null default '',
  composition jsonb not null,
  palette jsonb not null,
  style_profile_id uuid references public.style_profiles (id) on delete set null,
  reference_ids uuid[] not null default '{}',
  output jsonb not null,
  prompt_override text,
  prompt_template_id uuid references public.prompt_templates (id) on delete set null,
  locked_fields text[] not null default '{}',
  status text not null default 'draft' check (status in ('draft', 'concept', 'seed')),
  origin text not null default 'studio' check (origin in ('studio', 'explore', 'seed', 'restore')),
  series_index integer,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index scenes_user_updated_idx on public.scenes (user_id, archived, status, updated_at desc);

create table public.palettes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  swatches jsonb not null,
  mode text not null default 'custom',
  materials text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Generation
-- ---------------------------------------------------------------------------

create table public.generation_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  scene_id uuid references public.scenes (id) on delete set null,
  status text not null check (status in ('queued', 'generating', 'processing', 'completed', 'failed', 'cancelled')),
  operation text not null check (operation in ('generate', 'variation', 'refine')),
  provider text not null,
  model text not null,
  requested_count integer not null check (requested_count between 1 and 10),
  idempotency_key text not null,
  request jsonb not null default '{}'::jsonb,
  error text,
  attempts integer not null default 0,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);
create index generation_jobs_active_idx on public.generation_jobs (user_id, status, updated_at);

create table public.generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  scene_id uuid references public.scenes (id) on delete set null,
  job_id uuid references public.generation_jobs (id) on delete set null,
  parent_id uuid references public.generations (id) on delete set null,
  root_id uuid references public.generations (id) on delete set null,
  kind text not null check (kind in ('generate', 'variation', 'refine', 'import')),
  source text not null check (source in ('generated', 'imported')),
  status text not null check (status in ('queued', 'generating', 'processing', 'completed', 'failed', 'cancelled')),
  title text not null default '',
  prompt text not null default '',
  prompt_sections jsonb not null default '[]'::jsonb,
  scene_snapshot jsonb,
  style_profile_id uuid references public.style_profiles (id) on delete set null,
  style_version_id uuid references public.style_profile_versions (id) on delete set null,
  style_snapshot jsonb,
  reference_ids uuid[] not null default '{}',
  references_submitted boolean not null default false,
  provider text,
  model text,
  output_settings jsonb,
  width integer,
  height integer,
  asset_id uuid references public.assets (id) on delete set null,
  error_message text,
  duration_ms integer,
  cost_usd double precision,
  cost_estimated boolean not null default true,
  usage jsonb,
  rating smallint not null default 0 check (rating between 0 and 5),
  favorite boolean not null default false,
  review_status text not null default 'unreviewed' check (review_status in ('unreviewed', 'accepted', 'rejected')),
  notes text not null default '',
  tags text[] not null default '{}',
  search_text text not null default '',
  character_kind text,
  environment text not null default '',
  palette_hexes text[] not null default '{}',
  variation_index integer not null default 0,
  is_dev_placeholder boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);
create index generations_user_created_idx on public.generations (user_id, created_at desc);
create index generations_scene_idx on public.generations (user_id, scene_id, created_at desc);
create index generations_job_idx on public.generations (job_id);
create index generations_root_idx on public.generations (root_id);
create index generations_review_idx on public.generations (user_id, review_status);
create index generations_favorite_idx on public.generations (user_id) where favorite;
create index generations_character_idx on public.generations (user_id, character_kind);
create index generations_model_idx on public.generations (user_id, model);
create index generations_style_idx on public.generations (user_id, style_profile_id);
create index generations_palette_idx on public.generations using gin (palette_hexes);
create index generations_search_idx on public.generations using gin (search_text extensions.gin_trgm_ops);

create table public.prompt_versions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  scene_id uuid not null references public.scenes (id) on delete cascade,
  text text not null,
  sections jsonb not null default '[]'::jsonb,
  is_manual boolean not null default false,
  source text not null check (source in ('assembled', 'manual', 'refined', 'generation')),
  generation_id uuid references public.generations (id) on delete set null,
  created_at timestamptz not null default now()
);
create index prompt_versions_scene_idx on public.prompt_versions (user_id, scene_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Collections
-- ---------------------------------------------------------------------------

create table public.collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  description text not null default '',
  notes text not null default '',
  cover_generation_id uuid references public.generations (id) on delete set null,
  style_profile_id uuid references public.style_profiles (id) on delete set null,
  tags text[] not null default '{}',
  target_count integer check (target_count is null or target_count > 0),
  view_mode text not null default 'masonry' check (view_mode in ('masonry', 'grid', 'editorial', 'filmstrip', 'list')),
  is_seed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index collections_one_seed_idx on public.collections (user_id) where is_seed;
create index collections_user_idx on public.collections (user_id, updated_at desc);

create table public.collection_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  collection_id uuid not null references public.collections (id) on delete cascade,
  generation_id uuid references public.generations (id) on delete set null,
  scene_id uuid references public.scenes (id) on delete set null,
  position integer not null default 0,
  created_at timestamptz not null default now()
);
create index collection_items_collection_idx on public.collection_items (collection_id, position);
create index collection_items_generation_idx on public.collection_items (generation_id);

-- ---------------------------------------------------------------------------
-- Tags, reviews, usage
-- ---------------------------------------------------------------------------

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create table public.taggings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  tag_id uuid not null references public.tags (id) on delete cascade,
  target_type text not null check (target_type in ('generation', 'collection')),
  target_id uuid not null,
  created_at timestamptz not null default now(),
  unique (tag_id, target_type, target_id)
);
create index taggings_target_idx on public.taggings (user_id, target_type, target_id);

create table public.image_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  generation_id uuid not null references public.generations (id) on delete cascade,
  kind text not null check (kind in ('manual', 'ai')),
  criteria jsonb not null default '{}'::jsonb,
  summary text not null default '',
  findings jsonb not null default '[]'::jsonb,
  drift_detected boolean not null default false,
  suggestions text[] not null default '{}',
  repetition_notes text not null default '',
  model text,
  style_version_id uuid references public.style_profile_versions (id) on delete set null,
  created_at timestamptz not null default now()
);
create index image_reviews_generation_idx on public.image_reviews (generation_id, created_at desc);

create table public.usage_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  job_id uuid references public.generation_jobs (id) on delete set null,
  generation_id uuid references public.generations (id) on delete set null,
  provider text not null,
  model text not null,
  kind text not null check (kind in ('image', 'text')),
  images integer not null default 0,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  cost_usd double precision,
  estimated boolean not null default true,
  created_at timestamptz not null default now()
);
create index usage_records_user_created_idx on public.usage_records (user_id, created_at desc);
create index usage_records_model_idx on public.usage_records (user_id, model, kind);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array[
    'profiles', 'user_preferences', 'style_profiles', 'reference_images', 'prompt_templates',
    'scenes', 'palettes', 'generation_jobs', 'generations', 'collections'
  ] loop
    execute format('create trigger %I before update on public.%I for each row execute function public.set_updated_at()', t || '_updated_at', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

-- Owner-only access for ordinary tables.
do $$
declare t text;
begin
  foreach t in array array[
    'profiles', 'user_preferences', 'style_profiles', 'assets', 'prompt_templates', 'scenes',
    'palettes', 'prompt_versions', 'generation_jobs', 'tags', 'taggings'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))',
      t || '_owner', t
    );
  end loop;
end;
$$;

-- Immutable, append-only tables: read and insert only.
alter table public.style_profile_versions enable row level security;
create policy style_profile_versions_select on public.style_profile_versions
  for select to authenticated using (user_id = (select auth.uid()));
create policy style_profile_versions_insert on public.style_profile_versions
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.style_profiles p where p.id = profile_id and p.user_id = (select auth.uid()))
  );

alter table public.usage_records enable row level security;
create policy usage_records_select on public.usage_records
  for select to authenticated using (user_id = (select auth.uid()));
create policy usage_records_insert on public.usage_records
  for insert to authenticated with check (user_id = (select auth.uid()));

-- Tables whose foreign keys must also point at the caller's own rows.
alter table public.reference_images enable row level security;
create policy reference_images_owner on public.reference_images
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.assets a where a.id = asset_id and a.user_id = (select auth.uid()))
    and (profile_id is null or exists (select 1 from public.style_profiles p where p.id = profile_id and p.user_id = (select auth.uid())))
  );

alter table public.generations enable row level security;
create policy generations_owner on public.generations
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and (asset_id is null or exists (select 1 from public.assets a where a.id = asset_id and a.user_id = (select auth.uid())))
    and (scene_id is null or exists (select 1 from public.scenes s where s.id = scene_id and s.user_id = (select auth.uid())))
  );

alter table public.collections enable row level security;
create policy collections_owner on public.collections
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and (cover_generation_id is null or exists (select 1 from public.generations g where g.id = cover_generation_id and g.user_id = (select auth.uid())))
  );

alter table public.collection_items enable row level security;
create policy collection_items_owner on public.collection_items
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.collections c where c.id = collection_id and c.user_id = (select auth.uid()))
    and (generation_id is null or exists (select 1 from public.generations g where g.id = generation_id and g.user_id = (select auth.uid())))
    and (scene_id is null or exists (select 1 from public.scenes s where s.id = scene_id and s.user_id = (select auth.uid())))
  );

alter table public.image_reviews enable row level security;
create policy image_reviews_owner on public.image_reviews
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.generations g where g.id = generation_id and g.user_id = (select auth.uid()))
  );

-- ---------------------------------------------------------------------------
-- Private storage. Objects live under "<user id>/..." in each bucket.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('generations', 'generations', false, 52428800, array['image/png', 'image/jpeg', 'image/webp']),
  ('references', 'references', false, 26214400, array['image/png', 'image/jpeg', 'image/webp', 'image/avif', 'image/gif']),
  ('imports', 'imports', false, 26214400, array['image/png', 'image/jpeg', 'image/webp', 'image/avif', 'image/gif'])
on conflict (id) do update set public = false;

create policy elsewhere_storage_select on storage.objects
  for select to authenticated
  using (bucket_id in ('generations', 'references', 'imports') and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy elsewhere_storage_insert on storage.objects
  for insert to authenticated
  with check (bucket_id in ('generations', 'references', 'imports') and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy elsewhere_storage_update on storage.objects
  for update to authenticated
  using (bucket_id in ('generations', 'references', 'imports') and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id in ('generations', 'references', 'imports') and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy elsewhere_storage_delete on storage.objects
  for delete to authenticated
  using (bucket_id in ('generations', 'references', 'imports') and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Live generation progress: an estimate base, partial-image checkpoints and a small
-- preview, written while an image generates and cleared when it finishes.
-- Safe to run more than once. Until it runs, Elsewhere generates normally without live progress.
alter table public.generations add column if not exists progress jsonb;

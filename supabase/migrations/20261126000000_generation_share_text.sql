-- Caption and alt text for sharing an image, written by AI assistance or by hand.
-- Safe to run more than once. Until it runs, Elsewhere still writes captions and alt
-- text in the Share sheet but cannot keep them between visits.
alter table public.generations add column if not exists share_text jsonb;

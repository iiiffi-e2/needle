ALTER TABLE public.queue_items
  ALTER COLUMN dj_user_id DROP NOT NULL;

ALTER TABLE public.queue_items
  ADD COLUMN IF NOT EXISTS is_house BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.queue_items
  DROP CONSTRAINT IF EXISTS queue_items_dj_or_house;

ALTER TABLE public.queue_items
  ADD CONSTRAINT queue_items_dj_or_house
  CHECK (
    (is_house = TRUE AND dj_user_id IS NULL)
    OR (is_house = FALSE AND dj_user_id IS NOT NULL)
  );

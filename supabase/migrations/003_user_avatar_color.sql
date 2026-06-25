-- User-chosen avatar blob color (shown in crowd, DJ booth, profile)
ALTER TABLE public.users
  ADD COLUMN avatar_color TEXT;

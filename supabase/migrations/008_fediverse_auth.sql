-- Fediverse sign-in: handle on the profile, and one OAuth app registration per host.

ALTER TABLE public.users
  ADD COLUMN fediverse_acct TEXT UNIQUE;

CREATE TABLE public.fediverse_oauth_apps (
  host TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  client_secret TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.fediverse_oauth_apps ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  meta_name TEXT;
  stored_email TEXT;
BEGIN
  meta_name := NULLIF(BTRIM(NEW.raw_user_meta_data->>'display_name'), '');
  IF meta_name IS NULL THEN
    meta_name := NULLIF(BTRIM(NEW.raw_user_meta_data->>'full_name'), '');
  END IF;
  IF meta_name IS NULL THEN
    meta_name := NULLIF(BTRIM(NEW.raw_user_meta_data->>'name'), '');
  END IF;

  IF NEW.email LIKE '%@users.needle.invalid' THEN
    stored_email := NULL;
  ELSE
    stored_email := NEW.email;
  END IF;

  INSERT INTO public.users (id, email, display_name, avatar_url, fediverse_acct)
  VALUES (
    NEW.id,
    stored_email,
    COALESCE(meta_name, split_part(NEW.email, '@', 1)),
    COALESCE(
      NULLIF(BTRIM(NEW.raw_user_meta_data->>'avatar_url'), ''),
      NULLIF(BTRIM(NEW.raw_user_meta_data->>'picture'), '')
    ),
    NULLIF(BTRIM(NEW.raw_user_meta_data->>'fediverse_acct'), '')
  );
  INSERT INTO public.user_stats (user_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

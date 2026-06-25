-- Seed badges
INSERT INTO public.badges (name, description, icon) VALUES
  ('Deep Cut Dealer', 'Played tracks nobody else knew', '🎵'),
  ('Midnight Curator', 'Active in late-night rooms', '🌙'),
  ('Vibe Assassin', 'Consistently awesome track picks', '🔥'),
  ('Bloghouse Archaeologist', 'Revived forgotten gems', '💿'),
  ('No-Skip Menace', 'Tracks that never get lamed', '⚡'),
  ('Sad Song Sommelier', 'Master of melancholy', '🥀'),
  ('First Save', 'Got your first track saved', '❤️'),
  ('Crowd Favorite', '10+ awesome votes received', '⭐')
ON CONFLICT (name) DO NOTHING;

-- Example rooms (run after at least one user exists, or use service role)
-- These are inserted via the app seed API when configured

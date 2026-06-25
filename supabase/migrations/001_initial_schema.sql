-- Needle MVP Schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users (extends auth.users)
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Rooms
CREATE TABLE public.rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  vibe TEXT,
  tags TEXT[] DEFAULT '{}',
  max_djs INTEGER DEFAULT 3,
  lame_skip_percentage NUMERIC DEFAULT 0.4,
  lame_skip_minimum INTEGER DEFAULT 3,
  is_private BOOLEAN DEFAULT FALSE,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Room members
CREATE TABLE public.room_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'listener',
  joined_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  last_seen TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(room_id, user_id)
);

-- DJ slots
CREATE TABLE public.dj_slots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  joined_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  missed_turns INTEGER DEFAULT 0,
  UNIQUE(room_id, user_id),
  UNIQUE(room_id, position)
);

-- DJ waitlist
CREATE TABLE public.dj_waitlist (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  joined_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(room_id, user_id)
);

-- Tracks
CREATE TABLE public.tracks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider TEXT NOT NULL DEFAULT 'youtube',
  provider_id TEXT NOT NULL,
  url TEXT NOT NULL,
  title TEXT NOT NULL,
  artist TEXT,
  thumbnail_url TEXT,
  duration_seconds INTEGER,
  submitted_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Queue items
CREATE TABLE public.queue_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  dj_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  track_id UUID NOT NULL REFERENCES public.tracks(id) ON DELETE CASCADE,
  position INTEGER DEFAULT 0,
  status TEXT DEFAULT 'queued',
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  played_at TIMESTAMPTZ
);

-- Room playback state
CREATE TABLE public.room_playback (
  room_id UUID PRIMARY KEY REFERENCES public.rooms(id) ON DELETE CASCADE,
  current_track_id UUID REFERENCES public.tracks(id),
  current_queue_item_id UUID REFERENCES public.queue_items(id),
  current_dj_user_id UUID REFERENCES public.users(id),
  started_at TIMESTAMPTZ,
  paused_at TIMESTAMPTZ,
  is_paused BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Track votes
CREATE TABLE public.track_votes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  track_id UUID NOT NULL REFERENCES public.tracks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  vote_type TEXT NOT NULL CHECK (vote_type IN ('awesome', 'lame')),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(room_id, track_id, user_id, vote_type)
);

-- Saved tracks
CREATE TABLE public.saved_tracks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  track_id UUID NOT NULL REFERENCES public.tracks(id) ON DELETE CASCADE,
  room_id UUID REFERENCES public.rooms(id),
  saved_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(user_id, track_id)
);

-- Chat messages
CREATE TABLE public.chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  body TEXT NOT NULL,
  is_system BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- User stats
CREATE TABLE public.user_stats (
  user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  tracks_played INTEGER DEFAULT 0,
  tracks_saved_by_others INTEGER DEFAULT 0,
  awesome_votes_received INTEGER DEFAULT 0,
  lame_votes_received INTEGER DEFAULT 0,
  rooms_joined INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Badges
CREATE TABLE public.badges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT
);

-- User badges
CREATE TABLE public.user_badges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  badge_id UUID NOT NULL REFERENCES public.badges(id) ON DELETE CASCADE,
  earned_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(user_id, badge_id)
);

-- Indexes
CREATE INDEX idx_room_members_room ON public.room_members(room_id);
CREATE INDEX idx_room_members_user ON public.room_members(user_id);
CREATE INDEX idx_dj_slots_room ON public.dj_slots(room_id);
CREATE INDEX idx_queue_items_room ON public.queue_items(room_id);
CREATE INDEX idx_queue_items_status ON public.queue_items(room_id, status);
CREATE INDEX idx_track_votes_room_track ON public.track_votes(room_id, track_id);
CREATE INDEX idx_chat_messages_room ON public.chat_messages(room_id, created_at);
CREATE INDEX idx_saved_tracks_user ON public.saved_tracks(user_id);
CREATE INDEX idx_rooms_slug ON public.rooms(slug);

-- Auto-create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, display_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  INSERT INTO public.user_stats (user_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Updated_at trigger for rooms
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER rooms_updated_at
  BEFORE UPDATE ON public.rooms
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dj_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dj_waitlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.queue_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_playback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.track_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users are viewable by everyone" ON public.users FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Public rooms are viewable" ON public.rooms FOR SELECT USING (is_private = false OR created_by = auth.uid());
CREATE POLICY "Authenticated users can create rooms" ON public.rooms FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Room members viewable" ON public.room_members FOR SELECT USING (true);
CREATE POLICY "Users can join rooms" ON public.room_members FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own membership" ON public.room_members FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can leave rooms" ON public.room_members FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "DJ slots viewable" ON public.dj_slots FOR SELECT USING (true);
CREATE POLICY "DJ waitlist viewable" ON public.dj_waitlist FOR SELECT USING (true);
CREATE POLICY "Tracks viewable" ON public.tracks FOR SELECT USING (true);
CREATE POLICY "Queue items viewable" ON public.queue_items FOR SELECT USING (true);
CREATE POLICY "Playback viewable" ON public.room_playback FOR SELECT USING (true);
CREATE POLICY "Votes viewable" ON public.track_votes FOR SELECT USING (true);
CREATE POLICY "Saved tracks viewable by owner" ON public.saved_tracks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Chat viewable" ON public.chat_messages FOR SELECT USING (true);
CREATE POLICY "Stats viewable" ON public.user_stats FOR SELECT USING (true);
CREATE POLICY "Badges viewable" ON public.badges FOR SELECT USING (true);
CREATE POLICY "User badges viewable" ON public.user_badges FOR SELECT USING (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_members;
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_playback;
ALTER PUBLICATION supabase_realtime ADD TABLE public.track_votes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.dj_slots;
ALTER PUBLICATION supabase_realtime ADD TABLE public.dj_waitlist;
ALTER PUBLICATION supabase_realtime ADD TABLE public.queue_items;

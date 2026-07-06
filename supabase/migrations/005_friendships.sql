CREATE TABLE public.relationships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_a_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  user_b_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'declined', 'blocked')),
  requested_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  declined_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CONSTRAINT relationships_ordered_pair CHECK (user_a_id < user_b_id),
  UNIQUE (user_a_id, user_b_id)
);

CREATE TABLE public.room_invites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  from_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  to_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'dismissed')),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE (room_id, from_user_id, to_user_id)
);

CREATE INDEX idx_relationships_user_a ON public.relationships(user_a_id);
CREATE INDEX idx_relationships_user_b ON public.relationships(user_b_id);
CREATE INDEX idx_relationships_status ON public.relationships(status);
CREATE INDEX idx_room_invites_to_user ON public.room_invites(to_user_id, status);

ALTER TABLE public.relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own relationships" ON public.relationships
  FOR SELECT USING (auth.uid() = user_a_id OR auth.uid() = user_b_id);

CREATE POLICY "Users read own invites" ON public.room_invites
  FOR SELECT USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);

CREATE TRIGGER relationships_updated_at
  BEFORE UPDATE ON public.relationships
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE public.relationships;
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_invites;

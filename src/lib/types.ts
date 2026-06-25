export interface User {
  id: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
}

export interface Room {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  vibe: string | null;
  tags: string[];
  max_djs: number;
  lame_skip_percentage: number;
  lame_skip_minimum: number;
  is_private: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface RoomMember {
  id: string;
  room_id: string;
  user_id: string;
  role: string;
  joined_at: string;
  last_seen: string;
  user?: User;
}

export interface DjSlot {
  id: string;
  room_id: string;
  user_id: string;
  position: number;
  joined_at: string;
  missed_turns: number;
  user?: User;
}

export interface DjWaitlistEntry {
  id: string;
  room_id: string;
  user_id: string;
  position: number;
  joined_at: string;
  user?: User;
}

export interface Track {
  id: string;
  provider: string;
  provider_id: string;
  url: string;
  title: string;
  artist: string | null;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  submitted_by: string | null;
  created_at: string;
  submitter?: User;
}

export interface QueueItem {
  id: string;
  room_id: string;
  dj_user_id: string;
  track_id: string;
  position: number;
  status: "queued" | "playing" | "played" | "skipped";
  created_at: string;
  played_at: string | null;
  track?: Track;
  dj?: User;
}

export interface RoomPlayback {
  room_id: string;
  current_track_id: string | null;
  current_queue_item_id: string | null;
  current_dj_user_id: string | null;
  started_at: string | null;
  paused_at: string | null;
  is_paused: boolean;
  updated_at: string;
  track?: Track;
  dj?: User;
}

export interface TrackVote {
  id: string;
  room_id: string;
  track_id: string;
  user_id: string;
  vote_type: "awesome" | "lame";
  created_at: string;
}

export interface SavedTrack {
  id: string;
  user_id: string;
  track_id: string;
  room_id: string | null;
  saved_at: string;
  track?: Track;
}

export interface ChatMessage {
  id: string;
  room_id: string;
  user_id: string | null;
  body: string;
  is_system: boolean;
  created_at: string;
  user?: User;
}

export interface UserStats {
  user_id: string;
  tracks_played: number;
  tracks_saved_by_others: number;
  awesome_votes_received: number;
  lame_votes_received: number;
  rooms_joined: number;
  updated_at: string;
}

export interface Badge {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
}

export interface UserBadge {
  id: string;
  user_id: string;
  badge_id: string;
  earned_at: string;
  badge?: Badge;
}

export interface RoomWithStats extends Room {
  listener_count: number;
  dj_count: number;
  current_track?: Track | null;
  current_dj?: User | null;
}

export interface VoteCounts {
  awesome: number;
  lame: number;
}

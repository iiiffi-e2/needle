import { notFound } from "next/navigation";
import { Navbar } from "@/components/shared/Navbar";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { BadgeCard } from "@/components/profile/BadgeCard";
import { FriendActions } from "@/components/profile/FriendActions";
import { ProfileColorSettings } from "@/components/profile/ProfileColorSettings";
import { canonicalPair } from "@/lib/friends";
import { createServiceClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { formatDuration, timeAgo } from "@/lib/utils";
import type { Relationship } from "@/lib/types";

interface ProfilePageProps {
  params: Promise<{ id: string }>;
}

export default async function ProfilePage({ params }: ProfilePageProps) {
  const { id } = await params;
  const admin = createServiceClient();
  const supabase = await createClient();
  const {
    data: { user: sessionUser },
  } = await supabase.auth.getUser();
  const isOwnProfile = sessionUser?.id === id;
  let relationship: Relationship | null = null;

  const { data: user } = await admin
    .from("users")
    .select("*")
    .eq("id", id)
    .single();

  if (!user) notFound();

  if (sessionUser && !isOwnProfile) {
    const [userA, userB] = canonicalPair(sessionUser.id, id);
    const { data } = await admin
      .from("relationships")
      .select("*")
      .eq("user_a_id", userA)
      .eq("user_b_id", userB)
      .maybeSingle();
    relationship = data;
  }

  const [
    { data: stats },
    { data: recentlyPlayed },
    { data: badges },
  ] = await Promise.all([
    admin.from("user_stats").select("*").eq("user_id", id).single(),
    admin
      .from("queue_items")
      .select("*, track:tracks(*), room:rooms(name, slug)")
      .eq("dj_user_id", id)
      .eq("status", "played")
      .order("played_at", { ascending: false })
      .limit(20),
    admin
      .from("user_badges")
      .select("*, badge:badges(*)")
      .eq("user_id", id),
  ]);

  const s = stats || {
    tracks_played: 0,
    tracks_saved_by_others: 0,
    awesome_votes_received: 0,
    lame_votes_received: 0,
    rooms_joined: 0,
  };

  const totalVotes = s.awesome_votes_received + s.lame_votes_received;
  const awesomeRatio =
    totalVotes > 0
      ? Math.round((s.awesome_votes_received / totalVotes) * 100)
      : null;

  const knownFor: string[] = [];
  if (s.tracks_played > 10) knownFor.push("Heavy rotation");
  if (s.tracks_saved_by_others > 5) knownFor.push("Crowd pleaser");
  if (awesomeRatio && awesomeRatio > 80) knownFor.push("Vibe curator");
  if (s.awesome_votes_received > 20) knownFor.push("Room favorite");

  return (
    <div className="min-h-screen venue-bg">
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 py-10">
        <div className="flex items-center gap-5 mb-8">
          <UserAvatar
            name={user.display_name}
            avatarUrl={user.avatar_url}
            userId={user.id}
            avatarColor={user.avatar_color}
            size="lg"
          />
          <div>
            <h1 className="font-display text-2xl font-extrabold">
              {user.display_name || "Anonymous"}
            </h1>
            <p className="text-muted text-sm">
              Member since{" "}
              {new Date(user.created_at).toLocaleDateString("en-US", {
                month: "long",
                year: "numeric",
              })}
            </p>
          </div>
        </div>

        {sessionUser && !isOwnProfile && (
          <FriendActions
            profileUserId={user.id}
            currentUserId={sessionUser.id}
            initialRelationship={relationship}
          />
        )}

        {isOwnProfile && (
          <ProfileColorSettings
            userId={user.id}
            initialColor={user.avatar_color}
          />
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {[
            { label: "Tracks Played", value: s.tracks_played },
            { label: "Saves Received", value: s.tracks_saved_by_others },
            {
              label: "Awesome Ratio",
              value: awesomeRatio !== null ? `${awesomeRatio}%` : "—",
            },
            { label: "Rooms Joined", value: s.rooms_joined },
          ].map((stat) => (
            <div key={stat.label} className="glass-card rounded-xl p-4 text-center">
              <p className="font-display text-2xl font-extrabold text-glow-soft">{stat.value}</p>
              <p className="text-xs text-muted mt-1">{stat.label}</p>
            </div>
          ))}
        </div>

        {knownFor.length > 0 && (
          <div className="glass-card rounded-2xl p-5 mb-6">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted mb-3">
              Known For
            </h2>
            <div className="flex flex-wrap gap-2">
              {knownFor.map((tag) => (
                <span
                  key={tag}
                  className="text-sm bg-accent/10 text-accent px-3 py-1 rounded-full"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {badges && badges.length > 0 && (
          <div className="glass-card rounded-2xl p-5 mb-6">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted mb-3">
              Badges
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {badges.map((ub) => (
                <BadgeCard key={ub.id} badge={ub.badge} />
              ))}
            </div>
          </div>
        )}

        {recentlyPlayed && recentlyPlayed.length > 0 && (
          <div className="glass-card rounded-2xl p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted mb-4">
              Recently Played
            </h2>
            <div className="space-y-2">
              {recentlyPlayed.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-surface-light/50 transition-colors"
                >
                  {item.track?.thumbnail_url && (
                    <img
                      src={item.track.thumbnail_url}
                      alt=""
                      className="w-10 h-10 rounded object-cover"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">
                      {item.track?.title}
                    </p>
                    <p className="text-xs text-muted truncate">
                      {item.room?.name || "Unknown room"}
                      {item.played_at && (
                        <span suppressHydrationWarning>
                          {` · ${timeAgo(item.played_at)}`}
                        </span>
                      )}
                      {item.track?.duration_seconds
                        ? ` · ${formatDuration(item.track.duration_seconds)}`
                        : ""}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

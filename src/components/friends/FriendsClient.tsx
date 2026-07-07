"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { useFriendRealtime } from "@/hooks/useFriendRealtime";
import type {
  FriendWithPresence,
  Relationship,
  RelationshipHint,
  User,
} from "@/lib/types";

type TabId = "friends" | "requests" | "search";

type PendingRequest = Relationship & { user: User };
type RequestsResponse = {
  incoming: PendingRequest[];
  outgoing: PendingRequest[];
};
type SearchUser = User & { relationshipHint: RelationshipHint };

async function fetchJson<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init);
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(payload.error || "Request failed");
  }
  return payload as T;
}

interface FriendsClientProps {
  currentUserId?: string;
}

export function FriendsClient({ currentUserId }: FriendsClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabId>("friends");
  const [friends, setFriends] = useState<FriendWithPresence[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(true);
  const [requests, setRequests] = useState<RequestsResponse>({
    incoming: [],
    outgoing: [],
  });
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState("");

  const totalRequestCount = useMemo(
    () => requests.incoming.length + requests.outgoing.length,
    [requests]
  );

  const loadFriends = useCallback(async () => {
    setFriendsLoading(true);
    try {
      const data = await fetchJson<FriendWithPresence[] | { friends?: FriendWithPresence[] }>(
        "/api/friends"
      );
      setFriends(Array.isArray(data) ? data : (data.friends ?? []));
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : "Failed to load friends";
      setError(message);
    } finally {
      setFriendsLoading(false);
    }
  }, []);

  const loadRequests = useCallback(async () => {
    setRequestsLoading(true);
    try {
      const data = await fetchJson<RequestsResponse>("/api/friends/requests");
      setRequests(data);
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : "Failed to load requests";
      setError(message);
    } finally {
      setRequestsLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.all([loadFriends(), loadRequests()]);
  }, [loadFriends, loadRequests]);

  const refreshFromRealtime = useCallback(() => {
    if (activeTab === "friends") {
      void loadFriends();
      return;
    }
    if (activeTab === "requests") {
      void loadRequests();
      return;
    }
    // Keep request counts fresh while searching.
    void loadRequests();
  }, [activeTab, loadFriends, loadRequests]);

  useFriendRealtime(currentUserId, refreshFromRealtime);

  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    const timer = setTimeout(() => {
      setSearching(true);
      fetchJson<SearchUser[] | { users?: SearchUser[] }>(
        `/api/users/search?q=${encodeURIComponent(q)}`
      )
        .then((results) =>
          setSearchResults(
            Array.isArray(results) ? results : (results.users ?? [])
          )
        )
        .catch((caught) => {
          const message =
            caught instanceof Error ? caught.message : "Failed to search users";
          setError(message);
          setSearchResults([]);
        })
        .finally(() => setSearching(false));
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const runAction = async (
    actionId: string,
    request: () => Promise<void>
  ): Promise<void> => {
    setActionLoading(actionId);
    setError("");
    try {
      await request();
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : "Action failed";
      setError(message);
    } finally {
      setActionLoading(null);
    }
  };

  const addFriendFromSearch = (userId: string) =>
    runAction(`search-add-${userId}`, async () => {
      await fetchJson("/api/friends/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      setSearchResults((prev) =>
        prev.map((entry) =>
          entry.id === userId
            ? { ...entry, relationshipHint: "pending_out" }
            : entry
        )
      );
      await loadRequests();
    });

  const acceptRequest = (relationshipId: string) =>
    runAction(`accept-${relationshipId}`, async () => {
      await fetchJson(`/api/friends/requests/${relationshipId}/accept`, {
        method: "POST",
      });
      await Promise.all([loadRequests(), loadFriends()]);
    });

  const declineRequest = (relationshipId: string) =>
    runAction(`decline-${relationshipId}`, async () => {
      await fetchJson(`/api/friends/requests/${relationshipId}/decline`, {
        method: "POST",
      });
      await loadRequests();
    });

  const cancelRequest = (relationshipId: string) =>
    runAction(`cancel-${relationshipId}`, async () => {
      await fetchJson(`/api/friends/requests/${relationshipId}`, {
        method: "DELETE",
      });
      await loadRequests();
    });

  const renderPresence = (friend: FriendWithPresence) => {
    if (!friend.presence.roomId) return "Offline";
    if (friend.presence.isPrivate && !friend.presence.canJoin) {
      return "In a private room";
    }
    if (friend.presence.canJoin && friend.presence.roomName) {
      return `In ${friend.presence.roomName}`;
    }
    return "In a room";
  };

  const openFriendLocation = (friend: FriendWithPresence) => {
    if (friend.presence.canJoin && friend.presence.roomSlug) {
      router.push(`/rooms/${friend.presence.roomSlug}`);
      return;
    }
    router.push(`/profile/${friend.user.id}`);
  };

  return (
    <section className="glass-card rounded-2xl p-5">
      <div className="flex flex-wrap gap-2 mb-5">
        {[
          { id: "friends" as const, label: "Friends", count: friends.length },
          { id: "requests" as const, label: "Requests", count: totalRequestCount },
          { id: "search" as const, label: "Search" },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
              activeTab === tab.id
                ? "bg-accent/20 text-glow-soft border border-glow/40"
                : "bg-surface-light text-muted border border-transparent hover:border-[var(--ndl-line)]"
            }`}
          >
            {tab.label}
            {tab.count !== undefined ? ` (${tab.count})` : ""}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-danger mb-4">{error}</p>}

      {activeTab === "friends" && (
        <div className="space-y-2">
          {friendsLoading ? (
            <p className="text-sm text-muted italic">Loading friends...</p>
          ) : friends.length === 0 ? (
            <p className="text-sm text-muted italic">
              No friends yet. Search for someone to connect with.
            </p>
          ) : (
            friends.map((friend) => (
              <button
                key={friend.user.id}
                type="button"
                onClick={() => openFriendLocation(friend)}
                className="w-full text-left flex items-center justify-between gap-3 p-3 rounded-xl border border-[var(--ndl-line)] bg-surface-light hover:bg-white/10 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <UserAvatar
                    name={friend.user.display_name}
                    avatarUrl={friend.user.avatar_url}
                    userId={friend.user.id}
                    avatarColor={friend.user.avatar_color}
                  />
                  <div className="min-w-0">
                    <p className="font-medium truncate">
                      {friend.user.display_name || "Anonymous"}
                    </p>
                    <p className="text-xs text-muted truncate">
                      {renderPresence(friend)}
                    </p>
                  </div>
                </div>
                <span className="text-xs text-glow-soft shrink-0">
                  {friend.presence.canJoin ? "Join" : "View"}
                </span>
              </button>
            ))
          )}
        </div>
      )}

      {activeTab === "requests" && (
        <div className="space-y-6">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted mb-3">
              Incoming
            </h2>
            {requestsLoading ? (
              <p className="text-sm text-muted italic">Loading requests...</p>
            ) : requests.incoming.length === 0 ? (
              <p className="text-sm text-muted italic">No incoming requests.</p>
            ) : (
              <div className="space-y-2">
                {requests.incoming.map((request) => (
                  <div
                    key={request.id}
                    className="flex items-center justify-between gap-3 p-3 rounded-xl border border-[var(--ndl-line)] bg-surface-light"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <UserAvatar
                        name={request.user.display_name}
                        avatarUrl={request.user.avatar_url}
                        userId={request.user.id}
                        avatarColor={request.user.avatar_color}
                      />
                      <p className="font-medium truncate">
                        {request.user.display_name || "Anonymous"}
                      </p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => acceptRequest(request.id)}
                        disabled={actionLoading !== null}
                        className="btn-primary px-3 py-1.5 rounded-full text-xs font-bold disabled:opacity-50"
                      >
                        {actionLoading === `accept-${request.id}`
                          ? "Accepting..."
                          : "Accept"}
                      </button>
                      <button
                        type="button"
                        onClick={() => declineRequest(request.id)}
                        disabled={actionLoading !== null}
                        className="btn-secondary px-3 py-1.5 rounded-full text-xs font-medium disabled:opacity-50"
                      >
                        {actionLoading === `decline-${request.id}`
                          ? "Declining..."
                          : "Decline"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted mb-3">
              Outgoing
            </h2>
            {requestsLoading ? (
              <p className="text-sm text-muted italic">Loading requests...</p>
            ) : requests.outgoing.length === 0 ? (
              <p className="text-sm text-muted italic">No outgoing requests.</p>
            ) : (
              <div className="space-y-2">
                {requests.outgoing.map((request) => (
                  <div
                    key={request.id}
                    className="flex items-center justify-between gap-3 p-3 rounded-xl border border-[var(--ndl-line)] bg-surface-light"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <UserAvatar
                        name={request.user.display_name}
                        avatarUrl={request.user.avatar_url}
                        userId={request.user.id}
                        avatarColor={request.user.avatar_color}
                      />
                      <p className="font-medium truncate">
                        {request.user.display_name || "Anonymous"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => cancelRequest(request.id)}
                      disabled={actionLoading !== null}
                      className="btn-secondary px-3 py-1.5 rounded-full text-xs font-medium disabled:opacity-50"
                    >
                      {actionLoading === `cancel-${request.id}`
                        ? "Cancelling..."
                        : "Cancel"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "search" && (
        <div>
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search by display name..."
            className="input-venue w-full rounded-xl px-4 py-2.5 text-sm mb-4"
          />

          {searchQuery.trim().length > 0 && searchQuery.trim().length < 2 && (
            <p className="text-sm text-muted">Type at least 2 characters.</p>
          )}

          {searching && (
            <p className="text-sm text-muted italic">Searching...</p>
          )}

          {!searching && searchQuery.trim().length >= 2 && searchResults.length === 0 && (
            <p className="text-sm text-muted italic">No users found.</p>
          )}

          <div className="space-y-2">
            {searchResults.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between gap-3 p-3 rounded-xl border border-[var(--ndl-line)] bg-surface-light"
              >
                <button
                  type="button"
                  onClick={() => router.push(`/profile/${user.id}`)}
                  className="flex items-center gap-3 min-w-0 text-left"
                >
                  <UserAvatar
                    name={user.display_name}
                    avatarUrl={user.avatar_url}
                    userId={user.id}
                    avatarColor={user.avatar_color}
                  />
                  <p className="font-medium truncate">
                    {user.display_name || "Anonymous"}
                  </p>
                </button>

                {user.relationshipHint === "none" && (
                  <button
                    type="button"
                    onClick={() => addFriendFromSearch(user.id)}
                    disabled={actionLoading !== null}
                    className="btn-primary px-3 py-1.5 rounded-full text-xs font-bold disabled:opacity-50"
                  >
                    {actionLoading === `search-add-${user.id}`
                      ? "Adding..."
                      : "Add Friend"}
                  </button>
                )}

                {user.relationshipHint !== "none" && (
                  <span className="text-xs text-muted shrink-0 capitalize">
                    {user.relationshipHint.replace("_", " ")}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

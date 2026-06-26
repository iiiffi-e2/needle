"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type {
  ChatMessage,
  QueueItem,
  Room,
  RoomMember,
  SavedTrack,
  User,
} from "@/lib/types";
import { resolveUserColor } from "@/lib/design-tokens";
import { getQueuePlaybackOrder } from "@/lib/queue-order";
import { timeAgo } from "@/lib/utils";
import { ScrollOnHoverText } from "@/components/shared/ScrollOnHoverText";
import { SystemMessage } from "@/components/shared/SystemMessage";
import { NeedlebotMessage } from "@/components/shared/NeedlebotMessage";

type TabId = "chat" | "queue" | "info" | "crate";

interface RoomSidePanelProps {
  room: Room;
  members: RoomMember[];
  queueItems: QueueItem[];
  djSlots: { user_id: string; user?: User }[];
  djUserIds: Set<string>;
  listenerCount: number;
  roomSlug: string;
  initialMessages: ChatMessage[];
  currentUserId: string | null;
  currentDjUserId: string | null;
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  hideTabBar?: boolean;
  mobileDrawerOpen?: boolean;
  onCloseDrawer?: () => void;
}

export function RoomSidePanel({
  room,
  members,
  queueItems,
  djSlots,
  djUserIds,
  listenerCount,
  roomSlug,
  initialMessages,
  currentUserId,
  currentDjUserId,
  activeTab,
  onTabChange,
  hideTabBar = false,
  mobileDrawerOpen = false,
  onCloseDrawer,
}: RoomSidePanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [savedTracks, setSavedTracks] = useState<SavedTrack[]>([]);
  const [crateLoading, setCrateLoading] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);

  const tabs: { id: TabId; label: string; count?: number }[] = [
    { id: "chat", label: "Chat" },
    { id: "queue", label: "Queue", count: queueItems.length },
    { id: "info", label: "Room Info" },
  ];

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages, activeTab]);

  const addMessage = useCallback((message: ChatMessage) => {
    setMessages((prev) => {
      if (prev.some((m) => m.id === message.id)) return prev;
      return [...prev, message];
    });
  }, []);

  useEffect(() => {
    (window as unknown as { __needleAddChatMessage?: typeof addMessage }).__needleAddChatMessage =
      addMessage;
    return () => {
      delete (window as unknown as { __needleAddChatMessage?: typeof addMessage })
        .__needleAddChatMessage;
    };
  }, [addMessage]);

  const sendChat = async () => {
    const t = draft.trim();
    if (!t || !currentUserId || loading) return;
    setLoading(true);
    setDraft("");
    try {
      const res = await fetch(`/api/rooms/${roomSlug}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: t }),
      });
      if (res.ok) {
        const message = await res.json();
        setMessages((prev) => [...prev, message]);
      }
    } finally {
      setLoading(false);
    }
  };

  const floorMembers = members.filter((m) => !djUserIds.has(m.user_id));

  const orderedQueue = getQueuePlaybackOrder(
    queueItems,
    djSlots,
    currentDjUserId
  );

  useEffect(() => {
    if (activeTab !== "crate" || !currentUserId) return;
    let cancelled = false;
    setCrateLoading(true);
    fetch(`/api/users/${currentUserId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.savedTracks) {
          setSavedTracks(data.savedTracks);
        }
      })
      .finally(() => {
        if (!cancelled) setCrateLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeTab, currentUserId]);

  const drawerTitles: Record<TabId, string> = {
    chat: "Chat",
    queue: "Queue",
    info: "Room Info",
    crate: "Your Crate",
  };

  return (
    <>
      {mobileDrawerOpen && onCloseDrawer && (
        <button
          type="button"
          className="needle-mobile-backdrop lg:hidden"
          aria-label="Close panel"
          onClick={onCloseDrawer}
        />
      )}
      <aside
        className={`needle-sidebar min-h-0 ${
          mobileDrawerOpen ? "needle-sidebar-drawer-open" : ""
        }`}
      >
        {hideTabBar && mobileDrawerOpen && (
          <div className="flex items-center justify-between px-4 pt-3 pb-2 lg:hidden">
            <h2 className="font-display font-extrabold text-[16px]">
              {drawerTitles[activeTab]}
            </h2>
            <button
              type="button"
              onClick={onCloseDrawer}
              className="w-8 h-8 rounded-full border-none cursor-pointer text-lg"
              style={{
                background: "#ffffff10",
                color: "var(--sub)",
              }}
              aria-label="Close"
            >
              ×
            </button>
          </div>
        )}
        {!hideTabBar && (
      <div className="hidden lg:flex gap-1 p-3 pt-3 pb-0">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onTabChange(t.id)}
            className="flex-1 py-2.5 border-none cursor-pointer font-bold rounded-t-lg transition-colors"
            style={{
              fontSize: 12.5,
              background:
                activeTab === t.id
                  ? "rgba(255, 157, 60, 0.16)"
                  : "transparent",
              color: activeTab === t.id ? "var(--glow2)" : "var(--sub)",
              borderBottom:
                activeTab === t.id
                  ? "2px solid var(--glow)"
                  : "2px solid transparent",
            }}
          >
            {t.label}
            {t.count !== undefined && t.count > 0 && (
              <span
                className="ml-1.5 text-[10px] px-1.5 py-px rounded-full"
                style={{
                  background: "rgba(255, 157, 60, 0.25)",
                  color: "var(--glow2)",
                }}
              >
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>
        )}
      <div className="hidden lg:block h-px mt-[11px]" style={{ background: "var(--line)" }} />

      {activeTab === "chat" && (
        <div className="flex-1 flex flex-col overflow-hidden min-h-0">
          <div
            ref={chatRef}
            className="flex-1 overflow-y-auto p-3.5 flex flex-col gap-3"
          >
            <div className="text-center tracking-wide" style={{ fontSize: 10.5, color: "var(--sub)" }}>
              — live venue feed —
            </div>
            {messages.map((m) => {
              if (m.is_system) {
                if (m.body.includes("Needlebot")) {
                  return <NeedlebotMessage key={m.id} body={m.body} />;
                }
                return (
                  <div
                    key={m.id}
                    className="flex items-center gap-2 justify-center text-[11px]"
                    style={{ color: "var(--glow2)" }}
                  >
                    <span className="h-px flex-1" style={{ background: "var(--line)" }} />
                    {m.body}
                    <span className="h-px flex-1" style={{ background: "var(--line)" }} />
                  </div>
                );
              }
              const color = m.user_id
                ? resolveUserColor(m.user_id, m.user?.avatar_color)
                : "#a98bff";
              return (
                <div key={m.id} className="flex gap-2">
                  <span
                    className="w-[26px] h-[26px] shrink-0 rounded-full shadow-[0_0_0_2px_var(--ndl-bg1)]"
                    style={{ background: color }}
                  />
                  <div className="min-w-0">
                    <div className="text-[11px] mb-0.5">
                      <b className="font-bold" style={{ color: "var(--txt)" }}>
                        {m.user?.display_name || "Anonymous"}
                      </b>{" "}
                      <span style={{ color: "var(--sub)", fontSize: 10 }}>
                        {timeAgo(m.created_at)}
                      </span>
                    </div>
                    <div className="text-[12.5px] text-[#e9e3f0] leading-snug break-words">
                      {m.body}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="p-3 border-t flex gap-2" style={{ borderColor: "var(--line)" }}>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendChat()}
              placeholder="Say something to the room…"
              disabled={!currentUserId}
              className="flex-1 h-10 rounded-[10px] px-3 text-[12.5px] disabled:opacity-50 outline-none"
              style={{
                background: "#00000040",
                border: "1px solid var(--line)",
                color: "var(--txt)",
              }}
            />
            <button
              type="button"
              onClick={sendChat}
              disabled={!currentUserId || loading || !draft.trim()}
              className="w-10 h-10 rounded-[10px] border-none cursor-pointer text-[#1a0d06] text-base font-extrabold disabled:opacity-50"
              style={{
                background: "linear-gradient(120deg, var(--glow), var(--accent))",
              }}
            >
              ➤
            </button>
          </div>
        </div>
      )}

      {activeTab === "queue" && (
        <div className="flex-1 p-3.5 flex flex-col gap-2.5 overflow-y-auto min-h-0">
          <div className="text-[11px] text-muted tracking-wide">
            UP NEXT ON THE DECKS
          </div>
          {orderedQueue.length === 0 ? (
            <p className="text-sm text-muted italic py-4 text-center">
              Queue is empty — drop a track!
            </p>
          ) : (
            orderedQueue.map((q, i) => (
              <div
                key={q.id}
                className="flex items-center gap-2.5 p-2 rounded-[11px] bg-[#ffffff08] border border-[var(--ndl-line)]"
              >
                <span className="font-display font-extrabold text-sm text-glow-soft w-[18px]">
                  {i + 1}
                </span>
                <span
                  className="w-10 h-10 rounded-lg shrink-0"
                  style={{
                    background: q.track?.thumbnail_url
                      ? `url(${q.track.thumbnail_url}) center/cover`
                      : resolveUserColor(q.dj_user_id, q.dj?.avatar_color),
                  }}
                />
                <div className="flex-1 min-w-0">
                  <ScrollOnHoverText
                    text={q.track?.title || "Unknown"}
                    className="text-[13px] font-bold"
                  />
                  <div className="text-[11px] text-muted">
                    added by {q.dj?.display_name || "DJ"}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === "crate" && (
        <div className="flex-1 p-3.5 flex flex-col gap-2.5 overflow-y-auto min-h-0">
          <div className="text-[11px] text-muted tracking-wide">
            SAVED TRACKS
          </div>
          {!currentUserId ? (
            <p className="text-sm text-muted italic py-4 text-center">
              Sign in to see your crate.
            </p>
          ) : crateLoading ? (
            <p className="text-sm text-muted italic py-4 text-center">
              Loading…
            </p>
          ) : savedTracks.length === 0 ? (
            <p className="text-sm text-muted italic py-4 text-center">
              Nothing saved yet — heart a track while it spins.
            </p>
          ) : (
            savedTracks.map((st) => (
              <div
                key={st.id}
                className="flex items-center gap-2.5 p-2 rounded-[11px] bg-[#ffffff08] border border-[var(--ndl-line)]"
              >
                <span
                  className="w-10 h-10 rounded-lg shrink-0"
                  style={{
                    background: st.track?.thumbnail_url
                      ? `url(${st.track.thumbnail_url}) center/cover`
                      : "linear-gradient(135deg, var(--glow), var(--accent))",
                  }}
                />
                <div className="flex-1 min-w-0">
                  <ScrollOnHoverText
                    text={st.track?.title || "Unknown"}
                    className="text-[13px] font-bold"
                  />
                  {st.track?.artist && (
                    <div className="text-[11px] text-muted truncate">
                      {st.track.artist}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === "info" && (
        <div className="flex-1 p-4 flex flex-col gap-4 overflow-y-auto min-h-0">
          <div>
            <div className="font-display font-extrabold text-[17px]">
              {room.name}
            </div>
            {(room.description || room.vibe) && (
              <p className="text-[12.5px] text-muted leading-relaxed mt-1">
                {room.description || room.vibe}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <div className="flex-1 p-2.5 rounded-[11px] bg-[#ffffff08] border border-[var(--ndl-line)]">
              <div className="font-display font-extrabold text-[19px] text-glow-soft">
                {listenerCount}
              </div>
              <div className="text-[10.5px] text-muted">in the room</div>
            </div>
            <div className="flex-1 p-2.5 rounded-[11px] bg-[#ffffff08] border border-[var(--ndl-line)]">
              <div className="font-display font-extrabold text-[19px] text-glow-soft">
                {djSlots.length} / {room.max_djs}
              </div>
              <div className="text-[10.5px] text-muted">decks filled</div>
            </div>
          </div>
          <div>
            <div className="text-[11px] text-muted tracking-wide mb-2">
              ON THE FLOOR
            </div>
            <div className="flex flex-wrap gap-1.5">
              {floorMembers.map((m) => (
                <span
                  key={m.id}
                  className="w-[30px] h-[30px] rounded-full shadow-[0_0_0_2px_var(--ndl-bg1)]"
                  style={{
                    background: resolveUserColor(
                      m.user_id,
                      m.user?.avatar_color
                    ),
                  }}
                  title={m.user?.display_name || undefined}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </aside>
    </>
  );
}

export type { TabId };

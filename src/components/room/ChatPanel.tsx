"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { SystemMessage } from "@/components/shared/SystemMessage";
import { NeedlebotMessage } from "@/components/shared/NeedlebotMessage";
import type { ChatMessage } from "@/lib/types";
import { timeAgo } from "@/lib/utils";

interface ChatPanelProps {
  roomSlug: string;
  initialMessages: ChatMessage[];
  currentUserId: string | null;
}

export function ChatPanel({
  roomSlug,
  initialMessages,
  currentUserId,
}: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (isAtBottom) scrollToBottom();
  }, [messages, isAtBottom, scrollToBottom]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      setIsAtBottom(scrollHeight - scrollTop - clientHeight < 50);
    };

    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, []);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !currentUserId || loading) return;

    setLoading(true);
    const body = input.trim();
    setInput("");

    try {
      const res = await fetch(`/api/rooms/${roomSlug}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });

      if (res.ok) {
        const message = await res.json();
        setMessages((prev) => [...prev, message]);
      }
    } finally {
      setLoading(false);
    }
  };

  const addMessage = useCallback((message: ChatMessage) => {
    setMessages((prev) => {
      if (prev.some((m) => m.id === message.id)) return prev;
      return [...prev, message];
    });
  }, []);

  useEffect(() => {
    (window as unknown as { __needleAddChatMessage?: typeof addMessage }).__needleAddChatMessage = addMessage;
    return () => {
      delete (window as unknown as { __needleAddChatMessage?: typeof addMessage }).__needleAddChatMessage;
    };
  }, [addMessage]);

  return (
    <div className="glass-card rounded-2xl flex flex-col h-[400px]">
      <div className="px-4 py-3 border-b border-white/5">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted">
          Chat
        </h3>
      </div>

      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto px-4 py-3 space-y-2"
      >
        {messages.map((msg) => {
          if (msg.is_system) {
            if (msg.body.includes("Needlebot")) {
              return <NeedlebotMessage key={msg.id} body={msg.body} />;
            }
            return <SystemMessage key={msg.id} body={msg.body} />;
          }

          return (
            <div key={msg.id} className="flex gap-2 animate-fade-in">
              <UserAvatar
                name={msg.user?.display_name}
                avatarUrl={msg.user?.avatar_url}
                size="sm"
              />
              <div className="min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-medium">
                    {msg.user?.display_name || "Anonymous"}
                  </span>
                  <span className="text-xs text-muted">
                    {timeAgo(msg.created_at)}
                  </span>
                </div>
                <p className="text-sm text-foreground/90 break-words">
                  {msg.body}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {!isAtBottom && (
        <button
          onClick={scrollToBottom}
          className="mx-4 mb-1 text-xs text-accent hover:underline"
        >
          ↓ New messages
        </button>
      )}

      <form
        onSubmit={handleSend}
        className="px-4 py-3 border-t border-white/5 flex gap-2"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            currentUserId ? "Say something..." : "Sign in to chat"
          }
          disabled={!currentUserId}
          className="flex-1 bg-surface-light border border-white/10 rounded-full px-4 py-2 text-sm placeholder:text-muted/50 focus:outline-none focus:border-accent/50 transition-colors disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!currentUserId || loading || !input.trim()}
          className="bg-accent text-background px-4 py-2 rounded-full text-sm font-medium hover:bg-accent/90 transition-colors disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}

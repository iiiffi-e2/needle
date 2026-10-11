import type { ChatMessage, User } from "@/lib/types";

export function mergeChatMessage(
  messages: ChatMessage[],
  incoming: ChatMessage
): ChatMessage[] {
  const index = messages.findIndex((message) => message.id === incoming.id);
  if (index === -1) return [...messages, incoming];

  const existing = messages[index];
  const merged: ChatMessage = {
    ...existing,
    ...incoming,
    user: incoming.user ?? existing.user,
  };
  const next = messages.slice();
  next[index] = merged;
  return next;
}

export function hydrateChatAuthor(
  message: ChatMessage,
  members: { user_id: string; user?: User }[]
): ChatMessage {
  if (message.user || !message.user_id) return message;
  const member = members.find((entry) => entry.user_id === message.user_id);
  if (!member?.user) return message;
  return { ...message, user: member.user };
}

import type { QueueItem } from "@/lib/types";

interface DjSlotRef {
  user_id: string;
  position?: number;
}

/** Order queued items the way playback will play them. */
export function getQueuePlaybackOrder(
  queueItems: QueueItem[],
  djSlots: DjSlotRef[],
  currentDjUserId: string | null
): QueueItem[] {
  if (queueItems.length === 0 || djSlots.length === 0) return [];

  const slots = djSlots.map((s, i) => ({
    ...s,
    position: s.position ?? i,
  })).sort((a, b) => a.position - b.position);

  const byDj = new Map<string, QueueItem[]>();
  for (const item of queueItems) {
    const list = byDj.get(item.dj_user_id) ?? [];
    list.push(item);
    byDj.set(item.dj_user_id, list);
  }
  for (const items of byDj.values()) {
    items.sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  }

  if (slots.length === 1) {
    return byDj.get(slots[0].user_id) ?? [];
  }

  let startIndex = 0;
  if (currentDjUserId) {
    const currentIndex = slots.findIndex((s) => s.user_id === currentDjUserId);
    if (currentIndex >= 0) {
      startIndex = (currentIndex + 1) % slots.length;
    }
  }

  const pointers = new Map(slots.map((s) => [s.user_id, 0]));
  const result: QueueItem[] = [];
  let remaining = queueItems.length;

  while (remaining > 0) {
    let progressed = false;
    for (let i = 0; i < slots.length && remaining > 0; i++) {
      const slot = slots[(startIndex + i) % slots.length];
      const items = byDj.get(slot.user_id) ?? [];
      const ptr = pointers.get(slot.user_id)!;
      if (ptr < items.length) {
        result.push(items[ptr]);
        pointers.set(slot.user_id, ptr + 1);
        remaining--;
        progressed = true;
      }
    }
    if (!progressed) break;
  }

  return result;
}

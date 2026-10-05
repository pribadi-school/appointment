/** Slot helpers that combine settings, live public slots and the clock. */
import { useMemo } from 'react';
import { slotKey, useLive, useNow } from './live';
import { slotStarts, slotState, type SlotState } from './time';

export type SlotView = { start: number; key: string; state: SlotState; label: string | null; flashing: boolean };

/** All slots of one teacher with their current state. */
export function useTeacherSlots(teacherId: string | null): SlotView[] {
  const { settings, slots, flashing } = useLive();
  const { now } = useNow();
  return useMemo(() => {
    if (!settings || !teacherId) return [];
    return slotStarts(settings).map((start) => {
      const key = slotKey(teacherId, start);
      const entry = slots.get(key);
      return { start, key, state: slotState(entry, start, settings.slotMinutes, now), label: entry?.label ?? null, flashing: flashing.has(key) };
    });
  }, [settings, teacherId, slots, flashing, now]);
}

/** Number of still-bookable slots per teacher id. */
export function useAvailableCounts(): Map<string, number> {
  const { settings, slots, teachers } = useLive();
  const { now } = useNow(60_000);
  return useMemo(() => {
    const out = new Map<string, number>();
    if (!settings) return out;
    const starts = slotStarts(settings).filter((s) => s > now);
    for (const t of teachers) out.set(t.id, starts.filter((s) => !slots.has(slotKey(t.id, s))).length);
    return out;
  }, [settings, slots, teachers, now]);
}

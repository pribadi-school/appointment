/** Slot helpers that combine settings, live public slots and the clock. */
import { useMemo } from 'react';
import { slotKey, useLive, useNow } from './live';
import { slotStarts, slotState, teacherSchedule, type SlotState } from './time';

export type SlotView = { start: number; key: string; state: SlotState; label: string | null; flashing: boolean };

/** All slots of one teacher (on their level's grid) with their current state. */
export function useTeacherSlots(teacherId: string | null): SlotView[] {
  const { settings, slots, flashing, teachers } = useLive();
  const { now } = useNow();
  const teacher = teachers.find((x) => x.id === teacherId);
  const level = teacher?.level;
  const count = teacher?.slotCount ?? null;
  return useMemo(() => {
    if (!settings || !teacherId || !level) return [];
    const sch = teacherSchedule(settings, { level, slotCount: count });
    return slotStarts(sch).map((start) => {
      const key = slotKey(teacherId, start);
      const entry = slots.get(key);
      return { start, key, state: slotState(entry, start, sch.slotMinutes, now), label: entry?.label ?? null, flashing: flashing.has(key) };
    });
  }, [settings, teacherId, level, count, slots, flashing, now]);
}

/** Number of still-bookable slots per teacher id. */
export function useAvailableCounts(): Map<string, number> {
  const { settings, slots, teachers } = useLive();
  const { now } = useNow(60_000);
  return useMemo(() => {
    const out = new Map<string, number>();
    if (!settings) return out;
    for (const t of teachers) {
      const starts = slotStarts(teacherSchedule(settings, t)).filter((s) => s > now);
      out.set(t.id, starts.filter((s) => !slots.has(slotKey(t.id, s))).length);
    }
    return out;
  }, [settings, slots, teachers, now]);
}

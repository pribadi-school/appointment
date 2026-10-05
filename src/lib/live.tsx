/**
 * Live public data shared by every screen: event settings, teachers and the
 * public slot status. Subscribes to Supabase Realtime once, refetches on any
 * change, and remembers which slots changed so they can animate.
 *
 * Safety nets so screens never go stale: refetch when the tab becomes
 * visible again, after a reconnect, and every 20 s while visible.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { api, type LiveTopic } from './api';
import { clockOverride } from './time';
import type { PublicSlot, Settings, Teacher } from './types';

export const slotKey = (teacherId: string, slotStart: number) => `${teacherId}|${slotStart}`;

type LiveState = {
  settings: Settings | null;
  teachers: Teacher[];
  slots: Map<string, PublicSlot>;
  /** Slot keys that changed in the last couple of seconds (for animation). */
  flashing: Set<string>;
  /** Increments on every slot change; screens with private data refetch on it. */
  version: number;
  connected: boolean;
  loading: boolean;
  failed: boolean;
  reload: () => void;
  refreshSlots: () => Promise<void>;
};

const LiveContext = createContext<LiveState | null>(null);

export function LiveProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [slots, setSlots] = useState<Map<string, PublicSlot>>(new Map());
  const [flashing, setFlashing] = useState<Set<string>>(new Set());
  const [version, setVersion] = useState(0);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const prevSlots = useRef<Map<string, PublicSlot> | null>(null);
  const timers = useRef<Partial<Record<LiveTopic, ReturnType<typeof setTimeout>>>>({});

  const applySlots = useCallback((list: PublicSlot[]) => {
    const next = new Map(list.map((s) => [slotKey(s.teacherId, s.slotStart), s]));
    const prev = prevSlots.current;
    if (prev) {
      const changed = new Set<string>();
      for (const [k, v] of next) if (prev.get(k)?.status !== v.status) changed.add(k);
      for (const k of prev.keys()) if (!next.has(k)) changed.add(k);
      if (changed.size) {
        setFlashing(changed);
        setTimeout(() => setFlashing((cur) => (cur === changed ? new Set() : cur)), 1800);
        setVersion((v) => v + 1);
      }
    }
    prevSlots.current = next;
    setSlots(next);
  }, []);

  const refreshSlots = useCallback(async () => {
    try {
      applySlots(await api.getSlots());
    } catch {
      /* keep showing the last known state; the next event/poll will retry */
    }
  }, [applySlots]);

  const loadAll = useCallback(async () => {
    setFailed(false);
    try {
      const [s, t, sl] = await Promise.all([api.getSettings(), api.getTeachers(), api.getSlots()]);
      setSettings(s);
      setTeachers(t);
      applySlots(sl);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [applySlots]);

  useEffect(() => {
    loadAll();
    // Debounce bursts of events (e.g. an admin moving many bookings).
    const onChange = (topic: LiveTopic) => {
      clearTimeout(timers.current[topic]);
      timers.current[topic] = setTimeout(async () => {
        try {
          if (topic === 'slots') await refreshSlots();
          if (topic === 'teachers') setTeachers(await api.getTeachers());
          if (topic === 'settings') {
            setSettings(await api.getSettings());
            setVersion((v) => v + 1);
          }
        } catch {
          /* ignored — poll will catch up */
        }
      }, 120);
    };
    let wasConnected = false;
    const unsubscribe = api.subscribe(onChange, (live) => {
      setConnected(live);
      if (live && wasConnected === false && prevSlots.current) refreshSlots(); // catch up after reconnect
      wasConnected = live;
    });
    const onVisible = () => document.visibilityState === 'visible' && refreshSlots();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onVisible);
    const poll = setInterval(() => document.visibilityState === 'visible' && refreshSlots(), 20_000);
    return () => {
      unsubscribe();
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onVisible);
      clearInterval(poll);
    };
  }, [loadAll, refreshSlots]);

  const value = useMemo<LiveState>(
    () => ({ settings, teachers, slots, flashing, version, connected, loading, failed, reload: loadAll, refreshSlots }),
    [settings, teachers, slots, flashing, version, connected, loading, failed, loadAll, refreshSlots],
  );
  return <LiveContext.Provider value={value}>{children}</LiveContext.Provider>;
}

export function useLive() {
  const ctx = useContext(LiveContext);
  if (!ctx) throw new Error('useLive must be used inside LiveProvider');
  return ctx;
}

/** Current time, ticking every `everyMs`. Honors the ?now=09:12 override. */
export function useNow(everyMs = 15_000) {
  const { settings } = useLive();
  const override = clockOverride(settings?.eventDate);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(id);
  }, [everyMs]);
  return { now: override ?? now, simulated: override !== null };
}

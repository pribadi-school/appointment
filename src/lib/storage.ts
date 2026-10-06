/**
 * Small wrapper around localStorage that never throws (private browsing,
 * blocked storage) — the app keeps working, it just won't remember things.
 */
export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function save(key: string, value: unknown) {
  try {
    if (value === null || value === undefined) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable — ignore */
  }
}

export const KEYS = {
  lang: 'ptc.lang',
  parent: 'ptc.parent',
  teacherSession: 'ptc.teacherSession',
  lastTeacher: 'ptc.lastTeacher',
  adminSession: 'ptc.adminSession',
  demoDb: 'ptc.demo.v2', // v2: SD classes + SD times
} as const;

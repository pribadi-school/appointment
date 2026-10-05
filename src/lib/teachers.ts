/** Which teachers a parent sees, and in which groups. */
import type { T } from './i18n';
import { gradeOf, type Teacher } from './types';

export type TeacherGroup = { key: string; title: string; teachers: Teacher[] };

const matches = (t: Teacher, q: string) =>
  !q || `${t.name} ${t.subject ?? ''} ${t.room ?? ''} ${t.role ?? ''}`.toLowerCase().includes(q.toLowerCase().trim());

/**
 * 1. The child's homeroom teacher at the top.
 * 2. Teachers who teach the child's grade (or have no grade data), grouped by subject.
 * 3. "Counselors & Leadership" (counselors, principals, coordinators) for everyone.
 * A teacher can appear in both a subject group and the leadership group.
 * Unavailable teachers are hidden.
 */
export function groupTeachers(teachers: Teacher[], childClass: string, query: string, t: T): TeacherGroup[] {
  const grade = gradeOf(childClass);
  const list = teachers.filter((x) => x.available && matches(x, query));
  const groups: TeacherGroup[] = [];

  const homeroom = list.filter((x) => x.homeroomClass === childClass);
  if (homeroom.length) groups.push({ key: 'homeroom', title: t('t_homeroom', { cls: childClass }), teachers: homeroom });

  const bySubject = new Map<string, Teacher[]>();
  for (const x of list) {
    if (homeroom.includes(x)) continue;
    const teachesGrade = x.grades.length === 0 || x.grades.includes(grade);
    // Leadership staff with no grade data appear only in their own group,
    // not under a subject for every grade.
    if (!teachesGrade || (x.isLeadership && x.grades.length === 0)) continue;
    const subject = x.subject ?? t('t_other');
    bySubject.set(subject, [...(bySubject.get(subject) ?? []), x]);
  }
  [...bySubject.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([subject, ts]) => groups.push({ key: `s:${subject}`, title: subject, teachers: ts }));

  const leaders = list.filter((x) => x.isLeadership && !homeroom.includes(x));
  if (leaders.length) groups.push({ key: 'leadership', title: t('t_leadership'), teachers: leaders });

  return groups;
}

/** "Ana Nur Maulida, B.Sc." → "AN" */
export function initials(name: string) {
  const words = name.split(',')[0].trim().split(/\s+/);
  return ((words[0]?.[0] ?? '') + (words.length > 1 ? words[words.length - 1][0] : '')).toUpperCase();
}

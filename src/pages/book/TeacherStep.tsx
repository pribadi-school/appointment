/** Step 2: homeroom teacher first, then teachers of the child's grade by subject, then leadership. */
import { useMemo, useState } from 'react';
import { BadgeCheck, ChevronRight, MapPin, Search, X } from 'lucide-react';
import { Avatar, Skeleton, StatusPill, cx } from '../../components/ui';
import { useI18n } from '../../lib/i18n';
import { useLive } from '../../lib/live';
import { useAvailableCounts } from '../../lib/slots';
import { groupTeachers, initials } from '../../lib/teachers';
import { fmtTime } from '../../lib/time';
import type { Teacher } from '../../lib/types';
import type { Flow } from '../BookPage';

export function TeacherStep({ flow }: { flow: Flow }) {
  const { t } = useI18n();
  const { teachers, loading } = useLive();
  const counts = useAvailableCounts();
  const [query, setQuery] = useState('');
  const groups = useMemo(() => groupTeachers(teachers, flow.details.childClass, query, t), [teachers, flow.details.childClass, query, t]);

  // Teachers this child already has a booking with → "Booked · 09.10"
  const bookedWith = useMemo(() => new Map(flow.busy.filter((b) => b.sameChild).map((b) => [b.teacherId, b.slotStart])), [flow.busy]);

  const choose = (teacher: Teacher) => {
    if (flow.teacherId !== teacher.id) flow.setSlotStart(null);
    flow.setTeacherId(teacher.id);
    flow.go('time');
  };

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3 text-sm">
        <p className="text-muted-foreground">
          {t('t_for', { cls: flow.details.childClass })} · <span className="font-semibold text-accent">{flow.details.childName}</span>
        </p>
        <button type="button" onClick={() => flow.go('details')} className="shrink-0 font-semibold text-action underline-offset-2 hover:underline">
          {t('edit')}
        </button>
      </div>

      <div className="relative mb-5">
        <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('t_searchPh')}
          aria-label={t('t_searchPh')}
          className="h-12 w-full rounded-full bg-surface pr-12 pl-12 text-base shadow-e1 ring-1 ring-border-strong outline-none placeholder:text-muted-foreground/70 focus:ring-2 focus:ring-action [&::-webkit-search-cancel-button]:hidden"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            aria-label={t('clearSearch')}
            className="absolute top-1/2 right-2 inline-flex size-9 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-surface-page"
          >
            <X className="size-4" aria-hidden />
          </button>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-[72px] rounded-lg" />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <p className="py-10 text-center text-muted-foreground">{t('t_noResults', { q: query })}</p>
      ) : (
        <div className="space-y-6">
          {groups.map((g) => (
            <section key={g.key} aria-labelledby={`g-${g.key}`}>
              <h2 id={`g-${g.key}`} className="mb-2.5 text-xs font-bold tracking-wide text-muted-foreground uppercase">
                {g.title}
              </h2>
              <ul className="space-y-2.5">
                {g.teachers.map((teacher) => {
                  const left = counts.get(teacher.id) ?? 0;
                  const booked = bookedWith.get(teacher.id);
                  const featured = g.key === 'homeroom';
                  return (
                    <li key={teacher.id}>
                      <button
                        type="button"
                        onClick={() => choose(teacher)}
                        className={cx(
                          'group flex w-full items-center gap-3 rounded-lg bg-surface p-3 text-left ring-1 ring-border',
                          'transition-[box-shadow,transform] duration-250 hover:-translate-y-0.5 hover:shadow-e3 active:scale-[0.99]',
                          featured ? 'shadow-e2 ring-2 ring-primary/40' : 'shadow-e1',
                        )}
                      >
                        <Avatar text={initials(teacher.name)} muted={left === 0 && booked === undefined} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[15px] font-bold text-foreground">{teacher.name}</span>
                          <span className="mt-0.5 flex items-center gap-1 truncate text-[13px] text-muted-foreground">
                            {teacher.subject && <span className="truncate">{teacher.subject}</span>}
                            {teacher.subject && teacher.room && <span aria-hidden>·</span>}
                            {teacher.room && (
                              <span className="inline-flex shrink-0 items-center gap-0.5">
                                <MapPin className="size-3" aria-hidden />
                                {teacher.room}
                              </span>
                            )}
                          </span>
                          {teacher.role && (
                            <span className="mt-1.5 flex flex-wrap gap-1">
                              {teacher.role.split(',').map((r) => r.trim()).filter(Boolean).map((r) => (
                                <span key={r} className="inline-flex items-center gap-1 rounded-full bg-accent-tint px-2 py-0.5 text-[11px] font-semibold text-foreground">
                                  <BadgeCheck className="size-3 shrink-0 text-accent" aria-hidden />
                                  {r}
                                </span>
                              ))}
                            </span>
                          )}
                        </span>
                        {booked !== undefined ? (
                          <span className="shrink-0 rounded-full bg-action-tint px-2.5 py-1 text-xs font-semibold text-action">
                            {t('t_bookedAt', { time: fmtTime(booked) })}
                          </span>
                        ) : left === 0 ? (
                          <StatusPill status="taken" label={t('t_full')} />
                        ) : (
                          <span className="shrink-0 text-xs font-semibold text-action">{t('t_left', { n: left })}</span>
                        )}
                        <ChevronRight className="size-5 shrink-0 text-muted-foreground transition-transform duration-250 group-hover:translate-x-0.5" aria-hidden />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  );
}

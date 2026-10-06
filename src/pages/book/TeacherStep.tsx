/** Step 2: homeroom teacher first, then teachers of the child's grade by subject, then leadership. */
import { useMemo, useState } from 'react';
import { Check, ChevronRight, MapPin, Search, X } from 'lucide-react';
import { StickyBar } from '../../components/Header';
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
      <div className="mb-4 flex items-center justify-between gap-3 rounded-md border border-border-strong bg-surface px-4 py-2.5 text-sm">
        <p className="min-w-0 text-muted-foreground">
          {t('t_for', { cls: flow.details.childClass })} · <span className="font-semibold text-foreground">{flow.details.childName}</span>
        </p>
        <button
          type="button"
          onClick={() => flow.go('details')}
          className="-mr-2 inline-flex min-h-11 shrink-0 items-center rounded-md px-2 font-semibold text-action transition-colors duration-150 hover:bg-action-tint"
        >
          {t('edit')}
        </button>
      </div>

      <div className="relative mb-6">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('t_searchPh')}
          aria-label={t('t_searchPh')}
          className="h-12 w-full rounded-md border border-border-strong bg-surface pr-12 pl-11 text-base outline-none placeholder:text-muted-foreground focus:border-action focus:ring-1 focus:ring-action [&::-webkit-search-cancel-button]:hidden"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            aria-label={t('clearSearch')}
            className="absolute top-1/2 right-1 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-surface-page"
          >
            <X className="size-4" aria-hidden />
          </button>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-[72px] rounded-lg" />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <p className="py-10 text-center text-muted-foreground">{t('t_noResults', { q: query })}</p>
      ) : (
        <div className="space-y-7">
          {groups.map((g) => {
            const featured = g.key === 'homeroom';
            return (
              <section key={g.key} aria-labelledby={`g-${g.key}`}>
                <h2 id={`g-${g.key}`} className="mb-2 px-1 text-sm font-bold text-foreground">
                  {g.title}
                </h2>
                {/* One grouped list per section, rows separated by hairlines (native list pattern). */}
                <ul className={cx('divide-y divide-border-strong overflow-hidden rounded-lg border bg-surface', featured ? 'border-action' : 'border-border-strong')}>
                  {g.teachers.map((teacher) => {
                    const left = counts.get(teacher.id) ?? 0;
                    const booked = bookedWith.get(teacher.id);
                    return (
                      <li key={teacher.id}>
                        <button
                          type="button"
                          onClick={() => choose(teacher)}
                          className="flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors duration-150 hover:bg-surface-page active:bg-surface-muted"
                        >
                          <Avatar text={initials(teacher.name)} muted={left === 0 && booked === undefined} />
                          <span className="min-w-0 flex-1">
                            <span className="block text-base leading-snug font-semibold text-foreground">{teacher.name}</span>
                            <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-sm text-muted-foreground">
                              {teacher.subject && <span>{teacher.subject}</span>}
                              {teacher.subject && teacher.room && <span aria-hidden>·</span>}
                              {teacher.room && (
                                <span className="inline-flex items-center gap-1">
                                  <MapPin className="size-3.5" aria-hidden />
                                  {teacher.room}
                                </span>
                              )}
                            </span>
                            {teacher.role && (
                              <span className="mt-2 flex flex-wrap gap-1.5">
                                {teacher.role
                                  .split(',')
                                  .map((r) => r.trim())
                                  .filter(Boolean)
                                  .map((r) => (
                                    <span key={r} className="inline-flex items-center rounded-sm bg-accent-tint px-2 py-0.5 text-xs font-semibold text-foreground">
                                      {r}
                                    </span>
                                  ))}
                              </span>
                            )}
                            <span className="mt-2 block">
                              {booked !== undefined ? (
                                <span className="inline-flex items-center gap-1 rounded-sm bg-action-tint px-2 py-0.5 text-xs font-semibold text-action">
                                  <Check className="size-3.5" aria-hidden />
                                  {t('t_bookedAt', { time: fmtTime(booked) })}
                                </span>
                              ) : left === 0 ? (
                                <StatusPill status="taken" label={t('t_full')} />
                              ) : (
                                <span className="text-xs font-semibold text-action">{t('t_left', { n: left })}</span>
                              )}
                            </span>
                          </span>
                          <ChevronRight className="mt-3 size-5 shrink-0 text-muted-foreground" aria-hidden />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      )}

      <StickyBar onBack={() => window.history.back()} />
    </>
  );
}

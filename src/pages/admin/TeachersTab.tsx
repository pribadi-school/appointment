/** Edit teachers (SMP–SMA) and SD classes, subjects, grades, rooms — no code needed. */
import { useMemo, useState } from 'react';
import { MapPin, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { BottomSheet } from '../../components/BottomSheet';
import { Avatar, Button, Card, Field, Segmented, SelectField, StatusPill, Switch, cx } from '../../components/ui';
import { api } from '../../lib/api';
import { isLeadershipRole, parseHomeroom } from '../../data/seedTeachers';
import { useI18n } from '../../lib/i18n';
import { useLive } from '../../lib/live';
import { avatarText, classLabel } from '../../lib/teachers';
import { CLASSES, SD_CLASSES, type Level, type Teacher } from '../../lib/types';
import { useAdmin } from './AdminPage';

const NEW: Teacher = {
  id: '',
  name: '',
  level: 'smp_sma',
  subject: null,
  grades: [],
  role: null,
  homeroomClass: null,
  isLeadership: false,
  room: null,
  available: true,
  sortOrder: 0,
};

export function TeachersTab() {
  const { t } = useI18n();
  const { teachers } = useLive();
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<Teacher | null>(null);
  const [rooms, setRooms] = useState(false);
  const [level, setLevel] = useState<'all' | Level>('all');

  const list = useMemo(
    () =>
      [...teachers]
        .filter((x) => level === 'all' || x.level === level)
        .filter((x) => !q || `${x.name} ${x.subject ?? ''} ${x.room ?? ''}`.toLowerCase().includes(q.toLowerCase()))
        // SD classes in grade order, teachers by name.
        .sort((a, b) =>
          a.level === b.level
            ? a.level === 'sd'
              ? (a.homeroomClass ?? '').localeCompare(b.homeroomClass ?? '')
              : a.name.localeCompare(b.name)
            : a.level === 'sd'
              ? -1
              : 1,
        ),
    [teachers, q, level],
  );

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-60 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('a_t_search')}
            aria-label={t('a_t_search')}
            className="h-11 w-full rounded-md border border-border-strong bg-surface pr-3 pl-10 text-base outline-none focus:border-action focus:ring-1 focus:ring-action"
          />
        </div>
        <Segmented
          label={t('a_t_level')}
          value={level}
          onChange={setLevel}
          options={[
            { value: 'all', label: t('a_lvl_all') },
            { value: 'sd', label: t('sd') },
            { value: 'smp_sma', label: t('lvl_smp') },
          ]}
        />
        <Button size="sm" variant="secondary" icon={<MapPin className="size-4" aria-hidden />} onClick={() => setRooms(true)}>
          {t('a_roomsBySubject')}
        </Button>
        <Button size="sm" icon={<Plus className="size-4" aria-hidden />} onClick={() => setEditing(NEW)}>
          {t('a_addTeacher')}
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {list.map((x) => (
          <Card key={x.id} className={cx('flex items-start gap-3 p-4', !x.available && 'opacity-70')}>
            <Avatar text={avatarText(x)} muted={!x.available} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-bold text-foreground">{x.name}</p>
              <p className="truncate text-sm text-muted-foreground">
                {x.level === 'sd'
                  ? `${t('lvl_sd')} · ${classLabel(x.homeroomClass, t)}`
                  : `${x.subject ?? '-'} · ${x.grades.length ? x.grades.join(', ') : '7–12'}`}
              </p>
              <p className="truncate text-sm text-muted-foreground">
                <MapPin className="mr-0.5 inline size-3" aria-hidden />
                {x.room ?? '-'}
                {x.homeroomClass && x.level === 'smp_sma' && ` · ${t('a_t_homeroom')} ${x.homeroomClass}`}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {!x.available && <StatusPill status="taken" label={t('a_t_unavailable')} />}
                {x.isLeadership && <StatusPill status="available" label={t('t_leadership')} />}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setEditing(x)}
              aria-label={`${t('edit')}: ${x.name}`}
              className="inline-flex size-10 shrink-0 items-center justify-center rounded-md text-action transition-colors duration-150 hover:bg-action-tint"
            >
              <Pencil className="size-4" aria-hidden />
            </button>
          </Card>
        ))}
      </div>

      {editing && <TeacherSheet teacher={editing} onClose={() => setEditing(null)} />}
      {rooms && <RoomsSheet onClose={() => setRooms(false)} />}
    </>
  );
}

function TeacherSheet({ teacher, onClose }: { teacher: Teacher; onClose: () => void }) {
  const { t } = useI18n();
  const { token, bookings, run } = useAdmin();
  const [f, setF] = useState<Teacher>(teacher);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isNew = !teacher.id;
  const count = (bookings ?? []).filter((b) => b.teacherId === teacher.id && b.kind === 'booking').length;

  const set = <K extends keyof Teacher>(k: K, v: Teacher[K]) => setF((x) => ({ ...x, [k]: v }));
  const sd = f.level === 'sd';
  // Switching level resets what only makes sense for the other level.
  const setLevel = (level: Level) =>
    setF((x) =>
      x.level === level
        ? x
        : {
            ...x,
            level,
            grades: level === 'sd' ? [1] : [],
            homeroomClass: level === 'sd' ? '1' : null,
            subject: level === 'sd' ? null : x.subject,
            isLeadership: false,
          },
    );

  const saveTeacher = async () => {
    setBusy(true);
    const ok = await run(() => api.adminSaveTeacher(token, { ...f, id: f.id || undefined }), t('saved'));
    setBusy(false);
    if (ok) onClose();
  };

  return (
    <BottomSheet
      open
      onClose={onClose}
      size="lg"
      title={isNew ? t('a_addTeacher') : t('a_editTeacher')}
      footer={
        <Button block loading={busy} disabled={f.name.trim().length < 2 || (sd && !f.homeroomClass)} onClick={saveTeacher}>
          {t('save')}
        </Button>
      }
    >
      <div className="space-y-4">
        <div>
          <span className="mb-1.5 block text-sm font-semibold text-foreground">{t('a_t_level')}</span>
          <Segmented
            label={t('a_t_level')}
            value={f.level}
            onChange={setLevel}
            options={[
              { value: 'smp_sma', label: t('lvl_smp') },
              { value: 'sd', label: t('lvl_sd') },
            ]}
          />
        </div>
        <Field label={t(sd ? 'a_t_nameSd' : 'a_t_name')} value={f.name} onChange={(e) => set('name', e.target.value)} />
        {sd ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              label={t('a_t_sdClass')}
              value={f.homeroomClass ?? '1'}
              onChange={(v) => setF((x) => ({ ...x, homeroomClass: v, grades: [Number(v)] }))}
              options={SD_CLASSES.map((c) => ({
                value: c,
                label: classLabel(c, t),
              }))}
            />
            <Field label={t('a_t_room')} value={f.room ?? ''} onChange={(e) => set('room', e.target.value || null)} />
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('a_t_subject')} value={f.subject ?? ''} onChange={(e) => set('subject', e.target.value || null)} />
              <Field label={t('a_t_room')} value={f.room ?? ''} onChange={(e) => set('room', e.target.value || null)} />
            </div>
            <fieldset>
              <legend className="mb-1.5 text-sm font-semibold text-foreground">{t('a_t_grades')}</legend>
              <div className="flex flex-wrap gap-2">
                {[7, 8, 9, 10, 11, 12].map((g) => {
                  const on = f.grades.includes(g);
                  return (
                    <button
                      key={g}
                      type="button"
                      aria-pressed={on}
                      onClick={() => set('grades', on ? f.grades.filter((x) => x !== g) : [...f.grades, g].sort((a, b) => a - b))}
                      className={cx(
                        'h-10 w-12 rounded-md text-sm font-bold transition-colors duration-200',
                        on ? 'bg-action text-on-primary' : 'bg-surface text-foreground ring-1 ring-border-strong',
                      )}
                    >
                      {g}
                    </button>
                  );
                })}
              </div>
              <p className="mt-1.5 text-sm text-muted-foreground">{t('a_t_gradesHint')}</p>
            </fieldset>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label={t('a_t_role')}
                placeholder={t('a_t_rolePh')}
                value={f.role ?? ''}
                onChange={(e) => {
                  const role = e.target.value || null;
                  // Fill homeroom + leadership automatically from the role text.
                  setF((x) => ({
                    ...x,
                    role,
                    homeroomClass: parseHomeroom(role) ?? x.homeroomClass,
                    isLeadership: isLeadershipRole(role, x.subject) || x.isLeadership,
                  }));
                }}
              />
              <SelectField
                label={t('a_t_homeroom')}
                value={f.homeroomClass ?? ''}
                onChange={(v) => set('homeroomClass', v || null)}
                options={[{ value: '', label: t('a_t_none') }, ...CLASSES.map((c) => ({ value: c, label: c }))]}
              />
            </div>
            <div className="flex items-center justify-between gap-3 rounded-md bg-surface-page px-4 py-3">
              <span className="text-sm font-semibold text-foreground">{t('a_t_leadership')}</span>
              <Switch checked={f.isLeadership} onChange={(v) => set('isLeadership', v)} label={t('a_t_leadership')} />
            </div>
          </>
        )}
        <div className="flex items-center justify-between gap-3 rounded-md bg-surface-page px-4 py-3">
          <span className="text-sm font-semibold text-foreground">{t('a_t_available')}</span>
          <Switch checked={f.available} onChange={(v) => set('available', v)} label={t('a_t_available')} />
        </div>

        {!isNew && (
          <>
            <div className="border-t border-border pt-4">
              {confirmDelete ? (
                <div className="space-y-3">
                  <p className="text-sm text-foreground">{t('a_t_confirmDelete', { name: teacher.name, n: count })}</p>
                  <div className="flex gap-2">
                    <Button variant="secondary" block onClick={() => setConfirmDelete(false)}>
                      {t('cancel')}
                    </Button>
                    <Button
                      variant="danger"
                      block
                      onClick={async () => {
                        if (await run(() => api.adminDeleteTeacher(token, teacher.id), t('saved'))) onClose();
                      }}
                    >
                      {t('a_t_delete')}
                    </Button>
                  </div>
                </div>
              ) : (
                <Button variant="danger" block icon={<Trash2 className="size-4" aria-hidden />} onClick={() => setConfirmDelete(true)}>
                  {t('a_t_delete')}
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </BottomSheet>
  );
}

/** Set one room for all teachers of a subject. */
function RoomsSheet({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const { teachers } = useLive();
  const { token, run } = useAdmin();
  const subjects = useMemo(() => {
    const m = new Map<string, { room: string; n: number }>();
    for (const x of teachers) {
      const k = x.subject ?? '';
      const cur = m.get(k);
      m.set(k, { room: cur?.room ?? x.room ?? '', n: (cur?.n ?? 0) + 1 });
    }
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [teachers]);
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(subjects.map(([s, v]) => [s, v.room])));

  return (
    <BottomSheet open onClose={onClose} title={t('a_roomsBySubject')} size="lg">
      <p className="mb-4 text-sm text-muted-foreground">{t('a_roomsHint')}</p>
      <ul className="space-y-3">
        {subjects.map(([subject, { n }]) => (
          <li key={subject} className="flex items-end gap-2">
            <Field
              className="flex-1"
              label={`${subject || t('a_noSubject')} (${n})`}
              value={values[subject] ?? ''}
              onChange={(e) => setValues((v) => ({ ...v, [subject]: e.target.value }))}
            />
            <Button
              variant="secondary"
              onClick={() => run(() => api.adminSetRoomForSubject(token, subject || null, values[subject] ?? ''), t('a_roomsUpdated', { n }))}
            >
              {t('a_apply')}
            </Button>
          </li>
        ))}
      </ul>
    </BottomSheet>
  );
}

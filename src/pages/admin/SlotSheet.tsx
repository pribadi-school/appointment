/** Admin actions for one teacher + time: book for a parent, block, move, cancel, mark status. */
import { useState } from 'react';
import { ArrowRightLeft, Ban, Check, Trash2, UserX } from 'lucide-react';
import { BottomSheet } from '../../components/BottomSheet';
import { Button, Field, SelectField, StatusPill } from '../../components/ui';
import { api } from '../../lib/api';
import { useI18n } from '../../lib/i18n';
import { useLive } from '../../lib/live';
import { formatPhone } from '../../lib/phone';
import { classLabel } from '../../lib/teachers';
import { fmtRange, fmtTime, scheduleFor, slotStarts } from '../../lib/time';
import { classesFor } from '../../lib/types';
import { useAdmin } from './AdminPage';

export function SlotSheet({ teacherId, slotStart, onClose }: { teacherId: string; slotStart: number; onClose: () => void }) {
  const { t, lang } = useI18n();
  const { teachers, settings } = useLive();
  const { token, bookings, run } = useAdmin();
  const teacher = teachers.find((x) => x.id === teacherId);
  const booking = bookings?.find((b) => b.teacherId === teacherId && b.slotStart === slotStart);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    parentName: '',
    childName: '',
    // SD: the class is the record's own class.
    childClass: teacher?.level === 'sd' ? (teacher.homeroomClass ?? '1') : '7A',
    phone: '',
  });
  const [note, setNote] = useState(t('a_blockDefault'));
  const [moveTeacher, setMoveTeacher] = useState(teacherId);
  const [moveTime, setMoveTime] = useState(String(slotStart));
  const [confirmCancel, setConfirmCancel] = useState(false);
  if (!teacher || !settings) return null;

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    const done = await run(fn, ok);
    setBusy(false);
    if (done) onClose();
  };

  const taken = new Set((bookings ?? []).filter((b) => b.teacherId === moveTeacher && b.id !== booking?.id).map((b) => String(b.slotStart)));
  const title = t('a_slotTitle', { teacher: teacher.name, time: fmtRange(slotStart, scheduleFor(settings, teacher.level).slotMinutes) });
  // Bookings move only within the same level (the child's class decides it).
  const moveTarget = teachers.find((x) => x.id === moveTeacher) ?? teacher;

  return (
    <BottomSheet open onClose={onClose} title={title}>
      {!booking && (
        <div className="space-y-6">
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              act(() => api.adminBook(token, { ...form, teacherId, slotStart, lang }), t('done_title'));
            }}
          >
            <div>
              <h3 className="font-bold">{t('a_bookFor')}</h3>
              <p className="text-sm text-muted-foreground">{t('a_bookForHint')}</p>
            </div>
            <Field label={t('a_col_parent')} value={form.parentName} onChange={(e) => setForm({ ...form, parentName: e.target.value })} required />
            <div className="grid grid-cols-[1fr_96px] gap-3">
              <Field label={t('f_childName')} value={form.childName} onChange={(e) => setForm({ ...form, childName: e.target.value })} required />
              <SelectField
                label={t('a_col_class')}
                value={form.childClass}
                onChange={(v) => setForm({ ...form, childClass: v })}
                options={classesFor(teacher.level).map((c) => ({ value: c, label: classLabel(c, t) }))}
              />
            </div>
            <Field
              label={`${t('f_phone')} (${t('optional')})`}
              type="tel"
              inputMode="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
            <Button type="submit" block loading={busy} disabled={form.parentName.trim().length < 2 || form.childName.trim().length < 2}>
              {t('c_bookNow')}
            </Button>
          </form>
          <form
            className="space-y-3 border-t border-border pt-5"
            onSubmit={(e) => {
              e.preventDefault();
              act(() => api.adminBlock(token, teacherId, slotStart, note), t('st_blocked'));
            }}
          >
            <h3 className="font-bold">{t('a_block')}</h3>
            <Field label={t('a_blockNote')} value={note} onChange={(e) => setNote(e.target.value)} />
            <Button type="submit" variant="secondary" block disabled={busy} icon={<Ban className="size-4" aria-hidden />}>
              {t('a_block')}
            </Button>
          </form>
        </div>
      )}

      {booking?.kind === 'blocked' && (
        <div className="space-y-4">
          <p className="flex items-center gap-2 text-base font-semibold">
            <Ban className="size-4 text-muted-foreground" aria-hidden />
            {t('st_blocked')}
            {booking.note ? ` · ${booking.note}` : ''}
          </p>
          <Button variant="secondary" block loading={busy} onClick={() => act(() => api.adminCancel(token, booking.id), t('saved'))}>
            {t('a_unblock')}
          </Button>
        </div>
      )}

      {booking?.kind === 'booking' && (
        <div className="space-y-5">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
            <dt className="text-muted-foreground">{t('a_col_child')}</dt>
            <dd className="font-bold text-foreground">
              {booking.childName} · {classLabel(booking.childClass, t)}
            </dd>
            <dt className="text-muted-foreground">{t('a_col_parent')}</dt>
            <dd className="text-foreground">{booking.parentName}</dd>
            <dt className="text-muted-foreground">{t('a_col_phone')}</dt>
            <dd className="text-foreground">{booking.phone ? formatPhone(booking.phone) : t('tv_noPhone')}</dd>
            <dt className="text-muted-foreground">{t('a_col_code')}</dt>
            <dd className="font-mono font-bold text-foreground">{booking.code}</dd>
            <dt className="text-muted-foreground">{t('a_col_status')}</dt>
            <dd>
              <StatusPill
                status={booking.status === 'done' ? 'done' : booking.status === 'no_show' ? 'noShow' : 'taken'}
                label={booking.status === 'done' ? t('st_done') : booking.status === 'no_show' ? t('st_noShow') : t('st_taken')}
              />
            </dd>
            <dt className="text-muted-foreground">{t('a_createdBy')}</dt>
            <dd className="text-foreground">{booking.createdBy === 'admin' ? t('a_by_admin') : t('a_by_parent')}</dd>
          </dl>

          <div className="flex flex-wrap gap-2">
            {booking.status !== 'done' && (
              <Button size="sm" variant="secondary" disabled={busy} icon={<Check className="size-4" aria-hidden />} onClick={() => act(() => api.adminSetStatus(token, booking.id, 'done'), t('st_done'))}>
                {t('a_markDone')}
              </Button>
            )}
            {booking.status !== 'no_show' && (
              <Button size="sm" variant="secondary" disabled={busy} icon={<UserX className="size-4" aria-hidden />} onClick={() => act(() => api.adminSetStatus(token, booking.id, 'no_show'), t('st_noShow'))}>
                {t('a_markNoShow')}
              </Button>
            )}
            {booking.status !== 'booked' && (
              <Button size="sm" variant="secondary" disabled={busy} onClick={() => act(() => api.adminSetStatus(token, booking.id, 'booked'), t('saved'))}>
                {t('a_markBooked')}
              </Button>
            )}
          </div>

          <form
            className="space-y-3 border-t border-border pt-5"
            onSubmit={(e) => {
              e.preventDefault();
              act(() => api.adminMove(token, booking.id, moveTeacher, Number(moveTime)), t('saved'));
            }}
          >
            <h3 className="font-bold">{t('a_move')}</h3>
            <SelectField
              label={t('a_moveTeacher')}
              value={moveTeacher}
              onChange={setMoveTeacher}
              options={teachers
                .filter((x) => x.level === teacher.level)
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((x) => ({ value: x.id, label: x.name }))}
            />
            <SelectField
              label={t('a_moveTime')}
              value={moveTime}
              onChange={setMoveTime}
              options={slotStarts(scheduleFor(settings, moveTarget.level)).map((s) => ({
                value: String(s),
                label: `${fmtTime(s)}${taken.has(String(s)) ? ` (${t('st_taken')})` : ''}`,
                disabled: taken.has(String(s)),
              }))}
            />
            <Button type="submit" variant="secondary" block disabled={busy || (moveTeacher === teacherId && Number(moveTime) === slotStart)} icon={<ArrowRightLeft className="size-4" aria-hidden />}>
              {t('a_move')}
            </Button>
          </form>

          <div className="border-t border-border pt-5">
            {confirmCancel ? (
              <div className="space-y-3">
                <p className="text-sm text-foreground">{t('a_confirmCancel')}</p>
                <div className="flex gap-2">
                  <Button variant="secondary" block onClick={() => setConfirmCancel(false)}>
                    {t('my_keep')}
                  </Button>
                  <Button variant="danger" block loading={busy} onClick={() => act(() => api.adminCancel(token, booking.id), t('my_cancelled'))}>
                    {t('my_yesCancel')}
                  </Button>
                </div>
              </div>
            ) : (
              <Button variant="danger" block icon={<Trash2 className="size-4" aria-hidden />} onClick={() => setConfirmCancel(true)}>
                {t('a_cancelBooking')}
              </Button>
            )}
          </div>
        </div>
      )}
    </BottomSheet>
  );
}

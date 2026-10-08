/**
 * A teacher's / SD class's own times: first slot, slot length and number of
 * slots. Each field left empty = the level's (shown as the placeholder). Used in
 * Event settings ("Times per grade") and in the teacher editor.
 */
import { Field, SelectField } from '../../components/ui';
import { useI18n } from '../../lib/i18n';
import { scheduleFor, slotStarts, teacherSchedule } from '../../lib/time';
import type { Settings, Teacher } from '../../lib/types';

export type Own = Pick<Teacher, 'level' | 'dayStart' | 'slotMinutes' | 'slotCount'>;

const LENGTHS = [5, 10, 15, 20, 25, 30, 45, 60];
const hhmm = (s: string) => s.replace(':', '.');

export function OwnScheduleFields({ settings, value, onChange }: { settings: Settings; value: Own; onChange: (v: Own) => void }) {
  const { t } = useI18n();
  const level = scheduleFor(settings, value.level);
  return (
    <div className="grid grid-cols-3 gap-3">
      <Field
        label={t('a_t_start')}
        type="time"
        step={300}
        value={value.dayStart ?? ''}
        placeholder={level.dayStart}
        onChange={(e) => onChange({ ...value, dayStart: e.target.value || null })}
      />
      <SelectField
        label={t('a_t_length')}
        value={value.slotMinutes ? String(value.slotMinutes) : ''}
        onChange={(v) => onChange({ ...value, slotMinutes: v ? Number(v) : null })}
        options={[
          { value: '', label: t('a_t_default', { v: t('minutes', { n: level.slotMinutes }) }) },
          ...LENGTHS.map((m) => ({ value: String(m), label: t('minutes', { n: m }) })),
        ]}
      />
      <Field
        label={t('a_t_slots')}
        type="number"
        inputMode="numeric"
        min={1}
        max={96}
        placeholder={String(slotStarts(teacherSchedule(settings, { ...value, slotCount: null })).length)}
        value={value.slotCount ?? ''}
        onChange={(e) => {
          const n = parseInt(e.target.value, 10);
          onChange({ ...value, slotCount: Number.isFinite(n) && n > 0 ? Math.min(n, 96) : null });
        }}
      />
    </div>
  );
}

/** "08.00 – 13.00 · 20 slots of 15 min" for the times as they stand. */
export function OwnSchedulePreview({ settings, value }: { settings: Settings; value: Own }) {
  const { t } = useI18n();
  const own = teacherSchedule(settings, value);
  const n = slotStarts(own).length;
  return (
    <p className="text-sm text-muted-foreground tabular-nums">
      {n > 0 ? t('a_g_preview', { start: hhmm(own.dayStart), end: hhmm(own.dayEnd), n, m: own.slotMinutes }) : t('a_g_none')}
    </p>
  );
}

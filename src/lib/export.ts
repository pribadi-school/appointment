/** Export all bookings to CSV or Excel (.xlsx) from the admin page. */
import { formatPhone } from './phone';
import { classLabel } from './teachers';
import { fmtDate, fmtRange, jakartaDate, teacherMinutes } from './time';
import type { T } from './i18n';
import type { Booking, Lang, Settings, Teacher } from './types';

function rows(bookings: Booking[], teachers: Teacher[], settings: Settings, t: T, lang: Lang): string[][] {
  const byId = new Map(teachers.map((x) => [x.id, x]));
  const status = (b: Booking) =>
    b.kind === 'blocked' ? t('st_blocked') : b.status === 'done' ? t('st_done') : b.status === 'no_show' ? t('st_noShow') : t('st_taken');
  const header = [
    t('c_date'), t('a_col_time'), t('a_col_teacher'), t('a_col_subject'), t('a_col_room'), t('a_col_child'),
    t('a_col_class'), t('a_col_parent'), t('a_col_phone'), t('a_col_status'), t('a_col_code'), t('a_col_by'),
  ];
  const body = [...bookings]
    .sort((a, b) => a.slotStart - b.slotStart || (byId.get(a.teacherId)?.name ?? '').localeCompare(byId.get(b.teacherId)?.name ?? ''))
    .map((b) => {
      const teacher = byId.get(b.teacherId);
      return [
        fmtDate(jakartaDate(b.slotStart), lang, { weekday: undefined }),
        fmtRange(b.slotStart, teacherMinutes(settings, teacher)),
        teacher?.name ?? '',
        teacher?.subject ?? '',
        teacher?.room ?? '',
        b.childName ?? (b.note ? `(${b.note})` : ''),
        classLabel(b.childClass, t),
        b.parentName ?? '',
        formatPhone(b.phone),
        status(b),
        b.code,
        b.createdBy === 'admin' ? t('a_by_admin') : t('a_by_parent'),
      ];
    });
  return [header, ...body];
}

function download(blob: Blob, name: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

const fileName = (settings: Settings, ext: string) => `consultations-${settings.eventDate}.${ext}`;

export function exportCsv(bookings: Booking[], teachers: Teacher[], settings: Settings, t: T, lang: Lang) {
  const esc = (v: string) => (/[",\n;]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const csv = rows(bookings, teachers, settings, t, lang).map((r) => r.map(esc).join(',')).join('\r\n');
  // BOM so Excel opens UTF-8 names correctly.
  download(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }), fileName(settings, 'csv'));
}

export async function exportXlsx(bookings: Booking[], teachers: Teacher[], settings: Settings, t: T, lang: Lang) {
  const { default: writeXlsxFile } = await import('write-excel-file/browser');
  const data = rows(bookings, teachers, settings, t, lang).map((r, i) =>
    r.map((value) => ({ value, fontWeight: i === 0 ? ('bold' as const) : undefined })),
  );
  const blob = await writeXlsxFile(data, { columns: data[0].map((_, i) => ({ width: [18, 15, 30, 20, 18, 22, 7, 22, 18, 12, 8, 14][i] })) }).toBlob();
  download(blob, fileName(settings, 'xlsx'));
}

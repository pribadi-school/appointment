/**
 * Phone numbers are stored as digits with country code, e.g. 6281234567890.
 * Mirrors private.normalize_phone() in the database.
 */
export function normalizePhone(input: string): string | null {
  const raw = input.trim();
  let d = raw.replace(/\D/g, '');
  if (raw.startsWith('+')) {
    // already international
  } else if (d.startsWith('0')) {
    d = '62' + d.slice(1);
  } else if (d.startsWith('8')) {
    d = '62' + d;
  }
  return /^[1-9]\d{7,14}$/.test(d) ? d : null;
}

/** 6281234567890 → +62 812-3456-7890 (for display) */
export function formatPhone(digits: string | null): string {
  if (!digits) return '';
  if (digits.startsWith('62')) {
    const rest = digits.slice(2);
    return `+62 ${rest.slice(0, 3)}-${rest.slice(3, 7)}-${rest.slice(7)}`.replace(/-$/, '');
  }
  return `+${digits}`;
}

/** Child-name key used for "one slot per teacher per child". Mirrors the DB. */
export const childKey = (name: string) => name.trim().replace(/\s+/g, ' ').toLowerCase();

export const firstNameKey = (name: string) => childKey(name).split(' ')[0] ?? '';

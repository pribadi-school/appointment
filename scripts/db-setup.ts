/**
 * One-time database setup for a Supabase project.
 *
 *   npm run db:setup            → creates tables/functions, adds the teacher
 *                                 list (only if empty), sets the admin password,
 *                                 and sets the teacher PIN (only if none is set yet)
 *   npm run db:admin-password   → only (re)sets the admin password
 *   npm run db:teacher-pin      → only (re)sets the teacher PIN and signs every
 *                                 teacher out
 *
 * Reads SUPABASE_DB_URL, ADMIN_PASSWORD and TEACHER_PIN from the .env file.
 * Safe to run more than once: it never deletes bookings or teachers, and a
 * plain db:setup never overwrites a teacher PIN that is already set (it may
 * have been changed from the Admin page since).
 */
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import pg from 'pg';

const url = process.env.SUPABASE_DB_URL;
const password = process.env.ADMIN_PASSWORD;
const pin = process.env.TEACHER_PIN?.trim();
const passwordOnly = process.argv.includes('--password-only');
const pinOnly = process.argv.includes('--teacher-pin');

if (!url) {
  console.error('Missing SUPABASE_DB_URL in .env (Supabase → Connect → Session pooler connection string).');
  process.exit(1);
}
if (!pinOnly && (!password || password.length < 8 || password.startsWith('change-me'))) {
  console.error('Set ADMIN_PASSWORD in .env to a password of at least 8 characters.');
  process.exit(1);
}
if (pin !== undefined && pin !== '' && !/^[0-9]{4,10}$/.test(pin)) {
  console.error('TEACHER_PIN in .env must be 4 to 10 digits.');
  process.exit(1);
}
if (pinOnly && !pin) {
  console.error('Set TEACHER_PIN in .env (4 to 10 digits) first.');
  process.exit(1);
}

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });

try {
  await client.connect();
  if (pinOnly) {
    await client.query('select public.set_teacher_pin($1)', [pin]);
    console.log('Teacher PIN changed. Every teacher has been signed out.');
  } else {
    if (!passwordOnly) {
      console.log('Applying supabase/migrations/0001_schema.sql …');
      await client.query(read('supabase/migrations/0001_schema.sql'));
      console.log('Adding teachers from supabase/seed.sql (skipped if teachers already exist) …');
      await client.query(read('supabase/seed.sql'));

      const { rows } = await client.query(`select exists (select 1 from private.secrets where key = 'teacher_pin') as set`);
      if (rows[0].set) {
        console.log('Teacher PIN already set (kept). To change it: Admin page, or npm run db:teacher-pin.');
      } else if (pin) {
        await client.query('select public.set_teacher_pin($1)', [pin]);
        console.log('Teacher PIN set.');
      } else {
        console.log('No teacher PIN yet: teachers cannot sign in until you set TEACHER_PIN and run npm run db:teacher-pin.');
      }
    }
    await client.query('select public.set_admin_password($1)', [password]);
    console.log('Admin password set.');
  }
  console.log('Done ✔');
} catch (e) {
  console.error('Setup failed:', (e as Error).message);
  process.exitCode = 1;
} finally {
  await client.end();
}

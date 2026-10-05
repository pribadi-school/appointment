/**
 * One-time database setup for a Supabase project.
 *
 *   npm run db:setup            → creates tables/functions, adds the teacher
 *                                 list (only if empty), sets the admin password
 *   npm run db:admin-password   → only (re)sets the admin password
 *
 * Reads SUPABASE_DB_URL and ADMIN_PASSWORD from the .env file.
 * Safe to run more than once: it never deletes bookings or teachers.
 */
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import pg from 'pg';

const url = process.env.SUPABASE_DB_URL;
const password = process.env.ADMIN_PASSWORD;
const passwordOnly = process.argv.includes('--password-only');

if (!url) {
  console.error('Missing SUPABASE_DB_URL in .env (Supabase → Connect → Session pooler connection string).');
  process.exit(1);
}
if (!password || password.length < 8 || password.startsWith('change-me')) {
  console.error('Set ADMIN_PASSWORD in .env to a password of at least 8 characters.');
  process.exit(1);
}

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });

try {
  await client.connect();
  if (!passwordOnly) {
    console.log('Applying supabase/migrations/0001_schema.sql …');
    await client.query(read('supabase/migrations/0001_schema.sql'));
    console.log('Adding teachers from supabase/seed.sql (skipped if teachers already exist) …');
    await client.query(read('supabase/seed.sql'));
  }
  await client.query('select public.set_admin_password($1)', [password]);
  console.log('Admin password set.');
  console.log('Done ✔');
} catch (e) {
  console.error('Setup failed:', (e as Error).message);
  process.exitCode = 1;
} finally {
  await client.end();
}

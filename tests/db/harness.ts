/**
 * Starts a throw-away real PostgreSQL server (embedded-postgres), creates the
 * roles/publication Supabase normally provides, and applies our migration +
 * seed. Each test file gets a fresh database.
 */
import EmbeddedPostgres from 'embedded-postgres';
import pg from 'pg';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const root = new URL('../../', import.meta.url);
const read = (p: string) => readFileSync(new URL(p, root), 'utf8');

export type Harness = {
  connect: () => Promise<pg.Client>;
  stop: () => Promise<void>;
};

export async function startDatabase(): Promise<Harness> {
  const dir = mkdtempSync(join(tmpdir(), 'ptc-pg-'));
  const port = 54000 + Math.floor(Math.random() * 1000);
  const server = new EmbeddedPostgres({
    databaseDir: dir,
    user: 'postgres',
    password: 'postgres',
    port,
    persistent: false,
    onLog: () => {},
  });
  await server.initialise();
  await server.start();

  const connect = async () => {
    const c = new pg.Client({ host: 'localhost', port, user: 'postgres', password: 'postgres', database: 'postgres' });
    await c.connect();
    await c.query(`set timezone = 'UTC'`);
    return c;
  };

  const admin = await connect();
  // What a Supabase project already has.
  await admin.query(`
    create role anon nologin;
    create role authenticated nologin;
    grant anon, authenticated to postgres;
    create publication supabase_realtime;
  `);
  await admin.query(read('supabase/migrations/0001_schema.sql'));
  await admin.query(read('supabase/seed.sql'));
  // Running the migration twice must be harmless.
  await admin.query(read('supabase/migrations/0001_schema.sql'));
  await admin.query(read('supabase/seed.sql'));
  await admin.end();

  return {
    connect,
    stop: async () => {
      await server.stop();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

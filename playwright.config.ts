/**
 * End-to-end tests run in the offline demo mode (no Supabase needed), using
 * the Microsoft Edge / Chrome already installed on the machine.
 *   npm run test:e2e
 */
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  outputDir: 'test-results',
  use: {
    baseURL: 'http://localhost:5174',
    channel: process.env.PW_CHANNEL ?? 'msedge',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npx vite --port 5174 --strictPort',
    url: 'http://localhost:5174',
    reuseExistingServer: false,
    // Empty Supabase settings → the app runs in demo mode.
    env: { VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '' },
  },
});

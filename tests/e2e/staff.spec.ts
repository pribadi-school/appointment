/** Admin and teacher screens (demo mode: admin password "demo"; teachers pick their name). */
import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 1280, height: 900 } });

test('admin: book a walk-in, block a break, export, edit a teacher, change settings', async ({ page }) => {
  await page.goto('/admin');
  await page.getByLabel('Password').fill('wrong');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByText('That password isn’t right.')).toBeVisible();
  await page.getByLabel('Password').fill('demo');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('tab', { name: 'Dashboard' })).toHaveAttribute('aria-selected', 'true');

  // Walk-in without a phone number.
  await page.getByRole('button', { name: /^Yusri Ramadhan 08\.30: Available$/ }).click();
  const sheet = page.getByRole('dialog');
  await sheet.getByLabel('Parent').fill('Walk-in Parent');
  await sheet.getByLabel('Child’s name').fill('Fajar');
  await sheet.getByLabel('Class').selectOption('8B');
  await sheet.getByRole('button', { name: 'Book now' }).click();
  await expect(page.getByRole('button', { name: /^Yusri Ramadhan 08\.30: Fajar 8B$/ })).toBeVisible();

  // Block a break.
  await page.getByRole('button', { name: /^Yusri Ramadhan 10\.00: Available$/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Block this slot' }).click();
  await expect(page.getByRole('button', { name: /^Yusri Ramadhan 10\.00: Blocked$/ })).toBeVisible();

  // Move the walk-in to 08.40.
  await page.getByRole('button', { name: /^Yusri Ramadhan 08\.30: Fajar 8B$/ }).click();
  await page.getByRole('dialog').getByLabel('Time').selectOption({ label: '08.40' });
  await page.getByRole('dialog').getByRole('button', { name: 'Move booking' }).click();
  await expect(page.getByRole('button', { name: /^Yusri Ramadhan 08\.40: Fajar 8B$/ })).toBeVisible();

  // Export.
  await page.getByRole('tab', { name: 'Bookings' }).click();
  await expect(page.getByRole('cell', { name: 'Walk-in Parent' })).toBeVisible();
  const csv = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export CSV' }).click();
  expect((await csv).suggestedFilename()).toMatch(/^consultations-\d{4}-\d{2}-\d{2}\.csv$/);
  const xlsx = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export Excel' }).click();
  expect((await xlsx).suggestedFilename()).toMatch(/\.xlsx$/);

  // Edit a teacher's room; mark another unavailable.
  await page.getByRole('tab', { name: 'Teachers' }).click();
  await page.getByRole('button', { name: 'Edit: Rayhan Baist' }).click();
  await page.getByRole('dialog').getByLabel('Room', { exact: true }).fill('Room 204');
  await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Room 204')).toBeVisible();

  // Close booking from settings; the parent page then says so.
  await page.getByRole('tab', { name: 'Event settings' }).click();
  await expect(page.getByText(/24 slots: 08\.30 – 08\.40 … 12\.20 – 12\.30/)).toBeVisible();
  await page.getByRole('switch', { name: 'Parents can book online' }).click();

  await page.getByRole('button', { name: 'Save' }).click();
  // Saved = finished saving and the form has no unsaved changes any more.
  await expect(page.getByRole('button', { name: 'Save' })).not.toHaveAttribute('aria-busy');
  await expect(page.getByRole('button', { name: 'Save' })).toBeDisabled();
  await page.goto('/');
  await expect(page.getByText('Booking is closed')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continue' })).toBeDisabled();

  // QR code page renders an SVG code.
  await page.goto('/admin');
  await page.getByRole('tab', { name: 'QR code' }).click();
  await expect(page.locator('.qr-poster svg')).toBeVisible();
});

test('teacher: sign in by name, own schedule with parent details, Done', async ({ page, context }) => {
  // A parent books first.
  const parent = await context.newPage();
  await parent.goto('/');
  await parent.getByLabel('Your name').fill('Ibu Sari');
  await parent.getByLabel('Child’s name').fill('Galih');
  await parent.getByRole('button', { name: /Child’s class/ }).click();
  await parent.getByRole('dialog').getByRole('button', { name: '9A', exact: true }).click();
  await parent.getByLabel('WhatsApp number').fill('0815 5555 6666');
  await parent.getByRole('button', { name: 'Continue' }).click();
  await parent.getByRole('button', { name: /Nairah Umpa Camid/ }).first().click();
  await parent.getByRole('button', { name: /^Continue · / }).click();
  await parent.getByRole('button', { name: 'Book now' }).click();
  await expect(parent.getByRole('heading', { name: 'Booked!' })).toBeVisible();

  await page.goto('/teacher?now=08:33');
  await page.getByRole('button', { name: /Your name/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: /Nairah Umpa Camid/ }).click();
  await page.getByRole('button', { name: 'Sign in' }).click();

  const now = page.locator('li[aria-current="time"]');
  await expect(now).toContainText('Galih');
  await expect(now).toContainText('Ibu Sari');
  await expect(now).toContainText('+62 815-5555-6666');
  await now.getByRole('button', { name: 'Done' }).click();
  await expect(now.getByText('Done', { exact: true })).toBeVisible();
  await expect(now.getByRole('button', { name: 'Undo' })).toBeVisible();
});

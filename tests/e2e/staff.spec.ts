/** Admin and teacher screens (demo mode: admin password "demo"; teacher PIN "1234"). */
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

  await page.getByRole('button', { name: 'Save', exact: true }).click();
  // Saved = finished saving and the form has no unsaved changes any more.
  await expect(page.getByRole('button', { name: 'Save', exact: true })).not.toHaveAttribute('aria-busy');
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeDisabled();
  await page.goto('/smp-sma');
  await expect(page.getByText('Booking is closed')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continue' })).toBeDisabled();

  // QR code page renders an SVG code.
  await page.goto('/admin');
  await page.getByRole('tab', { name: 'QR code' }).click();
  await expect(page.locator('.qr-poster svg')).toBeVisible();
});

test('teacher: sign in with name + PIN, own schedule with parent details, Done', async ({ page, context }) => {
  // A parent books first.
  const parent = await context.newPage();
  await parent.goto('/smp-sma');
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
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeDisabled();
  await page.getByLabel('Teacher PIN').fill('9999');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByText('That PIN isn’t right. Please try again.')).toBeVisible();
  await page.getByLabel('Teacher PIN').fill('1234');
  await page.getByRole('button', { name: 'Sign in' }).click();

  const now = page.locator('li[aria-current="time"]');
  await expect(now).toContainText('Galih');
  await expect(now).toContainText('Ibu Sari');
  await expect(now).toContainText('+62 815-5555-6666');
  await now.getByRole('button', { name: 'Done' }).click();
  await expect(now.getByText('Done', { exact: true })).toBeVisible();
  await expect(now.getByRole('button', { name: 'Undo' })).toBeVisible();

  // Notes: saved on the server, still there after a reload; Admin sees them.
  await now.getByRole('button', { name: 'Notes' }).click();
  await page.getByRole('dialog').getByRole('textbox').fill('Strong in maths. Follow up in November.');
  await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click();
  await expect(now.getByText('Strong in maths. Follow up in November.')).toBeVisible();
  await page.reload();
  await expect(page.locator('li[aria-current="time"]').getByText('Strong in maths. Follow up in November.')).toBeVisible();

  await page.goto('/admin');
  await page.getByLabel('Password').fill('demo');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByRole('button', { name: /^Nairah Umpa Camid 08\.30: Galih 9A$/ }).click();
  await expect(page.getByRole('dialog').getByText('Teacher’s note')).toBeVisible();
  await expect(page.getByRole('dialog').getByText('Strong in maths. Follow up in November.')).toBeVisible();
  await page.keyboard.press('Escape');
  // Bookings tab: a Teacher's notes column.
  await page.getByRole('tab', { name: 'Bookings' }).click();
  await expect(page.getByRole('columnheader', { name: 'Teacher’s notes' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Strong in maths. Follow up in November.' })).toBeVisible();
});

test('admin: times per grade, e.g. Grade 1 in 10-minute slots; parents see them', async ({ page }) => {
  await page.goto('/admin');
  await page.getByLabel('Password').fill('demo');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByRole('tab', { name: 'Event settings' }).click();

  const grade1 = page.getByRole('listitem').filter({ hasText: /^Grade 1/ });
  await expect(grade1).toContainText('08.00 – 12.00 · 16 slots of 15 min');
  await grade1.getByLabel('Slot length').selectOption({ label: '10 min' });
  await expect(grade1).toContainText('08.00 – 12.00 · 24 slots of 10 min');
  const save = page.getByRole('button', { name: 'Save grade times' });
  await save.click();
  // Finished saving (not just busy) and nothing left unsaved.
  await expect(save).not.toHaveAttribute('aria-busy');
  await expect(save).toBeDisabled();

  // Parent side: Grade 1 now has 08.10; Grade 2 keeps 15 minutes.
  await page.goto('/sd');
  await page.getByLabel('Your name').fill('Ibu Tes');
  await page.getByLabel('Child’s name').fill('Kecil');
  await page.getByRole('button', { name: /Child’s class/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Grade 1', exact: true }).click();
  await expect(page.getByText('· 10 min')).toBeVisible();
  await page.getByLabel('WhatsApp number').fill('0812 9000 0001');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('button', { name: '08.10, Available' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^08\.15,/ })).toHaveCount(0);
});

test('live dashboard: public, no sign-in; shows the consultation in progress with room and booking code', async ({ page, context }) => {
  const parent = await context.newPage();
  await parent.goto('/smp-sma');
  await parent.getByLabel('Your name').fill('Ibu Dewi');
  await parent.getByLabel('Child’s name').fill('Bima');
  await parent.getByRole('button', { name: /Child’s class/ }).click();
  await parent.getByRole('dialog').getByRole('button', { name: '8B', exact: true }).click();
  await parent.getByLabel('WhatsApp number').fill('0816 1234 5678');
  await parent.getByRole('button', { name: 'Continue' }).click();
  await parent.getByRole('button', { name: /Yusri Ramadhan/ }).first().click();
  await parent.getByRole('button', { name: /^Continue · 08\.30$/ }).click();
  await parent.getByRole('button', { name: 'Book now' }).click();
  const code = (await parent.getByTestId('booking-code').textContent())!.trim();

  // No sign-in: straight to the level choice.
  await page.goto('/now');
  // Choose the level; each level has its own page.
  await page.getByRole('link', { name: 'Junior – Senior High School' }).click();
  await expect(page).toHaveURL(/\/now\/smp-sma$/);
  await page.goto('/now/smp-sma?now=08:33');

  const card = page.getByRole('listitem').filter({ hasText: 'Yusri Ramadhan' });
  await expect(card).toContainText('08.30 – 08.40');
  await expect(card).toContainText('In progress');
  await expect(card).toContainText('Language Room');
  await expect(card).toContainText(code);
  await expect(page.getByText('1 consultation(s) now')).toBeVisible();
  await page.screenshot({ path: 'test-results/screens/now-screen.png' });

  // The SD page never shows SMP–SMA teachers.
  await page.goto('/now/sd?now=08:33');
  await expect(page.getByText('Primary School', { exact: true })).toBeVisible();
  await expect(page.getByRole('listitem').filter({ hasText: 'Yusri Ramadhan' })).toHaveCount(0);

  // Between sessions: nothing in progress, next start shown.
  await page.goto('/now/smp-sma?now=08:20');
  await expect(page.getByText('No consultations at this moment')).toBeVisible();
  await expect(page.getByText('Next consultations start at 08.30')).toBeVisible();
});

test('live dashboard preview (/livedummy): public, sample data, always has sessions', async ({ page }) => {
  await page.goto('/livedummy');
  await expect(page.getByText('Preview with sample data. Booking codes are not real.')).toBeVisible();
  await expect(page.getByText('Welcome, Ayah & Bunda!')).toBeVisible();
  // No password, and cards are there (every teacher has a sample session).
  await expect(page.getByLabel('Password')).toHaveCount(0);
  await expect(page.getByRole('listitem').first()).toContainText('In progress');
  await expect(page.getByText(/consultation\(s\) now/)).toBeVisible();
  // SD page: only SD classes.
  await page.getByRole('link', { name: 'Primary School' }).click();
  await expect(page).toHaveURL(/\/livedummy\/sd$/);
  await expect(page.getByRole('listitem').first()).toContainText('Grade');
  await expect(page.getByText('6 consultation(s) now')).toBeVisible();
});

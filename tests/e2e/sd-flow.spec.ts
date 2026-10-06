/**
 * Greeting + level choice, and the Primary School (SD) flow on a 360 px phone:
 * class → time (15-minute slots from 08.00) → confirm → booked, in English and
 * Bahasa Indonesia, plus "one room at a time" across SD and SMP–SMA.
 * Screenshots of the key screens land in test-results/screens/.
 */
import { expect, test, type Page } from '@playwright/test';

test.use({ viewport: { width: 360, height: 780 }, isMobile: true, hasTouch: true });

const shot = (page: Page, name: string) => page.screenshot({ path: `test-results/screens/${name}.png`, fullPage: true, animations: 'disabled' });

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

async function sdDetails(page: Page, d: { parent: string; child: string; grade: string; phone: string }, l = EN) {
  await page.getByLabel(l.parent).fill(d.parent);
  await page.getByLabel(l.child).fill(d.child);
  await page.getByRole('button', { name: new RegExp(l.cls) }).click();
  await page.getByRole('dialog').getByRole('button', { name: d.grade, exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByLabel(l.phone).fill(d.phone);
}
const EN = { parent: 'Your name', child: 'Child’s name', cls: 'Child’s class', phone: 'WhatsApp number' };
const ID = { parent: 'Nama Anda', child: 'Nama anak', cls: 'Kelas anak', phone: 'Nomor WhatsApp' };

test('home: greeting first, then the level choice; both fit a 360 px phone without scrolling', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Welcome, Ayah & Bunda!' })).toBeVisible();
  await expect(page.getByText('Saturday, 17 October 2026')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Choose your child’s level' })).toBeVisible();
  const sd = page.getByRole('link', { name: /Primary School/ });
  const smp = page.getByRole('link', { name: /Junior – Senior High School/ });
  // Just the level name: no description lines.
  await expect(sd).toHaveText('Primary School');
  await expect(smp).toHaveText('Junior – Senior High School');
  // Greeting + both choices visible on the first screen.
  await expect(sd).toBeInViewport();
  await expect(smp).toBeInViewport();
  await expectNoHorizontalScroll(page);
  await shot(page, '1-home-en');

  await page.getByRole('button', { name: 'Bahasa Indonesia' }).click();
  await expect(page.getByRole('heading', { name: 'Selamat datang, Ayah & Bunda!' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Pilih jenjang putra-putri Anda' })).toBeVisible();
  await expect(page.getByRole('link', { name: /SMP – SMA/ })).toBeVisible();
  await shot(page, '1-home-id');

  // Levels open their own flow; "Change level" goes back.
  await page.getByRole('link', { name: 'SD', exact: true }).click();
  await expect(page).toHaveURL(/\/sd$/);
  await page.getByRole('link', { name: 'Ganti jenjang' }).click();
  await expect(page).toHaveURL(/\/$/);
});

test('SD (English): class → 15-minute time from 08.00 → confirm → booked', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: /Primary School/ }).click();
  await expect(page.getByRole('heading', { name: 'Your details' })).toBeVisible();
  await expect(page.getByText('Step 1 of 3')).toBeVisible();

  // Only SD classes are offered.
  await page.getByRole('button', { name: /Child’s class/ }).click();
  const sheet = page.getByRole('dialog');
  await expect(sheet.getByRole('button', { name: 'Grade 1', exact: true })).toBeVisible();
  await expect(sheet.getByRole('button', { name: '8B', exact: true })).toHaveCount(0);
  await page.keyboard.press('Escape');

  await sdDetails(page, { parent: 'Dewi Kartika', child: 'Nadia Putri', grade: 'Grade 3', phone: '0812 7000 0003' });
  await page.getByRole('button', { name: 'Continue' }).click();

  // Straight to the time: no teacher list. The class's two homeroom teachers.
  await expect(page.getByRole('heading', { name: 'Choose a time' })).toBeVisible();
  await expect(page.getByText('Step 2 of 3')).toBeVisible();
  await expect(page.getByText('Homeroom teachers · Grade 3')).toBeVisible();
  await expect(page.getByText(/Arinda Lailatul Karimah, M\.Pd\. & Bekti Nuryati/)).toBeVisible();
  await expect(page.getByRole('button', { name: '08.00, Selected' })).toBeVisible();
  await expect(page.getByRole('button', { name: '08.15, Available' })).toBeVisible();
  await expect(page.getByRole('button', { name: '11.45, Available' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^08\.10,/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^12\.00,/ })).toHaveCount(0);
  await page.getByRole('button', { name: '08.30, Available' }).click();
  await expectNoHorizontalScroll(page);
  await shot(page, '2-sd-time-en');
  await page.getByRole('button', { name: 'Continue · 08.30' }).click();

  await expect(page.getByRole('heading', { name: 'Confirm' })).toBeVisible();
  await expect(page.getByText('08.30 – 08.45')).toBeVisible();
  await expect(page.getByText('Classroom 3')).toBeVisible();
  await expect(page.getByText(/Nadia Putri · Grade 3/)).toBeVisible();
  await expectNoHorizontalScroll(page);
  await shot(page, '3-sd-confirm-en');
  await page.getByRole('button', { name: 'Book now' }).click();

  await expect(page.getByRole('heading', { name: 'Booked!' })).toBeVisible();
  const wa = page.getByRole('link', { name: 'Send schedule to my WhatsApp' });
  await expect(wa).toHaveAttribute('href', /text=/);
  const text = decodeURIComponent((await wa.getAttribute('href'))!.split('text=')[1]);
  expect(text).toContain('08.30 – 08.45');
  expect(text).toContain('Grade 3');

  // The same parent books an SMP–SMA child: 08.40 overlaps the SD 08.30–08.45 slot.
  await page.goto('/smp-sma');
  await page.getByLabel('Child’s name').fill('Raka Pratama');
  await page.getByRole('button', { name: /Child’s class/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: '8B', exact: true }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: /Yusri Ramadhan/ }).first().click();
  await expect(page.getByRole('button', { name: '08.30, You’re booked' })).toHaveAttribute('aria-disabled', 'true');
  await expect(page.getByRole('button', { name: '08.40, You’re booked' })).toHaveAttribute('aria-disabled', 'true');
  await expect(page.getByRole('button', { name: '08.50, Selected' })).toBeVisible(); // earliest free time

  // My schedule shows the SD booking with its 15-minute range.
  await page.goto('/my');
  // The remembered child is now Raka (no bookings yet), so look up Nadia.
  await page.getByLabel('Child’s name').fill('Nadia Putri');
  await page.getByRole('button', { name: 'Find my bookings' }).click();
  await expect(page.locator('ol > li').first()).toContainText('08.30');
  await expect(page.locator('ol > li').first()).toContainText('– 08.45');
  await expect(page.locator('ol > li').first()).toContainText('Grade 3');
});

test('SD (Bahasa Indonesia): kelas → waktu → konfirmasi', async ({ page }) => {
  await page.goto('/sd');
  await page.getByRole('button', { name: 'Bahasa Indonesia' }).click();
  await expect(page.getByRole('heading', { name: 'Data Anda' })).toBeVisible();
  await expect(page.getByText('Langkah 1 dari 3')).toBeVisible();
  await sdDetails(page, { parent: 'Budi Santoso', child: 'Citra Lestari', grade: 'Kelas 1', phone: '0813 7000 0001' }, ID);
  await page.getByRole('button', { name: 'Lanjut' }).click();

  await expect(page.getByRole('heading', { name: 'Pilih waktu' })).toBeVisible();
  await expect(page.getByText('Wali kelas · Kelas 1')).toBeVisible();
  await expect(page.getByRole('button', { name: '08.00, Dipilih' })).toBeVisible();
  await shot(page, '2-sd-time-id');
  await page.getByRole('button', { name: 'Lanjut · 08.00' }).click();

  await expect(page.getByRole('heading', { name: 'Konfirmasi' })).toBeVisible();
  await expect(page.getByText('08.00 – 08.15')).toBeVisible();
  await expect(page.getByText(/Citra Lestari · Kelas 1/)).toBeVisible();
  await shot(page, '3-sd-confirm-id');
  await page.getByRole('button', { name: 'Pesan sekarang' }).click();
  await expect(page.getByRole('heading', { name: 'Berhasil dipesan!' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Pesan untuk anak lain' })).toBeVisible();
  await expectNoHorizontalScroll(page);
});

test('menu: reach every part of the app from the header; header fits a 360 px phone', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Menu' }).click();
  const menu = page.getByRole('navigation', { name: 'Menu' });
  for (const name of ['Book a consultation', 'My schedule', 'Teacher', 'Live board', 'Admin']) {
    await expect(menu.getByRole('link', { name, exact: true })).toBeVisible();
  }
  await expect(menu.getByRole('link', { name: 'Book a consultation' })).toHaveAttribute('aria-current', 'page');
  await shot(page, '4-menu-en');
  // Esc closes it.
  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);

  await page.getByRole('button', { name: 'Menu' }).click();
  await menu.getByRole('link', { name: 'Teacher', exact: true }).click();
  await expect(page).toHaveURL(/\/teacher$/);
  await expect(menu).toHaveCount(0);
  await expectNoHorizontalScroll(page);

  // Signed-in teacher header (Log out + language + menu) still fits.
  await page.getByRole('button', { name: /Your name/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: /Nairah Umpa Camid/ }).click();
  await page.getByLabel('Teacher PIN').fill('1234');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('button', { name: 'Log out' })).toBeVisible();
  await expectNoHorizontalScroll(page);
  await shot(page, '5-teacher-header');

  await page.getByRole('button', { name: 'Menu' }).click();
  await menu.getByRole('link', { name: 'Live board', exact: true }).click();
  await expect(page).toHaveURL(/\/board$/);
  await expectNoHorizontalScroll(page);
});

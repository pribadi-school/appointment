/**
 * Full parent flow on a 360 px phone, in English and in Bahasa Indonesia,
 * plus the "two parents tap the same slot" experience and a 768 px check.
 */
import { expect, test, type Page } from '@playwright/test';

const PHONE = { viewport: { width: 360, height: 780 }, isMobile: true, hasTouch: true };

/** No sideways scrolling on the page itself. */
async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

async function fillDetails(page: Page, d: { parent: string; child: string; cls: string; phone: string }, labels: Record<string, string>) {
  await page.getByLabel(labels.parent).fill(d.parent);
  await page.getByLabel(labels.child).fill(d.child);
  await page.getByRole('button', { name: new RegExp(labels.cls) }).click();
  await page.getByRole('dialog').getByRole('button', { name: d.cls, exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByLabel(labels.phone).fill(d.phone);
}

test.describe('360 px phone', () => {
  test.use(PHONE);

  test('English: book two teachers, conflict hint, My schedule, WhatsApp text', async ({ page }) => {
    await page.goto('/smp-sma');
    await expect(page.getByRole('heading', { name: 'Your details' })).toBeVisible();
    await expect(page.getByText('Step 1 of 4')).toBeVisible();
    await expectNoHorizontalScroll(page);

    // Friendly validation, not technical errors.
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByText('Please enter your name.')).toBeVisible();
    await expect(page.getByText('Please choose your child’s class.')).toBeVisible();

    await fillDetails(
      page,
      { parent: 'Rina Wulandari', child: 'Aisyah Putri', cls: '8B', phone: '0812 3456 7890' },
      { parent: 'Your name', child: 'Child’s name', cls: 'Child’s class', phone: 'WhatsApp number' },
    );
    await page.getByRole('button', { name: 'Continue' }).click();

    // Step 2: homeroom teacher first, then subjects, then leadership.
    await expect(page.getByRole('heading', { name: 'Choose a teacher' })).toBeVisible();
    const groups = page.locator('section h2');
    await expect(groups.first()).toHaveText(/Homeroom teacher · 8B/i);
    await expect(groups.last()).toHaveText(/Counselors & Leadership/i);
    await expect(page.locator('section').first().getByRole('button', { name: /Yusri Ramadhan/ })).toBeVisible();
    // Grade 8 parent must not see a grade-12-only teacher.
    await expect(page.getByRole('button', { name: /Zalika Putri Intan Palupi/ })).toHaveCount(0);
    // Hidden (unavailable) teachers never appear.
    await expect(page.getByRole('button', { name: /Selvia Noviani/ })).toHaveCount(0);
    await expectNoHorizontalScroll(page);

    // Search works.
    await page.getByRole('searchbox').fill('rayhan');
    await expect(page.getByRole('button', { name: /Rayhan Baist/ })).toBeVisible();
    await page.getByRole('searchbox').fill('');

    await page.getByRole('button', { name: /Yusri Ramadhan/ }).first().click();

    // Step 3: earliest time is preselected (smart default); choose 09.10.
    await expect(page.getByRole('heading', { name: 'Choose a time' })).toBeVisible();
    await expect(page.getByRole('button', { name: '08.30, Selected' })).toBeVisible();
    await page.getByRole('button', { name: '09.10, Available' }).click();
    await expect(page.getByRole('button', { name: 'Continue · 09.10' })).toBeVisible();
    await expectNoHorizontalScroll(page);
    await page.getByRole('button', { name: 'Continue · 09.10' }).click();

    // Step 4: summary.
    await expect(page.getByRole('heading', { name: 'Confirm' })).toBeVisible();
    await expect(page.getByText('09.10 – 09.20')).toBeVisible();
    await expect(page.getByText('Language Room')).toBeVisible();
    await page.getByRole('button', { name: 'Book now' }).click();

    // Step 5: Booked!
    await expect(page.getByRole('heading', { name: 'Booked!' })).toBeVisible();
    await expect(page.getByTestId('booking-code')).toHaveText(/^[A-Z2-9]{5}$/);
    await expectNoHorizontalScroll(page);
    const wa = page.getByRole('link', { name: 'Send schedule to my WhatsApp' });
    await expect(wa).toHaveAttribute('href', /^https:\/\/wa\.me\/6281234567890\?text=/);
    const text = decodeURIComponent((await wa.getAttribute('href'))!.split('text=')[1]);
    expect(text).toContain('Parent–Teacher Consultation');
    expect(text).toContain('09.10 – 09.20');
    expect(text).toContain('Yusri Ramadhan');

    // Book another teacher: details kept, the booked teacher is marked.
    await page.getByRole('button', { name: 'Book another teacher' }).click();
    await expect(page.getByRole('heading', { name: 'Choose a teacher' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Yusri Ramadhan.*Booked · 09\.10/ })).toBeVisible();
    await page.getByRole('button', { name: /Rayhan Baist/ }).click();

    // Same time as the first booking is blocked with a short reason.
    await expect(page.getByRole('button', { name: '09.10, You’re booked' })).toHaveAttribute('aria-disabled', 'true');
    await page.getByRole('button', { name: '09.20, Available' }).click();
    await page.getByRole('button', { name: 'Continue · 09.20' }).click();
    await page.getByRole('button', { name: 'Book now' }).click();
    await expect(page.getByRole('heading', { name: 'Booked!' })).toBeVisible();

    // My schedule, in time order.
    await page.getByRole('link', { name: 'View my schedule' }).click();
    await expect(page.getByRole('heading', { name: 'My schedule' })).toBeVisible();
    const items = page.locator('ol > li');
    await expect(items).toHaveCount(2);
    await expect(items.nth(0)).toContainText('Yusri Ramadhan');
    await expect(items.nth(1)).toContainText('Rayhan Baist');
    await expectNoHorizontalScroll(page);

    // Cancel one; it disappears and the slot frees up.
    await items.nth(1).getByRole('button', { name: 'Cancel booking' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Yes, cancel' }).click();
    await expect(items).toHaveCount(1);
  });

  test('Bahasa Indonesia: whole flow translated, choice remembered', async ({ page }) => {
    await page.goto('/smp-sma');
    await page.getByRole('button', { name: 'Bahasa Indonesia' }).click();
    await expect(page.getByRole('heading', { name: 'Data Anda' })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'id');

    // Remembered on this device.
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Data Anda' })).toBeVisible();

    await page.getByRole('button', { name: 'Lanjut' }).click();
    await expect(page.getByText('Mohon isi nama Anda.')).toBeVisible();

    await fillDetails(
      page,
      { parent: 'Budi Santoso', child: 'Citra Lestari', cls: '11A', phone: '+62 813-1111-2222' },
      { parent: 'Nama Anda', child: 'Nama anak', cls: 'Kelas anak', phone: 'Nomor WhatsApp' },
    );
    await page.getByRole('button', { name: 'Lanjut' }).click();

    await expect(page.getByRole('heading', { name: 'Pilih guru' })).toBeVisible();
    await expect(page.locator('section h2').first()).toHaveText(/Wali kelas · 11A/i);
    await expect(page.locator('section h2').last()).toHaveText(/Konselor & Pimpinan/i);
    await page.locator('section').first().getByRole('button').first().click();

    await expect(page.getByRole('heading', { name: 'Pilih waktu' })).toBeVisible();
    await expect(page.getByRole('button', { name: '08.30, Dipilih' })).toBeVisible();
    await page.getByRole('button', { name: 'Lanjut · 08.30' }).click();

    await expect(page.getByRole('heading', { name: 'Konfirmasi' })).toBeVisible();
    await expect(page.getByText('Sabtu, 17 Oktober 2026')).toBeVisible();
    await page.getByRole('button', { name: 'Pesan sekarang' }).click();

    await expect(page.getByRole('heading', { name: 'Berhasil dipesan!' })).toBeVisible();
    await expectNoHorizontalScroll(page);
    const href = await page.getByRole('link', { name: 'Kirim jadwal ke WhatsApp saya' }).getAttribute('href');
    expect(href).toMatch(/^https:\/\/wa\.me\/6281311112222\?text=/);
    const text = decodeURIComponent(href!.split('text=')[1]);
    expect(text).toContain('Konsultasi Orang Tua–Guru');
    expect(text).toContain('Jadwal konsultasi Anda');
    expect(text).toContain('Ruang:');

    // Next visit: details are remembered.
    await page.goto('/smp-sma');
    await expect(page.getByText('Selamat datang kembali!')).toBeVisible();
    await expect(page.getByLabel('Nama anak')).toHaveValue('Citra Lestari');
  });

  test('two parents on the same slot: the slower one gets the friendly message and fresh times', async ({ context }) => {
    const a = await context.newPage();
    const b = await context.newPage();
    for (const [page, d] of [
      [a, { parent: 'Parent A', child: 'Anak A', cls: '9A', phone: '0811 1111 1111' }],
      [b, { parent: 'Parent B', child: 'Anak B', cls: '9A', phone: '0822 2222 2222' }],
    ] as const) {
      await page.goto('/smp-sma');
      await fillDetails(page, d, { parent: 'Your name', child: 'Child’s name', cls: 'Child’s class', phone: 'WhatsApp number' });
      await page.getByRole('button', { name: 'Continue' }).click();
      await page.locator('section').first().getByRole('button').first().click(); // 9A homeroom
      await page.getByRole('button', { name: '10.00, Available' }).click();
      await page.getByRole('button', { name: 'Continue · 10.00' }).click();
      await expect(page.getByRole('button', { name: 'Book now' })).toBeVisible();
    }
    // Both are on "Confirm" for the same teacher + 10.00. A is faster.
    await a.getByRole('button', { name: 'Book now' }).click();
    await expect(a.getByRole('heading', { name: 'Booked!' })).toBeVisible();

    await b.getByRole('button', { name: 'Book now' }).click();
    await expect(b.getByText('Sorry, this time was just booked by another parent. Please choose another time.')).toBeVisible();
    // B is back on the time picker and 10.00 now shows as Taken.
    await expect(b.getByRole('heading', { name: 'Choose a time' })).toBeVisible();
    await expect(b.getByRole('button', { name: '10.00, Taken' })).toBeVisible();
  });

  test('live: a slot booked in another tab turns "Taken" without reloading', async ({ context }) => {
    const watcher = await context.newPage();
    await watcher.goto('/board');
    await watcher.getByRole('radio', { name: /Grid/ }).click();
    const cell = watcher.getByRole('img', { name: /^Yusri Ramadhan, 11\.00: Available$/ });
    await expect(cell).toBeVisible();

    const parent = await context.newPage();
    await parent.goto('/smp-sma');
    await fillDetails(parent, { parent: 'Live Test', child: 'Dimas', cls: '8B', phone: '0813 0000 0001' }, {
      parent: 'Your name', child: 'Child’s name', cls: 'Child’s class', phone: 'WhatsApp number',
    });
    await parent.getByRole('button', { name: 'Continue' }).click();
    await parent.getByRole('button', { name: /Yusri Ramadhan/ }).first().click();
    await parent.getByRole('button', { name: '11.00, Available' }).click();
    await parent.getByRole('button', { name: 'Continue · 11.00' }).click();
    await parent.getByRole('button', { name: 'Book now' }).click();
    await expect(parent.getByRole('heading', { name: 'Booked!' })).toBeVisible();

    await expect(watcher.getByRole('img', { name: /^Yusri Ramadhan, 11\.00: Taken$/ })).toBeVisible({ timeout: 5000 });
  });
});

test.describe('768 px tablet', () => {
  test.use({ viewport: { width: 768, height: 1024 } });

  test('booking start, board and admin fit without sideways scrolling', async ({ page }) => {
    for (const path of ['/', '/sd', '/smp-sma', '/board', '/my', '/teacher', '/admin']) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      await expectNoHorizontalScroll(page);
    }
    // Board "By room" view shows class + initial only — never names.
    await page.goto('/board');
    await page.getByRole('radio', { name: /By room/ }).click();
    await expect(page.getByRole('heading', { name: 'Language Room' })).toBeVisible();
  });
});

import { expect, test, type Page } from '@playwright/test';

async function loginAsDemo(page: Page, email: string) {
  await page.goto('/login');
  await page.getByRole('button', { name: new RegExp(email.replace('.', '\\.')) }).click();
}

test.describe('public website', () => {
  test('home page renders and leads to search and facility details', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      'Shahar markazida joyingizni',
    );

    await page.getByRole('link', { name: 'Parking topish' }).first().click();
    await expect(page).toHaveURL(/\/search/);
    await expect(page.getByPlaceholder(/Parking|qidir/i).first()).toBeVisible();

    await page.getByRole('link', { name: /Markaziy Park/ }).first().click();
    await expect(page).toHaveURL(/\/facilities\/markaziy/);
    await expect(page.getByRole('heading', { name: 'Markaziy Park' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Joy band qilish' })).toBeVisible();
  });

  test('unknown routes render the 404 page', async ({ page }) => {
    await page.goto('/this-page-does-not-exist');
    await expect(page.getByText('404')).toBeVisible();
  });
});

test.describe('authentication and role routing', () => {
  test('user demo account lands on the user dashboard', async ({ page }) => {
    await loginAsDemo(page, 'demo@parkovka.uz');
    await expect(page).toHaveURL(/\/app$/);
    await expect(page.getByRole('heading', { name: /Salom, Dilshod/ })).toBeVisible();
  });

  test('admin demo account lands on the admin dashboard', async ({ page }) => {
    await loginAsDemo(page, 'admin@parkovka.uz');
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole('heading', { name: 'Boshqaruv paneli' })).toBeVisible();
  });

  test('guard demo account lands on the guard dashboard', async ({ page }) => {
    await loginAsDemo(page, 'guard@parkovka.uz');
    await expect(page).toHaveURL(/\/guard$/);
    await expect(page.getByRole('heading', { name: 'Qo‘riqchi paneli' })).toBeVisible();
  });

  test('anonymous visitor is redirected away from a protected route', async ({ page }) => {
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole('heading', { name: 'Xush kelibsiz' })).toBeVisible();
  });
});

test.describe('dashboard coverage', () => {
  const adminPaths = [
    '/admin/facilities',
    '/admin/floors',
    '/admin/zones',
    '/admin/spaces',
    '/admin/map',
    '/admin/reservations',
    '/admin/sessions',
    '/admin/payments',
    '/admin/users',
    '/admin/guards',
    '/admin/pricing',
    '/admin/cameras',
    '/admin/reports',
    '/admin/audit-logs',
    '/admin/notifications',
    '/admin/settings',
  ];

  const guardPaths = [
    '/guard/entry',
    '/guard/exit',
    '/guard/scan',
    '/guard/sessions',
    '/guard/arrivals',
    '/guard/departures',
    '/guard/incidents',
    '/guard/activity',
  ];

  const userPaths = [
    '/app/active',
    '/app/reservations',
    '/app/tickets',
    '/app/vehicles',
    '/app/payments',
    '/app/reviews',
    '/app/notifications',
    '/app/profile',
    '/app/settings',
  ];

  test('every admin page renders without runtime errors', async ({ page }) => {
    await loginAsDemo(page, 'admin@parkovka.uz');
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));

    for (const path of adminPaths) {
      await page.goto(path);
      await expect(page.locator('h1').first(), path).toBeVisible();
    }

    expect(errors).toEqual([]);
  });

  test('every guard page renders without runtime errors', async ({ page }) => {
    await loginAsDemo(page, 'guard@parkovka.uz');
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));

    for (const path of guardPaths) {
      await page.goto(path);
      await expect(page.locator('h1').first(), path).toBeVisible();
    }

    expect(errors).toEqual([]);
  });

  test('every user page renders without runtime errors', async ({ page }) => {
    await loginAsDemo(page, 'demo@parkovka.uz');
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));

    for (const path of userPaths) {
      await page.goto(path);
      await expect(page.locator('h1').first(), path).toBeVisible();
    }

    expect(errors).toEqual([]);
  });
});

test.describe('reservation flow', () => {
  test('user books an available space end to end', async ({ page }) => {
    await loginAsDemo(page, 'demo@parkovka.uz');
    await expect(page).toHaveURL(/\/app$/);

    await page.goto('/booking/markaziy');
    await expect(page.getByRole('heading', { name: 'Joy band qilish' })).toBeVisible();

    const next = page.getByRole('button', { name: 'Keyingi' });

    await next.click();
    await expect(page.getByRole('heading', { name: 'Sana va vaqtni tanlang' })).toBeVisible();

    await next.click();
    await expect(page.getByRole('heading', { name: 'Bo‘sh joyni tanlang' })).toBeVisible();
    const availableSpace = page.locator('g[role="button"][aria-label*="Bo‘sh"]').first();
    await availableSpace.click();
    await next.click();

    await expect(page.getByRole('heading', { name: 'Avtomobilni tanlang' })).toBeVisible();
    await next.click();

    await expect(page.getByRole('heading', { name: 'Bron xulosasi' })).toBeVisible();
    await next.click();

    await expect(page.getByRole('heading', { name: 'To‘lov usuli' })).toBeVisible();
    await page.locator('#booking-terms').click();
    await page.getByRole('button', { name: 'To‘lash va bron qilish' }).click();

    await expect(page.getByRole('heading', { name: 'Bron tasdiqlandi!', level: 2 })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText(/RSV-\d{4}/)).toBeVisible();
  });
});

import { expect, test, type Browser, type Page } from '@playwright/test';

const VIEWPORTS = {
  mobile: { width: 390, height: 844 },
  tablet: { width: 834, height: 1112 },
  desktop: { width: 1440, height: 900 },
} as const;

const PAGES = {
  public: ['/', '/search', '/facilities/markaziy', '/legal/privacy', '/login', '/register', '/not-a-page'],
  user: [
    '/app',
    '/app/active',
    '/app/reservations',
    '/app/tickets',
    '/app/vehicles',
    '/app/payments',
    '/app/reviews',
    '/app/notifications',
    '/app/profile',
    '/app/settings',
  ],
  admin: [
    '/admin',
    '/admin/facilities',
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
  ],
  guard: [
    '/guard',
    '/guard/entry',
    '/guard/exit',
    '/guard/scan',
    '/guard/sessions',
    '/guard/arrivals',
    '/guard/departures',
    '/guard/incidents',
    '/guard/activity',
  ],
} as const;

const DEMO_ACCOUNTS = {
  user: 'demo@parkovka.uz',
  admin: 'admin@parkovka.uz',
  guard: 'guard@parkovka.uz',
} as const;

async function loginAs(page: Page, email: string) {
  await page.goto('/login');
  await page.getByRole('button', { name: new RegExp(email.replace('.', '\\.')) }).click();
  const destination = email.startsWith('admin')
    ? /\/admin$/
    : email.startsWith('guard')
      ? /\/guard$/
      : /\/app$/;
  await expect(page).toHaveURL(destination);
}

async function expectNoHorizontalOverflow(page: Page, path: string) {
  await page.goto(path);
  await page.locator('h1:visible').first().waitFor({ state: 'visible', timeout: 20_000 });
  await page.waitForTimeout(150);
  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(
    metrics.scrollWidth,
    `${path} overflows horizontally (${metrics.scrollWidth}px > ${metrics.clientWidth}px)`,
  ).toBeLessThanOrEqual(metrics.clientWidth + 1);
}

async function auditRole(
  browser: Browser,
  viewport: { width: number; height: number },
  role: 'public' | keyof typeof DEMO_ACCOUNTS,
  paths: readonly string[],
) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  if (role !== 'public') {
    await loginAs(page, DEMO_ACCOUNTS[role]);
  }
  for (const path of paths) {
    await expectNoHorizontalOverflow(page, path);
  }
  await context.close();
}

for (const [size, viewport] of Object.entries(VIEWPORTS)) {
  test.describe(`responsive ${size} (${viewport.width}x${viewport.height})`, () => {
    test('public pages do not overflow horizontally', async ({ browser }) => {
      await auditRole(browser, viewport, 'public', PAGES.public);
    });

    test('user dashboard does not overflow horizontally', async ({ browser }) => {
      await auditRole(browser, viewport, 'user', PAGES.user);
    });

    test('admin dashboard does not overflow horizontally', async ({ browser }) => {
      await auditRole(browser, viewport, 'admin', PAGES.admin);
    });

    test('guard dashboard does not overflow horizontally', async ({ browser }) => {
      await auditRole(browser, viewport, 'guard', PAGES.guard);
    });
  });
}

test.describe('language switching', () => {
  test('public and user pages translate live and persist the choice', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('Shahar markazida');

    await page.getByRole('button', { name: 'Til' }).click();
    await page.getByRole('menuitem', { name: 'Русский' }).click();
    await expect(page.locator('h1')).toContainText('Забронируйте место в центре');

    await page.reload();
    await expect(page.locator('h1')).toContainText('Забронируйте место в центре');

    await page.getByRole('button', { name: 'Язык' }).click();
    await page.getByRole('menuitem', { name: 'English' }).click();
    await expect(page.locator('h1')).toContainText('Book your city centre spot');

    await loginAs(page, DEMO_ACCOUNTS.user);
    await page.goto('/app/tickets');
    await expect(page.getByRole('heading', { name: 'QR tickets', level: 1 })).toBeVisible();
    await page.goto('/app/payments');
    await expect(page.getByRole('heading', { name: 'Payments', level: 1 })).toBeVisible();
    await page.goto('/app/settings');
    await expect(page.getByRole('heading', { name: 'Settings', level: 1 })).toBeVisible();
  });

  test('user dashboard renders Russian labels and status badges', async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem('parkovka.language', 'ru'));
    await loginAs(page, DEMO_ACCOUNTS.user);

    await page.goto('/app/tickets');
    await expect(page.getByRole('heading', { name: 'QR-билеты', level: 1 })).toBeVisible();
    await expect(page.getByText('Подтверждено').first()).toBeVisible();

    await page.goto('/app/payments');
    await expect(page.getByRole('heading', { name: 'Платежи', level: 1 })).toBeVisible();
    await expect(page.getByText('Оплачено').first()).toBeVisible();
  });

  test('admin dashboard renders in English', async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem('parkovka.language', 'en'));
    await loginAs(page, DEMO_ACCOUNTS.admin);

    await page.goto('/admin/facilities');
    await expect(page.getByRole('heading', { name: 'Parking facilities', level: 1 })).toBeVisible();
    await page.goto('/admin/users');
    await expect(page.getByRole('heading', { name: 'Users', level: 1 })).toBeVisible();
    await expect(page.getByText('Active', { exact: true }).first()).toBeVisible();
  });

  test('guard dashboard renders in Russian', async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem('parkovka.language', 'ru'));
    await loginAs(page, DEMO_ACCOUNTS.guard);

    await page.goto('/guard/entry');
    await expect(page.getByRole('heading', { name: 'Въезд автомобиля', level: 1 })).toBeVisible();
    await page.goto('/guard/exit');
    await expect(page.getByRole('heading', { name: 'Выезд автомобиля', level: 1 })).toBeVisible();
    await page.goto('/guard/scan');
    await expect(page.getByRole('heading', { name: 'Сканирование QR', level: 1 })).toBeVisible();
  });
});

test.describe('empty and validation states', () => {
  test('admin table shows an empty state for unmatched searches and recovers when cleared', async ({
    page,
  }) => {
    await loginAs(page, DEMO_ACCOUNTS.admin);
    await page.goto('/admin/users');

    const search = page.getByRole('textbox', { name: /^Qidirish/ });
    await search.fill('no-such-user-xyz');
    await expect(page.getByText('Natija topilmadi').first()).toBeVisible();

    await search.fill('');
    await expect(page.getByRole('table')).toBeVisible();
  });
});

test.describe('mobile navigation', () => {
  test.use({ viewport: VIEWPORTS.mobile });

  test('opens the sidebar drawer and navigates between sections', async ({ page }) => {
    await loginAs(page, DEMO_ACCOUNTS.user);

    await page.getByRole('button', { name: 'Navigatsiya' }).click();
    const drawer = page.getByRole('dialog');
    await expect(drawer).toBeVisible();
    await drawer.getByRole('link', { name: 'QR chiptalar' }).click();

    await expect(page).toHaveURL(/\/app\/tickets$/);
    await expect(page.getByRole('heading', { name: 'QR chiptalar', level: 1 })).toBeVisible();
    await expect(page.getByRole('dialog')).toBeHidden();
  });
});

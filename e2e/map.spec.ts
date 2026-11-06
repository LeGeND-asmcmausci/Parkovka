import { expect, test, type Page } from '@playwright/test';

async function openMap(page: Page, path = '/map') {
  await page.route('https://*.tile.openstreetmap.org/**', (route) => route.abort());
  const heading = page.getByRole('heading', { level: 1, name: 'Parkovkalar xaritasi' });
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  if (!(await heading.isVisible())) {
    await page.reload({ waitUntil: 'domcontentloaded' });
  }
  await expect(heading).toBeVisible();
}

test.describe('parking map', () => {
  test('renders facility markers and opens details with the indoor map', async ({ page }) => {
    await openMap(page);

    await expect(page.locator('.leaflet-container')).toBeVisible();
    await expect(page.locator('.leaflet-marker-icon')).toHaveCount(6);

    const search = page.locator('aside input[placeholder="Parking nomi yoki manzil"]');
    await search.fill('Markaziy');
    await expect(page.getByText('1 ta parking topildi').first()).toBeVisible();

    await page.locator('aside').getByRole('button', { name: /Markaziy Park/ }).click();
    await expect(page.locator('aside h2', { hasText: 'Markaziy Park' })).toBeVisible();
    await expect(page).toHaveURL(/facility=markaziy/);

    const directions = page.locator('aside').getByRole('link', { name: 'Yo‘nalish olish' });
    await expect(directions).toHaveAttribute('href', /google\.com\/maps\/dir/);
    await expect(directions).toHaveAttribute('target', '_blank');

    const floor2 = page.locator('aside').getByRole('button', { name: /^P2/ });
    await floor2.click();
    await expect(floor2).toHaveAttribute('aria-pressed', 'true');

    const freeSpace = page.locator('aside').getByRole('button', { name: /— Bo‘sh$/ }).first();
    await expect(freeSpace).toBeEnabled();
    await freeSpace.click();
    await expect(page.locator('aside').getByText('Tanlangan joy')).toBeVisible();
    await expect(page.locator('aside').getByRole('link', { name: 'Kirish' })).toBeVisible();
  });

  test('clears the selected facility from the URL', async ({ page }) => {
    await openMap(page, '/map?facility=city');

    await expect(page.locator('aside h2', { hasText: 'Toshkent City' })).toBeVisible();
    await page.locator('aside').getByRole('button', { name: 'Yopish' }).click();

    await expect(page).toHaveURL(/\/map$/);
    await expect(page.locator('aside h2')).toHaveCount(0);
  });
});

test.describe('parking map geolocation', () => {
  test.use({
    geolocation: { latitude: 41.3111, longitude: 69.2797 },
    permissions: ['geolocation'],
  });

  test('locates the visitor, adds the position marker and sorts by distance', async ({ page }) => {
    await openMap(page);

    await expect(page.locator('.leaflet-marker-icon')).toHaveCount(6);
    await page.getByRole('button', { name: 'Mening joylashuvim' }).click();

    await expect(page.locator('aside').getByText('Joylashuvingiz aniqlandi.')).toBeVisible();
    await expect(page.locator('aside select#map-sort')).toHaveValue('distance');
    await expect(page.locator('.leaflet-marker-icon')).toHaveCount(7);
  });
});

test.describe('parking map on mobile', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('opens deep-linked details as a dismissible bottom sheet', async ({ page }) => {
    await openMap(page, '/map?facility=markaziy');

    const sheet = page.locator('aside');
    await expect(sheet).toBeVisible();
    await expect(sheet).toHaveClass(/fixed/);
    await expect(sheet.getByRole('heading', { name: 'Markaziy Park' })).toBeVisible();

    await sheet.getByRole('button', { name: 'Yopish' }).click();
    await expect(sheet).toBeHidden();
    await expect(page).toHaveURL(/\/map$/);
  });
});

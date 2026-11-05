import { expect, test, type Page } from '@playwright/test';

async function loginAsDemo(page: Page, email: string) {
  await page.goto('/login');
  await page.getByRole('button', { name: new RegExp(email.replace('.', '\\.')) }).click();
  const destination = email.startsWith('admin')
    ? /\/admin$/
    : email.startsWith('guard')
      ? /\/guard$/
      : /\/app$/;
  await expect(page).toHaveURL(destination);
}

async function goToBookingPaymentStep(page: Page) {
  await page.goto('/booking/markaziy');
  await expect(page.getByRole('heading', { name: 'Joy band qilish' })).toBeVisible();

  const next = page.getByRole('button', { name: 'Keyingi' });
  await next.click();
  await expect(page.getByRole('heading', { name: 'Sana va vaqtni tanlang' })).toBeVisible();

  await next.click();
  await expect(page.getByRole('heading', { name: 'Bo‘sh joyni tanlang' })).toBeVisible();
  await page.locator('g[role="button"][aria-label*="Bo‘sh"]').first().click();
  await next.click();

  await expect(page.getByRole('heading', { name: 'Avtomobilni tanlang' })).toBeVisible();
  await next.click();

  await expect(page.getByRole('heading', { name: 'Bron xulosasi' })).toBeVisible();
  await next.click();

  await expect(page.getByRole('heading', { name: 'To‘lov usuli' })).toBeVisible();
}

test.describe('public search and facility map', () => {
  test('search filters, empty state and map view stay in sync with the URL', async ({ page }) => {
    await page.goto('/search');
    await expect(page.getByRole('heading', { name: 'Parking qidirish' })).toBeVisible();
    await expect(page.getByText(/ta parking topildi/)).toBeVisible();

    await page.getByLabel('Shahar').selectOption('tashkent');
    await expect(page).toHaveURL(/city=tashkent/);

    await page.getByRole('checkbox', { name: /Faqat bo/ }).click();
    await expect(page).toHaveURL(/availability=available/);

    await page.getByRole('button', { name: 'Xarita', exact: true }).click();
    await expect(page).toHaveURL(/view=map/);
    await expect(page.locator('.leaflet-container')).toBeVisible();

    await page.getByRole('button', { name: 'Ro‘yxat', exact: true }).click();
    await expect(page).toHaveURL(/view=list/);

    const search = page.getByRole('textbox', { name: 'Manzil, parking yoki tuman nomi' });
    await search.fill('no-such-parking-xyz');
    await page.getByRole('button', { name: 'Qidirish' }).first().click();
    await expect(page.getByText('Mos parking topilmadi')).toBeVisible();

    await page.getByRole('button', { name: /Filtrlarni tozalash/ }).click();
    await expect(page).not.toHaveURL(/query=/);
    await expect(page.getByText(/ta parking topildi/)).toBeVisible();
  });

  test('facility map zooms, resets and selects an available space for booking', async ({ page }) => {
    await loginAsDemo(page, 'demo@parkovka.uz');
    await page.goto('/facilities/markaziy');
    await expect(page.getByRole('heading', { name: 'Markaziy Park' })).toBeVisible();
    await expect(page.locator('svg[role="img"]').first()).toBeVisible();

    await page.getByRole('button', { name: 'Kengaytirish' }).click();
    await expect(page.getByText('120%', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Tozalash' }).click();
    await expect(page.getByText('100%', { exact: true })).toBeVisible();

    const availableSpace = page.locator('g[data-space][role="button"][aria-label*="Bo‘sh"]').first();
    await expect(availableSpace).toBeVisible();
    await availableSpace.click();
    await expect(page.getByText('Tanlangan joy', { exact: true })).toBeVisible();

    const reserveLinks = page.getByRole('link', { name: /Joy band qilish/ });
    await expect(reserveLinks.first()).toHaveAttribute('href', /\/booking\/markaziy\?.*spaceId=/);
  });
});

test.describe('user dashboards and actions', () => {
  test('ticket list and detail expose QR token, download and printable ticket', async ({ page }) => {
    await loginAsDemo(page, 'demo@parkovka.uz');
    await page.goto('/app/tickets');
    await expect(page.getByRole('heading', { name: 'QR chiptalar' })).toBeVisible();
    await expect(page.getByText('RSV-9081', { exact: true })).toBeVisible();
    await expect(page.locator('svg[aria-label*="PVK-F2ZL3RTC"]')).toBeVisible();

    const ticketCard = page.getByRole('article').filter({ hasText: 'RSV-9081' });
    await ticketCard.getByRole('link', { name: /Chiptani ko‘rish/ }).click();
    await expect(page).toHaveURL(/\/ticket\/res_demo_upcoming/);
    await expect(page.locator('svg[aria-label*="PVK-F2ZL3RTC"]')).toBeVisible();
    await expect(page.getByText('Bron tafsilotlari')).toBeVisible();

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Chiptani yuklab olish' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('RSV-9081.txt');
  });

  test('unknown ticket id renders a recoverable error state', async ({ page }) => {
    await loginAsDemo(page, 'demo@parkovka.uz');
    await page.goto('/ticket/does-not-exist');
    await expect(page.getByText('Chipta topilmadi yoki yaroqsiz')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Qayta urinib ko‘ring' })).toBeVisible();
  });

  test('vehicle form validates the plate and supports create, edit and delete', async ({ page }) => {
    await loginAsDemo(page, 'demo@parkovka.uz');
    await page.goto('/app/vehicles');
    await expect(page.getByRole('heading', { name: 'Mening avtomobillarim' })).toBeVisible();
    await expect(page.getByText('01 A 123 AB')).toBeVisible();

    await page.getByRole('button', { name: 'Avtomobil qo‘shish' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Davlat raqami').fill('invalid-plate');
    await dialog.getByLabel('Marka').fill('Chevrolet');
    await dialog.getByLabel('Model').fill('Cobalt');
    await dialog.getByLabel('Rangi').fill('Oq');
    await dialog.getByRole('button', { name: 'Saqlash' }).click();
    await expect(dialog.getByText(/Raqam formati noto‘g‘ri/)).toBeVisible();

    await dialog.getByLabel('Davlat raqami').fill('01 A 999 ZZ');
    await dialog.getByRole('button', { name: 'Saqlash' }).click();
    await expect(dialog).toBeHidden();

    const card = page.locator('article').filter({ hasText: '01 A 999 ZZ' });
    await expect(card).toBeVisible();
    await card.getByRole('button', { name: 'Tahrirlash' }).click();
    await dialog.getByLabel('Rangi').fill('Qora');
    await dialog.getByRole('button', { name: 'Saqlash' }).click();
    await expect(card.getByText('Qora')).toBeVisible();

    await card.getByRole('button', { name: /chirish/ }).click();
    const confirm = page.getByRole('dialog');
    await confirm.getByRole('button', { name: /chirish/ }).click();
    await expect(page.getByText('01 A 999 ZZ')).toHaveCount(0);
  });

  test('profile validates required fields and saves valid changes', async ({ page }) => {
    await loginAsDemo(page, 'demo@parkovka.uz');
    await page.goto('/app/profile');
    await expect(page.getByRole('heading', { name: 'Profil' })).toBeVisible();

    const name = page.getByLabel('To‘liq ism');
    await name.fill('');
    await page.getByRole('button', { name: 'O‘zgarishlarni saqlash' }).click();
    await expect(page.getByText('Kamida 2 ta belgi kiriting.')).toBeVisible();

    await name.fill('Dilshod Karimov');
    await name.press('Tab');
    await page.getByRole('button', { name: 'O‘zgarishlarni saqlash' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Profil yangilandi.' })).toBeVisible();
  });

  test('review form rejects short comments and publishes a valid review', async ({ page }) => {
    await loginAsDemo(page, 'demo@parkovka.uz');
    await page.goto('/app/reviews');
    await expect(page.getByRole('heading', { name: 'Mening sharhlarim', level: 1 })).toBeVisible();

    await page.getByRole('button', { name: 'Parkingni baholang' }).first().click();
    const dialog = page.getByRole('dialog');
    await dialog.locator('#review-facility').selectOption('fac_markaziy');
    await dialog.getByLabel('Sharhingiz').fill('abc');
    await dialog.getByRole('button', { name: 'Sharhni yuborish' }).click();
    await expect(dialog.getByText('Kamida 5 ta belgi kiriting.')).toBeVisible();

    const comment = `Avtomatik sharh ${Date.now()}`;
    await dialog.getByLabel('Sharhingiz').fill(comment);
    await dialog.getByRole('button', { name: 'Sharhni yuborish' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText(comment)).toBeVisible();
  });

  test('notifications can all be marked as read', async ({ page }) => {
    await loginAsDemo(page, 'demo@parkovka.uz');
    await page.goto('/app/notifications');
    await expect(page.getByRole('heading', { name: 'Bildirishnomalar' })).toBeVisible();
    await expect(page.getByText(/ta o‘qilmagan/).first()).toBeVisible();

    await page.getByRole('button', { name: 'Barchasini o‘qilgan qilish' }).click();
    await expect(page.getByText('Barchasi o‘qilgan', { exact: true })).toBeVisible();
  });

  test('payment list shows providers and downloads a receipt', async ({ page }) => {
    await loginAsDemo(page, 'demo@parkovka.uz');
    await page.goto('/app/payments');
    await expect(page.getByRole('heading', { name: 'To‘lovlar' })).toBeVisible();

    const search = page.getByRole('textbox', { name: 'Qidirish' });
    await search.fill('Payme');
    await expect(page.getByText('Payme', { exact: true }).first()).toBeVisible();
    await search.fill('Click');
    await expect(page.getByText('Click', { exact: true }).first()).toBeVisible();
    await search.fill('Naqd');
    await expect(page.getByText('Naqd', { exact: true }).first()).toBeVisible();
    await search.fill('');

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Kvitansiyani yuklab olish' }).first().click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^PAY-.*\.txt$/);
  });

  test('settings switches language and persists it across reloads', async ({ page }) => {
    await loginAsDemo(page, 'demo@parkovka.uz');
    await page.goto('/app/settings');
    await expect(page.getByRole('heading', { name: 'Sozlamalar' })).toBeVisible();

    await page.getByRole('button', { name: 'Русский' }).click();
    await expect(page.getByRole('heading', { name: 'Настройки' })).toBeVisible();
    await expect(page.getByText('Оформление', { exact: true })).toBeVisible();

    await page.reload();
    await expect(page.getByRole('heading', { name: 'Настройки' })).toBeVisible();

    await page.getByRole('button', { name: 'English' }).click();
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
    await expect(page.getByText('Appearance', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'O‘zbekcha' }).click();
    await expect(page.getByRole('heading', { name: 'Sozlamalar' })).toBeVisible();
  });
});

test.describe('booking payment step', () => {
  test('shows every payment provider and blocks confirmation until terms are accepted', async ({ page }) => {
    await loginAsDemo(page, 'demo@parkovka.uz');
    await goToBookingPaymentStep(page);

    for (const label of ['Payme', 'Click', 'Uzcard', 'Humo', 'Chiqishda naqd']) {
      await expect(page.getByRole('button', { name: label, exact: true })).toBeVisible();
    }

    const confirm = page.getByRole('button', { name: 'To‘lash va bron qilish' });
    await expect(confirm).toBeDisabled();
    await page.getByRole('button', { name: 'Click', exact: true }).click();
    await page.locator('#booking-terms').click();
    await expect(confirm).toBeEnabled();
  });
});

test.describe('admin operations', () => {
  test('facility can be created, edited and deleted', async ({ page }) => {
    await loginAsDemo(page, 'admin@parkovka.uz');
    await page.goto('/admin/facilities');
    await expect(page.getByRole('heading', { name: 'Parking obyektlari' })).toBeVisible();

    await page.getByRole('button', { name: 'Obyekt qo‘shish' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.locator('#facility-name-uz').fill('Test Parking');
    await dialog.locator('#facility-name-ru').fill('Тест Паркинг');
    await dialog.locator('#facility-name-en').fill('Test Parking');
    await dialog.locator('#facility-address-uz').fill('Test ko‘chasi, 1');
    await dialog.locator('#facility-district-uz').fill('Test tumani');
    await dialog.locator('#facility-capacity').fill('6');
    await dialog.getByRole('button', { name: 'Saqlash' }).click();
    await expect(dialog).toBeHidden();

    const search = page.getByRole('textbox', { name: /^Qidirish/ });
    await search.fill('Test Parking');
    const row = page.getByRole('row', { name: /Test Parking/ });
    await expect(row).toBeVisible();

    await row.getByRole('button', { name: 'Tahrirlash' }).click();
    await dialog.locator('#facility-rate').fill('9000');
    await dialog.getByRole('button', { name: 'Saqlash' }).click();
    await expect(dialog).toBeHidden();

    await row.getByRole('button', { name: /chirish/ }).click();
    const confirm = page.getByRole('dialog');
    await confirm.getByRole('button', { name: /chirish/ }).click();
    await expect(page.getByRole('row', { name: /Test Parking/ })).toHaveCount(0);
  });

  test('user can be created and suspended', async ({ page }) => {
    await loginAsDemo(page, 'admin@parkovka.uz');
    await page.goto('/admin/users');
    await expect(page.getByRole('heading', { name: 'Foydalanuvchilar' })).toBeVisible();

    const email = `qa.user.${Date.now()}@parkovka.uz`;
    await page.getByRole('button', { name: 'Foydalanuvchi qo‘shish' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.locator('#user-fullname').fill('QA Test User');
    await dialog.locator('#user-email').fill(email);
    await dialog.locator('#user-phone').fill('+998 90 000 11 22');
    await dialog.getByRole('button', { name: 'Yaratish' }).click();
    await expect(dialog).toBeHidden();

    const search = page.getByRole('textbox', { name: /^Qidirish/ });
    await search.fill(email);
    const row = page.getByRole('row', { name: new RegExp(email.replace('.', '\\.')) });
    await expect(row).toBeVisible();

    await row.getByRole('button', { name: 'To‘xtatish' }).click();
    const confirm = page.getByRole('dialog');
    await confirm.getByRole('button', { name: 'To‘xtatish' }).click();
    await expect(row.getByText('To‘xtatilgan')).toBeVisible();
  });

  test('map selection updates a space status', async ({ page }) => {
    await loginAsDemo(page, 'admin@parkovka.uz');
    await page.goto('/admin/map');
    await expect(page.getByRole('heading', { name: 'Interaktiv parking xaritasi' })).toBeVisible();

    const space = page.locator('g[data-space][role="button"]').first();
    await expect(space).toBeVisible();
    await space.click();

    await page.locator('#map-space-status').selectOption('BLOCKED');
    await page.getByRole('button', { name: 'Saqlash' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'saqlandi' })).toBeVisible();
    await expect(page.getByText('Bloklangan').first()).toBeVisible();
  });

  test('pricing, cameras, reports and system settings actions persist', async ({ page }) => {
    await loginAsDemo(page, 'admin@parkovka.uz');

    await page.goto('/admin/pricing');
    await page.getByRole('button', { name: 'Tahrirlash' }).first().click();
    const pricing = page.getByRole('dialog');
    await pricing.locator('#pricing-rate').fill('9000');
    await pricing.getByRole('button', { name: 'Saqlash' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'saqlandi' })).toBeVisible();

    await page.goto('/admin/cameras');
    const cameraButton = page
      .getByRole('button', { name: /Kamerani (yoqish|o‘chirish)/ })
      .first();
    await cameraButton.click();
    await expect(page.getByRole('status').filter({ hasText: 'saqlandi' })).toBeVisible();

    await page.goto('/admin/reports');
    await page.getByRole('button', { name: 'Hisobot yaratish' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Hisobot yangilandi.' })).toBeVisible();

    await page.goto('/admin/settings');
    await page.locator('#settings-company').fill('Parkovka QA');
    await page.getByRole('button', { name: 'Sozlamalarni saqlash' }).click();
    await expect(
      page.getByRole('status').filter({ hasText: 'Tizim sozlamalari saqlandi.' }),
    ).toBeVisible();
  });
});

test.describe('guard operations', () => {
  test('walk-in vehicle enters and exits without a simulated payment', async ({ page }) => {
    await loginAsDemo(page, 'guard@parkovka.uz');
    const plate = '01 Z 555 ZZ';

    await page.goto('/guard/entry');
    await expect(page.getByRole('heading', { name: 'Avtomobil kirishi' })).toBeVisible();
    await page.locator('#entry-plate').fill(plate);
    await page.getByRole('switch', { name: 'Walk-in (bronsiz)' }).click();
    await expect(page.locator('#entry-space')).toBeVisible();

    const entry = page.getByRole('button', { name: 'Kirishni tasdiqlash' });
    await expect(entry).toBeEnabled();
    await entry.click();
    await expect(page.getByText('Kirish qayd etildi').first()).toBeVisible();

    await page.goto('/guard/exit');
    await page.locator('#exit-plate').fill(plate);
    await page.locator('form').getByRole('button', { name: 'Tekshirish' }).click();
    await expect(page.getByText(plate, { exact: true })).toBeVisible();
    await page.getByRole('switch', { name: 'To‘langan deb belgilash' }).click();

    await page.getByRole('button', { name: 'Chiqishni tasdiqlash' }).click();
    await expect(page.getByText('Chiqish qayd etildi').first()).toBeVisible();
  });

  test('manual QR validation resolves a reservation and checks the vehicle in', async ({ page }) => {
    await loginAsDemo(page, 'guard@parkovka.uz');
    await page.goto('/guard/scan');
    await expect(page.getByRole('heading', { name: 'QR skanerlash' })).toBeVisible();

    await page.getByLabel('QR kodni qo‘lda kiritish').fill('PVK-F2ZL3RTC');
    await page.getByRole('button', { name: 'Tekshirish' }).click();
    await expect(page.getByText('Bron topildi')).toBeVisible();
    await expect(page.getByText('RSV-9081')).toBeVisible();

    await page.getByRole('button', { name: 'Kirishni tasdiqlash' }).click();
    await expect(page.getByText('Kirish qayd etildi').first()).toBeVisible();
  });

  test('guard files a new incident from the operations dashboard', async ({ page }) => {
    await loginAsDemo(page, 'guard@parkovka.uz');
    await page.goto('/guard/incidents');
    await expect(page.getByRole('heading', { name: 'Hodisalar' })).toBeVisible();

    await page.getByRole('button', { name: 'Hodisa qayd etish' }).first().click();
    const dialog = page.getByRole('dialog');
    const description = `QA incident ${Date.now()}`;
    await dialog.locator('#incident-description').fill(description);
    await dialog.getByRole('button', { name: 'Hodisani yuborish' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText(description)).toBeVisible();
  });
});

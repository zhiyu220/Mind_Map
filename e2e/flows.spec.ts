import { expect, test, type Page } from '@playwright/test';

// What matters most: what you write is kept, can be locked away, and comes back from a backup.

const today = () => {
  const d = new Date();
  return `${d.getMonth() + 1}/${d.getDate()}`;
};

/** Everything in the app's database as it sits on the phone, without the app opening anything. */
const onDisk = (page: Page) =>
  page.evaluate(async () => {
    const req = indexedDB.open('my-sky');
    const db = await new Promise<IDBDatabase>(r => (req.onsuccess = () => r(req.result)));
    const all = (st: string) => new Promise<unknown[]>(r => { const q = db.transaction(st).objectStore(st).getAll(); q.onsuccess = () => r(q.result); });
    const text = JSON.stringify({ s: await all('sessions'), n: await all('notes'), p: await all('practices'), kv: await all('kv') });
    db.close();
    return text;
  });

async function recordToday(page: Page) {
  await page.getByRole('button', { name: '記下今天' }).click();
  await page.getByRole('button', { name: '有，今天去了' }).click();
  await page.locator('.weathers .wbtn').first().click();
  await page.getByRole('button', { name: '這樣就好' }).click();
  // the first session: no guess yet at when the next one is, so nothing is asked
  await expect(page.getByRole('button', { name: /^第 1 次諮商/ })).toBeVisible();
}

async function writeOnTheRoad(page: Page, text: string) {
  await page.locator('[aria-label^="現在這段路上"]').click();
  await page.locator('#road-text').fill(text);
  await page.getByRole('button', { name: '記下來' }).click();
  await expect(page.locator('section[aria-label="路上"]')).toHaveCount(0);
}

async function openSettings(page: Page) {
  await page.getByRole('button', { name: '全部紀錄' }).click();
  await page.getByRole('button', { name: '設定' }).click();
}

async function closeSettings(page: Page) {
  await page.getByRole('button', { name: '返回' }).click();
  await page.getByRole('button', { name: '回到小路' }).click();
}

const lockGroup = (page: Page) => page.locator('.group', { has: page.locator('h3', { hasText: '密碼鎖' }) });

async function setPin(page: Page, pin: string) {
  await openSettings(page);
  await lockGroup(page).getByRole('button', { name: '設定密碼' }).click();
  await page.locator('#pin-new').pressSequentially(pin, { delay: 30 });
  await expect(page.getByText('再輸入一次')).toBeVisible();
  await page.locator('#pin-new').pressSequentially(pin, { delay: 30 });
  await expect(page.locator('.toast')).toContainText('設好了');
  await closeSettings(page);
}

const typePin = async (page: Page, pin: string) => {
  for (const k of pin) await page.locator('.keypad button', { hasText: new RegExp(`^${k}$`) }).click();
};

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: '記下今天' })).toBeVisible();
});

test('a session and a note on the road are still there after reopening', async ({ page }) => {
  await recordToday(page);
  await expect(page.getByText(today(), { exact: true })).toBeVisible();
  await writeOnTheRoad(page, '路上想到媽媽');

  await page.reload();
  await expect(page.getByText(today(), { exact: true })).toBeVisible();
  await page.locator('[aria-label^="現在這段路上"]').click();
  await expect(page.getByText('路上想到媽媽')).toBeVisible();
});

test('with a PIN, what you wrote is sealed on the phone and opens with the right PIN only', async ({ page }) => {
  await writeOnTheRoad(page, '其實我很害怕');
  expect(await onDisk(page)).toContain('其實我很害怕');

  await setPin(page, '135790');
  expect(await onDisk(page)).not.toContain('其實我很害怕');

  await page.reload();
  await expect(page.locator('.pin-dots i')).toHaveCount(6);
  await typePin(page, '123456');
  await expect(page.getByRole('heading', { name: '再試一次' })).toBeVisible();
  await typePin(page, '135790');
  await expect(page.locator('.lock')).toHaveCount(0);
  await page.locator('[aria-label^="現在這段路上"]').click();
  await expect(page.getByText('其實我很害怕')).toBeVisible();
});

test('a backup made with a PIN set restores what was written', async ({ page }) => {
  await recordToday(page);
  await writeOnTheRoad(page, '要帶去說的事');
  await setPin(page, '135790');

  // export
  await openSettings(page);
  await page.getByRole('button', { name: '匯出備份' }).click();
  await page.locator('#backup-pw').fill('my backup');
  await page.locator('#backup-pw2').fill('my backup');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: '匯出', exact: true }).click();
  const file = await (await download).path();
  expect(await (await import('node:fs/promises')).readFile(file, 'utf8')).not.toContain('要帶去說的事');

  // something written after the backup goes away when it's restored
  await closeSettings(page);
  await writeOnTheRoad(page, '備份之後寫的');
  await openSettings(page);
  await page.locator('input[type=file]').setInputFiles(file);
  await page.locator('#backup-open').fill('my backup');
  await page.getByRole('button', { name: '打開' }).click();
  await page.getByRole('button', { name: '取代' }).click();
  await expect(page.locator('.toast')).toContainText('還原好了');
  await closeSettings(page);

  await page.locator('[aria-label^="現在這段路上"]').click();
  await expect(page.getByText('要帶去說的事')).toBeVisible();
  await expect(page.getByText('備份之後寫的')).toHaveCount(0);
  // still sealed on the phone after the restore
  expect(await onDisk(page)).not.toContain('要帶去說的事');
});

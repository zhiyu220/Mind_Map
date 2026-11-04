import { expect, test, type Page } from '@playwright/test';

// 時間鎖: open only 21:00–24:00; outside it, only 調整時間鎖 (behind the PIN, if one is set).

async function openSettings(page: Page) {
  await page.getByRole('button', { name: '全部紀錄' }).click();
  await page.getByRole('button', { name: '設定' }).click();
}

async function turnOnTimeLock(page: Page) {
  await openSettings(page);
  const group = page.locator('.group', { has: page.locator('h3', { hasText: '時間鎖' }) });
  // the switch follows the saved setting, a moment after the tap
  await group.getByRole('checkbox').click();
  await expect(group.getByRole('checkbox')).toBeChecked();
  await expect(page.locator('.toast')).toContainText('下次打開開始算');
  // turned on outside the window: nothing closes until the next time
  await expect(page.locator('.time-closed')).toHaveCount(0);
}

test('closed outside the window, and 調整時間鎖 can open it', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-04T15:00:00') });
  await page.goto('/');
  await turnOnTimeLock(page);

  await page.reload();
  await expect(page.getByRole('heading', { name: '現在先休息' })).toBeVisible();
  await expect(page.getByText('21:00 再來')).toBeVisible();
  await expect(page.getByRole('button', { name: '記下今天' })).toHaveCount(0);

  await page.getByRole('button', { name: '調整時間鎖' }).click();
  await page.locator('#time-from').fill('14:00');
  await page.getByRole('button', { name: '好了' }).click();
  await expect(page.getByRole('button', { name: '記下今天' })).toBeVisible();
});

test('opens inside the window', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-04T15:00:00') });
  await page.goto('/');
  await turnOnTimeLock(page);
  await page.clock.setSystemTime(new Date('2026-11-04T21:30:00'));
  await page.reload();
  await expect(page.getByRole('button', { name: '記下今天' })).toBeVisible();
});

test('with a PIN, 調整時間鎖 asks for it first', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-04T15:00:00') });
  await page.goto('/');
  await openSettings(page);
  const lock = page.locator('.group', { has: page.locator('h3', { hasText: '密碼鎖' }) });
  await lock.getByRole('button', { name: '設定密碼' }).click();
  await page.locator('#pin-new').pressSequentially('135790', { delay: 30 });
  await expect(page.getByText('再輸入一次')).toBeVisible();
  await page.locator('#pin-new').pressSequentially('135790', { delay: 30 });
  await expect(page.locator('.toast')).toContainText('設好了');
  await page.getByRole('button', { name: '返回' }).click();
  await page.getByRole('button', { name: '回到小路' }).click();
  await turnOnTimeLock(page);

  await page.reload();
  // the time lock comes before the PIN
  await expect(page.getByRole('heading', { name: '現在先休息' })).toBeVisible();
  await page.getByRole('button', { name: '調整時間鎖' }).click();
  await expect(page.locator('.pin-dots i')).toHaveCount(6);
  for (const k of '135790') await page.locator('.keypad button', { hasText: new RegExp(`^${k}$`) }).click();
  await expect(page.getByRole('heading', { name: '調整時間鎖' })).toBeVisible();
  // only the time lock here, not the rest of the settings
  await expect(page.getByRole('heading', { name: '密碼鎖' })).toHaveCount(0);
  await page.getByRole('button', { name: '好了' }).click();
  // still outside the window: closed again
  await expect(page.getByRole('heading', { name: '現在先休息' })).toBeVisible();
});

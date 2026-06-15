import { expect, test } from '@playwright/test';

import { createE2EUser } from '../../fixtures/users';
import { ensureSession, injectAuthSession } from '../../helpers/auth.helper';

test.describe('Responsive mobile 360', () => {
  test('vocabulary 在 360 宽度无横向滚动且主操作可见 @full', async ({ page, request }) => {
    const user = createE2EUser('mobile-vocabulary');
    const session = await ensureSession(request, user);

    await injectAuthSession(page, session);
    await page.goto('/vocabulary');

    await page.getByTestId('word-search-input').fill('ability');
    await expect(page.locator('[data-testid^="word-card-"]').first()).toBeVisible();
    await expect(page.locator('[data-testid^="word-add-"]').first()).toBeVisible();

    const noOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth <= window.innerWidth;
    });
    expect(noOverflow).toBe(true);
  });

  test('grammar 在 360 宽度无横向滚动且提交按钮可达 @full', async ({ page, request }) => {
    const user = createE2EUser('mobile-grammar');
    const session = await ensureSession(request, user);

    await injectAuthSession(page, session);
    await page.goto('/grammar');

    await expect(page.locator('[data-testid^="lesson-item-"]').first()).toBeVisible();
    await expect(page.getByTestId('submit-attempt')).toBeVisible();

    const noOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth <= window.innerWidth;
    });
    expect(noOverflow).toBe(true);
  });
});

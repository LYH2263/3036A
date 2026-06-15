import { expect, test } from '@playwright/test';

import { createE2EUser } from '../../fixtures/users';
import { ensureSession, injectAuthSession } from '../../helpers/auth.helper';

test.describe('Route guards smoke', () => {
  test('未登录访问根路由重定向到 auth @smoke', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/auth$/);
    await expect(page.getByTestId('auth-page')).toBeVisible();
  });

  test('未登录访问受保护页重定向到 auth @smoke', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/auth$/);
  });

  test('已登录访问根路由重定向到 dashboard @smoke', async ({ page, request }) => {
    const user = createE2EUser('guard-root-authenticated');
    const session = await ensureSession(request, user);

    await injectAuthSession(page, session);
    await page.goto('/');

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByTestId('dashboard-page')).toBeVisible();
  });
});

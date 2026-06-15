import { expect, test } from '@playwright/test';

import { createE2EUser } from '../../fixtures/users';
import { ensureSession, injectAuthSession } from '../../helpers/auth.helper';
import { DashboardPage } from '../../pages/DashboardPage';

test.describe('Dashboard smoke', () => {
  test('空态展示、快捷入口与退出登录 @smoke', async ({ page, request }) => {
    const user = createE2EUser('dashboard-empty');
    const session = await ensureSession(request, user);

    await injectAuthSession(page, session);

    const dashboardPage = new DashboardPage(page);
    await dashboardPage.goto();
    await dashboardPage.expectReady();
    await dashboardPage.expectEmptyState();

    await dashboardPage.clickGoVocabulary();
    await expect(page).toHaveURL(/\/vocabulary$/);

    await page.goto('/dashboard');
    await dashboardPage.clickGoGrammar();
    await expect(page).toHaveURL(/\/grammar$/);

    await page.goto('/dashboard');
    await dashboardPage.clickGoProgress();
    await expect(page).toHaveURL(/\/progress$/);

    await page.goto('/dashboard');
    await dashboardPage.logout();
    await expect(page).toHaveURL(/\/auth$/);
  });
});

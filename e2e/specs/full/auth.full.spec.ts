import { expect, test } from '@playwright/test';

import { createE2EUser } from '../../fixtures/users';
import { ensureSession, injectAuthSession } from '../../helpers/auth.helper';
import { AuthPage } from '../../pages/AuthPage';

test.describe('Auth full', () => {
  test('登录/注册模式切换文案正确 @full', async ({ page }) => {
    const authPage = new AuthPage(page);

    await authPage.goto();
    await authPage.expectReady();
    await expect(page.getByTestId('auth-mode-login')).toBeVisible();

    await authPage.switchMode();
    await expect(page.getByTestId('auth-mode-register')).toBeVisible();

    await authPage.switchMode();
    await expect(page.getByTestId('auth-mode-login')).toBeVisible();
  });

  test('重复注册显示后端错误提示 @full', async ({ page, request }) => {
    const user = createE2EUser('auth-duplicate');
    await ensureSession(request, user);

    const authPage = new AuthPage(page);
    await authPage.goto();
    await authPage.switchMode();
    await authPage.submit(user.email, user.password);

    await authPage.expectErrorContains('邮箱已被注册');
  });

  test('已登录访问 auth 自动跳转 dashboard @full', async ({ page, request }) => {
    const user = createE2EUser('auth-auto-redirect');
    const session = await ensureSession(request, user);

    await injectAuthSession(page, session);
    await page.goto('/auth');

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByTestId('dashboard-page')).toBeVisible();
  });

  test('登录成功后保持会话并可访问受保护页面 @full', async ({ page, request }) => {
    const user = createE2EUser('auth-login-success');
    await ensureSession(request, user);

    const authPage = new AuthPage(page);
    await authPage.goto();
    await authPage.submit(user.email, user.password);

    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto('/progress');
    await expect(page).toHaveURL(/\/progress$/);
    await expect(page.getByTestId('progress-page')).toBeVisible();
  });
});

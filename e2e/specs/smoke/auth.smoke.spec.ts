import { expect, test } from '@playwright/test';

import { createE2EUser } from '../../fixtures/users';
import { ensureSession } from '../../helpers/auth.helper';
import { AuthPage } from '../../pages/AuthPage';

test.describe('Auth smoke', () => {
  test('auth 表单校验与模式切换 @smoke', async ({ page }) => {
    const authPage = new AuthPage(page);

    await authPage.goto();
    await authPage.expectReady();

    await authPage.switchMode();
    await expect(page.getByTestId('auth-mode-register')).toBeVisible();

    await authPage.submit('invalid@email', '123456');
    await authPage.expectErrorContains('请输入有效邮箱地址');

    await authPage.submit('valid@example.com', '123');
    await authPage.expectErrorContains('密码长度至少 6 位');
  });

  test('auth 注册成功后跳转 dashboard @smoke', async ({ page }) => {
    const authPage = new AuthPage(page);
    const user = createE2EUser('auth-register');

    await authPage.goto();
    await authPage.switchMode();
    await authPage.submit(user.email, user.password);

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByTestId('dashboard-page')).toBeVisible();
  });

  test('auth 错误密码提示统一文案 @smoke', async ({ page, request }) => {
    const authPage = new AuthPage(page);
    const user = createE2EUser('auth-wrong-password');
    await ensureSession(request, user);

    await authPage.goto();
    await authPage.submit(user.email, `${user.password}-wrong`);

    await authPage.expectErrorContains('邮箱或密码错误');
    await expect(page).toHaveURL(/\/auth$/);
  });
});

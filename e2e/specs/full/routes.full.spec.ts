import { expect, test } from '@playwright/test';

import { createE2EUser } from '../../fixtures/users';
import { ensureSession, injectAuthSession } from '../../helpers/auth.helper';

test.describe('Routes full', () => {
  for (const path of ['/dashboard', '/vocabulary', '/grammar', '/progress'] as const) {
    test(`未登录访问 ${path} 会回到 /auth @full`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/auth$/);
    });
  }

  test('已登录可访问所有受保护页面 @full', async ({ page, request }) => {
    const user = createE2EUser('routes-auth');
    const session = await ensureSession(request, user);

    await injectAuthSession(page, session);

    for (const path of ['/dashboard', '/vocabulary', '/grammar', '/progress']) {
      await page.goto(path);
      await expect(page).toHaveURL(new RegExp(`${path}$`));
      await expect(page.getByTestId('shell-root')).toBeVisible();
    }
  });
});

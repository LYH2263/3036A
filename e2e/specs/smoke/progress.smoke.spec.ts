import { test } from '@playwright/test';

import { createE2EUser } from '../../fixtures/users';
import { ensureSession, injectAuthSession } from '../../helpers/auth.helper';
import { ProgressPage } from '../../pages/ProgressPage';

test.describe('Progress smoke', () => {
  test('进度页渲染与空成就态 @smoke', async ({ page, request }) => {
    const user = createE2EUser('progress-empty');
    const session = await ensureSession(request, user);

    await injectAuthSession(page, session);

    const progressPage = new ProgressPage(page);
    await progressPage.goto();
    await progressPage.expectReady();
    await progressPage.expectStatsVisible();
    await progressPage.expectEmptyAchievements();
  });
});

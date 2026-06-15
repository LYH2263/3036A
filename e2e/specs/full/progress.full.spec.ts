import { expect, test } from '@playwright/test';

import { buildGenericAnswers } from '../../fixtures/answers';
import { createE2EUser } from '../../fixtures/users';
import { ensureSession, injectAuthSession } from '../../helpers/auth.helper';
import { fetchLessonDetail, fetchLessons, submitGrammarAttempt } from '../../helpers/db.helper';
import { ProgressPage } from '../../pages/ProgressPage';

test.describe('Progress full', () => {
  test('空数据用户显示空成就提示 @full', async ({ page, request }) => {
    const user = createE2EUser('progress-empty-full');
    const session = await ensureSession(request, user);

    await injectAuthSession(page, session);

    const progressPage = new ProgressPage(page);
    await progressPage.goto();
    await progressPage.expectStatsVisible();
    await progressPage.expectEmptyAchievements();
  });

  test('达成阈值后显示成就列表 @full', async ({ page, request }) => {
    const user = createE2EUser('progress-achievement');
    const session = await ensureSession(request, user);

    const lessons = await fetchLessons(request, session.accessToken);
    const detail = await fetchLessonDetail(request, session.accessToken, lessons[0].id);

    for (let i = 0; i < 10; i += 1) {
      await submitGrammarAttempt(
        request,
        session.accessToken,
        detail.id,
        buildGenericAnswers(detail),
        `progress-achievement-${Date.now()}-${i}`
      );
    }

    await injectAuthSession(page, session);

    const progressPage = new ProgressPage(page);
    await progressPage.goto();
    await progressPage.expectAchievementList();
    await expect(page.getByTestId('achievement-GRAMMAR_10')).toBeVisible();
    await expect(page.getByTestId('progress-card-grammar-attempts')).toContainText('10');
  });
});

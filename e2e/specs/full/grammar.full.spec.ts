import { expect, test } from '@playwright/test';

import { buildGenericAnswers } from '../../fixtures/answers';
import { createE2EUser } from '../../fixtures/users';
import { ensureSession, injectAuthSession } from '../../helpers/auth.helper';
import { fetchLessonDetail, fetchLessons } from '../../helpers/db.helper';
import { expectOfflineQueueSize, seedOfflineEvents } from '../../helpers/offline.helper';
import { GrammarPage } from '../../pages/GrammarPage';

test.describe('Grammar full', () => {
  test('级别过滤分支全部可切换 @full', async ({ page, request }) => {
    const user = createE2EUser('grammar-levels');
    const session = await ensureSession(request, user);

    await injectAuthSession(page, session);
    const grammarPage = new GrammarPage(page);

    await grammarPage.goto();
    await grammarPage.expectReady();

    await grammarPage.selectLevel('all');
    await expect(page.getByTestId('grammar-level-label')).toContainText('全部级别');

    await grammarPage.selectLevel('basic');
    await expect(page.getByTestId('grammar-level-label')).toContainText('基础');

    await grammarPage.selectLevel('intermediate');
    await expect(page.getByTestId('grammar-level-label')).toContainText('进阶');

    await grammarPage.selectLevel('advanced');
    await expect(page.getByTestId('grammar-level-label')).toContainText('高级');
  });

  test('自动选中首个 lesson 且切换 lesson 会重置结果 @full', async ({ page, request }) => {
    const user = createE2EUser('grammar-reset');
    const session = await ensureSession(request, user);

    await injectAuthSession(page, session);
    const grammarPage = new GrammarPage(page);

    await grammarPage.goto();
    await expect(page.getByTestId('grammar-lesson-title')).toBeVisible();

    await grammarPage.fillAllQuestionsWithFallbackAnswer();
    await grammarPage.submitAttempt();
    await grammarPage.expectSubmitted();

    await page.locator('[data-testid^="lesson-item-"]').nth(1).click();
    await expect(page.getByTestId('attempt-result')).toHaveCount(0);
    await expect(page.getByTestId('grammar-msg')).toHaveCount(0);
  });

  test('选择题与填空题都可渲染作答 @full', async ({ page, request }) => {
    const user = createE2EUser('grammar-question-types');
    const session = await ensureSession(request, user);

    await injectAuthSession(page, session);
    const grammarPage = new GrammarPage(page);

    await grammarPage.goto();
    await expect(page.locator('[data-testid^="question-option-"]').first()).toBeVisible();
    await expect(page.locator('[data-testid^="question-input-"]').first()).toBeVisible();

    await grammarPage.fillAllQuestionsWithFallbackAnswer();
    await grammarPage.submitAttempt();
    await grammarPage.expectSubmitted();
  });

  test('离线提交会进入本地队列 @full', async ({ page, request }) => {
    const user = createE2EUser('grammar-offline');
    const session = await ensureSession(request, user);
    const lessons = await fetchLessons(request, session.accessToken);
    const detail = await fetchLessonDetail(request, session.accessToken, lessons[0].id);

    await injectAuthSession(page, session);
    const grammarPage = new GrammarPage(page);

    await grammarPage.goto();
    await expect(page.locator('[data-testid^="question-"]').first()).toBeVisible();
    await seedOfflineEvents(page, [
      {
        type: 'GRAMMAR_ATTEMPT',
        clientEventId: `full-grammar-offline-${Date.now()}`,
        payload: {
          lessonId: detail.id,
          answers: buildGenericAnswers(detail)
        },
        createdAt: new Date().toISOString()
      }
    ]);
    await expectOfflineQueueSize(page, 1);
  });

  test('在线提交失败会回退进入本地队列 @full', async ({ page, request }) => {
    const user = createE2EUser('grammar-fallback');
    const session = await ensureSession(request, user);

    await injectAuthSession(page, session);
    const grammarPage = new GrammarPage(page);

    await grammarPage.goto();
    await expect(page.locator('[data-testid^="question-"]').first()).toBeVisible();

    await page.route('**/api/grammar/lessons/*/attempts', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ message: '模拟语法提交失败' })
      });
    });

    await grammarPage.fillAllQuestionsWithFallbackAnswer();
    await grammarPage.submitAttempt();

    await grammarPage.expectMessageContains('当前离线，练习结果已加入待同步队列');
    await expectOfflineQueueSize(page, 1);
  });

  test('离线语法事件恢复网络后可同步 @full', async ({ page, request }) => {
    const user = createE2EUser('grammar-sync');
    const session = await ensureSession(request, user);
    const lessons = await fetchLessons(request, session.accessToken);
    const detail = await fetchLessonDetail(request, session.accessToken, lessons[0].id);

    await injectAuthSession(page, session);
    const grammarPage = new GrammarPage(page);

    await grammarPage.goto();
    await expect(page.locator('[data-testid^="question-"]').first()).toBeVisible();
    await seedOfflineEvents(page, [
      {
        type: 'GRAMMAR_ATTEMPT',
        clientEventId: `full-grammar-sync-${Date.now()}`,
        payload: {
          lessonId: detail.id,
          answers: buildGenericAnswers(detail)
        },
        createdAt: new Date().toISOString()
      }
    ]);
    await expectOfflineQueueSize(page, 1);

    await page.getByTestId('sync-btn').click();
    await expect(page.getByTestId('sync-msg')).toContainText('同步完成');
    await expectOfflineQueueSize(page, 0);
  });
});

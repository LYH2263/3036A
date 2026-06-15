import { expect, test } from '@playwright/test';

import { buildGenericAnswers } from '../../fixtures/answers';
import { createE2EUser } from '../../fixtures/users';
import { ensureSession, injectAuthSession } from '../../helpers/auth.helper';
import { API_BASE_URL } from '../../helpers/api.helper';
import { fetchLessonDetail, fetchLessons } from '../../helpers/db.helper';
import {
  clearOfflineQueue,
  expectOfflineQueueSize,
  seedOfflineEvents,
  setOffline,
  setOnline
} from '../../helpers/offline.helper';

test.describe('Dashboard full', () => {
  test('有学习数据时卡片渲染且空态隐藏 @full', async ({ page, request }) => {
    const user = createE2EUser('dashboard-filled');
    const session = await ensureSession(request, user);

    const lessons = await fetchLessons(request, session.accessToken);
    const detail = await fetchLessonDetail(request, session.accessToken, lessons[0].id);

    await request.post(`${API_BASE_URL}/grammar/lessons/${detail.id}/attempts`, {
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        'Content-Type': 'application/json'
      },
      data: {
        answers: buildGenericAnswers(detail)
      }
    });

    await injectAuthSession(page, session);
    await page.goto('/dashboard');

    await expect(page.getByTestId('dashboard-stats')).toBeVisible();
    await expect(page.getByTestId('dashboard-empty-state')).toHaveCount(0);
    await expect(page.getByTestId('dashboard-card-grammar-attempts')).toContainText('语法练习次数');
  });

  test('同步按钮失败分支显示失败计数 @full', async ({ page, request, context }) => {
    const user = createE2EUser('dashboard-sync-failed');
    const session = await ensureSession(request, user);

    await injectAuthSession(page, session);
    await page.goto('/dashboard');

    await clearOfflineQueue(page);
    await seedOfflineEvents(page, [
      {
        type: 'WORD_REVIEW',
        clientEventId: `broken-${Date.now()}`,
        payload: {
          progressId: '00000000-0000-0000-0000-000000000000',
          known: true
        },
        createdAt: new Date().toISOString()
      }
    ]);

    await expectOfflineQueueSize(page, 1);

    await setOffline(context, page);
    await page.getByTestId('sync-btn').click();
    await expect(page.getByTestId('sync-msg')).toContainText('失败 1 条');
    await expectOfflineQueueSize(page, 1);
    await setOnline(context, page);
  });

  test('同步按钮成功分支消费队列事件 @full', async ({ page, request }) => {
    const user = createE2EUser('dashboard-sync-success');
    const session = await ensureSession(request, user);

    const lessons = await fetchLessons(request, session.accessToken);
    const detail = await fetchLessonDetail(request, session.accessToken, lessons[0].id);

    await injectAuthSession(page, session);
    await page.goto('/dashboard');

    await clearOfflineQueue(page);
    await seedOfflineEvents(page, [
      {
        type: 'GRAMMAR_ATTEMPT',
        clientEventId: `grammar-${Date.now()}`,
        payload: {
          lessonId: detail.id,
          answers: buildGenericAnswers(detail)
        },
        createdAt: new Date().toISOString()
      }
    ]);

    await expectOfflineQueueSize(page, 1);
    await page.getByTestId('sync-btn').click();

    await expect(page.getByTestId('sync-msg')).toContainText('同步完成，共 1 条');
    await expectOfflineQueueSize(page, 0);
  });
});

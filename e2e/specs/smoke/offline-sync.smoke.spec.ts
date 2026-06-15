import { expect, test } from '@playwright/test';

import { createE2EUser } from '../../fixtures/users';
import { ensureSession, injectAuthSession } from '../../helpers/auth.helper';
import {
  addWordToNotebook,
  fetchTodayReviews,
  searchWords
} from '../../helpers/db.helper';
import {
  expectOfflineQueueSize,
  seedOfflineEvents
} from '../../helpers/offline.helper';
import { VocabularyPage } from '../../pages/VocabularyPage';

test.describe('Offline sync smoke', () => {
  test('离线队列事件可被同步消费 @smoke', async ({ page, request }) => {
    const user = createE2EUser('offline-review');
    const session = await ensureSession(request, user);

    const words = await searchWords(request, session.accessToken, 'ability');
    await addWordToNotebook(request, session.accessToken, words[0].id);

    const reviews = await fetchTodayReviews(request, session.accessToken);
    expect(reviews.length).toBeGreaterThan(0);

    await injectAuthSession(page, session);

    const vocabularyPage = new VocabularyPage(page);
    await vocabularyPage.goto();
    await vocabularyPage.expectReady();
    await expect(vocabularyPage.reviewItems.first()).toBeVisible();
    await seedOfflineEvents(page, [
      {
        type: 'WORD_REVIEW',
        clientEventId: `smoke-offline-review-${Date.now()}`,
        payload: {
          progressId: reviews[0].id,
          known: true
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

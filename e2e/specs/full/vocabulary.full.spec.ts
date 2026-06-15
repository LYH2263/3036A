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

test.describe('Vocabulary full', () => {
  test('空查询、无结果、有结果三种分支渲染 @full', async ({ page, request }) => {
    const user = createE2EUser('vocab-query-branches');
    const session = await ensureSession(request, user);

    await injectAuthSession(page, session);
    const vocabularyPage = new VocabularyPage(page);

    await vocabularyPage.goto();
    await vocabularyPage.expectReady();
    await expect(page.getByTestId('word-search-empty')).toHaveCount(0);

    await vocabularyPage.search('no-such-word-zzzz');
    await expect(page.getByTestId('word-search-empty')).toBeVisible();

    await vocabularyPage.search('ability');
    await expect(vocabularyPage.wordCards.first()).toBeVisible();
  });

  test('发音按钮在 speechSynthesis 存在时被调用 @full', async ({ page, request }) => {
    const user = createE2EUser('vocab-speech-exists');
    const session = await ensureSession(request, user);

    await page.addInitScript(() => {
      (window as any).__speakCount = 0;
      Object.defineProperty(window, 'speechSynthesis', {
        configurable: true,
        value: {
          cancel: () => undefined,
          speak: () => {
            (window as any).__speakCount += 1;
          }
        }
      });
    });

    await injectAuthSession(page, session);
    const vocabularyPage = new VocabularyPage(page);

    await vocabularyPage.goto();
    await vocabularyPage.search('ability');
    await expect(vocabularyPage.wordCards.first()).toBeVisible();
    await vocabularyPage.clickFirstPronounceButton();

    await expect
      .poll(async () => page.evaluate(() => (window as any).__speakCount as number))
      .toBeGreaterThan(0);
  });

  test('发音按钮在 speechSynthesis 缺失时安全降级 @full', async ({ page, request }) => {
    const user = createE2EUser('vocab-speech-missing');
    const session = await ensureSession(request, user);

    await page.addInitScript(() => {
      Object.defineProperty(window, 'speechSynthesis', {
        configurable: true,
        value: undefined
      });
    });

    await injectAuthSession(page, session);
    const vocabularyPage = new VocabularyPage(page);

    await vocabularyPage.goto();
    await vocabularyPage.search('ability');
    await expect(vocabularyPage.wordCards.first()).toBeVisible();
    await vocabularyPage.clickFirstPronounceButton();

    await expect(page.getByTestId('vocabulary-page')).toBeVisible();
  });

  test('加入生词本失败分支显示错误提示 @full', async ({ page, request }) => {
    const user = createE2EUser('vocab-add-fail');
    const session = await ensureSession(request, user);

    await injectAuthSession(page, session);
    const vocabularyPage = new VocabularyPage(page);

    await vocabularyPage.goto();
    await vocabularyPage.search('ability');
    await expect(vocabularyPage.wordCards.first()).toBeVisible();

    await page.route('**/api/user-words', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ message: '模拟加入失败' })
      });
    });

    await vocabularyPage.clickFirstAddButton();
    await vocabularyPage.expectNoticeContains('模拟加入失败');
  });

  test('今日复习空态与不认识反馈分支 @full', async ({ page, request }) => {
    const user = createE2EUser('vocab-review-empty-then-unknown');
    const session = await ensureSession(request, user);

    await injectAuthSession(page, session);
    const vocabularyPage = new VocabularyPage(page);

    await vocabularyPage.goto();
    await expect(page.getByTestId('review-empty')).toBeVisible();

    const words = await searchWords(request, session.accessToken, 'ability');
    await addWordToNotebook(request, session.accessToken, words[0].id);

    await page.reload();
    await expect(vocabularyPage.reviewItems.first()).toBeVisible();

    await vocabularyPage.clickFirstReviewUnknown();
    await vocabularyPage.expectNoticeContains('复习结果已提交');
  });

  test('在线请求失败回退到离线队列 @full', async ({ page, request }) => {
    const user = createE2EUser('vocab-review-fallback');
    const session = await ensureSession(request, user);

    const words = await searchWords(request, session.accessToken, 'ability');
    await addWordToNotebook(request, session.accessToken, words[0].id);

    const reviews = await fetchTodayReviews(request, session.accessToken);
    expect(reviews.length).toBeGreaterThan(0);

    await injectAuthSession(page, session);
    const vocabularyPage = new VocabularyPage(page);

    await vocabularyPage.goto();

    await page.route('**/api/user-words/*/review', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ message: '模拟复习失败' })
      });
    });

    await vocabularyPage.clickFirstReviewKnown();
    await vocabularyPage.expectNoticeContains('当前离线，复习记录已加入待同步队列');
    await expectOfflineQueueSize(page, 1);
  });

  test('离线复习后恢复网络可同步并清空队列 @full', async ({ page, request }) => {
    const user = createE2EUser('vocab-offline-sync');
    const session = await ensureSession(request, user);

    const words = await searchWords(request, session.accessToken, 'ability');
    await addWordToNotebook(request, session.accessToken, words[0].id);
    const reviews = await fetchTodayReviews(request, session.accessToken);
    expect(reviews.length).toBeGreaterThan(0);

    await injectAuthSession(page, session);
    const vocabularyPage = new VocabularyPage(page);

    await vocabularyPage.goto();
    await expect(vocabularyPage.reviewItems.first()).toBeVisible();
    await seedOfflineEvents(page, [
      {
        type: 'WORD_REVIEW',
        clientEventId: `full-vocab-offline-${Date.now()}`,
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

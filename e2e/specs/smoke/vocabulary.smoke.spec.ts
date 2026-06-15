import { expect, test } from '@playwright/test';

import { createE2EUser } from '../../fixtures/users';
import { ensureSession, injectAuthSession } from '../../helpers/auth.helper';
import { VocabularyPage } from '../../pages/VocabularyPage';

test.describe('Vocabulary smoke', () => {
  test('搜索、加入生词本、在线复习提交流程 @smoke', async ({ page, request }) => {
    const user = createE2EUser('vocabulary-online');
    const session = await ensureSession(request, user);

    await injectAuthSession(page, session);

    const vocabularyPage = new VocabularyPage(page);
    await vocabularyPage.goto();
    await vocabularyPage.expectReady();

    await vocabularyPage.search('ability');
    await expect(vocabularyPage.wordCards.first()).toBeVisible();

    await vocabularyPage.clickFirstAddButton();
    await vocabularyPage.expectNoticeContains('已加入生词本');

    await expect(vocabularyPage.reviewItems.first()).toBeVisible();
    const reviewedId = await vocabularyPage.getFirstReviewId();

    await vocabularyPage.clickFirstReviewKnown();
    await vocabularyPage.expectNoticeContains('复习结果已提交');

    await expect(page.getByTestId(`review-item-${reviewedId}`)).toHaveCount(0);
  });
});

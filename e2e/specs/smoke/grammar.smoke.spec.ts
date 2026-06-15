import { test } from '@playwright/test';

import { createE2EUser } from '../../fixtures/users';
import { ensureSession, injectAuthSession } from '../../helpers/auth.helper';
import { GrammarPage } from '../../pages/GrammarPage';

test.describe('Grammar smoke', () => {
  test('语法练习在线提交流程 @smoke', async ({ page, request }) => {
    const user = createE2EUser('grammar-online');
    const session = await ensureSession(request, user);

    await injectAuthSession(page, session);

    const grammarPage = new GrammarPage(page);
    await grammarPage.goto();
    await grammarPage.expectReady();

    await grammarPage.clickFirstLesson();
    await grammarPage.fillAllQuestionsWithFallbackAnswer();
    await grammarPage.submitAttempt();
    await grammarPage.expectSubmitted();
  });
});

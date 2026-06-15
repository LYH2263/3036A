import { expect, type Locator, type Page } from '@playwright/test';

export class GrammarPage {
  constructor(private readonly page: Page) {}

  async goto() {
    await this.page.goto('/grammar');
  }

  async expectReady() {
    await expect(this.page.getByTestId('grammar-page')).toBeVisible();
  }

  async selectLevel(level: 'all' | 'basic' | 'intermediate' | 'advanced') {
    await this.page.getByTestId(`level-filter-${level}`).click();
  }

  async clickFirstLesson() {
    await this.page.locator('[data-testid^="lesson-item-"]').first().click();
  }

  get questionBlocks(): Locator {
    return this.page.locator('[data-testid^="question-"]');
  }

  async fillAllQuestionsWithFallbackAnswer() {
    const count = await this.questionBlocks.count();

    for (let i = 0; i < count; i += 1) {
      const question = this.questionBlocks.nth(i);
      const radios = question.locator('input[type="radio"]');
      const radioCount = await radios.count();

      if (radioCount > 0) {
        await radios.first().check();
        continue;
      }

      const input = question.locator('input[type="text"]');
      if ((await input.count()) > 0) {
        await input.fill('placeholder-answer');
      }
    }
  }

  async submitAttempt() {
    await this.page.getByTestId('submit-attempt').click();
  }

  async expectSubmitted() {
    await expect(this.page.getByTestId('attempt-result')).toBeVisible();
  }

  async expectMessageContains(text: string) {
    await expect(this.page.getByTestId('grammar-msg')).toContainText(text);
  }

  async getFirstLessonId(): Promise<string> {
    const testId = await this.page
      .locator('[data-testid^="lesson-item-"]')
      .first()
      .getAttribute('data-testid');

    if (!testId) {
      throw new Error('lesson item not found');
    }

    return testId.replace('lesson-item-', '');
  }
}

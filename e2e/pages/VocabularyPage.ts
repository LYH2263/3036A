import { expect, type Locator, type Page } from '@playwright/test';

export class VocabularyPage {
  constructor(private readonly page: Page) {}

  async goto() {
    await this.page.goto('/vocabulary');
  }

  async expectReady() {
    await expect(this.page.getByTestId('vocabulary-page')).toBeVisible();
    await expect(this.page.getByTestId('word-search-input')).toBeVisible();
  }

  async search(query: string) {
    const input = this.page.getByTestId('word-search-input');
    await input.fill(query);
  }

  get wordCards(): Locator {
    return this.page.locator('[data-testid^="word-card-"]');
  }

  get addButtons(): Locator {
    return this.page.locator('[data-testid^="word-add-"]');
  }

  get reviewItems(): Locator {
    return this.page.locator('[data-testid^="review-item-"]');
  }

  async clickFirstAddButton() {
    await this.addButtons.first().click();
  }

  async clickFirstPronounceButton() {
    await this.page.locator('[data-testid^="word-pronounce-"]').first().click();
  }

  async clickFirstReviewKnown() {
    await this.page.locator('[data-testid^="review-known-"]').first().click();
  }

  async clickFirstReviewUnknown() {
    await this.page.locator('[data-testid^="review-unknown-"]').first().click();
  }

  async getFirstReviewId(): Promise<string> {
    const testId = await this.reviewItems.first().getAttribute('data-testid');
    if (!testId) {
      throw new Error('review item not found');
    }

    return testId.replace('review-item-', '');
  }

  async expectNoticeContains(text: string) {
    await expect(this.page.getByTestId('vocab-notice')).toContainText(text);
  }
}

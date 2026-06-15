import { expect, type Page } from '@playwright/test';

export class ProgressPage {
  constructor(private readonly page: Page) {}

  async goto() {
    await this.page.goto('/progress');
  }

  async expectReady() {
    await expect(this.page.getByTestId('progress-page')).toBeVisible();
  }

  async expectStatsVisible() {
    await expect(this.page.getByTestId('progress-stats')).toBeVisible();
  }

  async expectEmptyAchievements() {
    await expect(this.page.getByTestId('progress-achievements-empty')).toBeVisible();
  }

  async expectAchievementList() {
    await expect(this.page.getByTestId('progress-achievements-list')).toBeVisible();
  }
}

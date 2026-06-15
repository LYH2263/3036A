import { expect, type Page } from '@playwright/test';

export class DashboardPage {
  constructor(private readonly page: Page) {}

  async goto() {
    await this.page.goto('/dashboard');
  }

  async expectReady() {
    await expect(this.page.getByTestId('dashboard-page')).toBeVisible();
  }

  async expectStatsVisible() {
    await expect(this.page.getByTestId('dashboard-stats')).toBeVisible();
  }

  async expectEmptyState() {
    await expect(this.page.getByTestId('dashboard-empty-state')).toBeVisible();
  }

  async clickGoVocabulary() {
    await this.page.getByTestId('dashboard-go-vocabulary').click();
  }

  async clickGoGrammar() {
    await this.page.getByTestId('dashboard-go-grammar').click();
  }

  async clickGoProgress() {
    await this.page.getByTestId('dashboard-go-progress').click();
  }

  async logout() {
    await this.page.getByTestId('logout-btn').click();
  }
}

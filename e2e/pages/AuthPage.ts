import { expect, type Page } from '@playwright/test';

export class AuthPage {
  constructor(private readonly page: Page) {}

  readonly emailInput = this.page.getByTestId('auth-email');
  readonly passwordInput = this.page.getByTestId('auth-password');
  readonly submitButton = this.page.getByTestId('auth-submit');
  readonly toggleButton = this.page.getByTestId('auth-toggle');
  readonly errorText = this.page.getByTestId('auth-error');

  async goto() {
    await this.page.goto('/auth');
  }

  async expectReady() {
    await expect(this.emailInput).toBeVisible();
    await expect(this.passwordInput).toBeVisible();
    await expect(this.submitButton).toBeVisible();
  }

  async switchMode() {
    await this.toggleButton.click();
  }

  async submit(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }

  async expectErrorContains(text: string) {
    await expect(this.errorText).toContainText(text);
  }
}

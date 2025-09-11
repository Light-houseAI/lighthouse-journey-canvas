/**
 * Base Page Object
 *
 * Provides common functionality for all page objects:
 * 1. Standard navigation and waiting patterns
 * 2. Authentication state management
 * 3. Error handling and debugging utilities
 * 4. Common UI element interactions
 */

import { type Page, type Locator, expect } from '@playwright/test';

export abstract class BasePage {
  protected page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Navigate to a specific path and wait for page load
   */
  async goto(path: string) {
    await this.page.goto(path);
    await this.waitForPageLoad();
  }

  /**
   * Wait for page to be fully loaded
   */
  async waitForPageLoad() {
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Wait for an element to be visible
   */
  async waitForElement(locator: Locator, timeout = 10000) {
    await locator.waitFor({ state: 'visible', timeout });
  }

  /**
   * Click element with error handling
   */
  async clickElement(locator: Locator, options?: { timeout?: number }) {
    await this.waitForElement(locator, options?.timeout);
    await locator.click();
  }

  /**
   * Fill input field with validation
   */
  async fillInput(locator: Locator, value: string) {
    await this.waitForElement(locator);
    await locator.clear();
    await locator.fill(value);
    
    // Verify the value was set correctly
    await expect(locator).toHaveValue(value);
  }

  /**
   * Select option from dropdown
   */
  async selectOption(locator: Locator, value: string) {
    await this.waitForElement(locator);
    await locator.selectOption(value);
  }

  /**
   * Check if element is visible
   */
  async isVisible(locator: Locator): Promise<boolean> {
    try {
      await locator.waitFor({ state: 'visible', timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get text content from element
   */
  async getTextContent(locator: Locator): Promise<string> {
    await this.waitForElement(locator);
    const text = await locator.textContent();
    return text || '';
  }

  /**
   * Wait for element to contain specific text
   */
  async waitForText(locator: Locator, text: string, timeout = 10000) {
    await expect(locator).toContainText(text, { timeout });
  }

  /**
   * Take screenshot for debugging
   */
  async takeScreenshot(name: string) {
    await this.page.screenshot({ 
      path: `client/tests/e2e/test-results/${name}-${Date.now()}.png`,
      fullPage: true 
    });
  }

  /**
   * Check if user is authenticated by looking for auth indicators
   */
  async isAuthenticated(): Promise<boolean> {
    // Look for common authenticated UI elements
    const authIndicators = [
      this.page.locator('[data-testid="user-menu"]'),
      this.page.locator('.user-avatar'),
      this.page.locator('text="Dashboard"'),
      this.page.locator('text="Timeline"'),
    ];

    for (const indicator of authIndicators) {
      if (await this.isVisible(indicator)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Wait for navigation to complete
   */
  async waitForNavigation(urlPattern?: string | RegExp) {
    if (urlPattern) {
      await this.page.waitForURL(urlPattern);
    } else {
      await this.page.waitForLoadState('networkidle');
    }
  }

  /**
   * Handle common error states
   */
  async checkForErrors() {
    // Check for error messages in UI
    const errorSelectors = [
      '.error-message',
      '.alert-error',
      '[data-testid="error"]',
      'text="Error"',
      'text="Something went wrong"',
    ];

    for (const selector of errorSelectors) {
      const errorElement = this.page.locator(selector);
      if (await this.isVisible(errorElement)) {
        const errorText = await this.getTextContent(errorElement);
        throw new Error(`Page error detected: ${errorText}`);
      }
    }

    // Check for browser console errors
    const errors = await this.page.evaluate(() => {
      return window.console.errors || [];
    });

    if (errors.length > 0) {
      console.warn('Console errors detected:', errors);
    }
  }

  /**
   * Wait for loading indicators to disappear
   */
  async waitForLoading() {
    const loadingSelectors = [
      '.loading',
      '.spinner',
      '[data-testid="loading"]',
      'text="Loading..."',
    ];

    for (const selector of loadingSelectors) {
      const loadingElement = this.page.locator(selector);
      if (await this.isVisible(loadingElement)) {
        await loadingElement.waitFor({ state: 'hidden', timeout: 30000 });
      }
    }
  }

  /**
   * Common form submission pattern
   */
  async submitForm(formLocator?: Locator) {
    const form = formLocator || this.page.locator('form').first();
    await this.clickElement(form.locator('button[type="submit"]'));
    await this.waitForLoading();
  }

  /**
   * Handle modal dialogs
   */
  async handleModal(action: 'accept' | 'cancel' = 'accept') {
    const modal = this.page.locator('.modal, .dialog, [role="dialog"]').first();
    
    if (await this.isVisible(modal)) {
      const button = action === 'accept' 
        ? modal.locator('button:has-text("OK"), button:has-text("Confirm"), button:has-text("Yes")')
        : modal.locator('button:has-text("Cancel"), button:has-text("No")');
      
      await this.clickElement(button);
      await modal.waitFor({ state: 'hidden' });
    }
  }

  /**
   * Get current URL
   */
  getCurrentUrl(): string {
    return this.page.url();
  }

  /**
   * Reload page and wait for load
   */
  async reload() {
    await this.page.reload();
    await this.waitForPageLoad();
  }
}
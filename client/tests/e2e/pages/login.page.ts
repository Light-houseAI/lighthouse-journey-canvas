/**
 * Login Page Object
 *
 * Handles authentication workflows:
 * 1. User login and registration
 * 2. Password validation
 * 3. Authentication state verification
 * 4. Error handling for auth failures
 */

import { type Page, type Locator, expect } from '@playwright/test';
import { BasePage } from './base.page.js';

export class LoginPage extends BasePage {
  // Locators
  private readonly emailInput: Locator;
  private readonly passwordInput: Locator;
  private readonly loginButton: Locator;
  private readonly registerButton: Locator;
  private readonly registerLink: Locator;
  private readonly loginLink: Locator;
  private readonly errorMessage: Locator;
  private readonly successMessage: Locator;
  private readonly forgotPasswordLink: Locator;
  private readonly interestSelect: Locator;

  constructor(page: Page) {
    super(page);
    
    // Initialize locators
    this.emailInput = page.locator('input[type="email"], input[name="email"]');
    this.passwordInput = page.locator('input[type="password"], input[name="password"]');
    this.loginButton = page.locator('button[type="submit"]:has-text("Login"), button:has-text("Sign In")');
    this.registerButton = page.locator('button[type="submit"]:has-text("Register"), button:has-text("Sign Up")');
    this.registerLink = page.locator('a:has-text("Register"), a:has-text("Sign Up"), a:has-text("Create Account")');
    this.loginLink = page.locator('a:has-text("Login"), a:has-text("Sign In")');
    this.errorMessage = page.locator('.error-message, .alert-error, [data-testid="error-message"]');
    this.successMessage = page.locator('.success-message, .alert-success, [data-testid="success-message"]');
    this.forgotPasswordLink = page.locator('a:has-text("Forgot Password")');
    this.interestSelect = page.locator('select[name="interest"], [data-testid="interest-select"]');
  }

  /**
   * Navigate to login page
   */
  async navigateToLogin() {
    await this.goto('/login');
    await this.waitForElement(this.emailInput);
  }

  /**
   * Navigate to register page
   */
  async navigateToRegister() {
    await this.goto('/register');
    await this.waitForElement(this.emailInput);
  }

  /**
   * Switch from login to register form
   */
  async switchToRegister() {
    if (await this.isVisible(this.registerLink)) {
      await this.clickElement(this.registerLink);
      await this.waitForElement(this.registerButton);
    }
  }

  /**
   * Switch from register to login form
   */
  async switchToLogin() {
    if (await this.isVisible(this.loginLink)) {
      await this.clickElement(this.loginLink);
      await this.waitForElement(this.loginButton);
    }
  }

  /**
   * Perform user login
   */
  async login(email: string, password: string) {
    await this.fillInput(this.emailInput, email);
    await this.fillInput(this.passwordInput, password);
    await this.clickElement(this.loginButton);
    
    // Wait for navigation or error
    try {
      await this.waitForNavigation(/\/dashboard|\/timeline/);
      await this.waitForLoading();
      return { success: true };
    } catch (error) {
      // Check for error message
      if (await this.isVisible(this.errorMessage)) {
        const errorText = await this.getTextContent(this.errorMessage);
        return { success: false, error: errorText };
      }
      throw error;
    }
  }

  /**
   * Perform user registration
   */
  async register(email: string, password: string, interest = 'Technology') {
    await this.fillInput(this.emailInput, email);
    await this.fillInput(this.passwordInput, password);
    
    // Select interest if field is available
    if (await this.isVisible(this.interestSelect)) {
      await this.selectOption(this.interestSelect, interest);
    }
    
    await this.clickElement(this.registerButton);
    
    // Wait for navigation or error
    try {
      await this.waitForNavigation(/\/dashboard|\/timeline|\/onboarding/);
      await this.waitForLoading();
      return { success: true };
    } catch (error) {
      // Check for error message
      if (await this.isVisible(this.errorMessage)) {
        const errorText = await this.getTextContent(this.errorMessage);
        return { success: false, error: errorText };
      }
      throw error;
    }
  }

  /**
   * Quick authentication for tests
   */
  async quickAuth(credentials?: { email: string; password: string }) {
    const testCredentials = credentials || {
      email: `test.${Date.now()}@example.com`,
      password: 'TestPassword123!'
    };

    // Try to register first (in case user doesn't exist)
    await this.navigateToRegister();
    const registerResult = await this.register(testCredentials.email, testCredentials.password);
    
    if (!registerResult.success && registerResult.error?.includes('already exists')) {
      // User exists, try to login
      await this.navigateToLogin();
      const loginResult = await this.login(testCredentials.email, testCredentials.password);
      
      if (!loginResult.success) {
        throw new Error(`Authentication failed: ${loginResult.error}`);
      }
    } else if (!registerResult.success) {
      throw new Error(`Registration failed: ${registerResult.error}`);
    }

    // Verify authentication succeeded
    const isAuth = await this.isAuthenticated();
    if (!isAuth) {
      throw new Error('Authentication verification failed');
    }

    return testCredentials;
  }

  /**
   * Logout user
   */
  async logout() {
    // Look for logout button/link
    const logoutSelectors = [
      'button:has-text("Logout")',
      'button:has-text("Sign Out")',
      'a:has-text("Logout")',
      '[data-testid="logout-button"]',
      '.user-menu button:has-text("Logout")',
    ];

    for (const selector of logoutSelectors) {
      const logoutElement = this.page.locator(selector);
      if (await this.isVisible(logoutElement)) {
        await this.clickElement(logoutElement);
        
        // Wait for navigation to login page
        await this.waitForNavigation(/\/login|\/$/);
        return { success: true };
      }
    }

    // If no logout button found, try user menu dropdown
    const userMenus = [
      '[data-testid="user-menu"]',
      '.user-avatar',
      '.user-dropdown-trigger',
    ];

    for (const menuSelector of userMenus) {
      const userMenu = this.page.locator(menuSelector);
      if (await this.isVisible(userMenu)) {
        await this.clickElement(userMenu);
        
        // Look for logout in dropdown
        const dropdownLogout = this.page.locator('.dropdown-menu button:has-text("Logout"), .menu-item:has-text("Logout")');
        if (await this.isVisible(dropdownLogout)) {
          await this.clickElement(dropdownLogout);
          await this.waitForNavigation(/\/login|\/$/);
          return { success: true };
        }
      }
    }

    return { success: false, error: 'Logout button not found' };
  }

  /**
   * Verify error message is displayed
   */
  async verifyErrorMessage(expectedMessage?: string) {
    await this.waitForElement(this.errorMessage);
    
    if (expectedMessage) {
      await expect(this.errorMessage).toContainText(expectedMessage);
    }
    
    return await this.getTextContent(this.errorMessage);
  }

  /**
   * Verify success message is displayed
   */
  async verifySuccessMessage(expectedMessage?: string) {
    await this.waitForElement(this.successMessage);
    
    if (expectedMessage) {
      await expect(this.successMessage).toContainText(expectedMessage);
    }
    
    return await this.getTextContent(this.successMessage);
  }

  /**
   * Check password field validation
   */
  async testPasswordValidation() {
    await this.fillInput(this.passwordInput, 'weak');
    
    // Look for validation message
    const validationMessage = this.page.locator('.field-error, .validation-error, input:invalid + .error');
    
    if (await this.isVisible(validationMessage)) {
      return await this.getTextContent(validationMessage);
    }
    
    return null;
  }

  /**
   * Check email field validation
   */
  async testEmailValidation() {
    await this.fillInput(this.emailInput, 'invalid-email');
    
    // Look for validation message
    const validationMessage = this.page.locator('.field-error, .validation-error, input:invalid + .error');
    
    if (await this.isVisible(validationMessage)) {
      return await this.getTextContent(validationMessage);
    }
    
    return null;
  }

  /**
   * Wait for form to be ready
   */
  async waitForFormReady() {
    await this.waitForElement(this.emailInput);
    await this.waitForElement(this.passwordInput);
    await this.waitForLoading();
  }
}
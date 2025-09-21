import { expect,Page } from '@playwright/test';

import { TestUser } from '../test-data';
import { BasePage } from './BasePage';

/**
 * Enterprise Login Page Object
 * Extends BasePage with authentication-specific functionality and enterprise patterns
 */
export class LoginPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  /**
   * Navigate to login page with comprehensive validation
   */
  async navigateToLogin(): Promise<void> {
    // Check if already on a login form
    const isAlreadyOnLogin = await this.isLoginFormVisible();
    
    if (!isAlreadyOnLogin) {
      await this.navigateToLoginPage();
    }

    await this.validatePageLoaded();
  }

  /**
   * Validate login page is properly loaded
   */
  protected async validatePageLoaded(): Promise<void> {
    await this.validatePageState();
    
    // Ensure login form is present and functional
    await this.expectLoginFormReady();
  }

  /**
   * Perform login with comprehensive error handling
   */
  async login(email: string, password: string): Promise<void> {
    await this.retryWithBackoff(async () => {
      await this.fillEmail(email);
      await this.fillPassword(password);
      await this.submitForm();
      
      // Wait for login to process
      await this.waitForLoginResponse();
    });
  }

  /**
   * Login with user object
   */
  async loginWithUser(user: TestUser): Promise<void> {
    await this.login(user.email, user.password);
  }

  /**
   * Check if login form is currently visible
   */
  private async isLoginFormVisible(): Promise<boolean> {
    const loginFormSelectors = [
      'input[type="email"]',
      'input[name="email"]',
      'form[data-testid="login-form"]',
      '[data-testid="email-input"]'
    ];

    for (const selector of loginFormSelectors) {
      try {
        if (await this.page.locator(selector).isVisible({ timeout: 2000 })) {
          return true;
        }
      } catch (error) {
        continue;
      }
    }

    return false;
  }

  /**
   * Navigate to login page using multiple strategies
   */
  private async navigateToLoginPage(): Promise<void> {
    // Try finding login button/link first
    const loginTriggerSelectors = [
      'button:has-text("Sign In")',
      'button:has-text("Login")', 
      'a:has-text("Sign In")',
      'a:has-text("Login")',
      '[data-testid="login-button"]',
      '[data-testid="signin-link"]',
      'nav a[href*="signin"]',
      'nav a[href*="login"]'
    ];
    
    let navigationSuccessful = false;
    
    for (const selector of loginTriggerSelectors) {
      try {
        const element = await this.handleDynamicContent(selector, { timeout: 2000 });
        await this.interactWithReactComponent(selector, 'click');
        await this.waitForStableLoad();
        
        if (await this.isLoginFormVisible()) {
          navigationSuccessful = true;
          break;
        }
      } catch (error) {
        continue;
      }
    }
    
    // If no login button found, try direct navigation
    if (!navigationSuccessful) {
      const loginPaths = ['/signin', '/login', '/auth/login', '/auth/signin'];
      
      for (const path of loginPaths) {
        try {
          await this.navigateTo(path);
          
          if (await this.isLoginFormVisible()) {
            navigationSuccessful = true;
            break;
          }
        } catch (error) {
          continue;
        }
      }
    }

    if (!navigationSuccessful) {
      throw new Error('Could not navigate to login page');
    }
  }

  /**
   * Fill email field with reliability patterns
   */
  async fillEmail(email: string): Promise<void> {
    const emailSelectors = [
      'input[type="email"]',
      'input[name="email"]',
      '[data-testid="email-input"]',
      'input[placeholder*="email" i]',
      'input[aria-label*="email" i]',
      '[data-field="email"] input'
    ];
    
    const emailInput = await this.findElementWithFallback(
      emailSelectors[0],
      emailSelectors.slice(1)
    );

    await this.interactWithReactComponent(emailSelectors[0], 'fill', email);
  }

  /**
   * Fill password field with reliability patterns
   */
  async fillPassword(password: string): Promise<void> {
    const passwordSelectors = [
      'input[type="password"]',
      'input[name="password"]',
      '[data-testid="password-input"]',
      'input[placeholder*="password" i]',
      'input[aria-label*="password" i]',
      '[data-field="password"] input'
    ];
    
    const passwordInput = await this.findElementWithFallback(
      passwordSelectors[0],
      passwordSelectors.slice(1)
    );

    await this.interactWithReactComponent(passwordSelectors[0], 'fill', password);
  }

  /**
   * Submit login form with multiple strategies
   */
  async submitForm(): Promise<void> {
    const submitSelectors = [
      'button[type="submit"]',
      'button:has-text("Sign In")',
      'button:has-text("Login")',
      'button:has-text("Log In")',
      '[data-testid="login-submit"]',
      '[data-testid="signin-submit"]',
      'form button[type="submit"]'
    ];
    
    let submitted = false;
    
    for (const selector of submitSelectors) {
      try {
        const button = await this.handleDynamicContent(selector, { timeout: 2000 });
        await this.interactWithReactComponent(selector, 'click');
        submitted = true;
        break;
      } catch (error) {
        continue;
      }
    }
    
    if (!submitted) {
      // Try pressing Enter as fallback
      await this.page.keyboard.press('Enter');
      console.log('Used Enter key as login submission fallback');
    }
  }

  /**
   * Wait for login response and handle different outcomes
   */
  private async waitForLoginResponse(): Promise<void> {
    // Wait for form submission to process
    await this.page.waitForTimeout(1000);
    
    // Check for various response indicators
    const responseIndicators = [
      // Success indicators
      { type: 'success', selectors: [
        'text=What are you most interested in?', // Onboarding
        'text=Professional Journey',
        'text=Timeline',
        '[data-testid="user-menu"]',
        '[data-testid="timeline"]'
      ]},
      // Error indicators
      { type: 'error', selectors: [
        'text=Invalid',
        'text=Error',
        'text=Failed',
        'text=incorrect',
        '[role="alert"]',
        '.error',
        '.alert-error',
        '[data-testid*="error"]'
      ]},
      // Loading indicators
      { type: 'loading', selectors: [
        '[data-testid*="loading"]',
        '.loading',
        '.spinner',
        'text=Signing in...'
      ]}
    ];

    // Wait for any response indicator with timeout
    let responseDetected = false;
    const maxWaitTime = 10000; // 10 seconds
    const startTime = Date.now();

    while (!responseDetected && (Date.now() - startTime) < maxWaitTime) {
      for (const indicator of responseIndicators) {
        for (const selector of indicator.selectors) {
          try {
            if (await this.page.locator(selector).isVisible({ timeout: 1000 })) {
              console.log(`Login response detected: ${indicator.type} - ${selector}`);
              responseDetected = true;
              
              if (indicator.type === 'loading') {
                // Wait for loading to complete
                await this.waitForLoadingComplete();
              }
              
              return;
            }
          } catch (error) {
            // Continue checking other indicators
          }
        }
      }
      
      await this.page.waitForTimeout(500);
    }

    if (!responseDetected) {
      console.warn('No clear login response detected within timeout period');
    }
  }

  /**
   * Wait for loading states to complete
   */
  private async waitForLoadingComplete(): Promise<void> {
    const loadingSelectors = [
      '[data-testid*="loading"]',
      '.loading',
      '.spinner', 
      'text=Signing in...',
      'text=Loading...'
    ];

    for (const selector of loadingSelectors) {
      try {
        await expect(this.page.locator(selector)).not.toBeVisible({ timeout: 10000 });
      } catch (error) {
        // Loading indicator might not be present
      }
    }
  }

  /**
   * Expect login error with comprehensive validation
   */
  async expectLoginError(errorText?: string): Promise<void> {
    if (errorText) {
      // Check for specific error text
      const specificErrorSelectors = [
        `text=${errorText}`,
        `[data-testid*="error"]:has-text("${errorText}")`,
        `[role="alert"]:has-text("${errorText}")`
      ];

      let errorFound = false;
      for (const selector of specificErrorSelectors) {
        try {
          await expect(this.page.locator(selector)).toBeVisible({ timeout: 5000 });
          errorFound = true;
          break;
        } catch (error) {
          continue;
        }
      }

      if (!errorFound) {
        throw new Error(`Specific login error '${errorText}' not found`);
      }
    } else {
      // Check for any error indicator
      const errorSelectors = [
        'text=Invalid',
        'text=Error',
        'text=Failed',
        'text=incorrect',
        'text=wrong',
        '[role="alert"]',
        '.error',
        '.alert-error',
        '[data-testid*="error"]',
        '[aria-live="assertive"]'
      ];
      
      let errorFound = false;
      for (const selector of errorSelectors) {
        try {
          const element = await this.handleDynamicContent(selector, { timeout: 3000 });
          await expect(element).toBeVisible();
          errorFound = true;
          break;
        } catch (error) {
          continue;
        }
      }
      
      if (!errorFound) {
        throw new Error('No login error indicators found');
      }
    }
  }

  /**
   * Expect successful login with comprehensive validation
   */
  async expectSuccessfulLogin(): Promise<void> {
    // Wait for authentication state to update
    await this.page.waitForTimeout(2000);
    
    // Check for authenticated app content indicators
    const successIndicators = [
      // Onboarding indicators (for new users)
      'text=What are you most interested in?',
      'text=This helps us tailor your experience',
      'text=Step 1 of 2',
      
      // Timeline indicators (for existing users)
      'text=Professional Journey',
      'text=Timeline',
      '[data-testid="timeline"]',
      '[data-testid="hierarchical-timeline"]',
      
      // General app indicators
      '[data-testid="user-menu"]',
      'text=Add Experience',
      '[data-testid="floating-action-button"]',
      
      // Navigation indicators
      'nav[data-testid*="main"]',
      '[data-testid*="authenticated"]'
    ];
    
    let successFound = false;
    
    for (const indicator of successIndicators) {
      try {
        const element = await this.handleDynamicContent(indicator, { timeout: 5000 });
        await expect(element).toBeVisible();
        successFound = true;
        console.log(`✅ Login success confirmed by: ${indicator}`);
        break;
      } catch (error) {
        continue;
      }
    }
    
    if (!successFound) {
      await this.captureContextOnError(new Error('Login success validation failed'));
      throw new Error('No success indicators found after login attempt');
    }

    // Additional validation: ensure we're not still on login page
    const stillOnLogin = await this.isLoginFormVisible();
    if (stillOnLogin) {
      throw new Error('Still on login page after successful login attempt');
    }
  }

  /**
   * Expect login form is ready for interaction
   */
  private async expectLoginFormReady(): Promise<void> {
    // Validate email field
    const emailField = await this.findElementWithFallback(
      'input[type="email"]',
      ['input[name="email"]', '[data-testid="email-input"]']
    );

    // Validate password field
    const passwordField = await this.findElementWithFallback(
      'input[type="password"]',
      ['input[name="password"]', '[data-testid="password-input"]']
    );

    // Validate submit button
    const submitButton = await this.findElementWithFallback(
      'button[type="submit"]',
      ['button:has-text("Sign In")', 'button:has-text("Login")']
    );

    // Ensure all elements are actionable
    await expect(emailField).toBeVisible();
    await expect(emailField).toBeEnabled();
    await expect(passwordField).toBeVisible();
    await expect(passwordField).toBeEnabled();
    await expect(submitButton).toBeVisible();
    await expect(submitButton).toBeEnabled();
  }

  /**
   * Perform logout if logout functionality exists
   */
  async logout(): Promise<void> {
    const logoutSelectors = [
      '[data-testid="logout-button"]',
      'button:has-text("Logout")',
      'button:has-text("Sign Out")',
      '[data-testid="user-menu"] >> text=Logout',
      '[data-testid="user-menu"] >> text=Sign Out'
    ];

    // First try to find user menu to expand it
    const userMenuSelectors = [
      '[data-testid="user-menu"]',
      '[data-testid="profile-menu"]',
      '.user-menu',
      '[aria-label*="user" i]'
    ];

    for (const menuSelector of userMenuSelectors) {
      try {
        const menu = await this.handleDynamicContent(menuSelector, { timeout: 2000 });
        await this.interactWithReactComponent(menuSelector, 'click');
        await this.page.waitForTimeout(500);
        break;
      } catch (error) {
        continue;
      }
    }

    // Now look for logout option
    let loggedOut = false;
    
    for (const selector of logoutSelectors) {
      try {
        const logoutElement = await this.handleDynamicContent(selector, { timeout: 2000 });
        await this.interactWithReactComponent(selector, 'click');
        
        // Wait for logout to complete
        await this.page.waitForTimeout(2000);
        
        // Validate we're back to unauthenticated state
        const backToLogin = await this.isLoginFormVisible();
        if (backToLogin) {
          loggedOut = true;
          break;
        }
      } catch (error) {
        continue;
      }
    }

    if (!loggedOut) {
      console.warn('Logout functionality not found or failed');
    }
  }

  /**
   * Handle password reset flow
   */
  async resetPassword(email: string): Promise<void> {
    // Look for forgot password link
    const forgotPasswordSelectors = [
      'a:has-text("Forgot password")',
      'a:has-text("Reset password")',
      '[data-testid="forgot-password"]',
      'button:has-text("Forgot")'
    ];

    const forgotLink = await this.findElementWithFallback(
      forgotPasswordSelectors[0],
      forgotPasswordSelectors.slice(1)
    );

    await this.interactWithReactComponent(forgotPasswordSelectors[0], 'click');

    // Wait for reset form
    await this.page.waitForTimeout(1000);

    // Fill email for reset
    await this.fillEmail(email);

    // Submit reset request
    const resetSubmitSelectors = [
      'button:has-text("Send reset")',
      'button:has-text("Reset")',
      'button[type="submit"]'
    ];

    const resetSubmit = await this.findElementWithFallback(
      resetSubmitSelectors[0],
      resetSubmitSelectors.slice(1)
    );

    await this.interactWithReactComponent(resetSubmitSelectors[0], 'click');

    // Wait for confirmation
    await this.page.waitForTimeout(2000);
  }

  /**
   * Validate user is authenticated (for test setup)
   */
  async expectUserAuthenticated(): Promise<void> {
    await this.expectSuccessfulLogin();
  }

  /**
   * Validate user is not authenticated (for test teardown)
   */
  async expectUserNotAuthenticated(): Promise<void> {
    const unauthenticatedIndicators = [
      'input[type="email"]',
      'input[name="email"]', 
      'text=Sign In',
      'text=Login',
      '[data-testid="login-form"]'
    ];

    let unauthenticated = false;
    
    for (const indicator of unauthenticatedIndicators) {
      try {
        const element = await this.handleDynamicContent(indicator, { timeout: 3000 });
        await expect(element).toBeVisible();
        unauthenticated = true;
        break;
      } catch (error) {
        continue;
      }
    }

    if (!unauthenticated) {
      throw new Error('User appears to still be authenticated');
    }
  }
}
import { Page, Locator, expect, TestInfo } from '@playwright/test';

/**
 * Enterprise Base Page Object with Modern Reliability Patterns
 * 
 * Provides core infrastructure for all page objects including:
 * - Dynamic React component handling
 * - Retry mechanisms with exponential backoff
 * - Comprehensive error handling and context capture
 * - Performance optimization patterns
 * - Component stability validation
 */
export abstract class BasePage {
  protected readonly DEFAULT_TIMEOUT = 10000;
  protected readonly RETRY_ATTEMPTS = 3;
  protected readonly STABILITY_CHECK_DURATION = 500;

  constructor(protected page: Page) {}

  /**
   * Wait for page to reach stable state after dynamic content loads
   * Essential for React applications with async state updates
   */
  protected async waitForStableLoad(timeout = this.DEFAULT_TIMEOUT): Promise<void> {
    await this.page.waitForLoadState('networkidle', { timeout });
    
    // Additional stability check for React hydration
    await this.waitForReactHydration();
    
    // Wait for any loading indicators to disappear
    await this.waitForLoadingComplete();
  }

  /**
   * Handle dynamic React components with stability validation
   * Ensures component is both present and stable before interaction
   */
  protected async handleDynamicContent(
    selector: string, 
    options?: { timeout?: number; stable?: boolean }
  ): Promise<Locator> {
    const { timeout = this.DEFAULT_TIMEOUT, stable = true } = options || {};
    
    const element = this.page.locator(selector);
    
    // Wait for element to be present
    await expect(element).toBeVisible({ timeout });
    
    if (stable) {
      // Ensure element is stable (not changing)
      await this.waitForElementStability(element);
    }
    
    return element;
  }

  /**
   * Retry operation with exponential backoff
   * Provides resilient execution for flaky operations
   */
  protected async retryWithBackoff<T>(
    operation: () => Promise<T>,
    options?: {
      maxAttempts?: number;
      initialDelay?: number;
      backoffFactor?: number;
      retryCondition?: (error: Error) => boolean;
    }
  ): Promise<T> {
    const {
      maxAttempts = this.RETRY_ATTEMPTS,
      initialDelay = 1000,
      backoffFactor = 2,
      retryCondition = (error: Error) => !error.message.includes('non-retryable')
    } = options || {};

    let lastError: Error;
    let delay = initialDelay;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === maxAttempts || !retryCondition(lastError)) {
          await this.captureContextOnError(lastError, `Final attempt ${attempt}`);
          throw lastError;
        }

        console.log(`Attempt ${attempt} failed, retrying in ${delay}ms: ${lastError.message}`);
        await this.page.waitForTimeout(delay);
        delay *= backoffFactor;
      }
    }

    throw lastError!;
  }

  /**
   * Capture comprehensive context on error for debugging
   */
  protected async captureContextOnError(error: Error, context?: string): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const contextSuffix = context ? `-${context.replace(/\s+/g, '-')}` : '';
    const baseName = `error-${timestamp}${contextSuffix}`;

    try {
      // Screenshot (protect against closed page)
      try {
        await this.page.screenshot({ 
          path: `test-results/screenshots/${baseName}.png`,
          fullPage: true 
        });
      } catch (screenshotError) {
        console.warn('Could not capture screenshot:', screenshotError.message);
      }

      // Console logs
      const consoleLogs = await Promise.all(
        this.page.context().pages().map(async page => {
          try {
            return await page.evaluate(() => {
              return (window as any).testConsoleHistory || [];
            });
          } catch (error) {
            return [];
          }
        })
      ).then(results => results.flat());

      // Network requests (if available)
      const networkLogs = this.page.context().pages()
        .flatMap(page => (page as any).networkRequests || []);

      // DOM state snapshot
      const domState = await this.captureDOMState();

      const debugInfo = {
        error: {
          message: error.message,
          stack: error.stack,
          name: error.name
        },
        page: {
          url: this.page.url(),
          title: await this.page.title().catch(() => 'Unknown'),
          viewport: this.page.viewportSize()
        },
        context: context || 'No additional context',
        timestamp,
        consoleLogs: consoleLogs,
        networkLogs: networkLogs,
        domState
      };

      // Write debug info to file
      try {
        const fs = await import('fs');
        await fs.promises.writeFile(
          `test-results/debug/${baseName}.json`, 
          JSON.stringify(debugInfo, null, 2)
        );
      } catch (writeError) {
        console.log('Could not write debug file:', writeError.message);
      }

    } catch (captureError) {
      console.warn('Failed to capture error context:', captureError);
    }
  }

  /**
   * Validate current page state before proceeding with operations
   */
  protected async validatePageState(): Promise<void> {
    // Check for common error states
    const errorIndicators = [
      'text=Error',
      'text=404',
      'text=500',
      'text=Something went wrong',
      '[data-testid*="error"]',
      '.error-boundary'
    ];

    for (const indicator of errorIndicators) {
      if (await this.page.locator(indicator).isVisible({ timeout: 1000 })) {
        throw new Error(`Page in error state: ${indicator} is visible`);
      }
    }

    // Verify page is interactive
    await expect(this.page.locator('body')).toBeVisible();
  }

  /**
   * Wait for specific React component to be ready
   * Uses data-testid or component-specific indicators
   */
  protected async waitForComponent(
    componentName: string,
    options?: { timeout?: number; state?: 'visible' | 'attached' | 'stable' }
  ): Promise<Locator> {
    const { timeout = this.DEFAULT_TIMEOUT, state = 'stable' } = options || {};
    
    // Try multiple selector strategies
    const selectors = [
      `[data-testid="${componentName}"]`,
      `[data-component="${componentName}"]`,
      `[data-testid*="${componentName}"]`,
      `.${componentName.toLowerCase()}`,
      `[class*="${componentName}"]`
    ];

    let component: Locator | null = null;

    for (const selector of selectors) {
      try {
        const element = this.page.locator(selector);
        await expect(element).toBeVisible({ timeout: 2000 });
        component = element;
        break;
      } catch (error) {
        // Continue to next selector
        continue;
      }
    }

    if (!component) {
      throw new Error(`Component '${componentName}' not found with any selector strategy`);
    }

    if (state === 'stable') {
      await this.waitForElementStability(component);
    }

    return component;
  }

  /**
   * Interact with React component using safe patterns
   * Handles common React-specific interaction patterns
   */
  protected async interactWithReactComponent(
    selector: string, 
    interaction: 'click' | 'fill' | 'select',
    value?: string,
    options?: { force?: boolean; timeout?: number }
  ): Promise<void> {
    const element = await this.handleDynamicContent(selector, options);
    
    // Wait for element to be actionable
    await this.waitForActionable(element);

    switch (interaction) {
      case 'click':
        await this.retryWithBackoff(async () => {
          await element.click({ force: options?.force });
          await this.page.waitForTimeout(100); // Brief pause for React state updates
        });
        break;
      
      case 'fill':
        if (!value) throw new Error('Value required for fill interaction');
        await this.retryWithBackoff(async () => {
          await element.clear();
          await element.fill(value);
          // Trigger React onChange by blurring and focusing
          await element.blur();
          await element.focus();
        });
        break;
      
      case 'select':
        if (!value) throw new Error('Value required for select interaction');
        await this.retryWithBackoff(async () => {
          await element.selectOption(value);
        });
        break;
      
      default:
        throw new Error(`Unsupported interaction type: ${interaction}`);
    }
  }

  /**
   * Wait for React hydration to complete
   */
  private async waitForReactHydration(): Promise<void> {
    try {
      await this.page.waitForFunction(
        () => {
          // Check for React DevTools or common React indicators
          return !!(window as any).React || 
                 !!(window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__ ||
                 document.querySelector('[data-reactroot]') ||
                 document.querySelector('div[id="root"]')?.children.length > 0;
        },
        { timeout: 5000 }
      );
    } catch (error) {
      // React hydration check is optional
      console.warn('React hydration check failed, continuing:', error.message);
    }
  }

  /**
   * Wait for all loading indicators to disappear
   */
  private async waitForLoadingComplete(): Promise<void> {
    const loadingSelectors = [
      '[data-testid*="loading"]',
      '[data-testid*="spinner"]',
      '.loading',
      '.spinner',
      'text=Loading...',
      '[aria-label*="loading" i]'
    ];

    for (const selector of loadingSelectors) {
      try {
        await expect(this.page.locator(selector)).not.toBeVisible({ timeout: 3000 });
      } catch (error) {
        // Continue checking other loading indicators
      }
    }
  }

  /**
   * Wait for element to be stable (not changing position/size)
   */
  private async waitForElementStability(element: Locator): Promise<void> {
    let previousBoundingBox: any = null;
    const maxStabilityChecks = 5;
    
    for (let i = 0; i < maxStabilityChecks; i++) {
      try {
        const currentBoundingBox = await element.boundingBox();
        
        if (previousBoundingBox && currentBoundingBox) {
          const isStable = 
            Math.abs(currentBoundingBox.x - previousBoundingBox.x) < 1 &&
            Math.abs(currentBoundingBox.y - previousBoundingBox.y) < 1 &&
            Math.abs(currentBoundingBox.width - previousBoundingBox.width) < 1 &&
            Math.abs(currentBoundingBox.height - previousBoundingBox.height) < 1;
            
          if (isStable) {
            return; // Element is stable
          }
        }
        
        previousBoundingBox = currentBoundingBox;
        await this.page.waitForTimeout(this.STABILITY_CHECK_DURATION);
        
      } catch (error) {
        // Element might not be visible, break and continue
        break;
      }
    }
  }

  /**
   * Wait for element to be actionable (visible, enabled, stable)
   */
  private async waitForActionable(element: Locator): Promise<void> {
    await expect(element).toBeVisible();
    await expect(element).toBeEnabled();
    await this.waitForElementStability(element);
  }

  /**
   * Capture current DOM state for debugging
   */
  private async captureDOMState(): Promise<any> {
    try {
      return await this.page.evaluate(() => {
        const captureElement = (el: Element, maxDepth = 3, currentDepth = 0): any => {
          if (currentDepth >= maxDepth) return { tag: el.tagName, truncated: true };
          
          return {
            tag: el.tagName,
            id: el.id || undefined,
            className: el.className || undefined,
            textContent: el.textContent?.substring(0, 100) || undefined,
            attributes: Array.from(el.attributes).reduce((acc, attr) => {
              acc[attr.name] = attr.value;
              return acc;
            }, {} as Record<string, string>),
            children: Array.from(el.children)
              .slice(0, 5) // Limit children to prevent huge dumps
              .map(child => captureElement(child, maxDepth, currentDepth + 1))
          };
        };
        
        return {
          url: window.location.href,
          title: document.title,
          body: captureElement(document.body),
          errorElements: Array.from(document.querySelectorAll('[data-testid*="error"], .error, [role="alert"]'))
            .map(el => captureElement(el, 2))
        };
      });
    } catch (error) {
      return { error: 'Failed to capture DOM state', message: error.message };
    }
  }

  /**
   * Navigate with comprehensive error handling
   */
  protected async navigateTo(path: string, options?: { waitUntil?: 'load' | 'domcontentloaded' | 'networkidle' }): Promise<void> {
    const { waitUntil = 'networkidle' } = options || {};
    
    await this.retryWithBackoff(async () => {
      await this.page.goto(path, { waitUntil });
      await this.validatePageState();
      await this.waitForStableLoad();
    });
  }

  /**
   * Find element with fallback strategies
   * Tries multiple selector patterns commonly used in the app
   */
  protected async findElementWithFallback(
    primarySelector: string,
    fallbackSelectors: string[],
    options?: { timeout?: number }
  ): Promise<Locator> {
    const { timeout = this.DEFAULT_TIMEOUT } = options || {};
    
    // Try primary selector first
    try {
      const element = this.page.locator(primarySelector);
      await expect(element).toBeVisible({ timeout: 2000 });
      return element;
    } catch (error) {
      // Continue to fallback selectors
    }

    // Try fallback selectors
    for (const selector of fallbackSelectors) {
      try {
        const element = this.page.locator(selector);
        await expect(element).toBeVisible({ timeout: 2000 });
        console.log(`Found element using fallback selector: ${selector}`);
        return element;
      } catch (error) {
        // Continue to next fallback
      }
    }

    throw new Error(`Element not found with primary selector '${primarySelector}' or any fallback selectors`);
  }

  /**
   * Wait for and handle React modal dialogs
   */
  protected async waitForModal(options?: { timeout?: number; modalTestId?: string }): Promise<Locator> {
    const { timeout = this.DEFAULT_TIMEOUT, modalTestId } = options || {};
    
    const modalSelectors = modalTestId 
      ? [`[data-testid="${modalTestId}"]`]
      : [
          '[role="dialog"]',
          '[data-testid*="modal"]',
          '[data-testid*="dialog"]',
          '.modal',
          '.dialog',
          '[aria-modal="true"]'
        ];

    return await this.findElementWithFallback(modalSelectors[0], modalSelectors.slice(1), { timeout });
  }

  /**
   * Close modal dialog with multiple strategies
   */
  protected async closeModal(modal?: Locator): Promise<void> {
    // If no modal provided, find it first
    if (!modal) {
      try {
        modal = await this.waitForModal({ timeout: 2000 });
      } catch (error) {
        // No modal found, nothing to close
        return;
      }
    }

    const closeStrategies = [
      // Close button strategies
      () => modal!.locator('[data-testid="close-button"]').click(),
      () => modal!.locator('[aria-label*="close" i]').click(),
      () => modal!.locator('button:has-text("Close")').click(),
      () => modal!.locator('button:has-text("Cancel")').click(),
      () => modal!.locator('.close-button, .modal-close').click(),
      
      // Keyboard strategies
      () => this.page.keyboard.press('Escape'),
      
      // Click outside strategies (if modal allows)
      () => this.page.click('body', { position: { x: 10, y: 10 } })
    ];

    for (const strategy of closeStrategies) {
      try {
        await strategy();
        
        // Wait for modal to disappear
        await expect(modal).not.toBeVisible({ timeout: 3000 });
        return; // Successfully closed
        
      } catch (error) {
        // Try next strategy
        continue;
      }
    }

    throw new Error('Failed to close modal with any strategy');
  }

  /**
   * Abstract method for page-specific validation
   * Must be implemented by concrete page classes
   */
  protected abstract validatePageLoaded(): Promise<void>;
}
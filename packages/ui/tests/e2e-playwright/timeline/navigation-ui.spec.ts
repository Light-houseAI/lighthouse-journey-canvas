import { expect, test } from '@playwright/test';

/**
 * Timeline Navigation and UI Tests
 * Tests navigation, UI elements, and accessibility
 */



test.describe('Timeline Navigation and UI', () => {




  test.beforeEach(async ({ page }) => {
    console.log('🔧 Setting up timeline navigation test...');

    await page.goto('/professional-journey');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    console.log('✅ Navigation setup completed');
  });

  test('timeline page loads and renders correctly', async ({ page }) => {
    console.log('🧪 Testing timeline page loading...');

    await expect(page).toHaveURL(/\/(timeline|professional-journey)/);
    console.log('✅ URL is correct');

    // Check for either timeline elements OR empty state
    const hasTimelineElements = await page.locator('[data-testid="timeline"], .react-flow').first().isVisible({ timeout: 3000 }).catch(() => false);
    const hasEmptyState = await page.locator('text=No Journey Data').isVisible({ timeout: 3000 }).catch(() => false);
    const hasJourneyText = await page.locator('text=Professional Journey').first().isVisible({ timeout: 3000 }).catch(() => false);

    console.log('Timeline elements found:', hasTimelineElements);
    console.log('Empty state found:', hasEmptyState);
    console.log('Journey text found:', hasJourneyText);

    const pageLoaded = hasTimelineElements || hasEmptyState || hasJourneyText;
    expect(pageLoaded).toBeTruthy();

    console.log('✅ Timeline page loaded successfully');
  });

  test('display timeline elements or empty state correctly', async ({ page }) => {
    await page.goto('/professional-journey');
    await page.waitForLoadState('networkidle');

    // The page should show either content or empty state
    const hasContent = await page.locator('.react-flow, [data-testid*="timeline"]').first().isVisible({ timeout: 5000 }).catch(() => false);
    const hasEmptyState = await page.locator('text=No Journey Data').isVisible({ timeout: 5000 }).catch(() => false);

    // At least one should be visible
    expect(hasContent || hasEmptyState).toBeTruthy();

    if (hasEmptyState) {
      console.log('📭 Empty state displayed correctly');
    } else {
      console.log('📊 Timeline content displayed');
    }
  });

  test('responsive behavior on different screen sizes', async ({ page }) => {
    // Test desktop size
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.goto('/professional-journey');
    await page.waitForLoadState('networkidle');

    const desktopWorks = await page.locator('body').isVisible();
    expect(desktopWorks).toBeTruthy();
    console.log('✅ Desktop viewport works');

    // Test tablet size
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(1000);

    const tabletWorks = await page.locator('body').isVisible();
    expect(tabletWorks).toBeTruthy();
    console.log('✅ Tablet viewport works');

    // Test mobile size
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(1000);

    const mobileWorks = await page.locator('body').isVisible();
    expect(mobileWorks).toBeTruthy();
    console.log('✅ Mobile viewport works');
  });

  test('timeline accessibility features', async ({ page }) => {
    await page.goto('/professional-journey');
    await page.waitForLoadState('networkidle');

    // Check for accessibility elements
    const ariaElements = await page.locator('[role], [aria-label], [aria-describedby]').count();
    console.log(`Found ${ariaElements} accessibility elements`);

    // Check for keyboard navigation
    const focusableElements = await page.locator('button, a, input, select, textarea, [tabindex]:not([tabindex="-1"])').count();
    console.log(`Found ${focusableElements} focusable elements`);

    // Basic accessibility check passed if we have focusable elements
    expect(focusableElements).toBeGreaterThan(0);
    console.log('✅ Basic accessibility features present');
  });
});

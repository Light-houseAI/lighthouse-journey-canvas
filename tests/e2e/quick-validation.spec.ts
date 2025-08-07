import { test, expect } from '@playwright/test';

test.describe('Quick Validation Test', () => {
  test('should load timeline page and verify basic functionality', async ({ page }) => {
    // Navigate to the timeline with longer timeout
    await page.goto('http://localhost:5004/professional-journey', { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });
    
    // Take a screenshot to see what we're dealing with
    await page.screenshot({ path: 'timeline-loaded.png', fullPage: true });
    
    // Check if we have timeline or any React components loaded
    const body = page.locator('body');
    await expect(body).toContainText(['Timeline', 'Journey', 'Professional', 'Loading'], { timeout: 10000 });
    
    console.log('✅ Page loaded successfully');
    
    // Look for plus buttons or node creation elements
    const plusButtons = page.locator('[data-testid*="plus"], [data-testid*="add"], .react-flow__edge');
    const count = await plusButtons.count();
    console.log(`Found ${count} potential interaction elements`);
    
    if (count > 0) {
      await plusButtons.first().hover();
      await page.waitForTimeout(1000);
      
      // Look for node type selector or modals
      const modals = page.locator('[data-testid*="modal"], [class*="modal"]');
      const modalCount = await modals.count();
      console.log(`Found ${modalCount} modal elements`);
    }
    
    // Final screenshot
    await page.screenshot({ path: 'timeline-final.png', fullPage: true });
  });
});
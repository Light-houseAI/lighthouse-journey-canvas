import { test as setup, expect } from '@playwright/test';

const authFile = 'playwright/.auth/user.json';

setup('authenticate', async ({ page }) => {
  // Navigate to the login page
  await page.goto('/');
  
  // Check if we're already on a login form or need to navigate to login
  const isAlreadyOnLogin = await page.locator('input[type="email"], input[name="email"]').isVisible();
  
  if (!isAlreadyOnLogin) {
    // Look for a login/signin button to click
    const loginButton = page.locator('button:has-text("Sign In"), button:has-text("Login"), a:has-text("Sign In"), a:has-text("Login")');
    if (await loginButton.isVisible()) {
      await loginButton.click();
    } else {
      // If no obvious login button, try navigating to /login
      await page.goto('/login');
    }
  }

  // Fill in the login form
  await page.getByLabel('Email', { exact: false }).fill(process.env.TEST_USER_NAME || 'test@example.com');
  await page.getByLabel('Password', { exact: false }).fill(process.env.TEST_PASSWORD || 'password123');
  
  // Submit the form
  const submitButton = page.locator('button[type="submit"], button:has-text("Sign In"), button:has-text("Login")');
  await submitButton.click();
  
  // Wait for successful login - look for indicators that we're logged in
  await page.waitForURL(/\/(dashboard|timeline|home|$)/, { timeout: 10000 });
  
  // Additional check - look for user-specific content
  await expect(page.locator('text=Professional Journey, text=Timeline, text=Dashboard')).toBeVisible({ timeout: 10000 });
  
  // Save authentication state
  await page.context().storageState({ path: authFile });
});

// Additional setup for different user roles if needed
setup('authenticate as admin', async ({ page }) => {
  // If you have admin test credentials, you can set them up here
  // For now, using the same credentials
  await page.goto('/');
  
  const isAlreadyOnLogin = await page.locator('input[type="email"], input[name="email"]').isVisible();
  
  if (!isAlreadyOnLogin) {
    const loginButton = page.locator('button:has-text("Sign In"), button:has-text("Login")');
    if (await loginButton.isVisible()) {
      await loginButton.click();
    }
  }

  // Use admin credentials if available, fallback to regular test credentials
  await page.getByLabel('Email', { exact: false }).fill(process.env.TEST_ADMIN_EMAIL || process.env.TEST_USER_NAME || 'admin@example.com');
  await page.getByLabel('Password', { exact: false }).fill(process.env.TEST_ADMIN_PASSWORD || process.env.TEST_PASSWORD || 'adminpass');
  
  const submitButton = page.locator('button[type="submit"], button:has-text("Sign In"), button:has-text("Login")');
  await submitButton.click();
  
  await page.waitForURL(/\/(dashboard|timeline|home|admin|$)/, { timeout: 10000 });
  await expect(page.locator('text=Professional Journey, text=Timeline, text=Dashboard, text=Admin')).toBeVisible({ timeout: 10000 });
  
  await page.context().storageState({ path: 'playwright/.auth/admin.json' });
});
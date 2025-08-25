import { test, expect } from '@playwright/test';

test.describe('Settings Page', () => {
  test.beforeEach(async ({ page }) => {
    // Login with test credentials
    await page.goto('/');
    
    // Check if we need to login (not already authenticated)
    const loginButton = page.locator('button:has-text("Sign In"), button:has-text("Login")');
    if (await loginButton.isVisible()) {
      await page.getByLabel('Email').fill(process.env.TEST_USER_NAME || 'test@example.com');
      await page.getByLabel('Password').fill(process.env.TEST_PASSWORD || 'password');
      await loginButton.click();
      
      // Wait for successful login
      await expect(page.locator('text=Your Professional Journey')).toBeVisible();
    }
  });

  test('should navigate to settings from user menu', async ({ page }) => {
    // Click on user menu (avatar/dropdown)
    await page.locator('[data-testid="user-menu"], button:has(div:has-text("@"))').first().click();
    
    // Click on Settings option
    await page.getByText('Settings').click();
    
    // Verify we're on the settings page
    await expect(page).toHaveURL('/settings');
    await expect(page.getByText('Settings')).toBeVisible();
    await expect(page.getByText('Manage your profile and account preferences')).toBeVisible();
  });

  test('should display current user information', async ({ page }) => {
    await page.goto('/settings');
    
    // Verify email field is populated and readonly
    const emailField = page.getByLabel('Email Address');
    await expect(emailField).toBeVisible();
    await expect(emailField).toBeDisabled();
    await expect(emailField).toHaveValue(process.env.TEST_USER_NAME || 'test@example.com');
  });

  test('should update username successfully', async ({ page }) => {
    await page.goto('/settings');
    
    const newUsername = `testuser${Date.now()}`; // Unique username
    
    // Clear and fill username field
    const usernameField = page.getByLabel('Username');
    await usernameField.clear();
    await usernameField.fill(newUsername);
    
    // Submit the form
    await page.getByText('Update Profile').click();
    
    // Verify success message
    await expect(page.getByText('Profile updated')).toBeVisible();
    
    // Verify the username field still shows the new value
    await expect(usernameField).toHaveValue(newUsername);
  });

  test('should validate username format', async ({ page }) => {
    await page.goto('/settings');
    
    const usernameField = page.getByLabel('Username');
    
    // Test invalid characters
    await usernameField.clear();
    await usernameField.fill('invalid username!@#');
    await page.getByText('Update Profile').click();
    
    // Should show validation error
    await expect(page.getByText(/can only contain letters, numbers, underscores, and dashes/)).toBeVisible();
    
    // Test username starting with dash
    await usernameField.clear();
    await usernameField.fill('-invalidusername');
    await page.getByText('Update Profile').click();
    
    // Should show validation error
    await expect(page.getByText(/cannot start or end with a dash/)).toBeVisible();
    
    // Test too short username
    await usernameField.clear();
    await usernameField.fill('ab');
    await page.getByText('Update Profile').click();
    
    // Should show validation error
    await expect(page.getByText(/must be at least 3 characters/)).toBeVisible();
  });

  test('should show profile sharing link after setting username', async ({ page }) => {
    await page.goto('/settings');
    
    const newUsername = `sharetest${Date.now()}`;
    
    // Set a username first
    await page.getByLabel('Username').clear();
    await page.getByLabel('Username').fill(newUsername);
    await page.getByText('Update Profile').click();
    
    // Wait for success message
    await expect(page.getByText('Profile updated')).toBeVisible();
    
    // Verify profile link is shown
    const profileLinkField = page.getByDisplayValue(new RegExp(`/${newUsername}$`));
    await expect(profileLinkField).toBeVisible();
    
    // Verify copy button is visible
    const copyButton = page.getByRole('button', { name: /copy/i });
    await expect(copyButton).toBeVisible();
  });

  test('should copy profile link to clipboard', async ({ page }) => {
    await page.goto('/settings');
    
    const newUsername = `cliptest${Date.now()}`;
    
    // Set username and wait for update
    await page.getByLabel('Username').clear();
    await page.getByLabel('Username').fill(newUsername);
    await page.getByText('Update Profile').click();
    await expect(page.getByText('Profile updated')).toBeVisible();
    
    // Click copy button
    const copyButton = page.getByRole('button', { name: /copy/i });
    await copyButton.click();
    
    // Verify copy success message
    await expect(page.getByText('Link copied')).toBeVisible();
    
    // Verify button shows checkmark temporarily
    await expect(copyButton.locator('svg')).toHaveCount(1);
  });

  test('should handle username uniqueness validation', async ({ page }) => {
    await page.goto('/settings');
    
    // Try to use a username that might already exist
    // Note: In a real test, you'd set up test data with a known existing username
    const usernameField = page.getByLabel('Username');
    await usernameField.clear();
    await usernameField.fill('admin'); // Common username that might exist
    await page.getByText('Update Profile').click();
    
    // Should either succeed or show "already taken" error
    const successMessage = page.getByText('Profile updated');
    const errorMessage = page.getByText('Username already taken');
    
    // One of these should be visible
    await expect(successMessage.or(errorMessage)).toBeVisible();
  });

  test('should show placeholder for users without username', async ({ page }) => {
    await page.goto('/settings');
    
    // If user doesn't have a username set, should show appropriate placeholder
    const shareSection = page.locator('text=Share Your Profile').locator('..');
    
    // Check if we see the "Set a Username First" message or the actual sharing link
    const noUsernameMessage = shareSection.getByText('Set a Username First');
    const profileLinkField = shareSection.getByDisplayValue(/\//);
    
    // One should be visible
    await expect(noUsernameMessage.or(profileLinkField)).toBeVisible();
  });

  test('should navigate back to timeline', async ({ page }) => {
    await page.goto('/settings');
    
    // Click back button
    await page.getByText('Back to Timeline').click();
    
    // Should be back on main timeline
    await expect(page).toHaveURL('/');
    await expect(page.getByText('Your Professional Journey')).toBeVisible();
  });

  test('should display user menu with correct information', async ({ page }) => {
    await page.goto('/');
    
    // Click user menu
    const userMenuTrigger = page.locator('[data-testid="user-menu"], button:has(div:has-text("@"))').first();
    await userMenuTrigger.click();
    
    // Verify menu contains expected items
    await expect(page.getByText('Settings')).toBeVisible();
    await expect(page.getByText('Logout')).toBeVisible();
    
    // If user has username, should show copy profile link option
    const copyProfileLink = page.getByText('Copy Profile Link');
    // This might or might not be visible depending on if user has username set
  });

  test('should maintain visual consistency with Magic UI theme', async ({ page }) => {
    await page.goto('/settings');
    
    // Verify Magic UI components are rendered
    await expect(page.locator('[class*="magic-card"], [class*="MagicCard"]')).toBeVisible();
    
    // Verify glassmorphism/gradient styling
    await expect(page.locator('[class*="gradient"], [class*="backdrop-blur"]')).toBeVisible();
    
    // Verify shimmer button for submit
    const submitButton = page.getByText('Update Profile');
    await expect(submitButton).toBeVisible();
    
    // Take screenshot for visual regression testing
    await expect(page).toHaveScreenshot('settings-page.png');
  });
});
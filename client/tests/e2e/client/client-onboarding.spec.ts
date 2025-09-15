/**
 * Playwright E2E Tests - Client Onboarding Flow
 * Tests the complete client onboarding experience
 */

import { test, expect } from '@playwright/test';

test.describe('Client Onboarding Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Start from signup page
    await page.goto('/signup');
  });

  test('should complete full onboarding workflow', async ({ page }) => {
    // Step 1: Registration
    await page.fill('[data-testid="signup-email"]', 'newclient@example.com');
    await page.fill('[data-testid="signup-password"]', 'SecurePassword123!');
    await page.fill('[data-testid="signup-confirm-password"]', 'SecurePassword123!');
    
    await page.click('[data-testid="signup-submit"]');

    // Wait for redirect to onboarding
    await expect(page).toHaveURL(/\/onboarding/);

    // Step 2: Basic Information
    await expect(page.locator('h1')).toContainText('Welcome to Lighthouse');
    
    await page.fill('[data-testid="first-name"]', 'John');
    await page.fill('[data-testid="last-name"]', 'Doe');
    await page.fill('[data-testid="username"]', 'johndoe2024');
    
    // Check username availability
    await expect(page.locator('[data-testid="username-status"]')).toContainText('Available');
    
    await page.click('[data-testid="onboarding-continue"]');

    // Step 3: Interest Selection
    await expect(page.locator('h2')).toContainText('What are you interested in?');
    
    await page.click('[data-testid="interest-software-development"]');
    await page.click('[data-testid="onboarding-continue"]');

    // Step 4: Timeline Setup
    await expect(page.locator('h2')).toContainText('Let\'s build your timeline');
    
    // Add first experience
    await page.click('[data-testid="add-experience"]');
    
    await page.fill('[data-testid="experience-title"]', 'Software Engineer');
    await page.fill('[data-testid="experience-company"]', 'Tech Corp');
    await page.fill('[data-testid="experience-start-date"]', '2023-01-01');
    await page.fill('[data-testid="experience-end-date"]', '2023-12-31');
    await page.fill('[data-testid="experience-description"]', 'Developed React applications and led a small team.');
    
    // Add skills
    await page.fill('[data-testid="skills-input"]', 'React');
    await page.keyboard.press('Enter');
    await page.fill('[data-testid="skills-input"]', 'TypeScript');
    await page.keyboard.press('Enter');
    await page.fill('[data-testid="skills-input"]', 'Node.js');
    await page.keyboard.press('Enter');
    
    await page.click('[data-testid="save-experience"]');

    // Verify experience is added
    await expect(page.locator('[data-testid="timeline-item"]')).toContainText('Software Engineer');
    
    // Add education
    await page.click('[data-testid="add-education"]');
    
    await page.fill('[data-testid="education-title"]', 'Bachelor of Computer Science');
    await page.fill('[data-testid="education-institution"]', 'State University');
    await page.fill('[data-testid="education-start-date"]', '2019-09-01');
    await page.fill('[data-testid="education-end-date"]', '2023-05-01');
    
    await page.click('[data-testid="save-education"]');

    // Complete onboarding
    await page.click('[data-testid="complete-onboarding"]');

    // Should redirect to main timeline
    await expect(page).toHaveURL('/timeline');
    await expect(page.locator('[data-testid="welcome-message"]')).toContainText('Welcome, John!');
    
    // Verify timeline data is displayed
    await expect(page.locator('[data-testid="timeline-item"]')).toHaveCount(2);
  });

  test('should handle username validation', async ({ page }) => {
    // Navigate through initial signup
    await page.fill('[data-testid="signup-email"]', 'test@example.com');
    await page.fill('[data-testid="signup-password"]', 'Password123!');
    await page.fill('[data-testid="signup-confirm-password"]', 'Password123!');
    await page.click('[data-testid="signup-submit"]');

    await page.waitForURL(/\/onboarding/);

    // Fill basic info
    await page.fill('[data-testid="first-name"]', 'Test');
    await page.fill('[data-testid="last-name"]', 'User');
    
    // Try taken username
    await page.fill('[data-testid="username"]', 'admin');
    await expect(page.locator('[data-testid="username-status"]')).toContainText('Not available');
    
    // Try invalid username
    await page.fill('[data-testid="username"]', 'invalid@username');
    await expect(page.locator('[data-testid="username-error"]')).toContainText('Username can only contain letters, numbers, and underscores');
    
    // Use valid username
    await page.fill('[data-testid="username"]', 'validusername123');
    await expect(page.locator('[data-testid="username-status"]')).toContainText('Available');
    
    // Should be able to continue
    await page.click('[data-testid="onboarding-continue"]');
    await expect(page.locator('h2')).toContainText('What are you interested in?');
  });

  test('should allow skipping optional steps', async ({ page }) => {
    // Complete required steps
    await page.fill('[data-testid="signup-email"]', 'skipper@example.com');
    await page.fill('[data-testid="signup-password"]', 'Password123!');
    await page.fill('[data-testid="signup-confirm-password"]', 'Password123!');
    await page.click('[data-testid="signup-submit"]');

    await page.waitForURL(/\/onboarding/);

    await page.fill('[data-testid="first-name"]', 'Skip');
    await page.fill('[data-testid="last-name"]', 'User');
    await page.fill('[data-testid="username"]', 'skipuser');
    await page.click('[data-testid="onboarding-continue"]');

    // Skip interest selection
    await page.click('[data-testid="skip-interests"]');

    // Skip timeline setup
    await page.click('[data-testid="skip-timeline"]');

    // Should redirect to empty timeline
    await expect(page).toHaveURL('/timeline');
    await expect(page.locator('[data-testid="empty-timeline"]')).toBeVisible();
  });

  test('should handle form validation errors', async ({ page }) => {
    // Navigate to onboarding
    await page.fill('[data-testid="signup-email"]', 'validation@example.com');
    await page.fill('[data-testid="signup-password"]', 'Password123!');
    await page.fill('[data-testid="signup-confirm-password"]', 'Password123!');
    await page.click('[data-testid="signup-submit"]');

    await page.waitForURL(/\/onboarding/);

    // Try to continue without filling required fields
    await page.click('[data-testid="onboarding-continue"]');

    // Should show validation errors
    await expect(page.locator('[data-testid="first-name-error"]')).toContainText('First name is required');
    await expect(page.locator('[data-testid="last-name-error"]')).toContainText('Last name is required');
    await expect(page.locator('[data-testid="username-error"]')).toContainText('Username is required');

    // Fill minimum required fields
    await page.fill('[data-testid="first-name"]', 'V');
    await page.fill('[data-testid="last-name"]', 'U');
    await page.fill('[data-testid="username"]', 'vu');

    // Check length validation
    await expect(page.locator('[data-testid="first-name-error"]')).toContainText('First name must be at least 2 characters');
    await expect(page.locator('[data-testid="username-error"]')).toContainText('Username must be at least 3 characters');

    // Fix validation errors
    await page.fill('[data-testid="first-name"]', 'Valid');
    await page.fill('[data-testid="last-name"]', 'User');
    await page.fill('[data-testid="username"]', 'validuser');

    // Should be able to continue
    await page.click('[data-testid="onboarding-continue"]');
    await expect(page.locator('h2')).toContainText('What are you interested in?');
  });

  test('should handle avatar upload during onboarding', async ({ page }) => {
    // Complete basic onboarding steps
    await page.fill('[data-testid="signup-email"]', 'avatar@example.com');
    await page.fill('[data-testid="signup-password"]', 'Password123!');
    await page.fill('[data-testid="signup-confirm-password"]', 'Password123!');
    await page.click('[data-testid="signup-submit"]');

    await page.waitForURL(/\/onboarding/);

    await page.fill('[data-testid="first-name"]', 'Avatar');
    await page.fill('[data-testid="last-name"]', 'User');
    await page.fill('[data-testid="username"]', 'avataruser');

    // Upload avatar
    const fileInput = page.locator('[data-testid="avatar-upload"]');
    await fileInput.setInputFiles('./test-assets/test-avatar.jpg');

    // Wait for upload to complete
    await expect(page.locator('[data-testid="avatar-preview"]')).toBeVisible();
    await expect(page.locator('[data-testid="upload-success"]')).toContainText('Avatar uploaded successfully');

    await page.click('[data-testid="onboarding-continue"]');

    // Continue with rest of onboarding
    await page.click('[data-testid="interest-software-development"]');
    await page.click('[data-testid="onboarding-continue"]');
    await page.click('[data-testid="skip-timeline"]');

    // Verify avatar is displayed in timeline
    await expect(page.locator('[data-testid="user-avatar"]')).toBeVisible();
  });

  test('should save progress and allow resuming onboarding', async ({ page }) => {
    // Start onboarding
    await page.fill('[data-testid="signup-email"]', 'resume@example.com');
    await page.fill('[data-testid="signup-password"]', 'Password123!');
    await page.fill('[data-testid="signup-confirm-password"]', 'Password123!');
    await page.click('[data-testid="signup-submit"]');

    await page.waitForURL(/\/onboarding/);

    // Fill first step partially
    await page.fill('[data-testid="first-name"]', 'Resume');
    await page.fill('[data-testid="last-name"]', 'User');
    await page.fill('[data-testid="username"]', 'resumeuser');

    // Navigate away (simulate browser refresh or leaving)
    await page.goto('/');

    // Should redirect back to onboarding
    await expect(page).toHaveURL(/\/onboarding/);

    // Form should retain values
    await expect(page.locator('[data-testid="first-name"]')).toHaveValue('Resume');
    await expect(page.locator('[data-testid="last-name"]')).toHaveValue('User');
    await expect(page.locator('[data-testid="username"]')).toHaveValue('resumeuser');

    // Complete onboarding
    await page.click('[data-testid="onboarding-continue"]');
    await page.click('[data-testid="interest-software-development"]');
    await page.click('[data-testid="onboarding-continue"]');
    await page.click('[data-testid="skip-timeline"]');

    // Should now be able to access other parts of the app
    await page.goto('/settings');
    await expect(page).toHaveURL('/settings');
  });

  test('should handle network errors gracefully', async ({ page }) => {
    // Mock network failure
    await page.route('**/api/auth/check-username**', route => route.abort());

    await page.fill('[data-testid="signup-email"]', 'network@example.com');
    await page.fill('[data-testid="signup-password"]', 'Password123!');
    await page.fill('[data-testid="signup-confirm-password"]', 'Password123!');
    await page.click('[data-testid="signup-submit"]');

    await page.waitForURL(/\/onboarding/);

    await page.fill('[data-testid="first-name"]', 'Network');
    await page.fill('[data-testid="last-name"]', 'Test');
    await page.fill('[data-testid="username"]', 'networktest');

    // Should show error message for username check
    await expect(page.locator('[data-testid="username-error"]')).toContainText('Unable to check username availability');

    // Should still allow continuing with warning
    await expect(page.locator('[data-testid="onboarding-continue"]')).toBeEnabled();

    // Remove network mock
    await page.unroute('**/api/auth/check-username**');

    // Mock successful username check
    await page.route('**/api/auth/check-username**', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { available: true } })
      })
    );

    // Trigger username recheck
    await page.fill('[data-testid="username"]', 'networktest2');
    await expect(page.locator('[data-testid="username-status"]')).toContainText('Available');
  });

  test('should handle accessibility requirements', async ({ page }) => {
    await page.fill('[data-testid="signup-email"]', 'a11y@example.com');
    await page.fill('[data-testid="signup-password"]', 'Password123!');
    await page.fill('[data-testid="signup-confirm-password"]', 'Password123!');
    await page.click('[data-testid="signup-submit"]');

    await page.waitForURL(/\/onboarding/);

    // Check ARIA labels and roles
    await expect(page.locator('[data-testid="onboarding-form"]')).toHaveAttribute('role', 'form');
    await expect(page.locator('[data-testid="first-name"]')).toHaveAttribute('aria-label', 'First Name');
    await expect(page.locator('[data-testid="progress-indicator"]')).toHaveAttribute('role', 'progressbar');

    // Test keyboard navigation
    await page.keyboard.press('Tab');
    await expect(page.locator('[data-testid="first-name"]')).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(page.locator('[data-testid="last-name"]')).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(page.locator('[data-testid="username"]')).toBeFocused();

    // Test skip links
    await page.keyboard.press('Tab');
    await expect(page.locator('[data-testid="skip-link"]')).toBeFocused();

    // Ensure proper heading hierarchy
    const headings = await page.locator('h1, h2, h3, h4, h5, h6').allTextContents();
    expect(headings[0]).toContain('Welcome to Lighthouse');
  });

  test('should support internationalization', async ({ page }) => {
    // Test with different locale
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'language', {
        get: () => 'es-ES'
      });
    });

    await page.goto('/signup?lang=es');

    // Should display Spanish text
    await expect(page.locator('[data-testid="signup-title"]')).toContainText('Registro');
    
    // Continue with onboarding
    await page.fill('[data-testid="signup-email"]', 'i18n@example.com');
    await page.fill('[data-testid="signup-password"]', 'Password123!');
    await page.fill('[data-testid="signup-confirm-password"]', 'Password123!');
    await page.click('[data-testid="signup-submit"]');

    await page.waitForURL(/\/onboarding/);

    // Onboarding should also be in Spanish
    await expect(page.locator('h1')).toContainText('Bienvenido a Lighthouse');
  });
});
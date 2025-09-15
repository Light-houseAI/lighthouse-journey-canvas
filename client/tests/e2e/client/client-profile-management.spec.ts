/**
 * Playwright E2E Tests - Client Profile Management
 * Tests user profile operations and settings management
 */

import { test, expect } from '@playwright/test';

test.describe('Client Profile Management', () => {
  test.beforeEach(async ({ page }) => {
    // Login as authenticated user
    await page.goto('/login');
    await page.fill('[data-testid="login-email"]', 'testuser@example.com');
    await page.fill('[data-testid="login-password"]', 'password123');
    await page.click('[data-testid="login-submit"]');
    
    await page.waitForURL('/timeline');
  });

  test('should display current profile information', async ({ page }) => {
    // Navigate to settings
    await page.click('[data-testid="user-menu"]');
    await page.click('[data-testid="settings-link"]');
    
    await expect(page).toHaveURL('/settings');
    
    // Verify profile form is loaded with current data
    await expect(page.locator('[data-testid="profile-form"]')).toBeVisible();
    await expect(page.locator('[data-testid="first-name"]')).not.toHaveValue('');
    await expect(page.locator('[data-testid="last-name"]')).not.toHaveValue('');
    await expect(page.locator('[data-testid="email"]')).not.toHaveValue('');
    await expect(page.locator('[data-testid="username"]')).not.toHaveValue('');
  });

  test('should update basic profile information', async ({ page }) => {
    await page.click('[data-testid="user-menu"]');
    await page.click('[data-testid="settings-link"]');
    
    // Update profile fields
    await page.fill('[data-testid="first-name"]', 'UpdatedFirst');
    await page.fill('[data-testid="last-name"]', 'UpdatedLast');
    await page.fill('[data-testid="bio"]', 'I am a passionate software developer with 5+ years of experience.');
    await page.fill('[data-testid="location"]', 'San Francisco, CA');
    await page.fill('[data-testid="website"]', 'https://johndoe.dev');
    
    // Save changes
    await page.click('[data-testid="save-profile"]');
    
    // Verify success message
    await expect(page.locator('[data-testid="success-message"]')).toContainText('Profile updated successfully');
    
    // Verify changes are reflected in the header
    await expect(page.locator('[data-testid="user-name"]')).toContainText('UpdatedFirst UpdatedLast');
  });

  test('should handle avatar upload', async ({ page }) => {
    await page.click('[data-testid="user-menu"]');
    await page.click('[data-testid="settings-link"]');
    
    // Current avatar should be visible
    await expect(page.locator('[data-testid="current-avatar"]')).toBeVisible();
    
    // Upload new avatar
    const fileInput = page.locator('[data-testid="avatar-upload"]');
    await fileInput.setInputFiles('./test-assets/new-avatar.jpg');
    
    // Wait for upload completion
    await expect(page.locator('[data-testid="upload-progress"]')).toBeVisible();
    await expect(page.locator('[data-testid="upload-success"]')).toContainText('Avatar uploaded successfully');
    
    // Verify new avatar is displayed
    await expect(page.locator('[data-testid="avatar-preview"]')).toBeVisible();
    
    // Save profile with new avatar
    await page.click('[data-testid="save-profile"]');
    
    await expect(page.locator('[data-testid="success-message"]')).toContainText('Profile updated successfully');
    
    // Verify avatar appears in navigation
    await expect(page.locator('[data-testid="nav-avatar"]')).toBeVisible();
  });

  test('should change password', async ({ page }) => {
    await page.click('[data-testid="user-menu"]');
    await page.click('[data-testid="settings-link"]');
    
    // Navigate to security tab
    await page.click('[data-testid="security-tab"]');
    
    // Fill password change form
    await page.fill('[data-testid="current-password"]', 'password123');
    await page.fill('[data-testid="new-password"]', 'newSecurePassword123!');
    await page.fill('[data-testid="confirm-password"]', 'newSecurePassword123!');
    
    // Submit password change
    await page.click('[data-testid="change-password"]');
    
    await expect(page.locator('[data-testid="success-message"]')).toContainText('Password changed successfully');
    
    // Verify user is redirected to login (session invalidated)
    await expect(page).toHaveURL('/login');
    
    // Test login with new password
    await page.fill('[data-testid="login-email"]', 'testuser@example.com');
    await page.fill('[data-testid="login-password"]', 'newSecurePassword123!');
    await page.click('[data-testid="login-submit"]');
    
    await expect(page).toHaveURL('/timeline');
  });

  test('should validate password requirements', async ({ page }) => {
    await page.click('[data-testid="user-menu"]');
    await page.click('[data-testid="settings-link"]');
    await page.click('[data-testid="security-tab"]');
    
    // Try weak password
    await page.fill('[data-testid="current-password"]', 'password123');
    await page.fill('[data-testid="new-password"]', '123');
    await page.fill('[data-testid="confirm-password"]', '123');
    
    await page.click('[data-testid="change-password"]');
    
    // Verify validation errors
    await expect(page.locator('[data-testid="password-error"]')).toContainText('Password must be at least 8 characters');
    
    // Try password without special characters
    await page.fill('[data-testid="new-password"]', 'simplepassword');
    await page.fill('[data-testid="confirm-password"]', 'simplepassword');
    
    await page.click('[data-testid="change-password"]');
    
    await expect(page.locator('[data-testid="password-error"]')).toContainText('Password must contain at least one special character');
    
    // Try mismatched passwords
    await page.fill('[data-testid="new-password"]', 'ValidPassword123!');
    await page.fill('[data-testid="confirm-password"]', 'DifferentPassword123!');
    
    await page.click('[data-testid="change-password"]');
    
    await expect(page.locator('[data-testid="confirm-error"]')).toContainText('Passwords do not match');
  });

  test('should manage privacy settings', async ({ page }) => {
    await page.click('[data-testid="user-menu"]');
    await page.click('[data-testid="settings-link"]');
    
    // Navigate to privacy tab
    await page.click('[data-testid="privacy-tab"]');
    
    // Toggle public profile visibility
    const publicProfileToggle = page.locator('[data-testid="public-profile-toggle"]');
    const initialState = await publicProfileToggle.isChecked();
    
    await publicProfileToggle.click();
    
    // Verify toggle changed
    await expect(publicProfileToggle).toBeChecked({ checked: !initialState });
    
    // Configure timeline visibility
    await page.click('[data-testid="timeline-visibility-select"]');
    await page.click('[data-testid="visibility-friends-only"]');
    
    // Set search engine visibility
    await page.uncheck('[data-testid="search-engine-indexing"]');
    
    // Configure data sharing preferences
    await page.uncheck('[data-testid="analytics-sharing"]');
    await page.check('[data-testid="improvement-sharing"]');
    
    // Save privacy settings
    await page.click('[data-testid="save-privacy-settings"]');
    
    await expect(page.locator('[data-testid="success-message"]')).toContainText('Privacy settings updated successfully');
  });

  test('should manage notification preferences', async ({ page }) => {
    await page.click('[data-testid="user-menu"]');
    await page.click('[data-testid="settings-link"]');
    
    // Navigate to notifications tab
    await page.click('[data-testid="notifications-tab"]');
    
    // Configure email notifications
    await page.check('[data-testid="email-timeline-updates"]');
    await page.uncheck('[data-testid="email-promotional"]');
    await page.check('[data-testid="email-security-alerts"]');
    
    // Configure push notifications
    await page.check('[data-testid="push-comments"]');
    await page.check('[data-testid="push-shares"]');
    
    // Set notification frequency
    await page.selectOption('[data-testid="digest-frequency"]', 'weekly');
    
    // Save notification settings
    await page.click('[data-testid="save-notifications"]');
    
    await expect(page.locator('[data-testid="success-message"]')).toContainText('Notification preferences updated');
  });

  test('should view and manage connected accounts', async ({ page }) => {
    await page.click('[data-testid="user-menu"]');
    await page.click('[data-testid="settings-link"]');
    
    // Navigate to connected accounts tab
    await page.click('[data-testid="connected-accounts-tab"]');
    
    // Verify connected accounts section
    await expect(page.locator('[data-testid="connected-accounts-list"]')).toBeVisible();
    
    // Connect LinkedIn account
    await page.click('[data-testid="connect-linkedin"]');
    
    // Mock OAuth flow (would normally open popup)
    await page.route('**/auth/linkedin**', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, connected: true })
      });
    });
    
    // Verify connection success
    await expect(page.locator('[data-testid="linkedin-connected"]')).toBeVisible();
    
    // Disconnect account
    await page.click('[data-testid="disconnect-linkedin"]');
    
    // Confirm disconnection
    await expect(page.locator('[data-testid="disconnect-confirmation"]')).toBeVisible();
    await page.click('[data-testid="confirm-disconnect"]');
    
    await expect(page.locator('[data-testid="success-message"]')).toContainText('Account disconnected successfully');
  });

  test('should export personal data', async ({ page }) => {
    await page.click('[data-testid="user-menu"]');
    await page.click('[data-testid="settings-link"]');
    
    // Navigate to data export tab
    await page.click('[data-testid="data-export-tab"]');
    
    // Select data types to export
    await page.check('[data-testid="export-profile"]');
    await page.check('[data-testid="export-timeline"]');
    await page.check('[data-testid="export-connections"]');
    
    // Request data export
    await page.click('[data-testid="request-export"]');
    
    // Verify export request confirmation
    await expect(page.locator('[data-testid="export-confirmation"]')).toBeVisible();
    await expect(page.locator('[data-testid="export-confirmation"]')).toContainText(
      'Your data export will be ready within 24 hours'
    );
    
    // Check export status
    await expect(page.locator('[data-testid="export-status"]')).toContainText('Processing');
  });

  test('should handle account deletion', async ({ page }) => {
    await page.click('[data-testid="user-menu"]');
    await page.click('[data-testid="settings-link"]');
    
    // Navigate to danger zone
    await page.click('[data-testid="danger-zone-tab"]');
    
    // Verify warning message
    await expect(page.locator('[data-testid="deletion-warning"]')).toContainText(
      'This action cannot be undone'
    );
    
    // Click delete account
    await page.click('[data-testid="delete-account-btn"]');
    
    // Verify confirmation modal
    await expect(page.locator('[data-testid="deletion-modal"]')).toBeVisible();
    
    // Type confirmation text
    await page.fill('[data-testid="deletion-confirmation"]', 'DELETE');
    
    // Enter password for verification
    await page.fill('[data-testid="deletion-password"]', 'password123');
    
    // Confirm deletion
    await page.click('[data-testid="confirm-deletion"]');
    
    // Verify account deletion success and redirect
    await expect(page).toHaveURL('/goodbye');
    await expect(page.locator('[data-testid="deletion-success"]')).toContainText(
      'Your account has been successfully deleted'
    );
  });

  test('should validate profile form inputs', async ({ page }) => {
    await page.click('[data-testid="user-menu"]');
    await page.click('[data-testid="settings-link"]');
    
    // Clear required fields
    await page.fill('[data-testid="first-name"]', '');
    await page.fill('[data-testid="last-name"]', '');
    await page.fill('[data-testid="email"]', '');
    
    // Try to save
    await page.click('[data-testid="save-profile"]');
    
    // Verify validation errors
    await expect(page.locator('[data-testid="first-name-error"]')).toContainText('First name is required');
    await expect(page.locator('[data-testid="last-name-error"]')).toContainText('Last name is required');
    await expect(page.locator('[data-testid="email-error"]')).toContainText('Email is required');
    
    // Try invalid email
    await page.fill('[data-testid="email"]', 'invalid-email');
    await page.click('[data-testid="save-profile"]');
    
    await expect(page.locator('[data-testid="email-error"]')).toContainText('Please enter a valid email address');
    
    // Try invalid website URL
    await page.fill('[data-testid="website"]', 'not-a-url');
    await page.click('[data-testid="save-profile"]');
    
    await expect(page.locator('[data-testid="website-error"]')).toContainText('Please enter a valid URL');
    
    // Try username that's too short
    await page.fill('[data-testid="username"]', 'ab');
    await page.click('[data-testid="save-profile"]');
    
    await expect(page.locator('[data-testid="username-error"]')).toContainText('Username must be at least 3 characters');
  });

  test('should check username availability', async ({ page }) => {
    await page.click('[data-testid="user-menu"]');
    await page.click('[data-testid="settings-link"]');
    
    // Try to change to taken username
    await page.fill('[data-testid="username"]', 'admin');
    
    // Should show unavailable status
    await expect(page.locator('[data-testid="username-status"]')).toContainText('Username not available');
    await expect(page.locator('[data-testid="save-profile"]')).toBeDisabled();
    
    // Try available username
    await page.fill('[data-testid="username"]', 'uniqueusername123');
    
    await expect(page.locator('[data-testid="username-status"]')).toContainText('Username available');
    await expect(page.locator('[data-testid="save-profile"]')).toBeEnabled();
  });

  test('should handle profile image upload errors', async ({ page }) => {
    await page.click('[data-testid="user-menu"]');
    await page.click('[data-testid="settings-link"]');
    
    // Try uploading file that's too large
    const largeFileInput = page.locator('[data-testid="avatar-upload"]');
    
    // Mock file upload error
    await page.route('**/api/upload/avatar', route => {
      route.fulfill({
        status: 413,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: { message: 'File size too large. Maximum size is 5MB.' }
        })
      });
    });
    
    await largeFileInput.setInputFiles('./test-assets/large-image.jpg');
    
    // Verify error message
    await expect(page.locator('[data-testid="upload-error"]')).toContainText('File size too large');
    
    // Try unsupported file type
    await page.route('**/api/upload/avatar', route => {
      route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: { message: 'Unsupported file type. Please use JPG, PNG, or GIF.' }
        })
      });
    });
    
    await largeFileInput.setInputFiles('./test-assets/document.pdf');
    
    await expect(page.locator('[data-testid="upload-error"]')).toContainText('Unsupported file type');
  });

  test('should display activity log', async ({ page }) => {
    await page.click('[data-testid="user-menu"]');
    await page.click('[data-testid="settings-link"]');
    
    // Navigate to activity tab
    await page.click('[data-testid="activity-tab"]');
    
    // Verify activity log is displayed
    await expect(page.locator('[data-testid="activity-log"]')).toBeVisible();
    
    // Check for recent activities
    const activities = page.locator('[data-testid="activity-item"]');
    await expect(activities).toHaveCount.greaterThan(0);
    
    // Verify activity details
    const firstActivity = activities.first();
    await expect(firstActivity.locator('[data-testid="activity-type"]')).toBeVisible();
    await expect(firstActivity.locator('[data-testid="activity-timestamp"]')).toBeVisible();
    await expect(firstActivity.locator('[data-testid="activity-ip"]')).toBeVisible();
    
    // Filter activities by type
    await page.selectOption('[data-testid="activity-filter"]', 'login');
    
    // Verify filtered results
    const loginActivities = page.locator('[data-testid="activity-item"]:visible');
    await expect(loginActivities.first().locator('[data-testid="activity-type"]')).toContainText('Login');
  });

  test('should handle two-factor authentication setup', async ({ page }) => {
    await page.click('[data-testid="user-menu"]');
    await page.click('[data-testid="settings-link"]');
    await page.click('[data-testid="security-tab"]');
    
    // Enable 2FA
    await page.click('[data-testid="enable-2fa"]');
    
    // Verify QR code is displayed
    await expect(page.locator('[data-testid="2fa-qr-code"]')).toBeVisible();
    await expect(page.locator('[data-testid="backup-codes"]')).toBeVisible();
    
    // Enter verification code
    await page.fill('[data-testid="2fa-verification-code"]', '123456');
    
    // Confirm 2FA setup
    await page.click('[data-testid="confirm-2fa"]');
    
    await expect(page.locator('[data-testid="success-message"]')).toContainText('Two-factor authentication enabled');
    
    // Verify 2FA is now active
    await expect(page.locator('[data-testid="2fa-status"]')).toContainText('Enabled');
    
    // Test disabling 2FA
    await page.click('[data-testid="disable-2fa"]');
    await page.fill('[data-testid="2fa-disable-code"]', '123456');
    await page.click('[data-testid="confirm-disable-2fa"]');
    
    await expect(page.locator('[data-testid="success-message"]')).toContainText('Two-factor authentication disabled');
  });
});
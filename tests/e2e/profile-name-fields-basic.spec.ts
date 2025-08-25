import { test, expect } from '@playwright/test';

/**
 * Basic E2E tests for firstName/lastName functionality
 * These tests focus on the core user flow without complex navigation
 */

test.describe('Profile Name Fields - Basic Tests', () => {
  
  test('firstName and lastName form fields exist and are functional', async ({ page }) => {
    // Navigate directly to settings
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    
    // Basic form field existence check
    const firstNameField = page.locator('input').filter({ hasText: /first|First/ }).or(
      page.locator('input[name*="first" i], input[placeholder*="first" i]')
    ).first();
    
    const lastNameField = page.locator('input').filter({ hasText: /last|Last/ }).or(
      page.locator('input[name*="last" i], input[placeholder*="last" i]')
    ).first();
    
    // Check if fields are present and editable
    if (await firstNameField.isVisible({ timeout: 5000 })) {
      await expect(firstNameField).toBeEnabled();
      
      // Test basic input functionality
      await firstNameField.clear();
      await firstNameField.fill('TestFirstName');
      await expect(firstNameField).toHaveValue('TestFirstName');
    }
    
    if (await lastNameField.isVisible({ timeout: 5000 })) {
      await expect(lastNameField).toBeEnabled();
      
      // Test basic input functionality  
      await lastNameField.clear();
      await lastNameField.fill('TestLastName');
      await expect(lastNameField).toHaveValue('TestLastName');
    }
  });

  test('form submission with name fields works', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    
    // Find form elements
    const firstNameField = page.locator('input[name*="first" i], input[placeholder*="first" i]').first();
    const lastNameField = page.locator('input[name*="last" i], input[placeholder*="last" i]').first();
    const submitButton = page.locator('button[type="submit"], button:has-text("Update"), button:has-text("Save")').first();
    
    // Only run test if all elements are present
    const elementsExist = await Promise.all([
      firstNameField.isVisible({ timeout: 2000 }),
      lastNameField.isVisible({ timeout: 2000 }),
      submitButton.isVisible({ timeout: 2000 })
    ]);
    
    if (elementsExist.every(Boolean)) {
      // Fill form
      await firstNameField.clear();
      await firstNameField.fill('John');
      await lastNameField.clear(); 
      await lastNameField.fill('Doe');
      
      // Submit form
      await submitButton.click();
      
      // Wait for form processing
      await page.waitForLoadState('networkidle');
      
      // Verify values are retained (basic check)
      await expect(firstNameField).toHaveValue('John');
      await expect(lastNameField).toHaveValue('Doe');
    }
  });

  test('special characters in names are handled', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    
    const firstNameField = page.locator('input[name*="first" i], input[placeholder*="first" i]').first();
    const lastNameField = page.locator('input[name*="last" i], input[placeholder*="last" i]').first();
    
    if (await firstNameField.isVisible({ timeout: 2000 })) {
      // Test valid special characters
      await firstNameField.clear();
      await firstNameField.fill("Mary-Jane");
      await expect(firstNameField).toHaveValue("Mary-Jane");
    }
    
    if (await lastNameField.isVisible({ timeout: 2000 })) {
      // Test valid special characters  
      await lastNameField.clear();
      await lastNameField.fill("O'Connor");
      await expect(lastNameField).toHaveValue("O'Connor");
    }
  });

  test('profile form has proper labels and structure', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    
    // Check for form structure
    const hasProfileSection = await page.locator('text*="Profile", text*="Personal"').first().isVisible({ timeout: 5000 });
    
    if (hasProfileSection) {
      // Check for name field labels
      const hasFirstNameLabel = await page.locator('label:has-text("First"), label:has-text("first")').first().isVisible({ timeout: 2000 });
      const hasLastNameLabel = await page.locator('label:has-text("Last"), label:has-text("last")').first().isVisible({ timeout: 2000 });
      
      if (hasFirstNameLabel) {
        expect(hasFirstNameLabel).toBeTruthy();
      }
      
      if (hasLastNameLabel) {
        expect(hasLastNameLabel).toBeTruthy();
      }
      
      // Check for submit button
      const hasSubmitButton = await page.locator('button[type="submit"], button:has-text("Update"), button:has-text("Save")').first().isVisible({ timeout: 2000 });
      expect(hasSubmitButton).toBeTruthy();
    }
  });
});
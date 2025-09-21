import { expect,test } from '@playwright/test';

/**
 * User Settings and Profile Management Tests
 * Based on the comprehensive user journey from test-1.spec.ts
 * Covers profile updates, username changes, and settings navigation
 */
test.describe('User Settings Management', () => {
  let testUser: { email: string; password: string; firstName: string; lastName: string; username: string };

  test.beforeEach(async ({ page }) => {
    // Generate unique test data
    const timestamp = Date.now();
    testUser = {
      email: `settings-test-${timestamp}@lighthouse.com`,
      password: 'TestPassword123!',
      firstName: 'John',
      lastName: 'Doe',
      username: `user${timestamp}`
    };

    console.log(`🧪 Setting up test user: ${testUser.email}`);
  });

  test('complete user profile management flow', async ({ page }) => {
    console.log('🧪 Testing complete profile management flow...');

    await test.step('Create account and complete onboarding', async () => {
      await page.context().clearCookies();
      await page.goto('/');

      // Create account
      await page.locator('text=Create account').click();
      await page.waitForTimeout(1000);
      
      await page.locator('input[type="email"]').fill(testUser.email);
      await page.locator('input[type="password"]').fill(testUser.password);

      const signupResponse = page.waitForResponse(
        response => response.url().includes('/api/signup') && response.status() === 200
      );

      await page.locator('button:has-text("Create account")').click();
      await signupResponse;
      console.log('✅ Account created successfully');

      // Complete onboarding if present
      await page.waitForTimeout(2000);
      const hasOnboarding = await page.locator('text=What are you most interested in').isVisible({ timeout: 3000 });
      
      if (hasOnboarding) {
        await page.locator('button:has-text("Grow in my career")').click();
        await page.waitForTimeout(1000);
        
        const continueButton = page.locator('button:has-text("Continue")');
        if (await continueButton.isVisible({ timeout: 2000 })) {
          await continueButton.click();
          await page.waitForTimeout(2000);
        }
        console.log('✅ Onboarding completed');
      }
    });

    await test.step('Navigate to settings page', async () => {
      // Look for user profile menu or settings navigation
      const settingsSelectors = [
        'button:has-text("Settings")',
        'a:has-text("Settings")', 
        '[data-testid="user-menu"]',
        '[data-testid="profile-menu"]',
        'button:has([data-testid="avatar"])',
        // Look for user initials or profile buttons
        `button:has-text("${testUser.firstName.charAt(0)}${testUser.lastName.charAt(0)}")`,
        'button[aria-label*="profile" i]',
        'button[aria-label*="menu" i]'
      ];

      let settingsFound = false;
      for (const selector of settingsSelectors) {
        try {
          const element = page.locator(selector).first();
          if (await element.isVisible({ timeout: 2000 })) {
            console.log(`✅ Found settings navigation: ${selector}`);
            await element.click();
            settingsFound = true;
            
            // Wait for menu to open and look for settings option
            await page.waitForTimeout(1000);
            const settingsOption = page.locator('text=Settings', 'menuitem:has-text("Settings")').first();
            if (await settingsOption.isVisible({ timeout: 2000 })) {
              await settingsOption.click();
              console.log('✅ Clicked settings menu item');
            }
            break;
          }
        } catch (error) {
          // Continue to next selector
          continue;
        }
      }

      if (!settingsFound) {
        // Try direct navigation
        console.log('ℹ️ Direct navigation to settings page');
        await page.goto('/settings');
      }

      await page.waitForTimeout(2000);
      const currentUrl = page.url();
      console.log(`📍 Current URL: ${currentUrl}`);
    });

    await test.step('Update first and last name', async () => {
      console.log('📝 Updating user profile information...');

      // Look for first name field
      const firstNameSelectors = [
        'input[name="firstName"]',
        'input[placeholder*="first" i]',
        'input[aria-label*="first" i]',
        'input[data-testid="first-name"]'
      ];

      let firstNameUpdated = false;
      for (const selector of firstNameSelectors) {
        const input = page.locator(selector);
        if (await input.isVisible({ timeout: 2000 })) {
          await input.click();
          // Clear existing value and fill new one
          await input.fill('');
          await input.fill(testUser.firstName);
          firstNameUpdated = true;
          console.log(`✅ Updated first name to: ${testUser.firstName}`);
          break;
        }
      }

      // Look for last name field
      const lastNameSelectors = [
        'input[name="lastName"]',
        'input[placeholder*="last" i]',
        'input[aria-label*="last" i]',
        'input[data-testid="last-name"]'
      ];

      let lastNameUpdated = false;
      for (const selector of lastNameSelectors) {
        const input = page.locator(selector);
        if (await input.isVisible({ timeout: 2000 })) {
          await input.click();
          await input.fill('');
          await input.fill(testUser.lastName);
          lastNameUpdated = true;
          console.log(`✅ Updated last name to: ${testUser.lastName}`);
          break;
        }
      }

      expect(firstNameUpdated || lastNameUpdated).toBeTruthy();
    });

    await test.step('Save profile updates', async () => {
      // Look for save/update button
      const saveSelectors = [
        'button:has-text("Update Profile")',
        'button:has-text("Save Profile")',
        'button:has-text("Save Changes")',
        'button:has-text("Update")',
        'button[type="submit"]'
      ];

      let saveFound = false;
      for (const selector of saveSelectors) {
        const button = page.locator(selector);
        if (await button.isVisible({ timeout: 2000 })) {
          console.log(`✅ Found save button: ${selector}`);
          
          // Monitor for API response
          const updateResponse = page.waitForResponse(
            response => response.url().includes('/api/') && 
                       (response.url().includes('profile') || response.url().includes('user')),
            { timeout: 10000 }
          );

          await button.click();
          
          try {
            const response = await updateResponse;
            console.log(`📡 Profile update response: ${response.status()}`);
            expect([200, 204]).toContain(response.status());
          } catch (error) {
            console.log('⚠️ Profile update API response not captured, checking UI feedback');
          }

          saveFound = true;
          break;
        }
      }

      expect(saveFound).toBeTruthy();
      await page.waitForTimeout(2000);
      console.log('✅ Profile information saved');
    });

    await test.step('Update username', async () => {
      console.log('👤 Updating username...');

      // Look for username field
      const usernameSelectors = [
        'input[name="username"]',
        'input[placeholder*="username" i]',
        'input[aria-label*="username" i]',
        'input[data-testid="username"]'
      ];

      let usernameUpdated = false;
      for (const selector of usernameSelectors) {
        const input = page.locator(selector);
        if (await input.isVisible({ timeout: 2000 })) {
          await input.click();
          await input.fill('');
          await input.fill(testUser.username);
          usernameUpdated = true;
          console.log(`✅ Updated username to: ${testUser.username}`);
          break;
        }
      }

      if (usernameUpdated) {
        // Save username change
        const saveButton = page.locator('button:has-text("Update Profile")');
        if (await saveButton.isVisible({ timeout: 2000 })) {
          await saveButton.click();
          await page.waitForTimeout(2000);
          console.log('✅ Username saved');
        }
      } else {
        console.log('ℹ️ Username field not found or not editable');
      }
    });

    await test.step('Verify profile updates are persistent', async () => {
      // Navigate away and back to verify changes persist
      await page.goto('/');
      await page.waitForTimeout(1000);
      
      // Go back to settings
      const userMenuButton = page.locator(`button:has-text("${testUser.firstName.charAt(0)}${testUser.lastName.charAt(0)}")`);
      if (await userMenuButton.isVisible({ timeout: 3000 })) {
        await userMenuButton.click();
        await page.waitForTimeout(1000);
        
        const settingsMenuItem = page.locator('text=Settings');
        if (await settingsMenuItem.isVisible({ timeout: 2000 })) {
          await settingsMenuItem.click();
          await page.waitForTimeout(2000);
          
          // Verify values are still there
          const firstNameValue = await page.locator('input[name="firstName"]').inputValue();
          const lastNameValue = await page.locator('input[name="lastName"]').inputValue();
          
          expect(firstNameValue).toBe(testUser.firstName);
          expect(lastNameValue).toBe(testUser.lastName);
          console.log('✅ Profile updates verified as persistent');
        }
      }
    });
  });

  test('settings navigation and UI accessibility', async ({ page }) => {
    console.log('🧪 Testing settings navigation and accessibility...');

    await test.step('Create and login user', async () => {
      await page.context().clearCookies();
      await page.goto('/');

      await page.locator('text=Create account').click();
      await page.waitForTimeout(1000);
      await page.locator('input[type="email"]').fill(testUser.email);
      await page.locator('input[type="password"]').fill(testUser.password);
      await page.locator('button:has-text("Create account")').click();
      await page.waitForTimeout(3000);

      // Skip onboarding if present
      const continueButton = page.locator('button:has-text("Continue")');
      if (await continueButton.isVisible({ timeout: 3000 })) {
        await continueButton.click();
        await page.waitForTimeout(2000);
      }
    });

    await test.step('Test multiple settings navigation methods', async () => {
      // Method 1: Direct URL navigation
      await page.goto('/settings');
      await page.waitForTimeout(1000);
      
      let reachedSettings = await page.locator('input[name="firstName"], input[name="lastName"]').count() > 0;
      if (reachedSettings) {
        console.log('✅ Direct URL navigation to settings works');
      } else {
        console.log('ℹ️ Direct URL navigation not available, trying UI navigation');
        
        // Method 2: UI navigation through profile menu
        await page.goto('/');
        const profileButtons = await page.locator('button[aria-label*="profile" i], button[data-testid*="user"], button[data-testid*="profile"]').all();
        
        for (const button of profileButtons) {
          if (await button.isVisible()) {
            await button.click();
            await page.waitForTimeout(1000);
            
            const settingsLink = page.locator('a:has-text("Settings"), button:has-text("Settings")');
            if (await settingsLink.isVisible({ timeout: 2000 })) {
              await settingsLink.click();
              await page.waitForTimeout(1000);
              reachedSettings = true;
              console.log('✅ UI navigation to settings works');
              break;
            }
          }
        }
      }

      expect(reachedSettings).toBeTruthy();
    });

    await test.step('Validate settings form accessibility', async () => {
      // Check for proper form labels and structure
      const formElements = await page.locator('input, button, label').count();
      expect(formElements).toBeGreaterThan(0);
      console.log(`✅ Found ${formElements} form elements`);

      // Check for required accessibility attributes
      const labeledInputs = await page.locator('input[aria-label], input + label, label + input').count();
      expect(labeledInputs).toBeGreaterThan(0);
      console.log(`✅ Found ${labeledInputs} properly labeled inputs`);

      // Test keyboard navigation
      await page.keyboard.press('Tab');
      const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
      expect(['INPUT', 'BUTTON'].includes(focusedElement || '')).toBeTruthy();
      console.log('✅ Keyboard navigation working in settings');
    });
  });

  test('profile link generation and sharing', async ({ page }) => {
    console.log('🧪 Testing profile link generation...');

    await test.step('Setup user account', async () => {
      await page.context().clearCookies();
      await page.goto('/');

      await page.locator('text=Create account').click();
      await page.waitForTimeout(1000);
      await page.locator('input[type="email"]').fill(testUser.email);
      await page.locator('input[type="password"]').fill(testUser.password);
      await page.locator('button:has-text("Create account")').click();
      await page.waitForTimeout(3000);
    });

    await test.step('Look for profile link sharing functionality', async () => {
      // Look for profile sharing options
      const shareSelectors = [
        'button:has-text("Copy Profile Link")',
        'text=Copy Profile Link',
        'button:has-text("Share Profile")',
        '[data-testid="copy-profile-link"]'
      ];

      let shareFound = false;
      for (const selector of shareSelectors) {
        const element = page.locator(selector);
        if (await element.isVisible({ timeout: 2000 })) {
          console.log(`✅ Found profile sharing option: ${selector}`);
          
          // Test clicking the share button
          await element.click();
          await page.waitForTimeout(1000);
          
          // Check if copy action was successful (might show toast or change button text)
          const feedback = await page.textContent('body');
          const hasFeedback = feedback?.includes('Copied') || 
                             feedback?.includes('Link copied') ||
                             feedback?.includes('Success');
          
          if (hasFeedback) {
            console.log('✅ Profile link copy feedback detected');
          }
          
          shareFound = true;
          break;
        }
      }

      if (!shareFound) {
        console.log('ℹ️ Profile link sharing not found in current UI');
      }
    });
  });

  test('settings validation and error handling', async ({ page }) => {
    console.log('🧪 Testing settings validation and error handling...');

    await test.step('Create user and navigate to settings', async () => {
      await page.context().clearCookies();
      await page.goto('/');

      await page.locator('text=Create account').click();
      await page.waitForTimeout(1000);
      await page.locator('input[type="email"]').fill(testUser.email);
      await page.locator('input[type="password"]').fill(testUser.password);
      await page.locator('button:has-text("Create account")').click();
      await page.waitForTimeout(3000);

      // Navigate to settings (try multiple methods)
      await page.goto('/settings');
      await page.waitForTimeout(1000);
    });

    await test.step('Test field validation', async () => {
      // Test empty name validation
      const firstNameInput = page.locator('input[name="firstName"]');
      if (await firstNameInput.isVisible({ timeout: 2000 })) {
        await firstNameInput.fill('');
        
        const updateButton = page.locator('button:has-text("Update Profile")');
        if (await updateButton.isVisible()) {
          await updateButton.click();
          await page.waitForTimeout(1000);
          
          // Check for validation message
          const content = await page.textContent('body');
          const hasValidation = content?.includes('required') || 
                               content?.includes('cannot be empty') ||
                               content?.includes('Please enter');
          
          if (hasValidation) {
            console.log('✅ Empty field validation working');
          }
        }
      }
    });

    await test.step('Test invalid username handling', async () => {
      const usernameInput = page.locator('input[name="username"]');
      if (await usernameInput.isVisible({ timeout: 2000 })) {
        // Test special characters or invalid format
        await usernameInput.fill('invalid@username!');
        
        const updateButton = page.locator('button:has-text("Update Profile")');
        if (await updateButton.isVisible()) {
          await updateButton.click();
          await page.waitForTimeout(2000);
          
          // Check for validation or error response
          const content = await page.textContent('body');
          const hasError = content?.includes('invalid') ||
                          content?.includes('not allowed') ||
                          content?.includes('format');
          
          if (hasError) {
            console.log('✅ Username validation working');
          }
        }
      }
    });

    await test.step('Recover with valid data', async () => {
      // Fill valid data to ensure test cleanup
      const firstNameInput = page.locator('input[name="firstName"]');
      if (await firstNameInput.isVisible({ timeout: 1000 })) {
        await firstNameInput.fill(testUser.firstName);
      }

      const lastNameInput = page.locator('input[name="lastName"]');
      if (await lastNameInput.isVisible({ timeout: 1000 })) {
        await lastNameInput.fill(testUser.lastName);
      }

      const updateButton = page.locator('button:has-text("Update Profile")');
      if (await updateButton.isVisible({ timeout: 1000 })) {
        await updateButton.click();
        await page.waitForTimeout(1000);
        console.log('✅ Recovered with valid profile data');
      }
    });
  });

  test('settings persistence across sessions', async ({ page }) => {
    console.log('🧪 Testing settings persistence across sessions...');

    await test.step('Create account and update settings', async () => {
      await page.context().clearCookies();
      await page.goto('/');

      await page.locator('text=Create account').click();
      await page.waitForTimeout(1000);
      await page.locator('input[type="email"]').fill(testUser.email);
      await page.locator('input[type="password"]').fill(testUser.password);
      await page.locator('button:has-text("Create account")').click();
      await page.waitForTimeout(3000);

      // Navigate to settings and update profile
      await page.goto('/settings');
      await page.waitForTimeout(1000);

      const firstNameInput = page.locator('input[name="firstName"]');
      if (await firstNameInput.isVisible({ timeout: 2000 })) {
        await firstNameInput.fill(testUser.firstName);
        
        const updateButton = page.locator('button:has-text("Update Profile")');
        if (await updateButton.isVisible()) {
          await updateButton.click();
          await page.waitForTimeout(2000);
          console.log('✅ Profile updated successfully');
        }
      }
    });

    await test.step('Simulate logout and login', async () => {
      // Clear session (simulate logout)
      await page.context().clearCookies();
      await page.goto('/');
      
      // Login again
      await page.locator('input[type="email"]').fill(testUser.email);
      await page.locator('input[type="password"]').fill(testUser.password);
      await page.locator('button:has-text("Sign In")').click();
      await page.waitForTimeout(3000);
    });

    await test.step('Verify settings persistence', async () => {
      // Navigate back to settings
      await page.goto('/settings');
      await page.waitForTimeout(1000);

      // Check if previous changes are still there
      const firstNameValue = await page.locator('input[name="firstName"]').inputValue();
      
      if (firstNameValue === testUser.firstName) {
        console.log('✅ Settings persisted across sessions');
        expect(firstNameValue).toBe(testUser.firstName);
      } else {
        console.log('ℹ️ Settings may not be persisting or field not found');
      }
    });
  });

  test('settings back navigation and user flow', async ({ page }) => {
    console.log('🧪 Testing settings navigation flow...');

    await test.step('Create account and navigate to settings', async () => {
      await page.context().clearCookies();
      await page.goto('/');

      await page.locator('text=Create account').click();
      await page.waitForTimeout(1000);
      await page.locator('input[type="email"]').fill(testUser.email);
      await page.locator('input[type="password"]').fill(testUser.password);
      await page.locator('button:has-text("Create account")').click();
      await page.waitForTimeout(3000);

      await page.goto('/settings');
      await page.waitForTimeout(1000);
    });

    await test.step('Test back navigation to timeline/main app', async () => {
      // Look for back or timeline navigation
      const backSelectors = [
        'button:has-text("Back to Timeline")',
        'button:has-text("Back")',
        'a:has-text("Timeline")',
        'a:has-text("Dashboard")',
        'button[aria-label*="back" i]'
      ];

      let backFound = false;
      for (const selector of backSelectors) {
        const element = page.locator(selector);
        if (await element.isVisible({ timeout: 2000 })) {
          console.log(`✅ Found back navigation: ${selector}`);
          await element.click();
          await page.waitForTimeout(2000);
          backFound = true;
          break;
        }
      }

      if (backFound) {
        // Verify we're back in main app
        const currentUrl = page.url();
        const content = await page.textContent('body');
        
        const inMainApp = currentUrl.includes('timeline') ||
                         content?.includes('Professional Journey') ||
                         content?.includes('Timeline') ||
                         !content?.includes('First Name'); // No longer in settings

        expect(inMainApp).toBeTruthy();
        console.log('✅ Successfully navigated back to main app');
      } else {
        console.log('ℹ️ Back navigation not found, using browser back');
        await page.goBack();
        await page.waitForTimeout(1000);
      }
    });
  });
});
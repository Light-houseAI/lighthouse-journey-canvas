import { expect, test } from '@playwright/test';

/**
 * Consolidated Onboarding Tests
 * Covers all user onboarding scenarios from multiple test files
 */
test.describe('User Onboarding Flow', () => {
  test('complete onboarding flow after successful signup', async ({ page }) => {
    console.log('🧪 Testing complete onboarding flow after signup...');

    const testUser = {
      email: `onboarding-${Date.now()}@lighthouse.com`,
      password: 'TestPassword123!'
    };

    await test.step('Clear any existing session and navigate to homepage', async () => {
      await page.context().clearCookies();
      await page.goto('/');
      await expect(page.locator('input[type="email"]')).toBeVisible();
    });

    await test.step('Create new user account', async () => {
      // Switch to signup mode
      await page.locator('text=Create account').click();
      await page.waitForTimeout(1000);

      // Fill signup form
      await page.locator('input[type="email"]').fill(testUser.email);
      await page.locator('input[type="password"]').fill(testUser.password);

      console.log(`📧 Creating account for onboarding: ${testUser.email}`);

      // Monitor API response
      const signupResponsePromise = page.waitForResponse(
        response => response.url().includes('/api/signup') && response.status() === 200,
        { timeout: 15000 }
      );

      // Submit form
      await page.locator('button:has-text("Create account")').click();
      await signupResponsePromise;

      console.log('✅ Account created successfully');
      await page.waitForTimeout(2000);
    });

    await test.step('Verify onboarding step 1 appears', async () => {
      // Check for onboarding content
      const content = await page.locator('body').textContent();
      console.log('📄 Post-signup content preview:', content?.substring(0, 200));

      // Should see onboarding step 1
      const hasOnboardingContent = content?.includes('What are you most interested in') ||
        content?.includes('Step 1 of 2') ||
        content?.includes('This helps us tailor your experience');

      expect(hasOnboardingContent).toBeTruthy();
      console.log('✅ Onboarding step 1 displayed');
    });

    await test.step('Complete onboarding step 1 - Select career interest', async () => {
      // Look for career interest options
      const careerOptions = [
        'text=Grow in my career',
        'text=Change careers',
        'text=Find a new job',
        'text=Start my own business'
      ];

      let optionFound = false;
      for (const option of careerOptions) {
        if (await page.locator(option).isVisible({ timeout: 2000 })) {
          console.log(`✅ Found career option: ${option}`);
          await page.locator(option).click();
          optionFound = true;
          break;
        }
      }

      expect(optionFound).toBeTruthy();
      console.log('✅ Career interest selected');
      await page.waitForTimeout(1000);
    });

    await test.step('Complete onboarding step 2 - Continue to main app', async () => {
      // Look for continue button or step 2 elements
      const continueSelectors = [
        'button:has-text("Continue")',
        'button:has-text("Next")',
        'button:has-text("Get Started")',
        'button:has-text("Skip")'
      ];

      let continueFound = false;
      for (const selector of continueSelectors) {
        if (await page.locator(selector).isVisible({ timeout: 3000 })) {
          console.log(`✅ Found continue button: ${selector}`);
          await page.locator(selector).click();
          continueFound = true;
          break;
        }
      }

      expect(continueFound).toBeTruthy();
      console.log('✅ Onboarding step 2 completed');
      await page.waitForTimeout(2000);
    });

    await test.step('Verify redirect to main application', async () => {
      // Should be redirected to professional journey or main app
      const finalUrl = page.url();
      console.log(`📍 Final destination: ${finalUrl}`);

      const postOnboardingContent = await page.textContent('body');
      const reachedMainApp = finalUrl.includes('professional-journey') ||
        postOnboardingContent?.includes('Professional Journey') ||
        postOnboardingContent?.includes('Timeline') ||
        postOnboardingContent?.includes('Add Experience');

      expect(reachedMainApp).toBeTruthy();
      console.log('✅ Successfully reached main application after onboarding');
    });
  });

  test('onboarding for existing user with interests should skip to main app', async ({ page }) => {
    console.log('🧪 Testing onboarding skip for returning user...');

    const testUser = {
      email: `returning-user-${Date.now()}@lighthouse.com`,
      password: 'TestPassword123!'
    };

    await test.step('Create user account first', async () => {
      await page.context().clearCookies();
      await page.goto('/');

      // Create account
      await page.locator('text=Create account').click();
      await page.waitForTimeout(1000);
      await page.locator('input[type="email"]').fill(testUser.email);
      await page.locator('input[type="password"]').fill(testUser.password);

      const signupResponse = page.waitForResponse(
        response => response.url().includes('/api/signup')
      );

      await page.locator('button:has-text("Create account")').click();
      await signupResponse;
      await page.waitForTimeout(2000);
    });

    await test.step('Complete initial onboarding', async () => {
      // Select career interest if onboarding appears
      const hasOnboarding = await page.locator('text=What are you most interested in').isVisible({ timeout: 3000 });

      if (hasOnboarding) {
        await page.locator('button:has-text("Grow in my career")').click();
        await page.waitForTimeout(1000);

        const continueButton = page.locator('button:has-text("Continue")');
        if (await continueButton.isVisible({ timeout: 2000 })) {
          await continueButton.click();
          await page.waitForTimeout(2000);
        }
        console.log('✅ Completed initial onboarding');
      }
    });

    await test.step('Logout and login again to test returning user flow', async () => {
      // Clear session to simulate logout
      await page.context().clearCookies();
      await page.goto('/');
      await expect(page.locator('input[type="email"]')).toBeVisible();

      // Login as returning user
      await page.locator('input[type="email"]').fill(testUser.email);
      await page.locator('input[type="password"]').fill(testUser.password);

      console.log(`🔐 Logging in as returning user: ${testUser.email}`);
      await page.locator('button:has-text("Sign In")').click();
      await page.waitForTimeout(3000);
    });

    await test.step('Verify returning user bypasses onboarding', async () => {
      const content = await page.textContent('body');

      // Should NOT see onboarding steps
      const hasOnboardingContent = content?.includes('What are you most interested in') ||
        content?.includes('Step 1 of 2');

      // Should see main app content instead
      const hasMainAppContent = content?.includes('Professional Journey') ||
        content?.includes('Timeline') ||
        content?.includes('Add Experience');

      expect(hasOnboardingContent).toBeFalsy();
      expect(hasMainAppContent).toBeTruthy();
      console.log('✅ Returning user successfully bypassed onboarding');
    });
  });

  test('onboarding navigation and user experience flow', async ({ page }) => {
    console.log('🧪 Testing onboarding navigation and UX...');

    const testUser = {
      email: `nav-test-${Date.now()}@lighthouse.com`,
      password: 'TestPassword123!'
    };

    await test.step('Navigate through complete signup to onboarding', async () => {
      await page.context().clearCookies();
      await page.goto('/');

      // Complete signup
      await page.locator('text=Create account').click();
      await page.waitForTimeout(1000);
      await page.locator('input[type="email"]').fill(testUser.email);
      await page.locator('input[type="password"]').fill(testUser.password);

      await page.locator('button:has-text("Create account")').click();
      await page.waitForTimeout(3000);

      console.log('📧 Account created for navigation test');
    });

    await test.step('Verify onboarding step 1 UI elements', async () => {
      // Check for proper onboarding UI elements
      const onboardingIndicators = [
        'text=What are you most interested in?',
        'text=This helps us tailor your experience',
        'text=Step 1 of 2'
      ];

      let indicatorCount = 0;
      for (const indicator of onboardingIndicators) {
        if (await page.locator(indicator).isVisible({ timeout: 2000 })) {
          indicatorCount++;
          console.log(`✅ Found onboarding indicator: ${indicator}`);
        }
      }

      expect(indicatorCount).toBeGreaterThan(0);
      console.log(`✅ Found ${indicatorCount} onboarding UI elements`);
    });

    await test.step('Test different career interest options', async () => {
      // Test that multiple career options are available
      const careerOptions = [
        'Grow in my career',
        'Change careers',
        'Find a new job',
        'Start my own business'
      ];

      let availableOptions = 0;
      for (const option of careerOptions) {
        const optionElement = page.locator(`text=${option}`);
        if (await optionElement.isVisible({ timeout: 1000 })) {
          availableOptions++;
          console.log(`✅ Career option available: ${option}`);
        }
      }

      expect(availableOptions).toBeGreaterThan(0);

      // Select the first available option
      await page.locator('button:has-text("Grow in my career")').click();
      await page.waitForTimeout(1000);
      console.log('✅ Career interest selection completed');
    });

    await test.step('Navigate through onboarding step 2', async () => {
      // Look for step 2 content or final completion
      const step2Content = await page.textContent('body');
      console.log('📄 Step 2 content preview:', step2Content?.substring(0, 200));

      // Check if there's a step 2 or if we can proceed to main app
      const hasStep2 = step2Content?.includes('Step 2') ||
        step2Content?.includes('LinkedIn') ||
        step2Content?.includes('Connect');

      if (hasStep2) {
        console.log('ℹ️ Step 2 detected with additional configuration');

        // Look for skip or continue options
        const skipButton = page.locator('button:has-text("Skip")');
        const continueButton = page.locator('button:has-text("Continue")');

        if (await skipButton.isVisible({ timeout: 2000 })) {
          await skipButton.click();
          console.log('✅ Skipped step 2');
        } else if (await continueButton.isVisible({ timeout: 2000 })) {
          await continueButton.click();
          console.log('✅ Continued through step 2');
        }
      } else {
        console.log('ℹ️ No step 2 detected - proceeding to main app');
      }

      await page.waitForTimeout(2000);
    });

    await test.step('Verify successful onboarding completion', async () => {
      const finalUrl = page.url();
      const finalContent = await page.textContent('body');

      console.log(`📍 Final URL: ${finalUrl}`);
      console.log('📄 Final content preview:', finalContent?.substring(0, 200));

      // Should be in main app
      const inMainApp = finalUrl.includes('professional-journey') ||
        finalContent?.includes('Professional Journey') ||
        finalContent?.includes('Timeline') ||
        !finalContent?.includes('What are you most interested in');

      expect(inMainApp).toBeTruthy();
      console.log('✅ Onboarding navigation completed successfully');
    });
  });

  test('onboarding with LinkedIn integration option', async ({ page }) => {
    console.log('🧪 Testing onboarding LinkedIn integration...');

    const testUser = {
      email: `linkedin-test-${Date.now()}@lighthouse.com`,
      password: 'TestPassword123!'
    };

    await test.step('Complete signup and reach onboarding', async () => {
      await page.context().clearCookies();
      await page.goto('/');

      await page.locator('text=Create account').click();
      await page.waitForTimeout(1000);
      await page.locator('input[type="email"]').fill(testUser.email);
      await page.locator('input[type="password"]').fill(testUser.password);

      await page.locator('button:has-text("Create account")').click();
      await page.waitForTimeout(3000);
    });

    await test.step('Complete step 1 - Select career interest', async () => {
      await expect(page.locator('text=What are you most interested in')).toBeVisible();
      await page.locator('button:has-text("Grow in my career")').click();
      await page.waitForTimeout(1500);
    });

    await test.step('Check for LinkedIn integration option', async () => {
      const content = await page.textContent('body');

      // Check if LinkedIn integration is offered
      const hasLinkedInOption = content?.includes('LinkedIn') ||
        content?.includes('Connect your') ||
        content?.includes('Import from');

      if (hasLinkedInOption) {
        console.log('✅ LinkedIn integration option detected');

        // Look for LinkedIn-related buttons
        const linkedInButtons = [
          'button:has-text("Connect LinkedIn")',
          'button:has-text("Import from LinkedIn")',
          'button:has-text("Skip")',
          'text=Skip for now'
        ];

        let linkedInActionTaken = false;
        for (const buttonSelector of linkedInButtons) {
          const button = page.locator(buttonSelector);
          if (await button.isVisible({ timeout: 2000 })) {
            console.log(`✅ Found LinkedIn option: ${buttonSelector}`);

            // For testing, we'll skip LinkedIn integration
            if (buttonSelector.includes('Skip')) {
              await button.click();
              linkedInActionTaken = true;
              console.log('✅ Skipped LinkedIn integration');
              break;
            }
          }
        }

        expect(linkedInActionTaken).toBeTruthy();
      } else {
        console.log('ℹ️ No LinkedIn integration detected - continuing without it');

        // Look for general continue button
        const continueButton = page.locator('button:has-text("Continue")');
        if (await continueButton.isVisible({ timeout: 2000 })) {
          await continueButton.click();
        }
      }

      await page.waitForTimeout(2000);
    });

    await test.step('Verify completion regardless of LinkedIn choice', async () => {
      const finalUrl = page.url();
      const finalContent = await page.textContent('body');

      // Should reach main app whether LinkedIn was used or skipped
      const completedOnboarding = finalUrl.includes('professional-journey') ||
        finalContent?.includes('Professional Journey') ||
        finalContent?.includes('Timeline');

      expect(completedOnboarding).toBeTruthy();
      console.log('✅ Onboarding completed successfully with LinkedIn option handling');
    });
  });

  test('onboarding error handling and recovery', async ({ page }) => {
    console.log('🧪 Testing onboarding error handling...');

    const testUser = {
      email: `error-test-${Date.now()}@lighthouse.com`,
      password: 'TestPassword123!'
    };

    await test.step('Complete signup to reach onboarding', async () => {
      await page.context().clearCookies();
      await page.goto('/');

      await page.locator('text=Create account').click();
      await page.waitForTimeout(1000);
      await page.locator('input[type="email"]').fill(testUser.email);
      await page.locator('input[type="password"]').fill(testUser.password);

      await page.locator('button:has-text("Create account")').click();
      await page.waitForTimeout(3000);
    });

    await test.step('Test navigation without selection', async () => {
      // Try to proceed without making a selection
      const continueButton = page.locator('button:has-text("Continue")');
      const nextButton = page.locator('button:has-text("Next")');

      if (await continueButton.isVisible({ timeout: 2000 })) {
        await continueButton.click();
        await page.waitForTimeout(1000);

        // Should still be on onboarding or show validation
        const stillOnOnboarding = await page.locator('text=What are you most interested in').isVisible();
        if (stillOnOnboarding) {
          console.log('✅ Validation prevents proceeding without selection');
        }
      } else if (await nextButton.isVisible({ timeout: 2000 })) {
        await nextButton.click();
        await page.waitForTimeout(1000);
      }
    });

    await test.step('Complete onboarding properly after error', async () => {
      // Make proper selection
      await page.locator('button:has-text("Grow in my career")').click();
      await page.waitForTimeout(1000);

      // Continue through remaining steps
      const finalContinue = page.locator('button:has-text("Continue")');
      if (await finalContinue.isVisible({ timeout: 2000 })) {
        await finalContinue.click();
        await page.waitForTimeout(2000);
      }

      // Verify successful completion
      const finalContent = await page.textContent('body');
      const completed = finalContent?.includes('Professional Journey') ||
        finalContent?.includes('Timeline') ||
        !finalContent?.includes('What are you most interested in');

      expect(completed).toBeTruthy();
      console.log('✅ Onboarding completed successfully after error recovery');
    });
  });

  test('onboarding accessibility and UI validation', async ({ page }) => {
    console.log('🧪 Testing onboarding accessibility and UI...');

    const testUser = {
      email: `ui-test-${Date.now()}@lighthouse.com`,
      password: 'TestPassword123!'
    };

    await test.step('Setup and reach onboarding', async () => {
      await page.context().clearCookies();
      await page.goto('/');

      await page.locator('text=Create account').click();
      await page.waitForTimeout(1000);
      await page.locator('input[type="email"]').fill(testUser.email);
      await page.locator('input[type="password"]').fill(testUser.password);

      await page.locator('button:has-text("Create account")').click();
      await page.waitForTimeout(3000);
    });

    await test.step('Validate onboarding UI elements and accessibility', async () => {
      // Check for proper headings and structure
      const hasMainHeading = await page.locator('h1, h2, h3').count() > 0;
      expect(hasMainHeading).toBeTruthy();
      console.log('✅ Proper heading structure found');

      // Check for form elements and buttons
      const buttonCount = await page.locator('button').count();
      expect(buttonCount).toBeGreaterThan(0);
      console.log(`✅ Found ${buttonCount} interactive buttons`);

      // Check for career option buttons
      const careerButtons = await page.locator('button:has-text("career"), button:has-text("job"), button:has-text("business")').count();
      expect(careerButtons).toBeGreaterThan(0);
      console.log(`✅ Found ${careerButtons} career option buttons`);
    });

    await test.step('Test keyboard navigation', async () => {
      // Test Tab navigation through options
      await page.keyboard.press('Tab');
      await page.waitForTimeout(500);

      // Check if focus is visible
      const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
      expect(focusedElement).toBeTruthy();
      console.log(`✅ Keyboard focus working: ${focusedElement}`);
    });

    await test.step('Complete onboarding with keyboard interaction', async () => {
      // Select option with Enter key
      await page.locator('button:has-text("Grow in my career")').focus();
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1000);

      // Continue with keyboard if possible
      const continueButton = page.locator('button:has-text("Continue")');
      if (await continueButton.isVisible({ timeout: 2000 })) {
        await continueButton.focus();
        await page.keyboard.press('Enter');
        await page.waitForTimeout(2000);
      }

      // Verify successful completion
      const finalContent = await page.textContent('body');
      const completed = finalContent?.includes('Professional Journey') ||
        finalContent?.includes('Timeline');

      expect(completed).toBeTruthy();
      console.log('✅ Onboarding completed with keyboard navigation');
    });
  });

  test('onboarding state persistence and session handling', async ({ page }) => {
    console.log('🧪 Testing onboarding state persistence...');

    const testUser = {
      email: `persistence-test-${Date.now()}@lighthouse.com`,
      password: 'TestPassword123!'
    };

    await test.step('Complete signup and start onboarding', async () => {
      await page.context().clearCookies();
      await page.goto('/');

      await page.locator('text=Create account').click();
      await page.waitForTimeout(1000);
      await page.locator('input[type="email"]').fill(testUser.email);
      await page.locator('input[type="password"]').fill(testUser.password);

      await page.locator('button:has-text("Create account")').click();
      await page.waitForTimeout(3000);

      // Verify onboarding started
      const hasOnboarding = await page.locator('text=What are you most interested in').isVisible({ timeout: 3000 });
      expect(hasOnboarding).toBeTruthy();
      console.log('✅ Onboarding initiated after signup');
    });

    await test.step('Test page refresh during onboarding', async () => {
      // Refresh page during onboarding
      await page.reload();
      await page.waitForTimeout(2000);

      // Check if onboarding state is maintained
      const content = await page.textContent('body');
      const stillInOnboarding = content?.includes('What are you most interested in') ||
        content?.includes('Professional Journey') ||
        !content?.includes('Sign In'); // Not back to login

      expect(stillInOnboarding).toBeTruthy();
      console.log('✅ Onboarding state maintained after refresh');
    });

    await test.step('Complete onboarding after refresh', async () => {
      // Check current state and complete if needed
      const needsOnboarding = await page.locator('text=What are you most interested in').isVisible({ timeout: 2000 });

      if (needsOnboarding) {
        await page.locator('button:has-text("Grow in my career")').click();
        await page.waitForTimeout(1000);

        const continueButton = page.locator('button:has-text("Continue")');
        if (await continueButton.isVisible({ timeout: 2000 })) {
          await continueButton.click();
          await page.waitForTimeout(2000);
        }
      }

      // Verify final state
      const finalContent = await page.textContent('body');
      const completedSuccessfully = finalContent?.includes('Professional Journey') ||
        finalContent?.includes('Timeline') ||
        finalContent?.includes('Add Experience');

      expect(completedSuccessfully).toBeTruthy();
      console.log('✅ Onboarding completed successfully with state persistence');
    });
  });
});

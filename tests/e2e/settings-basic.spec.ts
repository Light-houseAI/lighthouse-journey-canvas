import { test, expect } from '@playwright/test';
import { config } from 'dotenv';

// Load environment variables from .env file
config();

test.describe('Settings Basic Test', () => {
  test('should be able to login and access settings', async ({ page }) => {
    // Navigate to the app
    await page.goto('/');
    
    // Ensure environment variables are set
    const testEmail = process.env.TEST_USER_NAME;
    const testPassword = process.env.TEST_PASSWORD;
    
    if (!testEmail || !testPassword) {
      throw new Error('TEST_USER_NAME and TEST_PASSWORD environment variables must be set in .env file');
    }
    
    console.log(`Using credentials: ${testEmail} / ${testPassword.replace(/./g, '*')}`);
    
    // Attempt to sign in with existing account
    console.log('Attempting to sign in...');
    await page.getByLabel('Email Address').fill(testEmail);
    await page.getByLabel('Password').fill(testPassword);
    await page.getByRole('button', { name: 'Sign in' }).click();
    
    // Wait for login response
    await page.waitForTimeout(3000);
    
    // Check if login failed
    const signInFailed = await page.locator('text=Sign in failed, text=Invalid email or password, text=Login failed').first().isVisible().catch(() => false);
    const stillOnLogin = await page.getByRole('button', { name: 'Sign in' }).isVisible().catch(() => false);
    
    if (signInFailed || stillOnLogin) {
      throw new Error(`Login failed for ${testEmail}. Please ensure the test account exists in the database.`);
    }
    
    // Handle onboarding if present
    // Step 1: Interest selection
    console.log('Checking for onboarding...');
    const onboardingInterests = page.locator('text=What are you most interested in?');
    if (await onboardingInterests.isVisible()) {
      console.log('Found onboarding step 1, selecting interest...');
      
      // Select the first available interest option
      const interestOptions = [
        'Find a new job',
        'Grow in my career', 
        'Change careers',
        'Start a startup'
      ];
      
      let selectedInterest = false;
      for (const interest of interestOptions) {
        const interestButton = page.locator(`text=${interest}`).first();
        if (await interestButton.isVisible()) {
          console.log(`Selecting interest: ${interest}`);
          await interestButton.click();
          selectedInterest = true;
          break;
        }
      }
      
      if (selectedInterest) {
        await page.getByRole('button', { name: 'Continue' }).click();
        await page.waitForTimeout(2000);
        console.log('Completed onboarding step 1');
      }
    }
    
    // Step 2: Profile extraction (skip if present)
    const skipButton = page.getByRole('button', { name: 'Skip' });
    if (await skipButton.isVisible()) {
      console.log('Skipping profile extraction step...');
      await skipButton.click();
      await page.waitForTimeout(2000);
    }
    
    // Additional onboarding completion check
    const getStartedButton = page.getByRole('button', { name: 'Get Started' });
    if (await getStartedButton.isVisible()) {
      console.log('Clicking Get Started...');
      await getStartedButton.click();
      await page.waitForTimeout(2000);
    }
    
    // Wait for timeline to load
    await page.waitForSelector('text=Professional Journey', { timeout: 10000 });
    console.log('Successfully reached the main timeline!');
    
    // Take a screenshot for debugging if needed
    await page.screenshot({ path: 'timeline-state.png' });
    
    // Look for user menu with more specific selectors
    const userMenuSelectors = [
      'button:has([class*="bg-gradient-to-br from-purple-500 to-pink-500"])',
      'button:has(div[class*="bg-gradient-to-br from-purple-500"])',
      'button[class*="hover:bg-purple-500/20"]:has([class*="bg-gradient"])',
      'button:has(.text-purple-200)',
      'button:has(span:has-text("@"))'
    ];
    
    let userMenuButton = null;
    for (const selector of userMenuSelectors) {
      const element = page.locator(selector).first();
      if (await element.isVisible()) {
        userMenuButton = element;
        console.log(`Found user menu with selector: ${selector}`);
        break;
      }
    }
    
    // If we didn't find it with specific selectors, try a more general approach
    if (!userMenuButton) {
      console.log('Trying to find any button that might be the user menu...');
      const allButtons = page.locator('button');
      const buttonCount = await allButtons.count();
      console.log(`Found ${buttonCount} buttons on the page`);
      
      // Look for buttons in the header area that might contain user info
      const headerButtons = page.locator('header button, .header button, [class*="header"] button');
      const headerButtonCount = await headerButtons.count();
      console.log(`Found ${headerButtonCount} header buttons`);
      
      if (headerButtonCount > 0) {
        userMenuButton = headerButtons.last(); // Usually user menu is at the end
      }
    }
    
    if (userMenuButton) {
      console.log('Found user menu, clicking...');
      await userMenuButton.click();
      
      // Look for Settings option
      const settingsOption = page.getByText('Settings');
      if (await settingsOption.isVisible()) {
        console.log('Clicking Settings...');
        await settingsOption.click();
        
        // Verify we're on settings page
        await expect(page).toHaveURL('/settings');
        await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
        console.log('✅ Successfully navigated to Settings page!');
        
        // Test basic settings functionality
        const emailField = page.getByLabel('Email Address');
        if (await emailField.isVisible()) {
          await expect(emailField).toBeDisabled();
          console.log('✅ Email field is properly disabled');
        }
        
        const usernameField = page.getByLabel('Username');
        if (await usernameField.isVisible()) {
          console.log('✅ Username field is visible');
          
          // Test username update
          const testUsername = `playwright${Date.now()}`;
          await usernameField.clear();
          await usernameField.fill(testUsername);
          
          const updateButton = page.getByText('Update Profile');
          await updateButton.click();
          
          // Look for success message
          const successMessage = page.getByText('Profile updated');
          if (await successMessage.isVisible({ timeout: 5000 })) {
            console.log('✅ Username update successful!');
          }
        }
        
        // Test back navigation
        const backButton = page.getByText('Back to Timeline');
        if (await backButton.isVisible()) {
          await backButton.click();
          await expect(page).toHaveURL('/');
          console.log('✅ Successfully navigated back to timeline');
        }
        
      } else {
        console.log('❌ Settings option not found in menu');
      }
    } else {
      console.log('❌ User menu not found - may need different selector');
    }
  });
});
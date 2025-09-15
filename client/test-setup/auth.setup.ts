import { expect,test as setup } from '@playwright/test';

const authFile = 'playwright/.auth/user.json';

setup('authenticate test user', async ({ page }) => {
  console.log('🔐 Setting up authentication for E2E tests...');
  
  // Navigate to the home page
  await page.goto('/');
  
  // The app shows login form directly on homepage - no navigation needed
  console.log('✅ App shows login form on homepage - no navigation required');

  // Wait for login form to be visible
  await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible({ timeout: 10000 });

  // Fill in the test user credentials from environment variables
  const testEmail = process.env.TEST_USER_NAME || 'testuser@lighthouse.com';
  const testPassword = process.env.TEST_PASSWORD || 'testuser@lighthouse.com';
  
  console.log(`🧪 Logging in with test user: ${testEmail}`);
  
  // Fill email field - try multiple selectors
  const emailSelectors = [
    'input[type="email"]',
    'input[name="email"]',
    'input[placeholder*="email" i]',
    'input[label*="email" i]'
  ];
  
  let emailFilled = false;
  for (const selector of emailSelectors) {
    try {
      if (await page.locator(selector).isVisible({ timeout: 1000 })) {
        await page.locator(selector).fill(testEmail);
        emailFilled = true;
        break;
      }
    } catch (error) {
      // Continue to next selector
    }
  }
  
  if (!emailFilled) {
    throw new Error('Could not find email input field');
  }
  
  // Fill password field - try multiple selectors
  const passwordSelectors = [
    'input[type="password"]',
    'input[name="password"]',
    'input[placeholder*="password" i]'
  ];
  
  let passwordFilled = false;
  for (const selector of passwordSelectors) {
    try {
      if (await page.locator(selector).isVisible({ timeout: 1000 })) {
        await page.locator(selector).fill(testPassword);
        passwordFilled = true;
        break;
      }
    } catch (error) {
      // Continue to next selector
    }
  }
  
  if (!passwordFilled) {
    throw new Error('Could not find password input field');
  }
  
  // Submit the form
  const submitSelectors = [
    'button[type="submit"]',
    'button:has-text("Sign In")',
    'button:has-text("Login")',
    'button:has-text("Log In")',
    '[data-testid="login-submit"]'
  ];
  
  let formSubmitted = false;
  for (const selector of submitSelectors) {
    try {
      if (await page.locator(selector).isVisible({ timeout: 1000 })) {
        await page.locator(selector).click();
        formSubmitted = true;
        break;
      }
    } catch (error) {
      // Continue to next selector
    }
  }
  
  if (!formSubmitted) {
    // Try pressing Enter as fallback
    await page.keyboard.press('Enter');
  }
  
  // Wait for successful login - look for post-login indicators
  try {
    // Wait for login form to disappear and app content to appear
    await page.waitForTimeout(3000); // Give time for login processing
    
    // Look for user-specific content that appears after login
    const successIndicators = [
      'text=Timeline',
      'text=Professional Journey', 
      'text=Dashboard',
      '[data-testid="user-menu"]',
      '[data-testid="timeline"]',
      'text=Add Experience',
      'button:has-text("Add Node")',
      'text=Career Journey'
    ];
    
    let loginVerified = false;
    for (const indicator of successIndicators) {
      try {
        if (await page.locator(indicator).isVisible({ timeout: 5000 })) {
          loginVerified = true;
          console.log(`✅ Login verified with indicator: ${indicator}`);
          break;
        }
      } catch (error) {
        // Continue to next indicator
      }
    }
    
    if (!loginVerified) {
      console.warn('⚠️ Login may have succeeded, but could not verify with standard indicators');
    }
    
  } catch (error) {
    console.error('❌ Login failed or timed out:', error.message);
    
    // Check for error messages
    const errorSelectors = [
      'text=Invalid',
      'text=Error',
      'text=Failed',
      '[role="alert"]',
      '.error',
      '.alert-error'
    ];
    
    for (const selector of errorSelectors) {
      if (await page.locator(selector).isVisible({ timeout: 1000 })) {
        const errorText = await page.locator(selector).textContent();
        console.error(`Error message found: ${errorText}`);
      }
    }
    
    throw new Error(`Authentication setup failed: ${error.message}`);
  }
  
  // Save authentication state
  await page.context().storageState({ path: authFile });
  console.log('✅ Authentication setup completed and saved');
});
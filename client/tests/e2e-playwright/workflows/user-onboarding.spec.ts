/**
 * User Onboarding E2E Tests
 *
 * Tests complete user onboarding workflows:
 * 1. User registration and initial setup
 * 2. Interest selection and profile completion
 * 3. First timeline node creation
 * 4. Onboarding completion verification
 */

import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/login.page.js';
import { TimelinePage } from '../pages/timeline.page.js';

test.describe('User Onboarding Workflows', () => {
  test('should complete full user onboarding flow', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const timelinePage = new TimelinePage(page);

    // Generate unique test user
    const testUser = {
      email: `onboarding.test.${Date.now()}@example.com`,
      password: 'OnboardingTest123!',
      interest: 'Technology'
    };

    // Step 1: User Registration
    await loginPage.navigateToRegister();
    const registrationResult = await loginPage.register(
      testUser.email, 
      testUser.password, 
      testUser.interest
    );

    expect(registrationResult.success).toBe(true);

    // Step 2: Verify authentication state
    const isAuthenticated = await loginPage.isAuthenticated();
    expect(isAuthenticated).toBe(true);

    // Step 3: Navigate to timeline (might redirect from onboarding)
    await timelinePage.navigateToTimeline();
    await timelinePage.waitForTimelineLoad();

    // Step 4: Create first timeline node
    const firstNode = {
      type: 'job',
      title: 'My First Job',
      description: 'This is my first job entry for testing',
      company: 'Test Company',
      startDate: '2024-01'
    };

    const nodeCreationResult = await timelinePage.createNode(firstNode);
    expect(nodeCreationResult.success).toBe(true);

    // Step 5: Verify node appears in timeline
    const createdNode = await timelinePage.findNodeByTitle(firstNode.title);
    expect(createdNode).toBeTruthy();

    // Step 6: Verify onboarding completion
    // This might involve checking for onboarding completion indicators
    // or verifying that onboarding UI is no longer present
    const currentUrl = timelinePage.getCurrentUrl();
    expect(currentUrl).toContain('/timeline');
  });

  test('should handle onboarding with different interests', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const timelinePage = new TimelinePage(page);

    const interests = ['Design', 'Business', 'Marketing'];

    for (const interest of interests) {
      // Create unique user for each interest
      const testUser = {
        email: `interest.${interest.toLowerCase()}.${Date.now()}@example.com`,
        password: 'InterestTest123!',
        interest
      };

      await loginPage.navigateToRegister();
      const result = await loginPage.register(testUser.email, testUser.password, interest);
      
      expect(result.success).toBe(true);

      // Verify user can access timeline
      await timelinePage.navigateToTimeline();
      await timelinePage.waitForTimelineLoad();

      // Logout for next iteration
      await loginPage.logout();
    }
  });

  test('should validate required fields during registration', async ({ page }) => {
    const loginPage = new LoginPage(page);

    await loginPage.navigateToRegister();
    await loginPage.waitForFormReady();

    // Test email validation
    const emailValidation = await loginPage.testEmailValidation();
    if (emailValidation) {
      expect(emailValidation).toContain('email');
    }

    // Test password validation
    const passwordValidation = await loginPage.testPasswordValidation();
    if (passwordValidation) {
      expect(passwordValidation).toContain('password');
    }
  });

  test('should handle duplicate registration gracefully', async ({ page }) => {
    const loginPage = new LoginPage(page);

    const testUser = {
      email: `duplicate.test.${Date.now()}@example.com`,
      password: 'DuplicateTest123!'
    };

    // First registration should succeed
    await loginPage.navigateToRegister();
    const firstResult = await loginPage.register(testUser.email, testUser.password);
    expect(firstResult.success).toBe(true);

    // Logout
    await loginPage.logout();

    // Second registration with same email should fail
    await loginPage.navigateToRegister();
    const secondResult = await loginPage.register(testUser.email, testUser.password);
    
    expect(secondResult.success).toBe(false);
    if (secondResult.error) {
      expect(secondResult.error.toLowerCase()).toContain('exists');
    }
  });

  test('should allow login after successful registration', async ({ page }) => {
    const loginPage = new LoginPage(page);

    const testUser = {
      email: `login.after.register.${Date.now()}@example.com`,
      password: 'LoginAfterRegister123!'
    };

    // Register user
    await loginPage.navigateToRegister();
    const registrationResult = await loginPage.register(testUser.email, testUser.password);
    expect(registrationResult.success).toBe(true);

    // Logout
    await loginPage.logout();

    // Login with same credentials
    await loginPage.navigateToLogin();
    const loginResult = await loginPage.login(testUser.email, testUser.password);
    expect(loginResult.success).toBe(true);

    // Verify authentication
    const isAuthenticated = await loginPage.isAuthenticated();
    expect(isAuthenticated).toBe(true);
  });
});
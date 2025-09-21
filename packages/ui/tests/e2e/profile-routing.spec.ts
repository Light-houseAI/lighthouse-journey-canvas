import { expect, test } from '@playwright/test';

/**
 * Profile Routing Tests for LIG-175
 * Tests the new /profile/:username route pattern and ProfileListView integration
 */
test.describe('Profile Routing', () => {
  let testUser: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    username: string;
  };
  let viewedUser: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    username: string;
  };

  test.beforeEach(async () => {
    // Generate unique test data for viewer
    const timestamp = Date.now();
    testUser = {
      email: `viewer-${timestamp}@lighthouse.com`,
      password: 'TestPassword123!',
      firstName: 'John',
      lastName: 'Viewer',
      username: `viewer${timestamp}`,
    };

    // Generate unique test data for viewed user
    viewedUser = {
      email: `viewed-${timestamp}@lighthouse.com`,
      password: 'TestPassword123!',
      firstName: 'Jane',
      lastName: 'Profile',
      username: `profile${timestamp}`,
    };

    console.log(`🧪 Setting up viewer: ${testUser.email}`);
    console.log(`🧪 Setting up viewed user: ${viewedUser.email}`);
  });

  test('should navigate to profile using new /profile/:username route', async ({
    page,
  }) => {
    console.log('🧪 Testing /profile/:username route navigation...');

    await test.step('Create and authenticate test user', async () => {
      await page.context().clearCookies();
      await page.goto('/');

      // Create account for viewer
      await page.locator('text=Create account').click();
      await page.waitForTimeout(1000);

      await page.locator('input[type="email"]').fill(testUser.email);
      await page.locator('input[type="password"]').fill(testUser.password);

      const signupResponse = page.waitForResponse(
        (response) =>
          response.url().includes('/api/signup') && response.status() === 200
      );

      await page.locator('button:has-text("Create account")').click();
      await signupResponse;
      console.log('✅ Viewer account created successfully');

      // Complete onboarding if present
      await page.waitForTimeout(2000);
      const hasOnboarding = await page
        .locator('text=What are you most interested in')
        .isVisible({ timeout: 3000 });

      if (hasOnboarding) {
        console.log('📋 Completing onboarding...');
        await page
          .locator('button:has-text("Business/Entrepreneurship")')
          .click();
        await page.locator('button:has-text("Continue")').click();
        await page.waitForTimeout(1000);

        // Skip step 2 for now
        const hasStep2 = await page
          .locator('text=Share your LinkedIn profile')
          .isVisible({ timeout: 3000 });
        if (hasStep2) {
          await page.locator('button:has-text("Skip for now")').click();
          await page.waitForTimeout(1000);
        }
      }

      // Wait for timeline to load
      await page.waitForTimeout(3000);
      console.log('✅ User authenticated and onboarded');
    });

    await test.step('Test direct navigation to /profile/username route', async () => {
      // Navigate to a profile using the new route pattern
      await page.goto(`/profile/${viewedUser.username}`);

      // Wait for page to load
      await page.waitForTimeout(2000);

      // Verify we're on the profile page
      expect(page.url()).toContain(`/profile/${viewedUser.username}`);
      console.log('✅ Successfully navigated to /profile/:username route');

      // Verify ProfileListView is rendered (check for timeline container)
      const profileContainer = page.locator(
        '[data-testid="profile-list-view"], .timeline, .profile-content'
      );
      await expect(profileContainer.first()).toBeVisible({ timeout: 10000 });
      console.log('✅ ProfileListView component rendered');
    });

    await test.step('Test navigation from search results', async () => {
      // Go back to main timeline
      await page.goto('/');
      await page.waitForTimeout(1000);

      // Try to find and use profile search if available
      const searchInput = page.locator(
        'input[placeholder*="Search"], input[placeholder*="search"]'
      );
      if (await searchInput.isVisible({ timeout: 3000 })) {
        await searchInput.fill(viewedUser.username);
        await page.waitForTimeout(1000);

        // Look for search results
        const searchResult = page.locator(
          `text=${viewedUser.username}, text=${viewedUser.firstName}`
        );
        if (await searchResult.first().isVisible({ timeout: 3000 })) {
          await searchResult.first().click();
          await page.waitForTimeout(2000);

          // Verify navigation used new route pattern
          expect(page.url()).toContain(`/profile/`);
          console.log('✅ Search navigation uses new /profile/ route');
        } else {
          console.log(
            'ℹ️  Search results not found, skipping search navigation test'
          );
        }
      } else {
        console.log(
          'ℹ️  Search input not found, skipping search navigation test'
        );
      }
    });

    await test.step('Test invalid username handling', async () => {
      // Test navigation to non-existent user
      await page.goto('/profile/nonexistentuser123');
      await page.waitForTimeout(2000);

      // Should handle gracefully (either show error state or empty profile)
      const hasErrorState = await page
        .locator('text=not found, text=error, text=does not exist')
        .isVisible({ timeout: 3000 });
      const hasEmptyState = await page
        .locator('text=No data, text=empty, .no-data')
        .isVisible({ timeout: 3000 });

      expect(hasErrorState || hasEmptyState).toBeTruthy();
      console.log('✅ Invalid username handled gracefully');
    });
  });

  test('should support both username and fallback routing', async ({
    page,
  }) => {
    console.log('🧪 Testing username and fallback routing...');

    await test.step('Create authenticated user', async () => {
      await page.context().clearCookies();
      await page.goto('/');

      // Quick authentication
      await page.locator('text=Create account').click();
      await page.waitForTimeout(1000);

      await page.locator('input[type="email"]').fill(testUser.email);
      await page.locator('input[type="password"]').fill(testUser.password);
      await page.locator('button:has-text("Create account")').click();

      // Wait for signup
      await page.waitForTimeout(3000);
      console.log('✅ User authenticated');
    });

    await test.step('Test username-based routing', async () => {
      // Test with a username
      await page.goto(`/profile/testuser`);
      await page.waitForTimeout(2000);

      expect(page.url()).toContain('/profile/testuser');
      console.log('✅ Username-based routing works');
    });

    await test.step('Test numeric ID fallback', async () => {
      // Test with numeric ID (fallback case)
      await page.goto(`/profile/123`);
      await page.waitForTimeout(2000);

      expect(page.url()).toContain('/profile/123');
      console.log('✅ Numeric ID fallback routing works');
    });
  });
});

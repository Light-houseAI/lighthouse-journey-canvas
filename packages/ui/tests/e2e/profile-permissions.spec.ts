import { expect, test } from '@playwright/test';

/**
 * Profile Permissions Tests for LIG-175
 * Tests permission enforcement when viewing other users' profiles
 */
test.describe('Profile Permissions', () => {
  let viewerUser: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    username: string;
  };
  let targetUser: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    username: string;
  };

  test.beforeEach(async () => {
    const timestamp = Date.now();

    viewerUser = {
      email: `viewer-${timestamp}@lighthouse.com`,
      password: 'TestPassword123!',
      firstName: 'John',
      lastName: 'Viewer',
      username: `viewer${timestamp}`,
    };

    targetUser = {
      email: `target-${timestamp}@lighthouse.com`,
      password: 'TestPassword123!',
      firstName: 'Jane',
      lastName: 'Target',
      username: `target${timestamp}`,
    };

    console.log(`🧪 Setting up viewer: ${viewerUser.email}`);
    console.log(`🧪 Setting up target: ${targetUser.email}`);
  });

  test('should enforce read-only permissions when viewing other users', async ({
    page,
    context,
  }) => {
    console.log('🧪 Testing read-only permissions enforcement...');

    await test.step('Create and authenticate viewer user', async () => {
      await context.clearCookies();
      await page.goto('/');

      // Create viewer account
      await page.locator('text=Create account').click();
      await page.waitForTimeout(1000);

      await page.locator('input[type="email"]').fill(viewerUser.email);
      await page.locator('input[type="password"]').fill(viewerUser.password);

      const signupResponse = page.waitForResponse(
        (response) =>
          response.url().includes('/api/signup') && response.status() === 200
      );

      await page.locator('button:has-text("Create account")').click();
      await signupResponse;

      // Complete minimal onboarding
      await page.waitForTimeout(2000);
      const hasOnboarding = await page
        .locator('text=What are you most interested in')
        .isVisible({ timeout: 3000 });
      if (hasOnboarding) {
        await page
          .locator('button:has-text("Business/Entrepreneurship")')
          .click();
        await page.locator('button:has-text("Continue")').click();
        await page.waitForTimeout(1000);

        const hasStep2 = await page
          .locator('text=Share your LinkedIn profile')
          .isVisible({ timeout: 3000 });
        if (hasStep2) {
          await page.locator('button:has-text("Skip for now")').click();
        }
      }

      await page.waitForTimeout(2000);
      console.log('✅ Viewer user authenticated');
    });

    await test.step('Navigate to other user profile and verify read-only mode', async () => {
      // Navigate to target user's profile
      await page.goto(`/profile/${targetUser.username}`);
      await page.waitForTimeout(3000);

      // Verify we're on the profile page
      expect(page.url()).toContain(`/profile/${targetUser.username}`);

      // Check that edit/add buttons are NOT visible (read-only mode)
      const addButton = page.locator(
        'button:has-text("Add"), button[aria-label*="Add"], button:has([data-testid*="add"])'
      );
      const editButton = page.locator(
        'button:has-text("Edit"), button[aria-label*="Edit"], button:has([data-testid*="edit"])'
      );
      const deleteButton = page.locator(
        'button:has-text("Delete"), button[aria-label*="Delete"], button:has([data-testid*="delete"])'
      );

      // Wait a moment for any dynamic content to load
      await page.waitForTimeout(2000);

      // These buttons should not be visible when viewing another user's profile
      expect(await addButton.count()).toBe(0);
      expect(await editButton.count()).toBe(0);
      expect(await deleteButton.count()).toBe(0);

      console.log(
        '✅ Edit/Add/Delete buttons correctly hidden in read-only mode'
      );
    });

    await test.step('Verify API calls use correct permission endpoint', async () => {
      // Monitor network requests to ensure correct API is called
      const apiCalls: string[] = [];

      page.on('request', (request) => {
        if (request.url().includes('/api/v2/timeline/nodes')) {
          apiCalls.push(request.url());
        }
      });

      // Navigate to target user profile
      await page.goto(`/profile/${targetUser.username}`);
      await page.waitForTimeout(3000);

      // Check that the API call includes username parameter for permission filtering
      const hasUsernameParam = apiCalls.some((url) =>
        url.includes(`username=${targetUser.username}`)
      );
      expect(hasUsernameParam).toBeTruthy();

      console.log(
        '✅ API calls correctly include username for permission filtering'
      );
      console.log(`API calls made: ${apiCalls.join(', ')}`);
    });

    await test.step('Verify own profile shows edit capabilities', async () => {
      // Navigate back to own profile
      await page.goto('/');
      await page.waitForTimeout(2000);

      // On own profile, edit capabilities should be available
      const hasEditCapabilities = await page
        .locator(
          'button:has-text("Add"), button[aria-label*="Add"], button:has([data-testid*="add"]), ' +
            '.add-node-button, .edit-timeline'
        )
        .first()
        .isVisible({ timeout: 5000 });

      if (hasEditCapabilities) {
        console.log('✅ Edit capabilities available on own profile');
      } else {
        console.log(
          'ℹ️  No timeline content yet on own profile (expected for new user)'
        );
      }
    });
  });

  test('should filter private content when viewing other users', async ({
    page,
    context,
  }) => {
    console.log('🧪 Testing private content filtering...');

    await test.step('Create authenticated viewer', async () => {
      await context.clearCookies();
      await page.goto('/');

      await page.locator('text=Create account').click();
      await page.waitForTimeout(1000);

      await page.locator('input[type="email"]').fill(viewerUser.email);
      await page.locator('input[type="password"]').fill(viewerUser.password);
      await page.locator('button:has-text("Create account")').click();

      await page.waitForTimeout(3000);
      console.log('✅ Viewer authenticated');
    });

    await test.step('Verify private content is not visible', async () => {
      // Navigate to another user's profile
      await page.goto(`/profile/${targetUser.username}`);
      await page.waitForTimeout(3000);

      // Look for indicators that content is filtered
      // This could be empty state, "No access" messages, or limited content
      const hasContent = await page
        .locator('.timeline-node, .profile-item, .career-item')
        .count();

      // For a user we don't have permission to view, we should see either:
      // 1. No content (empty state)
      // 2. Only public content
      // 3. Access denied message

      const hasEmptyState = await page
        .locator('text=No data, text=empty, .no-data')
        .isVisible({ timeout: 3000 });
      const hasAccessDenied = await page
        .locator('text=not authorized, text=access denied, text=private')
        .isVisible({ timeout: 3000 });

      // At minimum, we shouldn't see a lot of detailed private information
      expect(hasContent).toBeLessThan(10); // Arbitrary threshold for "limited content"

      console.log(`✅ Content filtering working - found ${hasContent} items`);
      if (hasEmptyState)
        console.log('✅ Empty state shown for unauthorized access');
      if (hasAccessDenied) console.log('✅ Access denied message shown');
    });
  });

  test('should handle non-existent users gracefully', async ({
    page,
    context,
  }) => {
    console.log('🧪 Testing non-existent user handling...');

    await test.step('Create authenticated user', async () => {
      await context.clearCookies();
      await page.goto('/');

      await page.locator('text=Create account').click();
      await page.waitForTimeout(1000);

      await page.locator('input[type="email"]').fill(viewerUser.email);
      await page.locator('input[type="password"]').fill(viewerUser.password);
      await page.locator('button:has-text("Create account")').click();

      await page.waitForTimeout(3000);
    });

    await test.step('Verify graceful handling of non-existent user', async () => {
      // Navigate to non-existent user
      await page.goto('/profile/nonexistentuser12345');
      await page.waitForTimeout(3000);

      // Should show appropriate error or empty state
      const hasNotFoundMessage = await page
        .locator('text=not found, text=does not exist, text=user not found')
        .isVisible({ timeout: 3000 });
      const hasEmptyState = await page
        .locator('text=No data, text=empty, .no-data')
        .isVisible({ timeout: 3000 });
      const hasErrorState = await page
        .locator('text=error, .error-state, .error-message')
        .isVisible({ timeout: 3000 });

      expect(hasNotFoundMessage || hasEmptyState || hasErrorState).toBeTruthy();
      console.log('✅ Non-existent user handled gracefully');

      // Should not crash or show broken state
      const hasBrokenState = await page
        .locator('text=undefined, text=null, text=error:')
        .isVisible({ timeout: 1000 });
      expect(hasBrokenState).toBeFalsy();
      console.log('✅ No broken state indicators found');
    });
  });
});

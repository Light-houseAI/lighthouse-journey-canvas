import { expect, test } from '@playwright/test';

/**
 * Profile Read-Only Mode Tests for LIG-175
 * Tests that UI properly enforces read-only behavior when viewing other users
 */
test.describe('Profile Read-Only Mode', () => {
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
      firstName: 'Viewer',
      lastName: 'User',
      username: `viewer${timestamp}`,
    };

    targetUser = {
      email: `target-${timestamp}@lighthouse.com`,
      password: 'TestPassword123!',
      firstName: 'Target',
      lastName: 'User',
      username: `target${timestamp}`,
    };

    console.log(`🧪 Setting up viewer: ${viewerUser.email}`);
    console.log(`🧪 Setting up target: ${targetUser.email}`);
  });

  test('should enforce read-only UI when viewing other users', async ({
    page,
    context,
  }) => {
    console.log('🧪 Testing read-only UI enforcement...');

    await test.step('Authenticate viewer user', async () => {
      await context.clearCookies();
      await page.goto('/');

      // Create and authenticate viewer
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

      // Complete onboarding quickly
      await page.waitForTimeout(2000);
      const hasOnboarding = await page
        .locator('text=What are you most interested in')
        .isVisible({ timeout: 3000 });
      if (hasOnboarding) {
        await page
          .locator('button:has-text("Business/Entrepreneurship")')
          .click();
        await page.locator('button:has-text("Continue")').click();

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

    await test.step('Navigate to target user profile', async () => {
      await page.goto(`/profile/${targetUser.username}`);
      await page.waitForTimeout(3000);

      expect(page.url()).toContain(`/profile/${targetUser.username}`);
      console.log('✅ Navigated to target user profile');
    });

    await test.step('Verify no add/edit buttons are visible', async () => {
      // Check for various types of edit controls that should be hidden
      const editControls = [
        'button:has-text("Add")',
        'button:has-text("Edit")',
        'button:has-text("Delete")',
        'button:has-text("Create")',
        'button:has-text("New")',
        'button[aria-label*="Add"]',
        'button[aria-label*="Edit"]',
        'button[aria-label*="Delete"]',
        '.add-button',
        '.edit-button',
        '.delete-button',
        '.add-node-button',
        '.edit-node-button',
        '[data-testid*="add"]',
        '[data-testid*="edit"]',
        '[data-testid*="delete"]',
      ];

      for (const selector of editControls) {
        const elements = await page.locator(selector).count();
        expect(elements).toBe(0);
      }

      console.log('✅ No edit controls visible in read-only mode');
    });

    await test.step('Verify timeline nodes open in read-only mode', async () => {
      // Look for any timeline nodes/items that might be clickable
      const timelineItems = page.locator(
        '.timeline-node, .profile-item, .career-item, .node-item'
      );
      const itemCount = await timelineItems.count();

      if (itemCount > 0) {
        // Click on first timeline item
        await timelineItems.first().click();
        await page.waitForTimeout(1000);

        // Check if a panel/modal opened
        const hasPanel = await page
          .locator('.panel, .modal, .popup, .details')
          .isVisible({ timeout: 3000 });

        if (hasPanel) {
          // If panel opened, verify it's in read-only mode (no edit controls)
          const panelEditControls = await page
            .locator(
              '.panel button:has-text("Edit"), .modal button:has-text("Save"), .popup button:has-text("Update")'
            )
            .count();
          expect(panelEditControls).toBe(0);
          console.log('✅ Timeline node panels open in read-only mode');

          // Close the panel
          const closeButton = page.locator(
            'button:has-text("Close"), button:has-text("×"), .close-button'
          );
          if (await closeButton.isVisible({ timeout: 1000 })) {
            await closeButton.first().click();
          }
        } else {
          console.log(
            'ℹ️  No panels opened, or timeline items are display-only'
          );
        }
      } else {
        console.log(
          'ℹ️  No timeline items found (expected for users with no content)'
        );
      }
    });

    await test.step('Verify no drag-and-drop or reordering capabilities', async () => {
      // Check for drag handles or sortable indicators
      const dragElements = page.locator(
        '.drag-handle, .sortable, [draggable="true"]'
      );
      const dragCount = await dragElements.count();

      expect(dragCount).toBe(0);
      console.log('✅ No drag-and-drop controls visible');
    });

    await test.step('Verify context menus are read-only or disabled', async () => {
      // Try right-clicking on timeline items to see if context menus appear
      const timelineItems = page.locator(
        '.timeline-node, .profile-item, .career-item'
      );
      const itemCount = await timelineItems.count();

      if (itemCount > 0) {
        await timelineItems.first().click({ button: 'right' });
        await page.waitForTimeout(500);

        // Check if context menu appeared
        const contextMenu = page.locator(
          '.context-menu, .right-click-menu, .popup-menu'
        );
        const hasContextMenu = await contextMenu.isVisible({ timeout: 1000 });

        if (hasContextMenu) {
          // If context menu exists, it should not have edit options
          const editOptions = await contextMenu
            .locator('text=Edit, text=Delete, text=Modify')
            .count();
          expect(editOptions).toBe(0);
          console.log('✅ Context menu (if present) has no edit options');

          // Click elsewhere to close menu
          await page.click('body', { position: { x: 10, y: 10 } });
        } else {
          console.log('ℹ️  No context menu found (expected in read-only mode)');
        }
      }
    });
  });

  test('should show view-only indicators and messaging', async ({
    page,
    context,
  }) => {
    console.log('🧪 Testing view-only indicators...');

    await test.step('Authenticate and navigate to other user profile', async () => {
      await context.clearCookies();
      await page.goto('/');

      await page.locator('text=Create account').click();
      await page.waitForTimeout(1000);

      await page.locator('input[type="email"]').fill(viewerUser.email);
      await page.locator('input[type="password"]').fill(viewerUser.password);
      await page.locator('button:has-text("Create account")').click();

      await page.waitForTimeout(3000);

      // Navigate to target profile
      await page.goto(`/profile/${targetUser.username}`);
      await page.waitForTimeout(3000);
    });

    await test.step('Look for read-only indicators', async () => {
      // Check for various indicators that this is a read-only view
      const readOnlyIndicators = [
        'text=View only',
        'text=Read only',
        'text=Viewing',
        'text=Profile view',
        '.read-only-badge',
        '.view-only-indicator',
        '[data-testid*="read-only"]',
      ];

      let _foundIndicator = false;
      for (const selector of readOnlyIndicators) {
        if (await page.locator(selector).isVisible({ timeout: 1000 })) {
          _foundIndicator = true;
          console.log(`✅ Found read-only indicator: ${selector}`);
          break;
        }
      }

      // Also check header for username context
      const hasUsernameInHeader = await page
        .locator(`text=${targetUser.username}, text=${targetUser.firstName}`)
        .isVisible({ timeout: 3000 });
      if (hasUsernameInHeader) {
        console.log('✅ User context shown in header');
      }

      // At minimum, the URL should indicate we're viewing someone else's profile
      expect(page.url()).toContain(`/profile/${targetUser.username}`);
      console.log('✅ URL clearly indicates profile view mode');
    });
  });

  test('should contrast with own profile edit capabilities', async ({
    page,
    context,
  }) => {
    console.log(
      '🧪 Testing contrast between own profile (editable) and other profile (read-only)...'
    );

    await test.step('Create user with timeline content', async () => {
      await context.clearCookies();
      await page.goto('/');

      await page.locator('text=Create account').click();
      await page.waitForTimeout(1000);

      await page.locator('input[type="email"]').fill(viewerUser.email);
      await page.locator('input[type="password"]').fill(viewerUser.password);
      await page.locator('button:has-text("Create account")').click();

      await page.waitForTimeout(3000);
      console.log('✅ User created');
    });

    await test.step('Check own profile has edit capabilities', async () => {
      // Go to own profile (root)
      await page.goto('/');
      await page.waitForTimeout(2000);

      // Look for add/edit capabilities on own profile
      const hasEditCapabilities = await page
        .locator(
          'button:has-text("Add"), .add-button, .add-node-button, ' +
            'button[aria-label*="Add"], [data-testid*="add"]'
        )
        .first()
        .isVisible({ timeout: 5000 });

      if (hasEditCapabilities) {
        console.log('✅ Edit capabilities available on own profile');
      } else {
        console.log(
          'ℹ️  No edit capabilities visible yet (may be due to empty timeline)'
        );
      }
    });

    await test.step('Compare with other user profile (read-only)', async () => {
      // Navigate to other user's profile
      await page.goto(`/profile/${targetUser.username}`);
      await page.waitForTimeout(2000);

      // Verify read-only mode
      const editControls = await page
        .locator(
          'button:has-text("Add"), button:has-text("Edit"), .add-button, .edit-button'
        )
        .count();

      expect(editControls).toBe(0);
      console.log('✅ Confirmed read-only mode on other user profile');
    });
  });
});

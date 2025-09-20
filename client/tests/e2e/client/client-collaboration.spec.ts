/**
 * Playwright E2E Tests - Client Collaboration Features
 * Tests sharing, commenting, and collaborative features
 */

import { test, expect } from '@playwright/test';

test.describe('Client Collaboration Features', () => {
  test.beforeEach(async ({ page }) => {
    // Login as primary user
    await page.goto('/login');
    await page.fill('[data-testid="login-email"]', 'testuser@example.com');
    await page.fill('[data-testid="login-password"]', 'password123');
    await page.click('[data-testid="login-submit"]');
    
    await page.waitForURL('/timeline');
  });

  test('should create and share timeline link', async ({ page }) => {
    // Open share menu
    await page.click('[data-testid="share-timeline-btn"]');
    
    // Verify share modal opens
    await expect(page.locator('[data-testid="share-modal"]')).toBeVisible();
    
    // Configure share settings
    await page.selectOption('[data-testid="share-permissions"]', 'view');
    await page.selectOption('[data-testid="share-expiration"]', '30-days');
    await page.check('[data-testid="allow-comments"]');
    
    // Generate share link
    await page.click('[data-testid="generate-share-link"]');
    
    // Verify link is generated
    await expect(page.locator('[data-testid="share-link-input"]')).toBeVisible();
    const shareLink = await page.locator('[data-testid="share-link-input"]').inputValue();
    expect(shareLink).toContain('/share/');
    
    // Copy link to clipboard
    await page.click('[data-testid="copy-share-link"]');
    await expect(page.locator('[data-testid="copy-success"]')).toContainText('Link copied to clipboard');
    
    // Save share settings
    await page.click('[data-testid="save-share-settings"]');
    await expect(page.locator('[data-testid="success-message"]')).toContainText('Share link created successfully');
    
    // Verify share link appears in recent shares
    await expect(page.locator('[data-testid="recent-shares"]')).toContainText('View access');
    
    return shareLink;
  });

  test('should access shared timeline as guest', async ({ page, context }) => {
    // First create a share link
    const shareLink = await test.step('Create share link', async () => {
      await page.click('[data-testid="share-timeline-btn"]');
      await page.selectOption('[data-testid="share-permissions"]', 'view');
      await page.check('[data-testid="allow-comments"]');
      await page.click('[data-testid="generate-share-link"]');
      
      const link = await page.locator('[data-testid="share-link-input"]').inputValue();
      await page.click('[data-testid="save-share-settings"]');
      return link;
    });

    // Open new incognito context for guest access
    const guestContext = await context.browser()?.newContext();
    const guestPage = await guestContext?.newPage();
    
    if (!guestPage) return;

    // Access shared timeline as guest
    await guestPage.goto(shareLink);
    
    // Verify shared timeline is accessible
    await expect(guestPage.locator('[data-testid="shared-timeline"]')).toBeVisible();
    await expect(guestPage.locator('[data-testid="timeline-owner"]')).toContainText('testuser');
    
    // Verify timeline content is displayed
    await expect(guestPage.locator('[data-testid="timeline-item"]')).toHaveCount.greaterThan(0);
    
    // Verify edit controls are not available
    await expect(guestPage.locator('[data-testid="edit-btn"]')).not.toBeVisible();
    await expect(guestPage.locator('[data-testid="delete-btn"]')).not.toBeVisible();
    
    // Verify comment section is available
    await expect(guestPage.locator('[data-testid="comments-section"]')).toBeVisible();
    
    await guestContext?.close();
  });

  test('should add and manage comments on shared timeline', async ({ page, context }) => {
    // Create share link with comments enabled
    await page.click('[data-testid="share-timeline-btn"]');
    await page.check('[data-testid="allow-comments"]');
    await page.click('[data-testid="generate-share-link"]');
    const shareLink = await page.locator('[data-testid="share-link-input"]').inputValue();
    await page.click('[data-testid="save-share-settings"]');

    // Open as guest user
    const guestContext = await context.browser()?.newContext();
    const guestPage = await guestContext?.newPage();
    
    if (!guestPage) return;

    await guestPage.goto(shareLink);
    
    // Add comment as guest
    await guestPage.fill('[data-testid="guest-name"]', 'Guest Reviewer');
    await guestPage.fill('[data-testid="guest-email"]', 'guest@example.com');
    await guestPage.fill('[data-testid="comment-text"]', 'Great experience section! Very impressive background.');
    
    await guestPage.click('[data-testid="submit-comment"]');
    
    // Verify comment appears
    await expect(guestPage.locator('[data-testid="comment-item"]')).toContainText('Great experience section!');
    await expect(guestPage.locator('[data-testid="comment-author"]')).toContainText('Guest Reviewer');
    
    await guestContext?.close();

    // Back on original user's page, check notifications
    await page.reload();
    
    // Should see comment notification
    await expect(page.locator('[data-testid="notification-badge"]')).toBeVisible();
    
    // Open notifications
    await page.click('[data-testid="notifications-btn"]');
    await expect(page.locator('[data-testid="comment-notification"]')).toContainText('New comment on your timeline');
    
    // View comments
    await page.click('[data-testid="view-comments"]');
    await expect(page.locator('[data-testid="comment-item"]')).toContainText('Great experience section!');
    
    // Reply to comment
    await page.click('[data-testid="reply-to-comment"]');
    await page.fill('[data-testid="reply-text"]', 'Thank you for the feedback!');
    await page.click('[data-testid="submit-reply"]');
    
    await expect(page.locator('[data-testid="comment-reply"]')).toContainText('Thank you for the feedback!');
  });

  test('should moderate comments on shared timeline', async ({ page }) => {
    // First add some comments (simulated)
    await page.goto('/timeline?comments=mock');
    
    // Navigate to comment moderation
    await page.click('[data-testid="user-menu"]');
    await page.click('[data-testid="comment-moderation"]');
    
    // Verify moderation panel
    await expect(page.locator('[data-testid="moderation-panel"]')).toBeVisible();
    await expect(page.locator('[data-testid="pending-comments"]')).toBeVisible();
    
    // Approve a comment
    const firstComment = page.locator('[data-testid="comment-item"]').first();
    await firstComment.locator('[data-testid="approve-comment"]').click();
    
    await expect(page.locator('[data-testid="success-message"]')).toContainText('Comment approved');
    
    // Flag inappropriate comment
    const secondComment = page.locator('[data-testid="comment-item"]').nth(1);
    await secondComment.locator('[data-testid="flag-comment"]').click();
    
    // Verify flagging modal
    await expect(page.locator('[data-testid="flag-modal"]')).toBeVisible();
    await page.selectOption('[data-testid="flag-reason"]', 'inappropriate');
    await page.fill('[data-testid="flag-details"]', 'Contains inappropriate language');
    await page.click('[data-testid="confirm-flag"]');
    
    await expect(page.locator('[data-testid="success-message"]')).toContainText('Comment flagged for review');
    
    // Delete spam comment
    const thirdComment = page.locator('[data-testid="comment-item"]').nth(2);
    await thirdComment.locator('[data-testid="delete-comment"]').click();
    
    await expect(page.locator('[data-testid="delete-confirmation"]')).toBeVisible();
    await page.click('[data-testid="confirm-delete"]');
    
    await expect(page.locator('[data-testid="success-message"]')).toContainText('Comment deleted');
  });

  test('should collaborate on timeline with edit permissions', async ({ page, context }) => {
    // Create share link with edit permissions
    await page.click('[data-testid="share-timeline-btn"]');
    await page.selectOption('[data-testid="share-permissions"]', 'edit');
    await page.fill('[data-testid="collaborator-email"]', 'collaborator@example.com');
    await page.click('[data-testid="add-collaborator"]');
    
    await page.click('[data-testid="generate-share-link"]');
    const shareLink = await page.locator('[data-testid="share-link-input"]').inputValue();
    await page.click('[data-testid="save-share-settings"]');

    // Open as collaborator
    const collabContext = await context.browser()?.newContext();
    const collabPage = await collabContext?.newPage();
    
    if (!collabPage) return;

    // Login as collaborator
    await collabPage.goto('/login');
    await collabPage.fill('[data-testid="login-email"]', 'collaborator@example.com');
    await collabPage.fill('[data-testid="login-password"]', 'password123');
    await collabPage.click('[data-testid="login-submit"]');
    
    // Access shared timeline
    await collabPage.goto(shareLink);
    
    // Verify edit permissions are available
    await expect(collabPage.locator('[data-testid="edit-btn"]')).toBeVisible();
    await expect(collabPage.locator('[data-testid="add-experience-btn"]')).toBeVisible();
    
    // Edit an existing experience
    await collabPage.click('[data-testid="edit-btn"]');
    await collabPage.fill('[data-testid="edit-note"]', 'Updated by collaborator - added more details about the project scope.');
    await collabPage.click('[data-testid="save-edit"]');
    
    // Add suggestion for new experience
    await collabPage.click('[data-testid="suggest-addition"]');
    await collabPage.fill('[data-testid="suggestion-title"]', 'Consider adding internship experience');
    await collabPage.fill('[data-testid="suggestion-details"]', 'Your summer internship at StartupCo would add value to this timeline.');
    await collabPage.click('[data-testid="submit-suggestion"]');
    
    await expect(collabPage.locator('[data-testid="success-message"]')).toContainText('Suggestion submitted');
    
    await collabContext?.close();

    // Back on owner's timeline, check for collaboration notifications
    await page.reload();
    
    // Should see edit notification
    await expect(page.locator('[data-testid="notification-badge"]')).toBeVisible();
    
    // Review suggestions
    await page.click('[data-testid="notifications-btn"]');
    await page.click('[data-testid="view-suggestions"]');
    
    await expect(page.locator('[data-testid="suggestion-item"]')).toContainText('Consider adding internship experience');
    
    // Accept suggestion
    await page.click('[data-testid="accept-suggestion"]');
    await expect(page.locator('[data-testid="success-message"]')).toContainText('Suggestion accepted');
  });

  test('should export shared timeline with custom branding', async ({ page }) => {
    // Configure sharing with custom branding
    await page.click('[data-testid="share-timeline-btn"]');
    await page.click('[data-testid="advanced-options"]');
    
    // Enable custom branding
    await page.check('[data-testid="enable-branding"]');
    await page.fill('[data-testid="custom-title"]', 'Professional Journey - John Doe');
    await page.fill('[data-testid="custom-description"]', 'Senior Software Engineer with expertise in React and Node.js');
    
    // Upload custom logo
    await page.setInputFiles('[data-testid="logo-upload"]', './test-assets/personal-logo.png');
    
    // Set color theme
    await page.click('[data-testid="color-theme"]');
    await page.click('[data-testid="theme-professional"]');
    
    // Generate shareable PDF
    await page.click('[data-testid="generate-pdf"]');
    
    // Wait for PDF generation
    await expect(page.locator('[data-testid="pdf-generating"]')).toBeVisible();
    
    const downloadPromise = page.waitForEvent('download');
    await expect(page.locator('[data-testid="download-pdf"]')).toBeVisible();
    await page.click('[data-testid="download-pdf"]');
    
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('professional-timeline');
    
    // Generate shareable web version
    await page.click('[data-testid="generate-web-version"]');
    const webLink = await page.locator('[data-testid="web-version-link"]').inputValue();
    
    expect(webLink).toContain('/portfolio/');
    
    // Verify custom branding appears in preview
    await page.click('[data-testid="preview-portfolio"]');
    await expect(page.locator('[data-testid="portfolio-title"]')).toContainText('Professional Journey - John Doe');
    await expect(page.locator('[data-testid="portfolio-logo"]')).toBeVisible();
  });

  test('should manage share permissions and revoke access', async ({ page }) => {
    // Create multiple share links
    await page.click('[data-testid="share-timeline-btn"]');
    
    // Add individual collaborators
    await page.fill('[data-testid="collaborator-email"]', 'colleague1@example.com');
    await page.selectOption('[data-testid="collaborator-permission"]', 'view');
    await page.click('[data-testid="add-collaborator"]');
    
    await page.fill('[data-testid="collaborator-email"]', 'colleague2@example.com');
    await page.selectOption('[data-testid="collaborator-permission"]', 'edit');
    await page.click('[data-testid="add-collaborator"]');
    
    // Create public share link
    await page.click('[data-testid="create-public-link"]');
    await page.selectOption('[data-testid="public-link-permission"]', 'view');
    
    // Save all sharing settings
    await page.click('[data-testid="save-all-shares"]');
    
    // Navigate to share management
    await page.click('[data-testid="manage-shares"]');
    
    // Verify all shares are listed
    await expect(page.locator('[data-testid="individual-shares"]')).toContainText('colleague1@example.com');
    await expect(page.locator('[data-testid="individual-shares"]')).toContainText('colleague2@example.com');
    await expect(page.locator('[data-testid="public-links"]')).toHaveCount(1);
    
    // Update permissions for colleague1
    await page.click('[data-testid="edit-colleague1-permissions"]');
    await page.selectOption('[data-testid="permission-select"]', 'edit');
    await page.click('[data-testid="save-permission-change"]');
    
    await expect(page.locator('[data-testid="success-message"]')).toContainText('Permissions updated');
    
    // Revoke access for colleague2
    await page.click('[data-testid="revoke-colleague2-access"]');
    await expect(page.locator('[data-testid="revoke-confirmation"]')).toBeVisible();
    await page.click('[data-testid="confirm-revoke"]');
    
    await expect(page.locator('[data-testid="success-message"]')).toContainText('Access revoked');
    
    // Disable public link
    await page.click('[data-testid="disable-public-link"]');
    await expect(page.locator('[data-testid="public-link-disabled"]')).toBeVisible();
    
    // Verify colleague2 can no longer access
    // This would typically be tested with multiple browser contexts
    await expect(page.locator('[data-testid="active-shares"]')).not.toContainText('colleague2@example.com');
  });

  test('should track collaboration analytics', async ({ page }) => {
    // Navigate to sharing analytics
    await page.click('[data-testid="user-menu"]');
    await page.click('[data-testid="settings-link"]');
    await page.click('[data-testid="analytics-tab"]');
    
    // Verify analytics dashboard
    await expect(page.locator('[data-testid="sharing-analytics"]')).toBeVisible();
    
    // Check view metrics
    await expect(page.locator('[data-testid="total-views"]')).toBeVisible();
    await expect(page.locator('[data-testid="unique-visitors"]')).toBeVisible();
    await expect(page.locator('[data-testid="avg-time-on-page"]')).toBeVisible();
    
    // View detailed statistics
    await page.click('[data-testid="view-detailed-stats"]');
    
    // Verify detailed metrics
    await expect(page.locator('[data-testid="views-chart"]')).toBeVisible();
    await expect(page.locator('[data-testid="geographic-data"]')).toBeVisible();
    await expect(page.locator('[data-testid="referral-sources"]')).toBeVisible();
    
    // Check comment engagement
    await expect(page.locator('[data-testid="comment-metrics"]')).toBeVisible();
    await expect(page.locator('[data-testid="total-comments"]')).toContainText(/\d+/);
    
    // Export analytics data
    const downloadPromise = page.waitForEvent('download');
    await page.click('[data-testid="export-analytics"]');
    
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('timeline-analytics');
  });

  test('should handle collaboration conflicts and version control', async ({ page, context }) => {
    // Create shared timeline with edit permissions
    await page.click('[data-testid="share-timeline-btn"]');
    await page.selectOption('[data-testid="share-permissions"]', 'edit');
    await page.click('[data-testid="generate-share-link"]');
    const shareLink = await page.locator('[data-testid="share-link-input"]').inputValue();
    await page.click('[data-testid="save-share-settings"]');

    // Open two collaborative sessions
    const collab1Context = await context.browser()?.newContext();
    const collab1Page = await collab1Context?.newPage();
    
    const collab2Context = await context.browser()?.newContext();
    const collab2Page = await collab2Context?.newPage();
    
    if (!collab1Page || !collab2Page) return;

    // Both collaborators access the same timeline
    await Promise.all([
      collab1Page.goto(shareLink),
      collab2Page.goto(shareLink)
    ]);

    // Collaborator 1 starts editing an experience
    await collab1Page.click('[data-testid="edit-btn"]');
    await collab1Page.fill('[data-testid="experience-title"]', 'Senior Software Engineer - Updated by Collab1');
    
    // Collaborator 2 also tries to edit the same experience
    await collab2Page.click('[data-testid="edit-btn"]');
    
    // Should show conflict warning
    await expect(collab2Page.locator('[data-testid="edit-conflict-warning"]')).toContainText(
      'This entry is currently being edited by another user'
    );
    
    // Collaborator 1 saves changes
    await collab1Page.click('[data-testid="save-experience"]');
    
    // Collaborator 2 should see the updated version
    await expect(collab2Page.locator('[data-testid="conflict-resolution"]')).toBeVisible();
    await expect(collab2Page.locator('[data-testid="latest-version"]')).toContainText('Updated by Collab1');
    
    // Collaborator 2 can choose to merge or discard their changes
    await collab2Page.fill('[data-testid="experience-description"]', 'Additional details added by Collab2');
    await collab2Page.click('[data-testid="merge-changes"]');
    
    await expect(collab2Page.locator('[data-testid="success-message"]')).toContainText('Changes merged successfully');
    
    // Check version history
    await page.click('[data-testid="view-history"]');
    await expect(page.locator('[data-testid="version-item"]')).toHaveCount.greaterThan(1);
    
    // Restore previous version if needed
    await page.click('[data-testid="restore-version"]');
    await expect(page.locator('[data-testid="restore-confirmation"]')).toBeVisible();
    await page.click('[data-testid="confirm-restore"]');
    
    await expect(page.locator('[data-testid="success-message"]')).toContainText('Version restored');
    
    await Promise.all([
      collab1Context?.close(),
      collab2Context?.close()
    ]);
  });
});
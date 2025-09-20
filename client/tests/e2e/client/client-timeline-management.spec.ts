/**
 * Playwright E2E Tests - Client Timeline Management
 * Tests timeline CRUD operations and user interactions
 */

import { test, expect } from '@playwright/test';

test.describe('Client Timeline Management', () => {
  test.beforeEach(async ({ page }) => {
    // Login as authenticated user
    await page.goto('/login');
    await page.fill('[data-testid="login-email"]', 'testuser@example.com');
    await page.fill('[data-testid="login-password"]', 'password123');
    await page.click('[data-testid="login-submit"]');
    
    // Wait for redirect to timeline
    await page.waitForURL('/timeline');
  });

  test('should display existing timeline entries', async ({ page }) => {
    // Verify timeline loads
    await expect(page.locator('[data-testid="timeline-container"]')).toBeVisible();
    
    // Check for existing entries
    const timelineItems = page.locator('[data-testid="timeline-item"]');
    await expect(timelineItems).toHaveCount.greaterThan(0);
    
    // Verify entry details are displayed
    const firstItem = timelineItems.first();
    await expect(firstItem.locator('[data-testid="item-title"]')).toBeVisible();
    await expect(firstItem.locator('[data-testid="item-company"]')).toBeVisible();
    await expect(firstItem.locator('[data-testid="item-dates"]')).toBeVisible();
  });

  test('should add new work experience', async ({ page }) => {
    // Click add experience button
    await page.click('[data-testid="add-experience-btn"]');
    
    // Verify modal opens
    await expect(page.locator('[data-testid="experience-modal"]')).toBeVisible();
    
    // Fill out experience form
    await page.fill('[data-testid="experience-title"]', 'Senior Software Engineer');
    await page.fill('[data-testid="experience-company"]', 'Innovative Tech Solutions');
    await page.fill('[data-testid="experience-location"]', 'San Francisco, CA');
    await page.fill('[data-testid="experience-start-date"]', '2024-01-01');
    await page.fill('[data-testid="experience-end-date"]', '2024-12-31');
    
    // Add job description
    await page.fill('[data-testid="experience-description"]', 
      'Led a team of 5 developers in building scalable web applications. ' +
      'Implemented microservices architecture and improved system performance by 40%.'
    );
    
    // Add skills
    await page.fill('[data-testid="skills-input"]', 'React');
    await page.keyboard.press('Enter');
    await page.fill('[data-testid="skills-input"]', 'Node.js');
    await page.keyboard.press('Enter');
    await page.fill('[data-testid="skills-input"]', 'PostgreSQL');
    await page.keyboard.press('Enter');
    
    // Verify skills are added
    await expect(page.locator('[data-testid="skill-tag"]')).toHaveCount(3);
    
    // Set privacy to public
    await page.check('[data-testid="public-visibility"]');
    
    // Save the experience
    await page.click('[data-testid="save-experience"]');
    
    // Verify success message
    await expect(page.locator('[data-testid="success-message"]')).toContainText('Experience added successfully');
    
    // Verify new experience appears in timeline
    await expect(page.locator('[data-testid="timeline-item"]').last()).toContainText('Senior Software Engineer');
    await expect(page.locator('[data-testid="timeline-item"]').last()).toContainText('Innovative Tech Solutions');
  });

  test('should add education entry', async ({ page }) => {
    await page.click('[data-testid="add-education-btn"]');
    
    await expect(page.locator('[data-testid="education-modal"]')).toBeVisible();
    
    // Fill education form
    await page.fill('[data-testid="education-degree"]', 'Master of Computer Science');
    await page.fill('[data-testid="education-institution"]', 'Stanford University');
    await page.fill('[data-testid="education-location"]', 'Stanford, CA');
    await page.fill('[data-testid="education-start-date"]', '2022-09-01');
    await page.fill('[data-testid="education-end-date"]', '2024-06-01');
    await page.fill('[data-testid="education-gpa"]', '3.8');
    
    // Add relevant coursework
    await page.fill('[data-testid="education-description"]', 
      'Focused on distributed systems and machine learning. ' +
      'Completed capstone project on real-time data processing.'
    );
    
    // Add academic achievements
    await page.fill('[data-testid="skills-input"]', 'Machine Learning');
    await page.keyboard.press('Enter');
    await page.fill('[data-testid="skills-input"]', 'Distributed Systems');
    await page.keyboard.press('Enter');
    
    await page.click('[data-testid="save-education"]');
    
    await expect(page.locator('[data-testid="success-message"]')).toContainText('Education added successfully');
    await expect(page.locator('[data-testid="timeline-item"]').last()).toContainText('Master of Computer Science');
  });

  test('should edit existing timeline entry', async ({ page }) => {
    // Click edit button on first timeline item
    const firstItem = page.locator('[data-testid="timeline-item"]').first();
    await firstItem.locator('[data-testid="edit-btn"]').click();
    
    // Verify edit modal opens with existing data
    await expect(page.locator('[data-testid="experience-modal"]')).toBeVisible();
    
    // Verify fields are pre-filled
    const titleField = page.locator('[data-testid="experience-title"]');
    await expect(titleField).not.toHaveValue('');
    
    // Update the title
    await titleField.clear();
    await titleField.fill('Lead Software Engineer');
    
    // Update description
    await page.locator('[data-testid="experience-description"]').clear();
    await page.fill('[data-testid="experience-description"]', 
      'Promoted to lead engineer role. Mentored junior developers and drove technical decisions.'
    );
    
    // Add new skill
    await page.fill('[data-testid="skills-input"]', 'Team Leadership');
    await page.keyboard.press('Enter');
    
    // Save changes
    await page.click('[data-testid="save-experience"]');
    
    await expect(page.locator('[data-testid="success-message"]')).toContainText('Experience updated successfully');
    
    // Verify changes are reflected
    await expect(firstItem).toContainText('Lead Software Engineer');
  });

  test('should delete timeline entry with confirmation', async ({ page }) => {
    // Get initial count of timeline items
    const initialCount = await page.locator('[data-testid="timeline-item"]').count();
    
    // Click delete button on first item
    const firstItem = page.locator('[data-testid="timeline-item"]').first();
    await firstItem.locator('[data-testid="delete-btn"]').click();
    
    // Verify confirmation dialog appears
    await expect(page.locator('[data-testid="delete-confirmation"]')).toBeVisible();
    await expect(page.locator('[data-testid="delete-confirmation"]')).toContainText('Are you sure you want to delete this entry?');
    
    // Cancel first to test cancellation
    await page.click('[data-testid="cancel-delete"]');
    await expect(page.locator('[data-testid="delete-confirmation"]')).not.toBeVisible();
    
    // Verify item still exists
    await expect(page.locator('[data-testid="timeline-item"]')).toHaveCount(initialCount);
    
    // Delete again and confirm
    await firstItem.locator('[data-testid="delete-btn"]').click();
    await page.click('[data-testid="confirm-delete"]');
    
    await expect(page.locator('[data-testid="success-message"]')).toContainText('Entry deleted successfully');
    
    // Verify item count decreased
    await expect(page.locator('[data-testid="timeline-item"]')).toHaveCount(initialCount - 1);
  });

  test('should toggle entry privacy settings', async ({ page }) => {
    const firstItem = page.locator('[data-testid="timeline-item"]').first();
    
    // Check current privacy status
    const privacyToggle = firstItem.locator('[data-testid="privacy-toggle"]');
    const isCurrentlyPrivate = await privacyToggle.isChecked();
    
    // Toggle privacy
    await privacyToggle.click();
    
    // Verify privacy changed
    await expect(privacyToggle).toBeChecked({ checked: !isCurrentlyPrivate });
    
    // Verify visual indicator
    if (!isCurrentlyPrivate) {
      await expect(firstItem.locator('[data-testid="private-indicator"]')).toBeVisible();
    } else {
      await expect(firstItem.locator('[data-testid="private-indicator"]')).not.toBeVisible();
    }
    
    await expect(page.locator('[data-testid="success-message"]')).toContainText('Privacy setting updated');
  });

  test('should filter timeline by entry type', async ({ page }) => {
    // Open filter menu
    await page.click('[data-testid="filter-btn"]');
    
    // Verify filter options are available
    await expect(page.locator('[data-testid="filter-menu"]')).toBeVisible();
    
    // Filter by experience only
    await page.click('[data-testid="filter-experience"]');
    await page.click('[data-testid="apply-filters"]');
    
    // Verify only experience entries are shown
    const visibleItems = page.locator('[data-testid="timeline-item"]:visible');
    await expect(visibleItems).toHaveCount.greaterThan(0);
    
    // Check that education entries are hidden
    const educationItems = page.locator('[data-testid="timeline-item"][data-type="education"]:visible');
    await expect(educationItems).toHaveCount(0);
    
    // Clear filters
    await page.click('[data-testid="clear-filters"]');
    
    // Verify all items are visible again
    await expect(page.locator('[data-testid="timeline-item"]:visible')).toHaveCount.greaterThan(0);
  });

  test('should search timeline entries', async ({ page }) => {
    // Use search functionality
    await page.fill('[data-testid="search-input"]', 'engineer');
    
    // Verify search results
    const searchResults = page.locator('[data-testid="timeline-item"]:visible');
    await expect(searchResults).toHaveCount.greaterThan(0);
    
    // Verify search highlights
    await expect(page.locator('[data-testid="search-highlight"]').first()).toBeVisible();
    
    // Clear search
    await page.click('[data-testid="clear-search"]');
    
    // Verify all items are visible
    await expect(page.locator('[data-testid="search-input"]')).toHaveValue('');
  });

  test('should reorder timeline entries with drag and drop', async ({ page }) => {
    const items = page.locator('[data-testid="timeline-item"]');
    const firstItem = items.first();
    const secondItem = items.nth(1);
    
    // Get initial order
    const firstItemText = await firstItem.locator('[data-testid="item-title"]').textContent();
    const secondItemText = await secondItem.locator('[data-testid="item-title"]').textContent();
    
    // Perform drag and drop
    await firstItem.dragTo(secondItem);
    
    // Verify order changed
    const newFirstItem = items.first();
    const newSecondItem = items.nth(1);
    
    await expect(newFirstItem.locator('[data-testid="item-title"]')).toContainText(secondItemText);
    await expect(newSecondItem.locator('[data-testid="item-title"]')).toContainText(firstItemText);
    
    await expect(page.locator('[data-testid="success-message"]')).toContainText('Timeline order updated');
  });

  test('should export timeline data', async ({ page }) => {
    // Open export menu
    await page.click('[data-testid="export-btn"]');
    
    // Verify export options
    await expect(page.locator('[data-testid="export-menu"]')).toBeVisible();
    
    // Export as PDF
    const downloadPromise = page.waitForEvent('download');
    await page.click('[data-testid="export-pdf"]');
    const download = await downloadPromise;
    
    // Verify download
    expect(download.suggestedFilename()).toContain('.pdf');
    
    // Export as JSON
    const jsonDownloadPromise = page.waitForEvent('download');
    await page.click('[data-testid="export-btn"]');
    await page.click('[data-testid="export-json"]');
    const jsonDownload = await jsonDownloadPromise;
    
    expect(jsonDownload.suggestedFilename()).toContain('.json');
  });

  test('should handle timeline sharing', async ({ page }) => {
    // Open share menu
    await page.click('[data-testid="share-btn"]');
    
    // Verify share modal
    await expect(page.locator('[data-testid="share-modal"]')).toBeVisible();
    
    // Generate share link
    await page.click('[data-testid="generate-share-link"]');
    
    // Verify share link is generated
    await expect(page.locator('[data-testid="share-link"]')).toBeVisible();
    
    // Copy link to clipboard
    await page.click('[data-testid="copy-link"]');
    
    await expect(page.locator('[data-testid="success-message"]')).toContainText('Link copied to clipboard');
    
    // Set expiration
    await page.selectOption('[data-testid="share-expiration"]', '7-days');
    
    // Update permissions
    await page.check('[data-testid="allow-comments"]');
    
    // Save share settings
    await page.click('[data-testid="save-share-settings"]');
    
    await expect(page.locator('[data-testid="success-message"]')).toContainText('Share settings updated');
  });

  test('should validate form inputs', async ({ page }) => {
    await page.click('[data-testid="add-experience-btn"]');
    
    // Try to save without required fields
    await page.click('[data-testid="save-experience"]');
    
    // Verify validation errors
    await expect(page.locator('[data-testid="title-error"]')).toContainText('Title is required');
    await expect(page.locator('[data-testid="company-error"]')).toContainText('Company is required');
    await expect(page.locator('[data-testid="start-date-error"]')).toContainText('Start date is required');
    
    // Fill invalid date range
    await page.fill('[data-testid="experience-start-date"]', '2024-01-01');
    await page.fill('[data-testid="experience-end-date"]', '2023-01-01');
    
    await page.click('[data-testid="save-experience"]');
    
    await expect(page.locator('[data-testid="date-range-error"]')).toContainText('End date must be after start date');
    
    // Fix dates
    await page.fill('[data-testid="experience-end-date"]', '2024-12-31');
    
    // Add minimum required fields
    await page.fill('[data-testid="experience-title"]', 'Test Position');
    await page.fill('[data-testid="experience-company"]', 'Test Company');
    
    // Should be able to save now
    await page.click('[data-testid="save-experience"]');
    
    await expect(page.locator('[data-testid="success-message"]')).toContainText('Experience added successfully');
  });

  test('should handle network errors gracefully', async ({ page }) => {
    // Mock network error for save operation
    await page.route('**/api/timeline', route => route.abort());
    
    await page.click('[data-testid="add-experience-btn"]');
    
    await page.fill('[data-testid="experience-title"]', 'Network Test');
    await page.fill('[data-testid="experience-company"]', 'Test Corp');
    await page.fill('[data-testid="experience-start-date"]', '2024-01-01');
    
    await page.click('[data-testid="save-experience"]');
    
    // Verify error handling
    await expect(page.locator('[data-testid="error-message"]')).toContainText('Failed to save experience');
    await expect(page.locator('[data-testid="retry-btn"]')).toBeVisible();
    
    // Remove network mock and retry
    await page.unroute('**/api/timeline');
    await page.click('[data-testid="retry-btn"]');
    
    await expect(page.locator('[data-testid="success-message"]')).toContainText('Experience added successfully');
  });

  test('should support keyboard navigation', async ({ page }) => {
    // Test keyboard navigation through timeline
    await page.keyboard.press('Tab');
    await expect(page.locator('[data-testid="add-experience-btn"]')).toBeFocused();
    
    await page.keyboard.press('Tab');
    await expect(page.locator('[data-testid="search-input"]')).toBeFocused();
    
    await page.keyboard.press('Tab');
    await expect(page.locator('[data-testid="filter-btn"]')).toBeFocused();
    
    // Navigate to first timeline item
    await page.keyboard.press('Tab');
    await expect(page.locator('[data-testid="timeline-item"]').first().locator('[data-testid="edit-btn"]')).toBeFocused();
    
    // Test arrow key navigation between timeline items
    await page.keyboard.press('ArrowDown');
    await expect(page.locator('[data-testid="timeline-item"]').nth(1).locator('[data-testid="edit-btn"]')).toBeFocused();
    
    await page.keyboard.press('ArrowUp');
    await expect(page.locator('[data-testid="timeline-item"]').first().locator('[data-testid="edit-btn"]')).toBeFocused();
  });

  test('should maintain data persistence across page refreshes', async ({ page }) => {
    // Add a new experience
    await page.click('[data-testid="add-experience-btn"]');
    await page.fill('[data-testid="experience-title"]', 'Persistence Test');
    await page.fill('[data-testid="experience-company"]', 'Test Company');
    await page.fill('[data-testid="experience-start-date"]', '2024-01-01');
    await page.click('[data-testid="save-experience"]');
    
    // Verify it's added
    await expect(page.locator('[data-testid="timeline-item"]').last()).toContainText('Persistence Test');
    
    // Refresh the page
    await page.reload();
    
    // Verify data persists
    await expect(page.locator('[data-testid="timeline-item"]')).toContainText('Persistence Test');
  });
});
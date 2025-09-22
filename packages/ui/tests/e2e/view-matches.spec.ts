/**
 * E2E Tests for View Matches Button Feature (LIG-179)
 *
 * Tests the complete user journey for the view matches button feature.
 * These tests validate the full integration from UI to backend API.
 */

import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

// Test data constants
const TEST_USER_EMAIL = 'test@example.com';
const TEST_USER_PASSWORD = 'TestPassword123!';

// Helper function to login
async function loginUser(page: Page) {
  await page.goto('/login');
  await page.fill('input[name="email"]', TEST_USER_EMAIL);
  await page.fill('input[name="password"]', TEST_USER_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL('/timeline');
}

// Helper function to create a current job node
async function createCurrentJobNode(page: Page) {
  await page.click('button:has-text("Add Experience")');
  await page.selectOption('select[name="type"]', 'job');
  await page.fill('input[name="role"]', 'Senior Software Engineer');
  await page.fill('textarea[name="description"]', 'Building scalable React applications with TypeScript');
  await page.fill('input[name="startDate"]', '2023-01');
  // Leave endDate empty for current job
  await page.click('button:has-text("Save")');
  await page.waitForSelector('.timeline-node:has-text("Senior Software Engineer")');
}

// Helper function to create a past job node
async function createPastJobNode(page: Page) {
  await page.click('button:has-text("Add Experience")');
  await page.selectOption('select[name="type"]', 'job');
  await page.fill('input[name="role"]', 'Junior Developer');
  await page.fill('textarea[name="description"]', 'Learning web development fundamentals');
  await page.fill('input[name="startDate"]', '2021-01');
  await page.fill('input[name="endDate"]', '2022-12');
  await page.click('button:has-text("Save")');
  await page.waitForSelector('.timeline-node:has-text("Junior Developer")');
}

test.describe('View Matches Button - Visibility', () => {
  test.beforeEach(async ({ page }) => {
    await loginUser(page);
  });

  test('should show matches button for current job experiences', async ({ page }) => {
    // Create a current job node
    await createCurrentJobNode(page);

    // Wait for the matches button to appear
    const matchesButton = page.locator('.timeline-node:has-text("Senior Software Engineer") button:has-text("View")');

    // Button should be visible after matches are fetched
    await expect(matchesButton).toBeVisible({ timeout: 5000 });

    // Button should contain match count
    const buttonText = await matchesButton.textContent();
    expect(buttonText).toMatch(/View \d+ match(es)?/);
  });

  test('should not show matches button for past job experiences', async ({ page }) => {
    // Create a past job node
    await createPastJobNode(page);

    // Wait a moment for any potential button to appear
    await page.waitForTimeout(2000);

    // Button should not exist for past experiences
    const matchesButton = page.locator('.timeline-node:has-text("Junior Developer") button:has-text("View")');
    await expect(matchesButton).not.toBeVisible();
  });

  test('should show matches button for current education', async ({ page }) => {
    // Create a current education node
    await page.click('button:has-text("Add Experience")');
    await page.selectOption('select[name="type"]', 'education');
    await page.fill('input[name="degree"]', 'Master of Computer Science');
    await page.fill('textarea[name="description"]', 'Specializing in distributed systems and machine learning');
    await page.fill('input[name="startDate"]', '2023-09');
    // Leave endDate empty for current education
    await page.click('button:has-text("Save")');

    await page.waitForSelector('.timeline-node:has-text("Master of Computer Science")');

    // Wait for the matches button to appear
    const matchesButton = page.locator('.timeline-node:has-text("Master of Computer Science") button:has-text("View")');

    // Button should be visible after matches are fetched
    await expect(matchesButton).toBeVisible({ timeout: 5000 });
  });

  test('should not show matches button for project nodes', async ({ page }) => {
    // Create a project node
    await page.click('button:has-text("Add Project")');
    await page.fill('input[name="title"]', 'Portfolio Website');
    await page.fill('textarea[name="description"]', 'Personal portfolio built with React and Next.js');
    await page.click('button:has-text("Save")');

    await page.waitForSelector('.timeline-node:has-text("Portfolio Website")');
    await page.waitForTimeout(2000);

    // Button should not exist for project nodes
    const matchesButton = page.locator('.timeline-node:has-text("Portfolio Website") button:has-text("View")');
    await expect(matchesButton).not.toBeVisible();
  });

  test('should update button when experience becomes current', async ({ page }) => {
    // Create a past job that we'll update to current
    await createPastJobNode(page);

    // Initially no button should be visible
    let matchesButton = page.locator('.timeline-node:has-text("Junior Developer") button:has-text("View")');
    await expect(matchesButton).not.toBeVisible();

    // Edit the node to make it current
    await page.click('.timeline-node:has-text("Junior Developer") button[aria-label="Edit"]');
    await page.fill('input[name="endDate"]', ''); // Clear end date
    await page.click('button:has-text("Save")');

    // Now button should appear
    await expect(matchesButton).toBeVisible({ timeout: 5000 });
  });

  test('should hide button when no matches are found', async ({ page }) => {
    // Create a current job with very specific description unlikely to have matches
    await page.click('button:has-text("Add Experience")');
    await page.selectOption('select[name="type"]', 'job');
    await page.fill('input[name="role"]', 'Unique Position XYZ123');
    await page.fill('textarea[name="description"]', 'Very unique description that will not match anything xyz789');
    await page.fill('input[name="startDate"]', '2023-01');
    await page.click('button:has-text("Save")');

    await page.waitForSelector('.timeline-node:has-text("Unique Position XYZ123")');
    await page.waitForTimeout(3000); // Wait for API call

    // Button should not be visible if no matches
    const matchesButton = page.locator('.timeline-node:has-text("Unique Position XYZ123") button:has-text("View")');
    await expect(matchesButton).not.toBeVisible();
  });
});

test.describe('View Matches Button - Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await loginUser(page);
    await createCurrentJobNode(page);
  });

  test('should navigate to search results page on click', async ({ page }) => {
    // Wait for matches button
    const matchesButton = page.locator('.timeline-node:has-text("Senior Software Engineer") button:has-text("View")');
    await expect(matchesButton).toBeVisible({ timeout: 5000 });

    // Click the button
    await matchesButton.click();

    // Should navigate to search results page
    await page.waitForURL(/\/search\?q=.*/);

    // Verify we're on the search page
    expect(page.url()).toContain('/search');
    expect(page.url()).toContain('q=');

    // Search query should be in the URL
    const url = new URL(page.url());
    const searchQuery = url.searchParams.get('q');
    expect(searchQuery).toBeTruthy();
    expect(searchQuery).toContain('React'); // From the description
  });

  test('should show search results after navigation', async ({ page }) => {
    // Click matches button
    const matchesButton = page.locator('.timeline-node:has-text("Senior Software Engineer") button:has-text("View")');
    await matchesButton.click();

    // Wait for navigation
    await page.waitForURL(/\/search\?q=.*/);

    // Wait for search results to load
    await page.waitForSelector('.search-results', { timeout: 10000 });

    // Should display search results
    const results = page.locator('.search-result-item');
    await expect(results.first()).toBeVisible();

    // Results should be relevant (contain matching terms)
    const firstResult = await results.first().textContent();
    expect(firstResult?.toLowerCase()).toMatch(/react|typescript|software|engineer/i);
  });

  test('should maintain search query in search input field', async ({ page }) => {
    // Click matches button
    const matchesButton = page.locator('.timeline-node:has-text("Senior Software Engineer") button:has-text("View")');
    await matchesButton.click();

    // Wait for navigation
    await page.waitForURL(/\/search\?q=.*/);

    // Search input should contain the query
    const searchInput = page.locator('input[type="search"], input[placeholder*="Search"]');
    const inputValue = await searchInput.inputValue();
    expect(inputValue).toContain('Building scalable React applications');
  });

  test('should handle special characters in search query', async ({ page }) => {
    // Create node with special characters
    await page.click('button:has-text("Add Experience")');
    await page.selectOption('select[name="type"]', 'job');
    await page.fill('input[name="role"]', 'C++ & Python Developer');
    await page.fill('textarea[name="description"]', 'Working with C++ & Python/Django frameworks');
    await page.fill('input[name="startDate"]', '2023-06');
    await page.click('button:has-text("Save")');

    await page.waitForSelector('.timeline-node:has-text("C++ & Python Developer")');

    // Click matches button
    const matchesButton = page.locator('.timeline-node:has-text("C++ & Python Developer") button:has-text("View")');
    await expect(matchesButton).toBeVisible({ timeout: 5000 });
    await matchesButton.click();

    // Should navigate with properly encoded URL
    await page.waitForURL(/\/search\?q=.*/);

    const url = new URL(page.url());
    const searchQuery = url.searchParams.get('q');
    expect(searchQuery).toContain('C++');
    expect(searchQuery).toContain('Python');
  });
});

test.describe('View Matches Button - Loading States', () => {
  test.beforeEach(async ({ page }) => {
    await loginUser(page);
  });

  test('should show loading state while fetching matches', async ({ page }) => {
    // Create a current job node
    await createCurrentJobNode(page);

    // Look for loading indicator
    const loadingIndicator = page.locator('.timeline-node:has-text("Senior Software Engineer") .loading-spinner, .timeline-node:has-text("Senior Software Engineer") [data-testid="loading-spinner"]');

    // Loading state should appear briefly
    await expect(loadingIndicator).toBeVisible({ timeout: 2000 });

    // Then should be replaced by button or hidden
    await expect(loadingIndicator).not.toBeVisible({ timeout: 5000 });
  });

  test('should handle slow network gracefully', async ({ page }) => {
    // Simulate slow network
    await page.route('**/api/v2/experience/*/matches', async route => {
      await page.waitForTimeout(3000); // 3 second delay
      await route.continue();
    });

    await createCurrentJobNode(page);

    // Should show loading state for longer
    const loadingIndicator = page.locator('.timeline-node:has-text("Senior Software Engineer") .loading-spinner');
    await expect(loadingIndicator).toBeVisible();

    // Eventually should show button or handle timeout
    await page.waitForTimeout(5000);

    // Either button appears or loading disappears
    const matchesButton = page.locator('.timeline-node:has-text("Senior Software Engineer") button:has-text("View")');
    const buttonVisible = await matchesButton.isVisible();
    const loadingVisible = await loadingIndicator.isVisible();

    expect(buttonVisible || !loadingVisible).toBeTruthy();
  });
});

test.describe('View Matches Button - Cache Behavior', () => {
  test.beforeEach(async ({ page }) => {
    await loginUser(page);
    await createCurrentJobNode(page);
  });

  test('should use cached results on page refresh', async ({ page }) => {
    // Wait for initial load
    const matchesButton = page.locator('.timeline-node:has-text("Senior Software Engineer") button:has-text("View")');
    await expect(matchesButton).toBeVisible({ timeout: 5000 });

    const initialText = await matchesButton.textContent();

    // Refresh the page
    await page.reload();

    // Button should appear quickly with same data (from cache)
    await expect(matchesButton).toBeVisible({ timeout: 1000 }); // Faster due to cache
    const refreshedText = await matchesButton.textContent();

    expect(refreshedText).toBe(initialText);
  });

  test('should refresh data when node is updated', async ({ page }) => {
    // Wait for initial button
    const matchesButton = page.locator('.timeline-node:has-text("Senior Software Engineer") button:has-text("View")');
    await expect(matchesButton).toBeVisible({ timeout: 5000 });

    // Edit the node description
    await page.click('.timeline-node:has-text("Senior Software Engineer") button[aria-label="Edit"]');
    await page.fill('textarea[name="description"]', 'Expert in React, Node.js, and cloud architecture');
    await page.click('button:has-text("Save")');

    // Wait for potential update
    await page.waitForTimeout(2000);

    // Button should still be visible (might have different count)
    await expect(matchesButton).toBeVisible();
  });
});

test.describe('View Matches Button - Error Scenarios', () => {
  test.beforeEach(async ({ page }) => {
    await loginUser(page);
  });

  test('should handle API errors gracefully', async ({ page }) => {
    // Mock API to return error
    await page.route('**/api/v2/experience/*/matches', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: {
            code: 'SEARCH_SERVICE_ERROR',
            message: 'Failed to fetch matches',
          },
        }),
      });
    });

    await createCurrentJobNode(page);

    // Wait for API call
    await page.waitForTimeout(3000);

    // Button should not be visible on error
    const matchesButton = page.locator('.timeline-node:has-text("Senior Software Engineer") button:has-text("View")');
    await expect(matchesButton).not.toBeVisible();

    // No error message should break the UI
    await expect(page.locator('.timeline-node:has-text("Senior Software Engineer")')).toBeVisible();
  });

  test('should handle network failures', async ({ page }) => {
    // Block API requests
    await page.route('**/api/v2/experience/*/matches', route => route.abort());

    await createCurrentJobNode(page);

    // Wait for timeout
    await page.waitForTimeout(3000);

    // Button should not appear
    const matchesButton = page.locator('.timeline-node:has-text("Senior Software Engineer") button:has-text("View")');
    await expect(matchesButton).not.toBeVisible();

    // UI should remain functional
    await expect(page.locator('.timeline-node')).toBeVisible();
  });
});
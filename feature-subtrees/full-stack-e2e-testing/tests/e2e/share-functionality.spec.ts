import { test, expect } from '@playwright/test';

test.describe('Share Functionality', () => {
  test.beforeEach(async ({ page }) => {
    // Set up auth bypass with X-User-Id header
    await page.route('**/*', async (route) => {
      const headers = {
        ...route.request().headers(),
        'X-User-Id': '1'
      };
      await route.continue({ headers });
    });

    // Navigate to the timeline page
    await page.goto('http://localhost:3000/');
    
    // Wait for the page to load
    await page.waitForLoadState('networkidle');
  });

  test('should open share modal when share all button is clicked', async ({ page }) => {
    // Look for the share button in the header (share all functionality)
    const shareAllButton = page.locator('[data-testid="share-all-button"], button:has-text("Share")').first();
    
    // Click the share all button
    await shareAllButton.click();
    
    // Check if the share modal opened
    await expect(page.locator('[role="dialog"]')).toBeVisible();
    
    // Check if "Share Timeline Nodes" title is visible
    await expect(page.locator('text=Share Timeline Nodes')).toBeVisible();
    
    // Check if "Share all my timeline nodes" checkbox is visible and checked
    const shareAllCheckbox = page.locator('#share-all');
    await expect(shareAllCheckbox).toBeVisible();
    await expect(shareAllCheckbox).toBeChecked();
  });

  test('should open share modal with specific node selected when node share button is clicked', async ({ page }) => {
    // Wait for timeline nodes to load
    await page.waitForSelector('[data-testid="timeline-node"], .timeline-node', { timeout: 10000 });
    
    // Click on a timeline node to open the node panel
    const timelineNode = page.locator('[data-testid="timeline-node"], .timeline-node').first();
    await timelineNode.click();
    
    // Wait for the node panel to open
    await page.waitForSelector('[data-testid="node-panel"], .node-panel', { timeout: 5000 });
    
    // Look for the share button in the node panel
    const nodeShareButton = page.locator('[data-testid="node-share-button"], button:has([data-testid="share-icon"]), button:has-text("Share")').last();
    
    // Click the node share button
    await nodeShareButton.click();
    
    // Check if the share modal opened
    await expect(page.locator('[role="dialog"]')).toBeVisible();
    
    // Check if "Share Timeline Nodes" title is visible
    await expect(page.locator('text=Share Timeline Nodes')).toBeVisible();
    
    // Check if "Share all my timeline nodes" checkbox is NOT checked (since we're sharing specific node)
    const shareAllCheckbox = page.locator('#share-all');
    await expect(shareAllCheckbox).toBeVisible();
    await expect(shareAllCheckbox).not.toBeChecked();
    
    // Check if selected nodes section is visible
    await expect(page.locator('text=Selected nodes:')).toBeVisible();
  });

  test('should show selected node details when sharing specific node', async ({ page }) => {
    // Wait for timeline nodes to load
    await page.waitForSelector('[data-testid="timeline-node"], .timeline-node', { timeout: 10000 });
    
    // Click on a timeline node to open the node panel
    const timelineNode = page.locator('[data-testid="timeline-node"], .timeline-node').first();
    await timelineNode.click();
    
    // Wait for the node panel to open
    await page.waitForSelector('[data-testid="node-panel"], .node-panel', { timeout: 5000 });
    
    // Look for the share button in the node panel
    const nodeShareButton = page.locator('[data-testid="node-share-button"], button:has([data-testid="share-icon"]), button:has-text("Share")').last();
    
    // Click the node share button
    await nodeShareButton.click();
    
    // Check if the share modal opened
    await expect(page.locator('[role="dialog"]')).toBeVisible();
    
    // Verify that selected nodes are displayed with their details
    const selectedNodesSection = page.locator('text=Selected nodes:').locator('..').locator('..');
    await expect(selectedNodesSection).toBeVisible();
    
    // Check that at least one node is shown in the selected nodes list
    const nodeCards = selectedNodesSection.locator('div').filter({ hasText: /^((?!Selected nodes:).)*$/ }).first();
    await expect(nodeCards).toBeVisible();
  });

  test('should toggle between share all and specific nodes', async ({ page }) => {
    // Wait for timeline nodes to load
    await page.waitForSelector('[data-testid="timeline-node"], .timeline-node', { timeout: 10000 });
    
    // Click on a timeline node to open the node panel
    const timelineNode = page.locator('[data-testid="timeline-node"], .timeline-node').first();
    await timelineNode.click();
    
    // Wait for the node panel to open
    await page.waitForSelector('[data-testid="node-panel"], .node-panel', { timeout: 5000 });
    
    // Click the node share button to open modal with specific node
    const nodeShareButton = page.locator('[data-testid="node-share-button"], button:has([data-testid="share-icon"]), button:has-text("Share")').last();
    await nodeShareButton.click();
    
    // Verify we start with specific node selected (not share all)
    const shareAllCheckbox = page.locator('#share-all');
    await expect(shareAllCheckbox).not.toBeChecked();
    await expect(page.locator('text=Selected nodes:')).toBeVisible();
    
    // Click the "Share all" checkbox
    await shareAllCheckbox.click();
    
    // Verify it's now checked and selected nodes section is hidden
    await expect(shareAllCheckbox).toBeChecked();
    await expect(page.locator('text=Selected nodes:')).not.toBeVisible();
    
    // Uncheck "Share all" again
    await shareAllCheckbox.click();
    
    // Verify it's unchecked but no nodes are selected now
    await expect(shareAllCheckbox).not.toBeChecked();
    await expect(page.locator('text=Selected nodes:')).not.toBeVisible();
  });

  test('should not show node selector input', async ({ page }) => {
    // Open share modal from header
    const shareAllButton = page.locator('[data-testid="share-all-button"], button:has-text("Share")').first();
    await shareAllButton.click();
    
    // Verify the share modal opened
    await expect(page.locator('[role="dialog"]')).toBeVisible();
    
    // Verify that there's no MultiSelectInput or search input for nodes
    await expect(page.locator('input[placeholder*="Search and select specific nodes"]')).not.toBeVisible();
    await expect(page.locator('input[placeholder*="Search nodes"]')).not.toBeVisible();
    
    // Toggle off "Share all" to see if any input appears
    const shareAllCheckbox = page.locator('#share-all');
    await shareAllCheckbox.click();
    
    // Still should not show any node search/select input
    await expect(page.locator('input[placeholder*="Search and select specific nodes"]')).not.toBeVisible();
    await expect(page.locator('input[placeholder*="Search nodes"]')).not.toBeVisible();
  });

  test('should close modal when cancel is clicked', async ({ page }) => {
    // Open share modal
    const shareAllButton = page.locator('[data-testid="share-all-button"], button:has-text("Share")').first();
    await shareAllButton.click();
    
    // Verify modal is open
    await expect(page.locator('[role="dialog"]')).toBeVisible();
    
    // Click cancel button
    await page.locator('button:has-text("Cancel")').click();
    
    // Verify modal is closed
    await expect(page.locator('[role="dialog"]')).not.toBeVisible();
  });
});
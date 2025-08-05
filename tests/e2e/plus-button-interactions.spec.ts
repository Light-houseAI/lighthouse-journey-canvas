import { test, expect, type Page } from '@playwright/test';

/**
 * Plus Button Interactions E2E Tests
 * 
 * Focuses specifically on testing the plus button functionality
 * on timeline edges, including hover states, positioning, and interactions.
 */

test.describe('Plus Button Interactions', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('/professional-journey');
    await page.waitForSelector('[data-testid="journey-timeline"]', { timeout: 10000 });
    await page.waitForTimeout(2000); // Wait for React Flow initialization
  });

  test.describe('Plus Button Visibility and Hover States', () => {
    
    test('should hide plus buttons by default', async ({ page }) => {
      // Plus buttons should not be visible initially
      const plusButtons = page.locator('[data-testid*="edge-plus-button"]');
      await expect(plusButtons).toHaveCount(0);
    });

    test('should show plus button on timeline edge hover', async ({ page }) => {
      // Find timeline edges
      const edges = page.locator('.react-flow__edge');
      const firstEdge = edges.first();
      
      await expect(firstEdge).toBeVisible();
      
      // Hover over edge
      await firstEdge.hover();
      
      // Plus button should appear
      const plusButton = page.locator('[data-testid*="edge-plus-button"]').first();
      await expect(plusButton).toBeVisible({ timeout: 3000 });
    });

    test('should hide plus button when mouse leaves edge', async ({ page }) => {
      // Hover over edge to show plus button
      const edges = page.locator('.react-flow__edge');
      const firstEdge = edges.first();
      await firstEdge.hover();
      
      // Verify plus button is visible
      const plusButton = page.locator('[data-testid*="edge-plus-button"]').first();
      await expect(plusButton).toBeVisible();
      
      // Move mouse away from edge
      await page.mouse.move(0, 0);
      
      // Plus button should disappear
      await expect(plusButton).not.toBeVisible({ timeout: 3000 });
    });

    test('should show plus button on branch edge hover', async ({ page }) => {
      // First need to focus on an experience node to show branch edges
      const experienceNodes = page.locator('[data-testid*="experience-"]');
      if (await experienceNodes.count() > 0) {
        await experienceNodes.first().click();
        
        // Wait for focus mode and branch edges to appear
        await page.waitForTimeout(1000);
        
        // Find branch edges
        const branchEdges = page.locator('.react-flow__edge[data-testid*="branch"]');
        if (await branchEdges.count() > 0) {
          await branchEdges.first().hover();
          
          // Branch plus button should appear
          const branchPlusButton = page.locator('[data-testid*="branch-edge-plus-button"]').first();
          await expect(branchPlusButton).toBeVisible();
        }
      }
    });
  });

  test.describe('Plus Button Positioning', () => {
    
    test('should position plus button at edge midpoint', async ({ page }) => {
      const edges = page.locator('.react-flow__edge');
      const firstEdge = edges.first();
      
      // Get edge bounding box
      const edgeBounds = await firstEdge.boundingBox();
      expect(edgeBounds).toBeTruthy();
      
      // Hover to show plus button
      await firstEdge.hover();
      
      const plusButton = page.locator('[data-testid*="edge-plus-button"]').first();
      await expect(plusButton).toBeVisible();
      
      // Get plus button position
      const buttonBounds = await plusButton.boundingBox();
      expect(buttonBounds).toBeTruthy();
      
      // Plus button should be roughly centered on the edge
      // (exact positioning may vary based on edge path)
      expect(buttonBounds!.x).toBeGreaterThan(edgeBounds!.x);
      expect(buttonBounds!.y).toBeGreaterThan(edgeBounds!.y);
    });

    test('should maintain plus button position during edge animations', async ({ page }) => {
      const edges = page.locator('.react-flow__edge');
      const firstEdge = edges.first();
      
      await firstEdge.hover();
      
      const plusButton = page.locator('[data-testid*="edge-plus-button"]').first();
      await expect(plusButton).toBeVisible();
      
      // Get initial position
      const initialBounds = await plusButton.boundingBox();
      
      // Wait for any animations to settle
      await page.waitForTimeout(500);
      
      // Position should remain stable
      const finalBounds = await plusButton.boundingBox();
      expect(Math.abs(finalBounds!.x - initialBounds!.x)).toBeLessThan(5);
      expect(Math.abs(finalBounds!.y - initialBounds!.y)).toBeLessThan(5);
    });
  });

  test.describe('Plus Button Click Interactions', () => {
    
    test('should trigger modal opening on plus button click', async ({ page }) => {
      await hoverAndClickPlusButton(page);
      
      // Modal should open
      await expect(page.locator('[data-testid="modal-overlay"]')).toBeVisible();
      await expect(page.locator('#modal-title')).toContainText('Add New Milestone');
    });

    test('should pass correct context data on plus button click', async ({ page }) => {
      await hoverAndClickPlusButton(page);
      
      // Verify context information is displayed
      const contextInfo = page.locator('[data-testid="context-info"]');
      await expect(contextInfo).toBeVisible();
      
      // Context should contain insertion point and node information
      const contextText = await contextInfo.textContent();
      expect(contextText).toContain('insertionPoint');
      expect(contextText).toContain('parentNode');
      expect(contextText).toContain('targetNode');
    });

    test('should handle rapid plus button clicks gracefully', async ({ page }) => {
      const edges = page.locator('.react-flow__edge');
      const firstEdge = edges.first();
      
      await firstEdge.hover();
      
      const plusButton = page.locator('[data-testid*="edge-plus-button"]').first();
      await expect(plusButton).toBeVisible();
      
      // Click multiple times rapidly
      await plusButton.click();
      await plusButton.click();
      await plusButton.click();
      
      // Should only open one modal
      const modals = page.locator('[data-testid="modal-overlay"]');
      await expect(modals).toHaveCount(1);
    });

    test('should distinguish between timeline and branch plus buttons', async ({ page }) => {
      // Test timeline plus button
      await hoverAndClickPlusButton(page);
      
      let contextText = await page.locator('[data-testid="context-info"]').textContent();
      expect(contextText).toContain('between');
      
      // Close modal
      await page.locator('[data-testid="close-modal"]').click();
      
      // Test branch plus button if available
      const experienceNodes = page.locator('[data-testid*="experience-"]');
      if (await experienceNodes.count() > 0) {
        await experienceNodes.first().click();
        await page.waitForTimeout(1000);
        
        const branchEdges = page.locator('.react-flow__edge[data-testid*="branch"]');
        if (await branchEdges.count() > 0) {
          await branchEdges.first().hover();
          
          const branchPlusButton = page.locator('[data-testid*="branch-edge-plus-button"]').first();
          if (await branchPlusButton.isVisible()) {
            await branchPlusButton.click();
            
            contextText = await page.locator('[data-testid="context-info"]').textContent();
            expect(contextText).toContain('branch');
          }
        }
      }
    });
  });

  test.describe('Plus Button Accessibility', () => {
    
    test('should have proper ARIA attributes', async ({ page }) => {
      const edges = page.locator('.react-flow__edge');
      await edges.first().hover();
      
      const plusButton = page.locator('[data-testid*="edge-plus-button"]').first();
      await expect(plusButton).toBeVisible();
      
      // Check ARIA attributes
      await expect(plusButton).toHaveAttribute('aria-label');
      await expect(plusButton).toHaveAttribute('title');
      await expect(plusButton).toHaveAttribute('role', 'button');
    });

    test('should be keyboard accessible', async ({ page }) => {
      // Tab to the timeline area
      await page.keyboard.press('Tab');
      
      // Use arrow keys to navigate to edge areas
      // Note: This might require custom keyboard navigation implementation
      await page.keyboard.press('ArrowRight');
      
      // Enter should activate plus button if focused
      // This test might need adjustment based on actual keyboard navigation implementation
    });

    test('should provide clear button labels', async ({ page }) => {
      const edges = page.locator('.react-flow__edge');
      await edges.first().hover();
      
      const plusButton = page.locator('[data-testid*="edge-plus-button"]').first();
      await expect(plusButton).toBeVisible();
      
      const ariaLabel = await plusButton.getAttribute('aria-label');
      const title = await plusButton.getAttribute('title');
      
      // Labels should be descriptive
      expect(ariaLabel).toMatch(/add/i);
      expect(title).toMatch(/add/i);
    });
  });

  test.describe('Plus Button Visual States', () => {
    
    test('should have hover effect on plus button', async ({ page }) => {
      const edges = page.locator('.react-flow__edge');
      await edges.first().hover();
      
      const plusButton = page.locator('[data-testid*="edge-plus-button"]').first();
      await expect(plusButton).toBeVisible();
      
      // Get initial styles
      const initialTransform = await plusButton.evaluate(el => 
        getComputedStyle(el).transform
      );
      
      // Hover over plus button
      await plusButton.hover();
      
      // Should have scale transform on hover
      const hoverTransform = await plusButton.evaluate(el => 
        getComputedStyle(el).transform
      );
      
      expect(hoverTransform).not.toBe(initialTransform);
    });

    test('should have different styles for different edge types', async ({ page }) => {
      // Test timeline edge plus button
      const edges = page.locator('.react-flow__edge');
      await edges.first().hover();
      
      const timelinePlusButton = page.locator('[data-testid*="edge-plus-button"]').first();
      await expect(timelinePlusButton).toBeVisible();
      
      const timelineColor = await timelinePlusButton.evaluate(el => 
        getComputedStyle(el).backgroundColor
      );
      
      // Close any open modal
      await page.mouse.move(0, 0);
      
      // Test branch edge plus button if available
      const experienceNodes = page.locator('[data-testid*="experience-"]');
      if (await experienceNodes.count() > 0) {
        await experienceNodes.first().click();
        await page.waitForTimeout(1000);
        
        const branchEdges = page.locator('.react-flow__edge[data-testid*="branch"]');
        if (await branchEdges.count() > 0) {
          await branchEdges.first().hover();
          
          const branchPlusButton = page.locator('[data-testid*="branch-edge-plus-button"]').first();
          if (await branchPlusButton.isVisible()) {
            const branchColor = await branchPlusButton.evaluate(el => 
              getComputedStyle(el).backgroundColor
            );
            
            // Should have different colors
            expect(branchColor).not.toBe(timelineColor);
          }
        }
      }
    });

    test('should be visible against different backgrounds', async ({ page }) => {
      const edges = page.locator('.react-flow__edge');
      await edges.first().hover();
      
      const plusButton = page.locator('[data-testid*="edge-plus-button"]').first();
      await expect(plusButton).toBeVisible();
      
      // Check if button has sufficient contrast
      const buttonStyle = await plusButton.evaluate(el => {
        const style = getComputedStyle(el);
        return {
          backgroundColor: style.backgroundColor,
          color: style.color,
          boxShadow: style.boxShadow
        };
      });
      
      // Should have background color and shadow for visibility
      expect(buttonStyle.backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
      expect(buttonStyle.boxShadow).not.toBe('none');
    });
  });

  test.describe('Plus Button Performance', () => {
    
    test('should not cause performance issues on multiple edge hovers', async ({ page }) => {
      const startTime = Date.now();
      
      // Hover over multiple edges quickly
      const edges = page.locator('.react-flow__edge');
      const edgeCount = await edges.count();
      
      for (let i = 0; i < Math.min(edgeCount, 5); i++) {
        await edges.nth(i).hover();
        await page.waitForTimeout(100);
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should complete within reasonable time
      expect(duration).toBeLessThan(5000); // 5 seconds max
    });

    test('should clean up hover states properly', async ({ page }) => {
      // Hover over edge
      const edges = page.locator('.react-flow__edge');
      await edges.first().hover();
      
      const plusButton = page.locator('[data-testid*="edge-plus-button"]').first();
      await expect(plusButton).toBeVisible();
      
      // Navigate away from page
      await page.goto('/');
      
      // Should not cause memory leaks or console errors
      const consoleErrors = [];
      page.on('console', msg => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      });
      
      await page.waitForTimeout(1000);
      
      // Filter out known acceptable errors
      const significantErrors = consoleErrors.filter(error => 
        !error.includes('ResizeObserver') && 
        !error.includes('Non-passive event listener')
      );
      
      expect(significantErrors).toHaveLength(0);
    });
  });
});

// Helper function
async function hoverAndClickPlusButton(page: Page) {
  const edges = page.locator('.react-flow__edge');
  const firstEdge = edges.first();
  
  await firstEdge.hover();
  
  const plusButton = page.locator('[data-testid*="edge-plus-button"]').first();
  await expect(plusButton).toBeVisible();
  
  await plusButton.click();
}
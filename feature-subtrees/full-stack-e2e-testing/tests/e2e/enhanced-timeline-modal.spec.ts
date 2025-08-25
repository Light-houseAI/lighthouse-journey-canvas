import { test, expect, type Page } from '@playwright/test';

/**
 * Enhanced Timeline Interactions - Modal System E2E Tests
 * 
 * This test suite covers:
 * 1. Current modal functionality (regression prevention)
 * 2. Plus button interactions on timeline edges
 * 3. Form validation for all node types
 * 4. API integration with /api/save-milestone
 * 5. New multi-step modal requirements (failing tests for future implementation)
 * 6. Support for 6 node types with visual cards
 */

test.describe('Enhanced Timeline Modal System', () => {
  
  test.beforeEach(async ({ page }) => {
    // Navigate to the main timeline page
    await page.goto('/professional-journey');
    
    // Wait for the timeline to load
    await page.waitForSelector('[data-testid="journey-timeline"]', { timeout: 10000 });
    
    // Wait for React Flow to initialize
    await page.waitForTimeout(2000);
  });

  test.describe('Current Modal Functionality - Regression Tests', () => {
    
    test('should display timeline with plus buttons on edge hover', async ({ page }) => {
      // Find timeline edges
      const edges = page.locator('.react-flow__edge');
      await expect(edges.first()).toBeVisible();
      
      // Hover over first edge to reveal plus button
      await edges.first().hover();
      
      // Check if plus button appears
      const plusButton = page.locator('[data-testid*="edge-plus-button"]').first();
      await expect(plusButton).toBeVisible({ timeout: 5000 });
    });

    test('should open AddNodeModal when plus button is clicked', async ({ page }) => {
      // Find and hover over timeline edge
      const edges = page.locator('.react-flow__edge');
      await edges.first().hover();
      
      // Click plus button
      const plusButton = page.locator('[data-testid*="edge-plus-button"]').first();
      await plusButton.click();
      
      // Verify modal opens
      await expect(page.locator('[data-testid="modal-overlay"]')).toBeVisible();
      await expect(page.locator('#modal-title')).toContainText('Add New Milestone');
      
      // Verify context information is displayed
      await expect(page.locator('[data-testid="context-info"]')).toBeVisible();
    });

    test('should display node type dropdown in modal', async ({ page }) => {
      // Open modal
      await openModal(page);
      
      // Verify type selector exists
      const typeSelector = page.locator('[data-testid="node-type-selector"]');
      await expect(typeSelector).toBeVisible();
      
      // Click to open dropdown
      await typeSelector.click();
      
      // Verify available options
      await expect(page.locator('text="Work Experience"')).toBeVisible();
      await expect(page.locator('text="Education"')).toBeVisible();
      await expect(page.locator('text="Project"')).toBeVisible();
      await expect(page.locator('text="Skill"')).toBeVisible();
    });

    test('should close modal when cancel button is clicked', async ({ page }) => {
      // Open modal
      await openModal(page);
      
      // Click cancel button
      await page.locator('[data-testid="close-modal"]').click();
      
      // Verify modal is closed
      await expect(page.locator('[data-testid="modal-overlay"]')).not.toBeVisible();
    });

    test('should close modal when clicking outside', async ({ page }) => {
      // Open modal
      await openModal(page);
      
      // Click outside modal (on overlay)
      await page.locator('[data-testid="modal-overlay"]').click({ position: { x: 10, y: 10 } });
      
      // Verify modal is closed
      await expect(page.locator('[data-testid="modal-overlay"]')).not.toBeVisible();
    });
  });

  test.describe('Form Validation Tests', () => {

    test('should validate Work Experience form', async ({ page }) => {
      await openModal(page);
      
      // Select Work Experience
      await selectNodeType(page, 'workExperience');
      
      // Try to submit empty form
      await page.locator('[data-testid="submit-button"]').click();
      
      // Verify validation errors
      await expect(page.locator('text="Job title is required"')).toBeVisible();
      await expect(page.locator('text="Company is required"')).toBeVisible();
      await expect(page.locator('text="Start date is required"')).toBeVisible();
      
      // Fill required fields
      await page.fill('#title', 'Software Engineer');
      await page.fill('#company', 'Tech Corp');
      await page.fill('#start', '2023-01');
      
      // Verify no validation errors for valid data
      await page.locator('[data-testid="submit-button"]').click();
      
      // Should not show required field errors
      await expect(page.locator('text="Job title is required"')).not.toBeVisible();
      await expect(page.locator('text="Company is required"')).not.toBeVisible();
      await expect(page.locator('text="Start date is required"')).not.toBeVisible();
    });

    test('should validate Education form', async ({ page }) => {
      await openModal(page);
      
      // Select Education
      await selectNodeType(page, 'education');
      
      // Try to submit empty form
      await page.locator('[data-testid="submit-button"]').click();
      
      // Verify validation errors
      await expect(page.locator('text="Institution is required"')).toBeVisible();
      await expect(page.locator('text="Degree is required"')).toBeVisible();
      await expect(page.locator('text="Field of study is required"')).toBeVisible();
      await expect(page.locator('text="Start date is required"')).toBeVisible();
      
      // Fill required fields
      await page.fill('#school', 'University of Tech');
      await page.fill('#degree', 'Bachelor of Science');
      await page.fill('#field', 'Computer Science');
      await page.fill('#start', '2019-09');
      
      // Submit valid form
      await page.locator('[data-testid="submit-button"]').click();
      
      // Should not show validation errors
      await expect(page.locator('text="Institution is required"')).not.toBeVisible();
    });

    test('should validate Project form', async ({ page }) => {
      await openModal(page);
      
      // Select Project
      await selectNodeType(page, 'project');
      
      // Try to submit empty form
      await page.locator('[data-testid="submit-button"]').click();
      
      // Verify validation errors
      await expect(page.locator('text="Project name is required"')).toBeVisible();
      
      // Fill required field
      await page.fill('#title', 'My Awesome Project');
      
      // Submit valid form
      await page.locator('[data-testid="submit-button"]').click();
      
      // Should not show validation error
      await expect(page.locator('text="Project name is required"')).not.toBeVisible();
    });

    test('should validate Skill form', async ({ page }) => {
      await openModal(page);
      
      // Select Skill
      await selectNodeType(page, 'skill');
      
      // Try to submit empty form
      await page.locator('[data-testid="submit-button"]').click();
      
      // Verify validation errors
      await expect(page.locator('text="Skill name is required"')).toBeVisible();
      await expect(page.locator('text="Proficiency Level"')).toBeVisible();
      
      // Fill required fields
      await page.fill('#name', 'JavaScript');
      await page.click('[data-testid="proficiency-selector"]');
      await page.click('text="Advanced"');
      
      // Submit valid form
      await page.locator('[data-testid="submit-button"]').click();
      
      // Should not show validation errors
      await expect(page.locator('text="Skill name is required"')).not.toBeVisible();
    });

    test('should validate date format and logic', async ({ page }) => {
      await openModal(page);
      
      // Select Work Experience
      await selectNodeType(page, 'workExperience');
      
      // Fill form with invalid date format
      await page.fill('#title', 'Software Engineer');
      await page.fill('#company', 'Tech Corp');
      await page.fill('#start', 'invalid-date');
      
      await page.locator('[data-testid="submit-button"]').click();
      
      // Verify date format validation
      await expect(page.locator('text="Invalid date format"')).toBeVisible();
      
      // Fix start date and test end date logic
      await page.fill('#start', '2023-06');
      await page.fill('#end', '2023-01'); // End before start
      
      await page.locator('[data-testid="submit-button"]').click();
      
      // Verify date logic validation
      await expect(page.locator('text="End date must be after start date"')).toBeVisible();
    });

    test('should handle ongoing checkbox correctly', async ({ page }) => {
      await openModal(page);
      
      // Select Work Experience
      await selectNodeType(page, 'workExperience');
      
      // Fill basic info
      await page.fill('#title', 'Software Engineer');
      await page.fill('#company', 'Tech Corp');
      await page.fill('#start', '2023-01');
      await page.fill('#end', '2024-01');
      
      // Check ongoing checkbox
      await page.check('#isOngoing');
      
      // Verify end date field is disabled and cleared
      const endDateField = page.locator('#end');
      await expect(endDateField).toBeDisabled();
      await expect(endDateField).toHaveValue('');
    });
  });

  test.describe('API Integration Tests', () => {

    test('should call /api/save-milestone on form submission', async ({ page }) => {
      // Set up API response monitoring
      const apiPromise = page.waitForRequest(request => 
        request.url().includes('/api/save-milestone') && request.method() === 'POST'
      );
      
      await openModal(page);
      
      // Fill and submit work experience form
      await selectNodeType(page, 'workExperience');
      await page.fill('#title', 'Senior Developer');
      await page.fill('#company', 'Innovation Labs');
      await page.fill('#start', '2023-03');
      await page.fill('#location', 'San Francisco, CA');
      await page.fill('#description', 'Lead development of key features');
      
      await page.locator('[data-testid="submit-button"]').click();
      
      // Wait for API call
      const request = await apiPromise;
      
      // Verify request details
      expect(request.method()).toBe('POST');
      expect(request.headers()['content-type']).toContain('application/json');
      
      // Verify request body contains expected data
      const requestBody = request.postDataJSON();
      expect(requestBody.milestone.type).toBe('workExperience');
      expect(requestBody.milestone.title).toBe('Senior Developer');
      expect(requestBody.milestone.company).toBe('Innovation Labs');
    });

    test('should handle API errors gracefully', async ({ page }) => {
      // Mock API to return error
      await page.route('/api/save-milestone', route => {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Internal server error' })
        });
      });
      
      await openModal(page);
      
      // Fill and submit form
      await selectNodeType(page, 'workExperience');
      await page.fill('#title', 'Test Job');
      await page.fill('#company', 'Test Company');
      await page.fill('#start', '2023-01');
      
      await page.locator('[data-testid="submit-button"]').click();
      
      // Verify error is displayed
      await expect(page.locator('text="Internal server error"')).toBeVisible();
      
      // Verify retry button appears
      await expect(page.locator('[data-testid="retry-button"]')).toBeVisible();
    });

    test('should retry API call when retry button clicked', async ({ page }) => {
      let callCount = 0;
      
      // Mock API to fail first time, succeed second time
      await page.route('/api/save-milestone', route => {
        callCount++;
        if (callCount === 1) {
          route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Temporary error' })
          });
        } else {
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true, id: 'milestone-123' })
          });
        }
      });
      
      await openModal(page);
      
      // Fill and submit form
      await selectNodeType(page, 'workExperience');
      await page.fill('#title', 'Test Job');
      await page.fill('#company', 'Test Company');
      await page.fill('#start', '2023-01');
      
      await page.locator('[data-testid="submit-button"]').click();
      
      // Wait for error and click retry
      await expect(page.locator('text="Temporary error"')).toBeVisible();
      await page.locator('[data-testid="retry-button"]').click();
      
      // Verify modal closes on success (indicating successful retry)
      await expect(page.locator('[data-testid="modal-overlay"]')).not.toBeVisible();
      expect(callCount).toBe(2);
    });

    test('should close modal and refresh timeline on successful submission', async ({ page }) => {
      // Mock successful API response
      await page.route('/api/save-milestone', route => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, id: 'milestone-123' })
        });
      });
      
      await openModal(page);
      
      // Fill and submit form
      await selectNodeType(page, 'workExperience');
      await page.fill('#title', 'New Position');
      await page.fill('#company', 'Great Company');
      await page.fill('#start', '2024-01');
      
      await page.locator('[data-testid="submit-button"]').click();
      
      // Wait for modal to close
      await expect(page.locator('[data-testid="modal-overlay"]')).not.toBeVisible({ timeout: 10000 });
      
      // Verify timeline is still visible (indicating successful completion)
      await expect(page.locator('[data-testid="journey-timeline"]')).toBeVisible();
    });
  });

  test.describe('Future Requirements - Multi-Step Modal (Failing Tests)', () => {
    
    test('should show visual type selection as step 1 (FUTURE)', async ({ page }) => {
      test.skip(true, 'This test will pass when multi-step modal is implemented');
      
      await openModal(page);
      
      // Should show visual type selection grid instead of dropdown
      await expect(page.locator('[data-testid="type-selection-grid"]')).toBeVisible();
      
      // Should show 6 type cards in 3x2 grid
      const typeCards = page.locator('[data-testid="type-card"]');
      await expect(typeCards).toHaveCount(6);
      
      // Verify all 6 node types are present
      await expect(page.locator('[data-testid="type-card-education"]')).toBeVisible();
      await expect(page.locator('[data-testid="type-card-job"]')).toBeVisible();
      await expect(page.locator('[data-testid="type-card-jobTransition"]')).toBeVisible();
      await expect(page.locator('[data-testid="type-card-project"]')).toBeVisible();
      await expect(page.locator('[data-testid="type-card-event"]')).toBeVisible();
      await expect(page.locator('[data-testid="type-card-action"]')).toBeVisible();
    });

    test('should show step navigation in multi-step modal (FUTURE)', async ({ page }) => {
      test.skip(true, 'This test will pass when multi-step modal is implemented');
      
      await openModal(page);
      
      // Should show step indicator
      await expect(page.locator('[data-testid="step-indicator"]')).toBeVisible();
      await expect(page.locator('text="Step 1 of 2"')).toBeVisible();
      
      // Select a type and proceed to step 2
      await page.locator('[data-testid="type-card-job"]').click();
      await page.locator('[data-testid="next-step-button"]').click();
      
      // Should show step 2
      await expect(page.locator('text="Step 2 of 2"')).toBeVisible();
      await expect(page.locator('[data-testid="back-step-button"]')).toBeVisible();
    });

    test('should display visual type cards with proper styling (FUTURE)', async ({ page }) => {
      test.skip(true, 'This test will pass when visual type cards are implemented');
      
      await openModal(page);
      
      // Education card should be blue
      const educationCard = page.locator('[data-testid="type-card-education"]');
      await expect(educationCard).toHaveClass(/bg-blue/);
      await expect(educationCard).toContainText('Education');
      
      // Job card should be green
      const jobCard = page.locator('[data-testid="type-card-job"]');
      await expect(jobCard).toHaveClass(/bg-green/);
      await expect(jobCard).toContainText('Job');
      
      // Job transition card should be orange
      const jobTransitionCard = page.locator('[data-testid="type-card-jobTransition"]');
      await expect(jobTransitionCard).toHaveClass(/bg-orange/);
      await expect(jobTransitionCard).toContainText('Job Transition');
      
      // Project card should be purple
      const projectCard = page.locator('[data-testid="type-card-project"]');
      await expect(projectCard).toHaveClass(/bg-purple/);
      await expect(projectCard).toContainText('Project');
      
      // Event card should be orange
      const eventCard = page.locator('[data-testid="type-card-event"]');
      await expect(eventCard).toHaveClass(/bg-orange/);
      await expect(eventCard).toContainText('Event');
      
      // Action card should be pink
      const actionCard = page.locator('[data-testid="type-card-action"]');
      await expect(actionCard).toHaveClass(/bg-pink/);
      await expect(actionCard).toContainText('Action');
    });

    test('should support new node types in API calls (FUTURE)', async ({ page }) => {
      test.skip(true, 'This test will pass when new node types are supported');
      
      // Set up API monitoring
      const apiPromise = page.waitForRequest('/api/save-milestone');
      
      await openModal(page);
      
      // Select job transition type
      await page.locator('[data-testid="type-card-jobTransition"]').click();
      await page.locator('[data-testid="next-step-button"]').click();
      
      // Fill job transition specific form
      await page.fill('#title', 'Career Change');
      await page.fill('#fromRole', 'Designer');
      await page.fill('#toRole', 'Developer');
      await page.fill('#start', '2023-06');
      
      await page.locator('[data-testid="submit-button"]').click();
      
      // Verify API call includes new node type
      const request = await apiPromise;
      const requestBody = request.postDataJSON();
      expect(requestBody.milestone.type).toBe('jobTransition');
    });

    test('should allow navigation back from step 2 to step 1 (FUTURE)', async ({ page }) => {
      test.skip(true, 'This test will pass when step navigation is implemented');
      
      await openModal(page);
      
      // Go to step 2
      await page.locator('[data-testid="type-card-education"]').click();
      await page.locator('[data-testid="next-step-button"]').click();
      
      // Verify we're on step 2
      await expect(page.locator('text="Step 2 of 2"')).toBeVisible();
      
      // Go back to step 1
      await page.locator('[data-testid="back-step-button"]').click();
      
      // Verify we're back on step 1
      await expect(page.locator('text="Step 1 of 2"')).toBeVisible();
      await expect(page.locator('[data-testid="type-selection-grid"]')).toBeVisible();
    });

    test('should adapt form fields based on selected node type (FUTURE)', async ({ page }) => {
      test.skip(true, 'This test will pass when dynamic forms are implemented');
      
      await openModal(page);
      
      // Test Event type form
      await page.locator('[data-testid="type-card-event"]').click();
      await page.locator('[data-testid="next-step-button"]').click();
      
      // Should show event-specific fields
      await expect(page.locator('#eventName')).toBeVisible();
      await expect(page.locator('#eventDate')).toBeVisible();
      await expect(page.locator('#impact')).toBeVisible();
      
      // Go back and test Action type
      await page.locator('[data-testid="back-step-button"]').click();
      await page.locator('[data-testid="type-card-action"]').click();
      await page.locator('[data-testid="next-step-button"]').click();
      
      // Should show action-specific fields  
      await expect(page.locator('#actionTaken')).toBeVisible();
      await expect(page.locator('#outcome')).toBeVisible();
      await expect(page.locator('#lessons')).toBeVisible();
    });
  });

  test.describe('Accessibility Tests', () => {
    
    test('should have proper ARIA attributes', async ({ page }) => {
      await openModal(page);
      
      // Modal should have proper ARIA attributes
      const modal = page.locator('[role="dialog"]');
      await expect(modal).toBeVisible();
      await expect(modal).toHaveAttribute('aria-labelledby', 'modal-title');
      await expect(modal).toHaveAttribute('aria-describedby', 'modal-description');
      
      // Form elements should have proper labels
      await expect(page.locator('label[for="title"]')).toBeVisible();
      await expect(page.locator('#title')).toHaveAttribute('aria-describedby');
    });

    test('should be keyboard navigable', async ({ page }) => {
      await openModal(page);
      
      // Should be able to tab through form elements
      await page.keyboard.press('Tab'); // Type dropdown
      await page.keyboard.press('Tab'); // First form field
      await page.keyboard.press('Tab'); // Second form field
      
      // Enter should submit form (after filling required fields)
      await selectNodeType(page, 'workExperience');
      await page.fill('#title', 'Test Job');
      await page.fill('#company', 'Test Company');
      await page.fill('#start', '2023-01');
      
      await page.keyboard.press('Enter');
      
      // Should trigger form submission (loading state or API call)
      await expect(page.locator('[data-testid="submit-button"]')).toContainText('Adding...');
    });

    test('should announce form validation errors to screen readers', async ({ page }) => {
      await openModal(page);
      
      // Submit empty form
      await page.locator('[data-testid="submit-button"]').click();
      
      // Error messages should have proper ARIA attributes
      const errorMessages = page.locator('[role="alert"], [aria-live="polite"]');
      await expect(errorMessages.first()).toBeVisible();
    });
  });

  test.describe('Responsive Design Tests', () => {
    
    test('should work on mobile devices', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      
      await openModal(page);
      
      // Modal should be responsive
      const modal = page.locator('[role="dialog"]');
      await expect(modal).toBeVisible();
      
      // Form should be scrollable on mobile
      const modalContent = page.locator('[data-testid="modal-content"]');
      await expect(modalContent).toHaveCSS('overflow-y', 'auto');
    });

    test('should adapt plus button size on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      
      // Find and hover over timeline edge
      const edges = page.locator('.react-flow__edge');
      await edges.first().hover();
      
      // Plus button should be larger on mobile
      const plusButton = page.locator('[data-testid*="edge-plus-button"]').first();
      await expect(plusButton).toBeVisible();
      
      // Should have mobile-friendly touch target size
      const boundingBox = await plusButton.boundingBox();
      expect(boundingBox?.width).toBeGreaterThanOrEqual(44); // Minimum touch target
      expect(boundingBox?.height).toBeGreaterThanOrEqual(44);
    });
  });
});

// Helper functions
async function openModal(page: Page) {
  // Find and hover over timeline edge to show plus button
  const edges = page.locator('.react-flow__edge');
  await edges.first().hover();
  
  // Click plus button to open modal
  const plusButton = page.locator('[data-testid*="edge-plus-button"]').first();
  await plusButton.click();
  
  // Wait for modal to be visible
  await expect(page.locator('[data-testid="modal-overlay"]')).toBeVisible();
}

async function selectNodeType(page: Page, nodeType: string) {
  // Click type selector dropdown
  const typeSelector = page.locator('[data-testid="node-type-selector"]');
  await typeSelector.click();
  
  // Select the specified node type
  const typeMap = {
    workExperience: 'Work Experience',
    education: 'Education', 
    project: 'Project',
    skill: 'Skill'
  };
  
  await page.locator(`text="${typeMap[nodeType as keyof typeof typeMap]}"`).click();
}
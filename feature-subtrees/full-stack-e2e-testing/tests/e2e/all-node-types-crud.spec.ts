import { test, expect } from '@playwright/test';

/**
 * Comprehensive E2E Tests for All Node Types - CRUD Operations
 * 
 * Tests all 6 node types with create functionality via + button:
 * - job (renamed from workExperience)
 * - education 
 * - project
 * - event
 * - action  
 * - careerTransition
 * 
 * Focus: Chrome testing, desktop only, create functionality with auto-refresh
 */

test.describe('All Node Types - CRUD Operations', () => {
  
  test.beforeEach(async ({ page }) => {
    // Navigate to the main timeline page
    await page.goto('/professional-journey');
    
    // Wait for the timeline to load
    await page.waitForSelector('[data-testid="journey-timeline"]', { timeout: 10000 });
    
    // Wait for React Flow to initialize
    await page.waitForTimeout(2000);
  });

  test.describe('Node Creation via Plus Button', () => {
    
    test('should create a new job node', async ({ page }) => {
      // Find and click plus button
      const edges = page.locator('.react-flow__edge');
      await edges.first().hover();
      
      const plusButton = page.locator('[data-testid*="edge-plus-button"]').first();
      await plusButton.click();
      
      // Should open multi-step modal
      await expect(page.locator('[data-testid="multi-step-modal"]')).toBeVisible();
      
      // Step 1: Select node type
      await page.locator('[data-testid="node-type-job"]').click();
      await page.locator('[data-testid="next-button"]').click();
      
      // Step 2: Fill job form
      await page.locator('#title').fill('Senior Software Engineer');
      await page.locator('#company').fill('TechCorp Inc');
      await page.locator('#start').fill('2023-01');
      await page.locator('#end').fill('2024-08');
      await page.locator('#location').fill('San Francisco, CA');
      await page.locator('#description').fill('Leading a team of engineers developing scalable web applications.');
      
      // Submit form
      await page.locator('[data-testid="submit-button"]').click();
      
      // Wait for API call and UI refresh
      await page.waitForTimeout(2000);
      
      // Verify new node appears on timeline
      await expect(page.locator('text=Senior Software Engineer')).toBeVisible();
      await expect(page.locator('text=TechCorp Inc')).toBeVisible();
    });

    test('should create a new education node', async ({ page }) => {
      const edges = page.locator('.react-flow__edge');
      await edges.first().hover();
      
      const plusButton = page.locator('[data-testid*="edge-plus-button"]').first();
      await plusButton.click();
      
      await expect(page.locator('[data-testid="multi-step-modal"]')).toBeVisible();
      
      // Select education type
      await page.locator('[data-testid="node-type-education"]').click();
      await page.locator('[data-testid="next-button"]').click();
      
      // Fill education form
      await page.locator('#school').fill('Stanford University');
      await page.locator('#degree').fill('Master of Science');
      await page.locator('#field').fill('Computer Science');
      await page.locator('#start').fill('2020-09');
      await page.locator('#end').fill('2022-06');
      await page.locator('#description').fill('Specialized in machine learning and distributed systems.');
      
      // Submit
      await page.locator('[data-testid="submit-button"]').click();
      await page.waitForTimeout(2000);
      
      // Verify
      await expect(page.locator('text=Master of Science')).toBeVisible();
      await expect(page.locator('text=Stanford University')).toBeVisible();
    });

    test('should create a new project node', async ({ page }) => {
      const edges = page.locator('.react-flow__edge');
      await edges.first().hover();
      
      const plusButton = page.locator('[data-testid*="edge-plus-button"]').first();
      await plusButton.click();
      
      await expect(page.locator('[data-testid="multi-step-modal"]')).toBeVisible();
      
      // Select project type
      await page.locator('[data-testid="node-type-project"]').click();
      await page.locator('[data-testid="next-button"]').click();
      
      // Fill project form
      await page.locator('#title').fill('E-commerce Platform');
      await page.locator('#description').fill('Built a scalable e-commerce platform using modern web technologies.');
      await page.locator('#technologies').fill('React, Node.js, PostgreSQL, AWS');
      await page.locator('#start').fill('2023-03');
      await page.locator('#end').fill('2023-12');
      
      // Submit
      await page.locator('[data-testid="submit-button"]').click();
      await page.waitForTimeout(2000);
      
      // Verify
      await expect(page.locator('text=E-commerce Platform')).toBeVisible();
    });

    test('should create a new event node', async ({ page }) => {
      const edges = page.locator('.react-flow__edge');
      await edges.first().hover();
      
      const plusButton = page.locator('[data-testid*="edge-plus-button"]').first();
      await plusButton.click();
      
      await expect(page.locator('[data-testid="multi-step-modal"]')).toBeVisible();
      
      // Select event type
      await page.locator('[data-testid="node-type-event"]').click();
      await page.locator('[data-testid="next-button"]').click();
      
      // Fill event form
      await page.locator('#title').fill('React Conference 2023');
      await page.locator('#description').fill('Attended talks on React 18 features and modern development practices.');
      await page.locator('[data-testid="event-type-select"]').click();
      await page.locator('text=Conference').click();
      await page.locator('#location').fill('San Francisco, CA');
      await page.locator('#start').fill('2023-10');
      await page.locator('#organizer').fill('React Community');
      
      // Submit
      await page.locator('[data-testid="submit-button"]').click();
      await page.waitForTimeout(2000);
      
      // Verify
      await expect(page.locator('text=React Conference 2023')).toBeVisible();
    });

    test('should create a new action node', async ({ page }) => {
      const edges = page.locator('.react-flow__edge');
      await edges.first().hover();
      
      const plusButton = page.locator('[data-testid*="edge-plus-button"]').first();
      await plusButton.click();
      
      await expect(page.locator('[data-testid="multi-step-modal"]')).toBeVisible();
      
      // Select action type
      await page.locator('[data-testid="node-type-action"]').click();
      await page.locator('[data-testid="next-button"]').click();
      
      // Fill action form
      await page.locator('#title').fill('AWS Certified Developer');
      await page.locator('#description').fill('Achieved AWS Certified Developer Associate certification.');
      await page.locator('[data-testid="category-select"]').click();
      await page.locator('text=Certification').click();
      await page.locator('#impact').fill('Enhanced cloud development skills and team capability.');
      await page.locator('#verification').fill('AWS Certificate ID: ABC123');
      await page.locator('#start').fill('2023-08');
      
      // Submit
      await page.locator('[data-testid="submit-button"]').click();
      await page.waitForTimeout(2000);
      
      // Verify
      await expect(page.locator('text=AWS Certified Developer')).toBeVisible();
    });

    test('should create a new career transition node', async ({ page }) => {
      const edges = page.locator('.react-flow__edge');
      await edges.first().hover();
      
      const plusButton = page.locator('[data-testid*="edge-plus-button"]').first();
      await plusButton.click();
      
      await expect(page.locator('[data-testid="multi-step-modal"]')).toBeVisible();
      
      // Select career transition type
      await page.locator('[data-testid="node-type-careerTransition"]').click();
      await page.locator('[data-testid="next-button"]').click();
      
      // Fill career transition form
      await page.locator('#title').fill('Career Pivot to Tech Leadership');
      await page.locator('#description').fill('Transitioned from individual contributor to engineering manager role.');
      await page.locator('#fromRole').fill('Senior Software Engineer');
      await page.locator('#toRole').fill('Engineering Manager');
      await page.locator('#reason').fill('Passion for mentoring and team growth');
      await page.locator('#outcome').fill('Successfully leading a team of 6 engineers');
      await page.locator('#start').fill('2023-01');
      await page.locator('#end').fill('2023-06');
      
      // Submit
      await page.locator('[data-testid="submit-button"]').click();
      await page.waitForTimeout(2000);
      
      // Verify
      await expect(page.locator('text=Career Pivot to Tech Leadership')).toBeVisible();
    });
  });

  test.describe('Node Interactions', () => {
    
    test('should expand child nodes when chevron is clicked', async ({ page }) => {
      // Find a job node with projects (expandable content)
      const jobNode = page.locator('[data-node-type="job"]').first();
      await expect(jobNode).toBeVisible();
      
      // Look for chevron button
      const chevronButton = jobNode.locator('[data-testid="expand-chevron"]');
      if (await chevronButton.isVisible()) {
        await chevronButton.click();
        
        // Wait for expansion animation
        await page.waitForTimeout(1000);
        
        // Verify child nodes appear
        const projectNodes = page.locator('[data-node-type="project"]');
        await expect(projectNodes.first()).toBeVisible();
      }
    });

    test('should open details panel when node is clicked', async ({ page }) => {
      // Find and click a job node (not the chevron)
      const jobNode = page.locator('[data-node-type="job"]').first();
      await expect(jobNode).toBeVisible();
      
      // Click the node itself (avoid chevron area)
      await jobNode.click({ position: { x: 50, y: 50 } });
      
      // Verify details panel opens
      await expect(page.locator('[data-testid="node-details-panel"]')).toBeVisible();
      
      // Verify focus mode is activated
      await expect(page.locator('[data-testid="exit-focus-button"]')).toBeVisible();
    });

    test('should exit focus mode when exit button is clicked', async ({ page }) => {
      // First enter focus mode by clicking a node
      const jobNode = page.locator('[data-node-type="job"]').first();
      await jobNode.click({ position: { x: 50, y: 50 } });
      
      // Wait for focus mode to activate
      await expect(page.locator('[data-testid="exit-focus-button"]')).toBeVisible();
      
      // Click exit focus button
      await page.locator('[data-testid="exit-focus-button"]').click();
      
      // Verify focus mode is exited
      await expect(page.locator('[data-testid="exit-focus-button"]')).not.toBeVisible();
      
      // Verify timeline zooms out to show full view
      await page.waitForTimeout(1000);
      const timelineNodes = page.locator('[data-node-type]');
      const nodeCount = await timelineNodes.count();
      expect(nodeCount).toBeGreaterThan(1); // Multiple nodes should be visible
    });
  });

  test.describe('Form Validation', () => {
    
    test('should validate required fields in job form', async ({ page }) => {
      const edges = page.locator('.react-flow__edge');
      await edges.first().hover();
      
      const plusButton = page.locator('[data-testid*="edge-plus-button"]').first();
      await plusButton.click();
      
      // Select job type and proceed to form
      await page.locator('[data-testid="node-type-job"]').click();
      await page.locator('[data-testid="next-button"]').click();
      
      // Try to submit without required fields
      await page.locator('[data-testid="submit-button"]').click();
      
      // Verify validation errors appear
      await expect(page.locator('text=Job title is required')).toBeVisible();
      await expect(page.locator('text=Company is required')).toBeVisible();
      await expect(page.locator('text=Start date is required')).toBeVisible();
    });

    test('should validate date format', async ({ page }) => {
      const edges = page.locator('.react-flow__edge');
      await edges.first().hover();
      
      const plusButton = page.locator('[data-testid*="edge-plus-button"]').first();
      await plusButton.click();
      
      // Select job type and proceed
      await page.locator('[data-testid="node-type-job"]').click();
      await page.locator('[data-testid="next-button"]').click();
      
      // Fill with invalid date format
      await page.locator('#title').fill('Test Job');
      await page.locator('#company').fill('Test Company');
      await page.locator('#start').fill('invalid-date');
      
      // Submit and check for validation error
      await page.locator('[data-testid="submit-button"]').click();
      await expect(page.locator('text=Invalid date format')).toBeVisible();
    });
  });

  test.describe('API Integration', () => {
    
    test('should call correct CRUD API endpoints', async ({ page }) => {
      // Monitor network requests
      const apiRequests: string[] = [];
      page.on('request', (request) => {
        if (request.url().includes('/api/v2/timeline/')) {
          apiRequests.push(`${request.method()} ${request.url()}`);
        }
      });
      
      // Create a job node
      const edges = page.locator('.react-flow__edge');
      await edges.first().hover();
      
      const plusButton = page.locator('[data-testid*="edge-plus-button"]').first();
      await plusButton.click();
      
      await page.locator('[data-testid="node-type-job"]').click();
      await page.locator('[data-testid="next-button"]').click();
      
      await page.locator('#title').fill('API Test Job');
      await page.locator('#company').fill('API Test Company');
      await page.locator('#start').fill('2023-01');
      
      await page.locator('[data-testid="submit-button"]').click();
      await page.waitForTimeout(2000);
      
      // Verify correct API endpoint was called
      const jobsApiCall = apiRequests.find(req => req.includes('POST') && req.includes('/jobs'));
      expect(jobsApiCall).toBeDefined();
    });
  });

  test.describe('Chrome-specific Features', () => {
    
    test('should work with Chrome DevTools integration', async ({ page }) => {
      // This test can be extended for Chrome-specific features
      // For now, just verify basic functionality in Chrome
      
      const userAgent = await page.evaluate(() => navigator.userAgent);
      expect(userAgent).toContain('Chrome');
      
      // Verify timeline renders correctly in Chrome
      const timelineElement = page.locator('[data-testid="journey-timeline"]');
      await expect(timelineElement).toBeVisible();
      
      // Verify React Flow works properly
      const nodes = page.locator('[data-node-type]');
      const nodeCount = await nodes.count();
      expect(nodeCount).toBeGreaterThan(0);
    });
  });
});
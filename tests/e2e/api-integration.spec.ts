import { test, expect, type Page } from '@playwright/test';

/**
 * API Integration E2E Tests for Enhanced Timeline Modal System
 * 
 * Tests the integration between the modal system and the /api/save-milestone endpoint,
 * including error handling, data validation, and response processing.
 */

test.describe('API Integration Tests', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('/professional-journey');
    await page.waitForSelector('[data-testid="journey-timeline"]', { timeout: 10000 });
    await page.waitForTimeout(2000);
  });

  test.describe('Successful API Calls', () => {
    
    test('should send Work Experience data to /api/save-milestone', async ({ page }) => {
      const apiPromise = page.waitForRequest(request => 
        request.url().includes('/api/save-milestone') && request.method() === 'POST'
      );
      
      await openModalAndFillWorkExperience(page, {
        title: 'Senior Software Engineer',
        company: 'Tech Innovations Inc',
        start: '2023-01',
        end: '2024-06',
        location: 'San Francisco, CA',
        description: 'Led development of microservices architecture'
      });
      
      const request = await apiPromise;
      
      // Verify request method and headers
      expect(request.method()).toBe('POST');
      expect(request.headers()['content-type']).toContain('application/json');
      
      // Verify request body structure
      const requestBody = request.postDataJSON();
      expect(requestBody).toHaveProperty('milestone');
      
      const milestone = requestBody.milestone;
      expect(milestone.type).toBe('workExperience');
      expect(milestone.title).toBe('Senior Software Engineer');
      expect(milestone.company).toBe('Tech Innovations Inc');
      expect(milestone.startDate).toBe('2023-01');
      expect(milestone.endDate).toBe('2024-06');
      expect(milestone.location).toBe('San Francisco, CA');
      expect(milestone.description).toBe('Led development of microservices architecture');
      expect(milestone.ongoing).toBe(false);
    });

    test('should send Education data correctly', async ({ page }) => {
      const apiPromise = page.waitForRequest('/api/save-milestone');
      
      await openModalAndFillEducation(page, {
        school: 'Stanford University',
        degree: 'Master of Science',
        field: 'Computer Science',
        start: '2019-09',
        end: '2021-06',
        description: 'Specialized in Machine Learning and AI'
      });
      
      const request = await apiPromise;
      const requestBody = request.postDataJSON();
      
      const milestone = requestBody.milestone;
      expect(milestone.type).toBe('education');
      expect(milestone.school).toBe('Stanford University');
      expect(milestone.degree).toBe('Master of Science');
      expect(milestone.field).toBe('Computer Science');
      expect(milestone.startDate).toBe('2019-09');
      expect(milestone.endDate).toBe('2021-06');
    });

    test('should send Project data correctly', async ({ page }) => {
      const apiPromise = page.waitForRequest('/api/save-milestone');
      
      await openModalAndFillProject(page, {
        title: 'E-commerce Platform Redesign',
        description: 'Complete redesign of the checkout flow',
        technologies: 'React, Node.js, PostgreSQL',
        start: '2023-03',
        end: '2023-08'
      });
      
      const request = await apiPromise;
      const requestBody = request.postDataJSON();
      
      const milestone = requestBody.milestone;
      expect(milestone.type).toBe('project');
      expect(milestone.title).toBe('E-commerce Platform Redesign');
      expect(milestone.description).toBe('Complete redesign of the checkout flow');
      expect(milestone.technologies).toBe('React, Node.js, PostgreSQL');
    });

    test('should send Skill data correctly', async ({ page }) => {
      const apiPromise = page.waitForRequest('/api/save-milestone');
      
      await openModalAndFillSkill(page, {
        name: 'TypeScript',
        proficiency: 'advanced',
        context: 'Used in multiple production projects',
        verification: 'GitHub portfolio and certifications'
      });
      
      const request = await apiPromise;
      const requestBody = request.postDataJSON();
      
      const milestone = requestBody.milestone;
      expect(milestone.type).toBe('skill');
      expect(milestone.name).toBe('TypeScript');
      expect(milestone.proficiency).toBe('advanced');
      expect(milestone.context).toBe('Used in multiple production projects');
      expect(milestone.verification).toBe('GitHub portfolio and certifications');
    });

    test('should handle ongoing work experience correctly', async ({ page }) => {
      const apiPromise = page.waitForRequest('/api/save-milestone');
      
      await openModal(page);
      await selectNodeType(page, 'workExperience');
      
      // Fill form with ongoing experience
      await page.fill('#title', 'Current Position');
      await page.fill('#company', 'Current Company');
      await page.fill('#start', '2024-01');
      await page.check('#isOngoing');
      
      await page.locator('[data-testid="submit-button"]').click();
      
      const request = await apiPromise;
      const requestBody = request.postDataJSON();
      
      const milestone = requestBody.milestone;
      expect(milestone.ongoing).toBe(true);
      expect(milestone.endDate).toBeFalsy();
    });

    test('should include context information in API call', async ({ page }) => {
      const apiPromise = page.waitForRequest('/api/save-milestone');
      
      await openModalAndFillWorkExperience(page, {
        title: 'Test Job',
        company: 'Test Company',
        start: '2023-01'
      });
      
      const request = await apiPromise;
      const requestBody = request.postDataJSON();
      
      // Should include context about where the milestone was added
      expect(requestBody).toHaveProperty('context');
      expect(requestBody.context).toHaveProperty('insertionPoint');
      expect(requestBody.context).toHaveProperty('parentNode');
      expect(requestBody.context).toHaveProperty('targetNode');
    });
  });

  test.describe('API Error Handling', () => {
    
    test('should handle 500 server errors gracefully', async ({ page }) => {
      // Mock server error
      await page.route('/api/save-milestone', route => {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Internal server error occurred' })
        });
      });
      
      await openModalAndFillWorkExperience(page, {
        title: 'Test Job',
        company: 'Test Company',
        start: '2023-01'
      });
      
      // Should display error message
      await expect(page.locator('text="Internal server error occurred"')).toBeVisible();
      
      // Should show retry button
      await expect(page.locator('[data-testid="retry-button"]')).toBeVisible();
      
      // Modal should remain open
      await expect(page.locator('[data-testid="modal-overlay"]')).toBeVisible();
    });

    test('should handle 400 validation errors', async ({ page }) => {
      // Mock validation error
      await page.route('/api/save-milestone', route => {
        route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ 
            error: 'Validation failed',
            details: 'Start date must be before end date'
          })
        });
      });
      
      await openModalAndFillWorkExperience(page, {
        title: 'Test Job',
        company: 'Test Company',
        start: '2023-06',
        end: '2023-01' // Invalid: end before start
      });
      
      // Should display validation error
      await expect(page.locator('text="Validation failed"')).toBeVisible();
      await expect(page.locator('text="Start date must be before end date"')).toBeVisible();
    });

    test('should handle network errors', async ({ page }) => {
      // Mock network failure
      await page.route('/api/save-milestone', route => {
        route.abort('internetdisconnected');
      });
      
      await openModalAndFillWorkExperience(page, {
        title: 'Test Job',
        company: 'Test Company',
        start: '2023-01'
      });
      
      // Should display network error message
      await expect(page.locator('text="Network Error"')).toBeVisible();
      await expect(page.locator('text="Please check your connection and try again"')).toBeVisible();
      
      // Should show retry button
      await expect(page.locator('[data-testid="retry-button"]')).toBeVisible();
    });

    test('should handle 401 authentication errors', async ({ page }) => {
      // Mock authentication error
      await page.route('/api/save-milestone', route => {
        route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Authentication required' })
        });
      });
      
      await openModalAndFillWorkExperience(page, {
        title: 'Test Job',
        company: 'Test Company',
        start: '2023-01'
      });
      
      // Should display authentication error
      await expect(page.locator('text="Authentication required"')).toBeVisible();
    });

    test('should retry API call when retry button is clicked', async ({ page }) => {
      let callCount = 0;
      
      // Mock API to fail first time, succeed second time
      await page.route('/api/save-milestone', route => {
        callCount++;
        if (callCount === 1) {
          route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Temporary server error' })
          });
        } else {
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true, id: 'milestone-123' })
          });
        }
      });
      
      await openModalAndFillWorkExperience(page, {
        title: 'Test Job',
        company: 'Test Company',
        start: '2023-01'
      });
      
      // Wait for error and click retry
      await expect(page.locator('text="Temporary server error"')).toBeVisible();
      await page.locator('[data-testid="retry-button"]').click();
      
      // Modal should close on successful retry
      await expect(page.locator('[data-testid="modal-overlay"]')).not.toBeVisible();
      
      // Should have made exactly 2 API calls
      expect(callCount).toBe(2);
    });

    test('should prevent multiple simultaneous submissions', async ({ page }) => {
      let callCount = 0;
      
      // Mock slow API response
      await page.route('/api/save-milestone', route => {
        callCount++;
        setTimeout(() => {
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true, id: 'milestone-123' })
          });
        }, 2000); // 2 second delay
      });
      
      await openModal(page);
      await selectNodeType(page, 'workExperience');
      
      // Fill form
      await page.fill('#title', 'Test Job');
      await page.fill('#company', 'Test Company');
      await page.fill('#start', '2023-01');
      
      // Click submit multiple times quickly
      const submitButton = page.locator('[data-testid="submit-button"]');
      await submitButton.click();
      await submitButton.click();
      await submitButton.click();
      
      // Should show loading state
      await expect(submitButton).toContainText('Adding...');
      await expect(submitButton).toBeDisabled();
      
      // Should only make one API call
      await page.waitForTimeout(3000);
      expect(callCount).toBe(1);
    });
  });

  test.describe('Response Processing', () => {
    
    test('should close modal on successful API response', async ({ page }) => {
      // Mock successful response
      await page.route('/api/save-milestone', route => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ 
            success: true, 
            id: 'milestone-123',
            message: 'Milestone created successfully'
          })
        });
      });
      
      await openModalAndFillWorkExperience(page, {
        title: 'Test Job',
        company: 'Test Company',
        start: '2023-01'
      });
      
      // Modal should close
      await expect(page.locator('[data-testid="modal-overlay"]')).not.toBeVisible({ timeout: 10000 });
    });

    test('should refresh timeline data after successful submission', async ({ page }) => {
      // Mock successful response
      await page.route('/api/save-milestone', route => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, id: 'milestone-123' })
        });
      });
      
      // Also mock profile data refresh endpoint
      let profileDataCalls = 0;
      await page.route('/api/profile**', route => {
        profileDataCalls++;
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ 
            experiences: [
              { title: 'Existing Job', company: 'Old Company', start: '2022-01' },
              { title: 'Test Job', company: 'Test Company', start: '2023-01' } // New job
            ]
          })
        });
      });
      
      await openModalAndFillWorkExperience(page, {
        title: 'Test Job',
        company: 'Test Company',
        start: '2023-01'
      });
      
      // Wait for modal to close and data to refresh
      await expect(page.locator('[data-testid="modal-overlay"]')).not.toBeVisible();
      
      // Should have called profile data endpoint to refresh
      expect(profileDataCalls).toBeGreaterThan(0);
    });

    test('should handle malformed API responses', async ({ page }) => {
      // Mock malformed response
      await page.route('/api/save-milestone', route => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: 'invalid json response'
        });
      });
      
      await openModalAndFillWorkExperience(page, {
        title: 'Test Job',
        company: 'Test Company',
        start: '2023-01'
      });
      
      // Should display error for malformed response
      await expect(page.locator('text="Failed to save milestone"')).toBeVisible();
    });
  });

  test.describe('API Security and Headers', () => {
    
    test('should include authentication cookies in requests', async ({ page }) => {
      const apiPromise = page.waitForRequest('/api/save-milestone');
      
      await openModalAndFillWorkExperience(page, {
        title: 'Test Job',
        company: 'Test Company',
        start: '2023-01'
      });
      
      const request = await apiPromise;
      
      // Should include session cookies
      const headers = request.headers();
      expect(headers).toHaveProperty('cookie');
    });

    test('should set correct content-type header', async ({ page }) => {
      const apiPromise = page.waitForRequest('/api/save-milestone');
      
      await openModalAndFillWorkExperience(page, {
        title: 'Test Job',
        company: 'Test Company',
        start: '2023-01'
      });
      
      const request = await apiPromise;
      
      expect(request.headers()['content-type']).toBe('application/json');
    });

    test('should handle CSRF protection if implemented', async ({ page }) => {
      // This test would verify CSRF token handling if implemented
      test.skip(true, 'CSRF protection not yet implemented');
      
      const apiPromise = page.waitForRequest('/api/save-milestone');
      
      await openModalAndFillWorkExperience(page, {
        title: 'Test Job',
        company: 'Test Company',
        start: '2023-01'
      });
      
      const request = await apiPromise;
      const headers = request.headers();
      
      // Should include CSRF token
      expect(headers).toHaveProperty('x-csrf-token');
    });
  });
});

// Helper functions
async function openModal(page: Page) {
  const edges = page.locator('.react-flow__edge');
  await edges.first().hover();
  
  const plusButton = page.locator('[data-testid*="edge-plus-button"]').first();
  await plusButton.click();
  
  await expect(page.locator('[data-testid="modal-overlay"]')).toBeVisible();
}

async function selectNodeType(page: Page, nodeType: string) {
  const typeSelector = page.locator('[data-testid="node-type-selector"]');
  await typeSelector.click();
  
  const typeMap = {
    workExperience: 'Work Experience',
    education: 'Education',
    project: 'Project',
    skill: 'Skill'
  };
  
  await page.locator(`text="${typeMap[nodeType as keyof typeof typeMap]}"`).click();
}

async function openModalAndFillWorkExperience(page: Page, data: {
  title: string;
  company: string;
  start: string;
  end?: string;
  location?: string;
  description?: string;
}) {
  await openModal(page);
  await selectNodeType(page, 'workExperience');
  
  await page.fill('#title', data.title);
  await page.fill('#company', data.company);
  await page.fill('#start', data.start);
  
  if (data.end) {
    await page.fill('#end', data.end);
  }
  
  if (data.location) {
    await page.fill('#location', data.location);
  }
  
  if (data.description) {
    await page.fill('#description', data.description);
  }
  
  await page.locator('[data-testid="submit-button"]').click();
}

async function openModalAndFillEducation(page: Page, data: {
  school: string;
  degree: string;
  field: string;
  start: string;
  end?: string;
  description?: string;
}) {
  await openModal(page);
  await selectNodeType(page, 'education');
  
  await page.fill('#school', data.school);
  await page.fill('#degree', data.degree);
  await page.fill('#field', data.field);
  await page.fill('#start', data.start);
  
  if (data.end) {
    await page.fill('#end', data.end);
  }
  
  if (data.description) {
    await page.fill('#description', data.description);
  }
  
  await page.locator('[data-testid="submit-button"]').click();
}

async function openModalAndFillProject(page: Page, data: {
  title: string;
  description?: string;
  technologies?: string;
  start?: string;
  end?: string;
}) {
  await openModal(page);
  await selectNodeType(page, 'project');
  
  await page.fill('#title', data.title);
  
  if (data.description) {
    await page.fill('#description', data.description);
  }
  
  if (data.technologies) {
    await page.fill('#technologies', data.technologies);
  }
  
  if (data.start) {
    await page.fill('#start', data.start);
  }
  
  if (data.end) {
    await page.fill('#end', data.end);
  }
  
  await page.locator('[data-testid="submit-button"]').click();
}

async function openModalAndFillSkill(page: Page, data: {
  name: string;
  proficiency: string;
  context?: string;
  verification?: string;
}) {
  await openModal(page);
  await selectNodeType(page, 'skill');
  
  await page.fill('#name', data.name);
  
  // Select proficiency
  await page.click('[data-testid="proficiency-selector"] button');
  await page.locator(`text="${data.proficiency.charAt(0).toUpperCase() + data.proficiency.slice(1)}"`).click();
  
  if (data.context) {
    await page.fill('#context', data.context);
  }
  
  if (data.verification) {
    await page.fill('#verification', data.verification);
  }
  
  await page.locator('[data-testid="submit-button"]').click();
}
import { type Page, expect } from '@playwright/test';
// Note: Could import Education from '@shared/schema' but form fields currently use 'school' not 'institution'

/**
 * Shared test utilities for Enhanced Timeline Modal E2E tests
 */

export interface WorkExperienceData {
  title: string;
  company: string;
  start: string;
  end?: string;
  location?: string;
  description?: string;
  isOngoing?: boolean;
}

export interface EducationData {
  school: string;
  degree: string;
  field: string;
  start: string;
  end?: string;
  description?: string;
  isOngoing?: boolean;
}

export interface ProjectData {
  title: string;
  description?: string;
  technologies?: string;
  start?: string;
  end?: string;
}

export interface SkillData {
  name: string;
  proficiency: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  context?: string;
  verification?: string;
}

export type NodeType = 'job' | 'education' | 'project' | 'event' | 'action' | 'careerTransition';

/**
 * Opens the modal by hovering over timeline edge and clicking plus button
 */
export async function openModal(page: Page) {
  // Wait for timeline to be ready
  await page.waitForSelector('[data-testid="journey-timeline"]', { state: 'visible' });
  
  // Find timeline edges
  const edges = page.locator('.react-flow__edge');
  await expect(edges.first()).toBeVisible();
  
  // Hover over first edge to show plus button
  await edges.first().hover();
  
  // Wait for plus button to appear and click it
  const plusButton = page.locator('[data-testid*="edge-plus-button"]').first();
  await expect(plusButton).toBeVisible({ timeout: 5000 });
  await plusButton.click();
  
  // Wait for modal to open
  await expect(page.locator('[data-testid="modal-overlay"]')).toBeVisible();
}

/**
 * Selects a node type from the dropdown
 */
export async function selectNodeType(page: Page, nodeType: NodeType) {
  const typeMap = {
    workExperience: 'Work Experience',
    education: 'Education',
    project: 'Project',
    skill: 'Skill'
  };
  
  // Click type selector dropdown
  const typeSelector = page.locator('[data-testid="node-type-selector"]');
  await expect(typeSelector).toBeVisible();
  await typeSelector.click();
  
  // Select the specified node type
  const optionText = typeMap[nodeType];
  await page.locator(`text="${optionText}"`).click();
}

/**
 * Fills work experience form with provided data
 */
export async function fillWorkExperienceForm(page: Page, data: WorkExperienceData) {
  await page.fill('#title', data.title);
  await page.fill('#company', data.company);
  await page.fill('#start', data.start);
  
  if (data.end && !data.isOngoing) {
    await page.fill('#end', data.end);
  }
  
  if (data.location) {
    await page.fill('#location', data.location);
  }
  
  if (data.description) {
    await page.fill('#description', data.description);
  }
  
  if (data.isOngoing) {
    await page.check('#isOngoing');
  }
}

/**
 * Fills education form with provided data
 */
export async function fillEducationForm(page: Page, data: EducationData) {
  await page.fill('#school', data.school);
  await page.fill('#degree', data.degree);
  await page.fill('#field', data.field);
  await page.fill('#start', data.start);
  
  if (data.end && !data.isOngoing) {
    await page.fill('#end', data.end);
  }
  
  if (data.description) {
    await page.fill('#description', data.description);
  }
  
  if (data.isOngoing) {
    await page.check('#isOngoing');
  }
}

/**
 * Fills project form with provided data
 */
export async function fillProjectForm(page: Page, data: ProjectData) {
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
}

/**
 * Fills skill form with provided data
 */
export async function fillSkillForm(page: Page, data: SkillData) {
  await page.fill('#name', data.name);
  
  // Handle proficiency dropdown
  const proficiencySelector = page.locator('[data-testid="proficiency-selector"] button');
  await proficiencySelector.click();
  
  const proficiencyText = data.proficiency.charAt(0).toUpperCase() + data.proficiency.slice(1);
  await page.locator(`text="${proficiencyText}"`).click();
  
  if (data.context) {
    await page.fill('#context', data.context);
  }
  
  if (data.verification) {
    await page.fill('#verification', data.verification);
  }
}

/**
 * Opens modal, selects node type, fills form, and submits
 */
export async function createMilestone(
  page: Page,
  nodeType: NodeType,
  data: WorkExperienceData | EducationData | ProjectData | SkillData
) {
  await openModal(page);
  await selectNodeType(page, nodeType);
  
  switch (nodeType) {
    case 'workExperience':
      await fillWorkExperienceForm(page, data as WorkExperienceData);
      break;
    case 'education':
      await fillEducationForm(page, data as EducationData);
      break;
    case 'project':
      await fillProjectForm(page, data as ProjectData);
      break;
    case 'skill':
      await fillSkillForm(page, data as SkillData);
      break;
  }
  
  await page.locator('[data-testid="submit-button"]').click();
}

/**
 * Waits for and returns an API request
 */
export async function waitForApiRequest(page: Page, endpoint: string) {
  return page.waitForRequest(request => 
    request.url().includes(endpoint) && request.method() === 'POST'
  );
}

/**
 * Mocks API responses
 */
export async function mockApiResponse(
  page: Page,
  endpoint: string,
  response: { status: number; body: any }
) {
  await page.route(endpoint, route => {
    route.fulfill({
      status: response.status,
      contentType: 'application/json',
      body: JSON.stringify(response.body)
    });
  });
}

/**
 * Mocks successful API response
 */
export async function mockSuccessfulApiResponse(page: Page, endpoint: string, id = 'milestone-123') {
  await mockApiResponse(page, endpoint, {
    status: 200,
    body: { success: true, id, message: 'Milestone created successfully' }
  });
}

/**
 * Mocks API error response
 */
export async function mockApiErrorResponse(
  page: Page,
  endpoint: string,
  status: number,
  error: string
) {
  await mockApiResponse(page, endpoint, {
    status,
    body: { error }
  });
}

/**
 * Asserts that modal is closed
 */
export async function expectModalClosed(page: Page) {
  await expect(page.locator('[data-testid="modal-overlay"]')).not.toBeVisible();
}

/**
 * Asserts that modal is open
 */
export async function expectModalOpen(page: Page) {
  await expect(page.locator('[data-testid="modal-overlay"]')).toBeVisible();
  await expect(page.locator('#modal-title')).toContainText('Add New Milestone');
}

/**
 * Asserts API request body contains expected data
 */
export function expectMilestoneData(requestBody: any, expectedData: Partial<any>) {
  expect(requestBody).toHaveProperty('milestone');
  
  const milestone = requestBody.milestone;
  
  Object.entries(expectedData).forEach(([key, value]) => {
    expect(milestone[key]).toBe(value);
  });
}

/**
 * Simulates hovering over multiple edges (performance testing)
 */
export async function hoverMultipleEdges(page: Page, count = 5) {
  const edges = page.locator('.react-flow__edge');
  const edgeCount = await edges.count();
  
  const actualCount = Math.min(count, edgeCount);
  
  for (let i = 0; i < actualCount; i++) {
    await edges.nth(i).hover();
    await page.waitForTimeout(100); // Small delay between hovers
  }
}

/**
 * Checks for console errors (excluding known acceptable ones)
 */
export async function checkForConsoleErrors(page: Page): Promise<string[]> {
  const consoleErrors: string[] = [];
  
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });
  
  // Filter out known acceptable errors
  return consoleErrors.filter(error => 
    !error.includes('ResizeObserver') && 
    !error.includes('Non-passive event listener') &&
    !error.includes('favicon')
  );
}

/**
 * Sets up common test fixtures
 */
export async function setupTestPage(page: Page) {
  // Navigate to timeline page
  await page.goto('/professional-journey');
  
  // Wait for page to load
  await page.waitForSelector('[data-testid="journey-timeline"]', { timeout: 10000 });
  
  // Wait for React Flow to initialize
  await page.waitForTimeout(2000);
  
  // Set up console error monitoring
  const errors = await checkForConsoleErrors(page);
  
  return { errors };
}

/**
 * Cleanup after tests
 */
export async function cleanupTestPage(page: Page) {
  // Clear any open modals
  if (await page.locator('[data-testid="modal-overlay"]').isVisible()) {
    await page.keyboard.press('Escape');
  }
  
  // Clear any routes
  await page.unrouteAll();
}

/**
 * Test data factories
 */
export const TestData = {
  workExperience: (overrides: Partial<WorkExperienceData> = {}): WorkExperienceData => ({
    title: 'Software Engineer',
    company: 'Tech Company',
    start: '2023-01',
    end: '2024-01',
    location: 'San Francisco, CA',
    description: 'Developed amazing software',
    ...overrides
  }),

  education: (overrides: Partial<EducationData> = {}): EducationData => ({
    school: 'University of Technology',
    degree: 'Bachelor of Science',
    field: 'Computer Science',
    start: '2019-09',
    end: '2023-06',
    description: 'Studied computer science fundamentals',
    ...overrides
  }),

  project: (overrides: Partial<ProjectData> = {}): ProjectData => ({
    title: 'Awesome Project',
    description: 'Built something amazing',
    technologies: 'React, Node.js, PostgreSQL',
    start: '2023-03',
    end: '2023-08',
    ...overrides
  }),

  skill: (overrides: Partial<SkillData> = {}): SkillData => ({
    name: 'JavaScript',
    proficiency: 'advanced',
    context: 'Used in production applications',
    verification: 'GitHub portfolio',
    ...overrides
  })
};

/**
 * Viewport presets for responsive testing
 */
export const Viewports = {
  mobile: { width: 375, height: 667 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1920, height: 1080 },
  smallDesktop: { width: 1024, height: 768 }
};

/**
 * Wait for animations to complete
 */
export async function waitForAnimations(page: Page, timeout = 1000) {
  await page.waitForTimeout(timeout);
}
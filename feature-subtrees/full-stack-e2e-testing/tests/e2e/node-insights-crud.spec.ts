import { test, expect } from '@playwright/test';

/**
 * Node Insights System E2E Tests
 * 
 * Tests comprehensive CRUD operations for insights across:
 * - All 6 node types (Job, Education, Project, Event, Action, Career Transition)
 * - Different hierarchy levels (root nodes and child nodes)
 * - Magic UI animations and interactions
 * - Error handling and edge cases
 */

test.describe('Node Insights System - CRUD Operations', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the application
    await page.goto('/');
    
    // Wait for the application to load
    await page.waitForLoadState('networkidle');
    
    // Ensure we're logged in (adjust based on your auth flow)
    // If not logged in, this might need authentication steps
  });

  test.describe('Job Node Insights', () => {
    test('should create, read, update, and delete insights on a job node', async ({ page }) => {
      // Create a test job node first
      await createJobNode(page, 'Senior Software Engineer', 'TechCorp Inc.');
      
      // Open the job node panel
      await page.click('[data-testid="job-node"], .job-node, [class*="job"]').first();
      
      // Wait for panel to open and insights section to load
      await page.waitForSelector('[data-testid="insights-section"], .insights-section, h4:has-text("Insights")', { timeout: 10000 });
      
      // Test CREATE operation
      await testCreateInsight(page, {
        description: 'Learned advanced React patterns and state management techniques that significantly improved application performance.',
        resources: [
          'https://reactpatterns.com',
          'Book: Advanced React Patterns by Kent C. Dodds',
          'Internal mentorship sessions on performance optimization'
        ]
      });
      
      // Test READ operation - verify insight appears
      await expect(page.locator('text="Learned advanced React patterns"')).toBeVisible();
      await expect(page.locator('text="https://reactpatterns.com"')).toBeVisible();
      
      // Test UPDATE operation
      await testUpdateInsight(page, {
        description: 'Mastered advanced React patterns, Redux Toolkit, and performance optimization techniques that led to 40% faster page loads.',
        resources: [
          'https://reactpatterns.com',
          'https://redux-toolkit.js.org',
          'Book: Advanced React Patterns by Kent C. Dodds',
          'Performance audit documentation'
        ]
      });
      
      // Test DELETE operation
      await testDeleteInsight(page);
      
      // Verify insight is removed
      await expect(page.locator('text="Mastered advanced React patterns"')).not.toBeVisible();
    });
  });

  test.describe('Education Node Insights', () => {
    test('should handle insights on education nodes with Magic UI effects', async ({ page }) => {
      // Create education node
      await createEducationNode(page, 'Computer Science Degree', 'University of Technology');
      
      // Open education panel
      await page.click('[data-testid="education-node"], .education-node, [class*="education"]').first();
      await page.waitForSelector('h4:has-text("Insights")');
      
      // Test with multiple insights to verify animated list
      await testCreateInsight(page, {
        description: 'Fundamental algorithms and data structures course provided strong foundation for technical interviews.',
        resources: ['https://algorithmsbook.com', 'Leetcode practice problems']
      });
      
      // Add second insight to test list animations
      await testCreateInsight(page, {
        description: 'Database design course taught normalization and query optimization principles.',
        resources: ['Database Systems textbook', 'PostgreSQL documentation']
      });
      
      // Verify both insights appear with animations
      await expect(page.locator('text="algorithms and data structures"')).toBeVisible();
      await expect(page.locator('text="Database design course"')).toBeVisible();
      
      // Test Magic UI shimmer button effect
      await page.hover('[data-testid="add-insight-btn"], button:has-text("Add Insight")');
      await page.waitForTimeout(500); // Allow animation to show
    });
  });

  test.describe('Project Node Insights (Child Node)', () => {
    test('should handle insights on child project nodes', async ({ page }) => {
      // Create parent job node first
      await createJobNode(page, 'Full Stack Developer', 'StartupXYZ');
      
      // Create child project node
      await createProjectNode(page, 'E-commerce Platform Redesign', 'StartupXYZ Job');
      
      // Open project panel
      await page.click('[data-testid="project-node"], .project-node, [class*="project"]').first();
      await page.waitForSelector('h4:has-text("Insights")');
      
      // Test insights on child node
      await testCreateInsight(page, {
        description: 'Implemented microservices architecture that improved system scalability and reduced deployment time by 60%.',
        resources: [
          'https://microservices.io',
          'Docker containerization guide',
          'Kubernetes deployment configs'
        ]
      });
      
      // Verify insight card displays properly with Magic Card effects
      await page.hover('[data-testid="insight-card"], .magic-card').first();
      await page.waitForTimeout(300); // Allow hover effects
      
      // Test expand/collapse functionality
      const readMoreBtn = page.locator('button:has-text("Read more")');
      if (await readMoreBtn.isVisible()) {
        await readMoreBtn.click();
        await expect(page.locator('text="microservices architecture"')).toBeVisible();
        
        // Test collapse
        await page.click('button:has-text("Show less")');
      }
    });
  });

  test.describe('Event Node Insights', () => {
    test('should handle insights with resource management', async ({ page }) => {
      await createEventNode(page, 'Tech Conference 2024', 'Annual Developer Summit');
      
      await page.click('[data-testid="event-node"], .event-node, [class*="event"]').first();
      await page.waitForSelector('h4:has-text("Insights")');
      
      // Test comprehensive resource management
      await page.click('button:has-text("Add Insight")');
      await page.waitForSelector('[data-testid="insight-form"], .insight-form, [role="dialog"]');
      
      // Fill description
      await page.fill('[data-testid="description-input"], textarea[placeholder*="insight"]', 
        'Networking session revealed emerging trends in AI/ML and provided valuable industry connections.');
      
      // Add multiple resources
      const resources = [
        'https://aitrends2024.com',
        'LinkedIn connections made at event',
        'Speaker contact: john@aicompany.com',
        'Follow-up meeting scheduled for next week'
      ];
      
      for (const resource of resources) {
        await page.fill('[data-testid="resource-input"], input[placeholder*="URL"]', resource);
        await page.click('[data-testid="add-resource-btn"], button:has-text("add"), [class*="ripple"]');
        await page.waitForTimeout(200); // Allow animation
      }
      
      // Verify resources appear
      for (const resource of resources) {
        await expect(page.locator(`text="${resource}"`)).toBeVisible();
      }
      
      // Remove one resource
      await page.click('[data-testid="remove-resource-btn"], button:has([class*="trash"])').first();
      
      // Submit with animated button
      await page.click('[data-testid="submit-btn"], button:has-text("Save Insight")');
      await page.waitForSelector('button:has-text("Saved!")'); // Wait for success animation
      
      // Verify insight was created
      await expect(page.locator('text="Networking session revealed"')).toBeVisible();
    });
  });

  test.describe('Action Node Insights', () => {
    test('should handle empty state and first insight creation', async ({ page }) => {
      await createActionNode(page, 'Skill Development Initiative', 'Learning React Native');
      
      await page.click('[data-testid="action-node"], .action-node, [class*="action"]').first();
      await page.waitForSelector('h4:has-text("Insights")');
      
      // Verify empty state displays
      await expect(page.locator('text="No insights yet"')).toBeVisible();
      await expect(page.locator('text="💡"')).toBeVisible();
      
      // Test first insight creation from empty state
      await page.click('button:has-text("Add Your First Insight")');
      await page.waitForSelector('[role="dialog"]');
      
      await page.fill('textarea[placeholder*="insight"]', 
        'Mobile development course taught me cross-platform development principles and native performance optimization.');
      
      await page.click('button:has-text("Save Insight")');
      await page.waitForSelector('button:has-text("Saved!")');
      
      // Verify empty state is replaced with insight
      await expect(page.locator('text="No insights yet"')).not.toBeVisible();
      await expect(page.locator('text="Mobile development course"')).toBeVisible();
      await expect(page.locator('text="(1)"')).toBeVisible(); // Counter should show
    });
  });

  test.describe('Career Transition Node Insights', () => {
    test('should handle insights with error scenarios', async ({ page }) => {
      await createCareerTransitionNode(page, 'Career Pivot to Tech', 'From Marketing to Software Development');
      
      await page.click('[data-testid="career-transition-node"], .career-transition-node, [class*="career"]').first();
      await page.waitForSelector('h4:has-text("Insights")');
      
      // Test validation errors
      await page.click('button:has-text("Add Insight")');
      await page.waitForSelector('[role="dialog"]');
      
      // Try to submit empty form
      await page.click('button:has-text("Save Insight")');
      
      // Should show validation error
      await expect(page.locator('text="Description is required"')).toBeVisible();
      
      // Test character limit
      const longText = 'A'.repeat(2001); // Exceed 2000 char limit
      await page.fill('textarea[placeholder*="insight"]', longText);
      
      await expect(page.locator('text="Description too long"')).toBeVisible();
      
      // Test valid submission
      await page.fill('textarea[placeholder*="insight"]', 
        'Career transition required learning completely new skill set. Bootcamp and self-study provided foundation, but real learning happened through practical projects.');
      
      await page.click('button:has-text("Save Insight")');
      await page.waitForSelector('button:has-text("Saved!")');
      
      // Test edit functionality
      await page.click('[data-testid="insight-menu"], button:has([class*="more"])').first();
      await page.click('text="Edit"');
      
      await page.fill('textarea[placeholder*="insight"]', 
        'Career transition from marketing to software development required 18 months of intensive learning. Bootcamp provided structure, but real growth came from building personal projects and contributing to open source.');
      
      await page.click('button:has-text("Update")');
      await page.waitForSelector('button:has-text("Updated!")');
      
      await expect(page.locator('text="18 months of intensive learning"')).toBeVisible();
    });
  });

  test.describe('Cross-Node Type Testing', () => {
    test('should handle insights across multiple node types in same session', async ({ page }) => {
      // Create insights on different node types to test store state management
      const nodeTests = [
        { type: 'job', title: 'Software Engineer', company: 'TechCorp' },
        { type: 'education', title: 'CS Degree', institution: 'University' },
        { type: 'project', title: 'Mobile App', description: 'React Native app' }
      ];
      
      for (const nodeTest of nodeTests) {
        // Create node based on type
        if (nodeTest.type === 'job') {
          await createJobNode(page, nodeTest.title, nodeTest.company);
        } else if (nodeTest.type === 'education') {
          await createEducationNode(page, nodeTest.title, nodeTest.institution);
        } else if (nodeTest.type === 'project') {
          await createProjectNode(page, nodeTest.title, nodeTest.description);
        }
        
        // Add insight to each node
        await page.click(`[data-testid="${nodeTest.type}-node"], .${nodeTest.type}-node, [class*="${nodeTest.type}"]`).first();
        await page.waitForSelector('h4:has-text("Insights")');
        
        await testCreateInsight(page, {
          description: `Key learning from ${nodeTest.title}: Important insights gained during this experience.`,
          resources: [`https://example-${nodeTest.type}.com`]
        });
        
        // Close panel
        await page.click('[data-testid="close-panel"], button:has([class*="x"])');
        await page.waitForTimeout(500);
      }
      
      // Verify all insights persist
      for (const nodeTest of nodeTests) {
        await page.click(`[data-testid="${nodeTest.type}-node"], .${nodeTest.type}-node, [class*="${nodeTest.type}"]`).first();
        await page.waitForSelector('h4:has-text("Insights")');
        
        await expect(page.locator(`text="Key learning from ${nodeTest.title}"`)).toBeVisible();
        
        await page.click('[data-testid="close-panel"], button:has([class*="x"])');
        await page.waitForTimeout(300);
      }
    });
  });

  // Helper functions for creating different node types
  async function createJobNode(page, title: string, company: string) {
    // Implementation depends on your node creation UI
    // This is a placeholder - adjust based on actual UI
    await page.click('[data-testid="add-job"], button:has-text("Add Job")');
    await page.fill('[data-testid="job-title"], input[name="title"]', title);
    await page.fill('[data-testid="company"], input[name="company"]', company);
    await page.click('button:has-text("Save"), button:has-text("Create")');
    await page.waitForTimeout(1000);
  }

  async function createEducationNode(page, title: string, institution: string) {
    await page.click('[data-testid="add-education"], button:has-text("Add Education")');
    await page.fill('[data-testid="education-title"], input[name="title"]', title);
    await page.fill('[data-testid="institution"], input[name="institution"]', institution);
    await page.click('button:has-text("Save"), button:has-text("Create")');
    await page.waitForTimeout(1000);
  }

  async function createProjectNode(page, title: string, description: string) {
    await page.click('[data-testid="add-project"], button:has-text("Add Project")');
    await page.fill('[data-testid="project-title"], input[name="title"]', title);
    await page.fill('[data-testid="description"], textarea[name="description"]', description);
    await page.click('button:has-text("Save"), button:has-text("Create")');
    await page.waitForTimeout(1000);
  }

  async function createEventNode(page, title: string, description: string) {
    await page.click('[data-testid="add-event"], button:has-text("Add Event")');
    await page.fill('[data-testid="event-title"], input[name="title"]', title);
    await page.fill('[data-testid="description"], textarea[name="description"]', description);
    await page.click('button:has-text("Save"), button:has-text("Create")');
    await page.waitForTimeout(1000);
  }

  async function createActionNode(page, title: string, description: string) {
    await page.click('[data-testid="add-action"], button:has-text("Add Action")');
    await page.fill('[data-testid="action-title"], input[name="title"]', title);
    await page.fill('[data-testid="description"], textarea[name="description"]', description);
    await page.click('button:has-text("Save"), button:has-text("Create")');
    await page.waitForTimeout(1000);
  }

  async function createCareerTransitionNode(page, title: string, description: string) {
    await page.click('[data-testid="add-career-transition"], button:has-text("Add Career Transition")');
    await page.fill('[data-testid="transition-title"], input[name="title"]', title);
    await page.fill('[data-testid="description"], textarea[name="description"]', description);
    await page.click('button:has-text("Save"), button:has-text("Create")');
    await page.waitForTimeout(1000);
  }

  // Helper function to test insight creation
  async function testCreateInsight(page, insight: { description: string; resources: string[] }) {
    await page.click('button:has-text("Add Insight")');
    await page.waitForSelector('[role="dialog"]');
    
    // Fill description
    await page.fill('textarea[placeholder*="insight"]', insight.description);
    
    // Add resources
    for (const resource of insight.resources) {
      await page.fill('input[placeholder*="URL"]', resource);
      await page.click('button:has([class*="plus"])');
      await page.waitForTimeout(200);
    }
    
    // Submit
    await page.click('button:has-text("Save Insight")');
    await page.waitForSelector('button:has-text("Saved!")');
    await page.waitForTimeout(1500); // Wait for success animation to complete
  }

  // Helper function to test insight updates
  async function testUpdateInsight(page, updatedInsight: { description: string; resources: string[] }) {
    // Open edit menu
    await page.click('button:has([class*="more"])').first();
    await page.click('text="Edit"');
    
    // Clear and update description
    await page.fill('textarea[placeholder*="insight"]', '');
    await page.fill('textarea[placeholder*="insight"]', updatedInsight.description);
    
    // Add new resources (assuming some exist, add more)
    for (const resource of updatedInsight.resources.slice(-2)) { // Add last 2 as new
      await page.fill('input[placeholder*="URL"]', resource);
      await page.click('button:has([class*="plus"])');
      await page.waitForTimeout(200);
    }
    
    await page.click('button:has-text("Update")');
    await page.waitForSelector('button:has-text("Updated!")');
    await page.waitForTimeout(1500);
  }

  // Helper function to test insight deletion
  async function testDeleteInsight(page) {
    await page.click('button:has([class*="more"])').first();
    await page.click('text="Delete"');
    
    // Confirm deletion in alert dialog
    await page.click('button:has-text("Delete"):not(:has-text("Cancel"))');
    await page.waitForTimeout(500);
  }
});
import { test, expect } from '@playwright/test';

test.describe('Add Node Modal Functionality', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the professional journey page
    await page.goto('http://localhost:5004/professional-journey');
    
    // Wait for the timeline to load
    await page.waitForSelector('[role="application"]');
    await page.waitForTimeout(2000); // Allow time for nodes to render
  });

  test('Modal opens from child timeline plus button and creates project successfully', async ({ page }) => {
    console.log('Testing child timeline project creation...');
    
    // Look for an "Add project here" button in the child timeline
    const addProjectButton = page.locator('button:has-text("Add project here")').first();
    await expect(addProjectButton).toBeVisible({ timeout: 10000 });
    
    // Click the add project button
    await addProjectButton.click();
    
    // Verify modal opens
    await expect(page.locator('dialog[aria-labelledby]')).toBeVisible();
    await expect(page.locator('h2:has-text("Add New Milestone")')).toBeVisible();
    
    // Select Project type
    await page.getByTestId('node-type-project').click();
    
    // Verify Project button is selected
    await expect(page.locator('button[data-testid="node-type-project"][aria-pressed="true"]')).toBeVisible();
    
    // Click Next to go to form
    await page.getByTestId('next-button').click();
    
    // Verify we're on the project form
    await expect(page.locator('label:has-text("Project Name")')).toBeVisible();
    
    // Fill out the project form
    await page.getByRole('textbox', { name: 'Project Name *' }).fill('Test E-commerce Platform');
    await page.getByRole('textbox', { name: 'Description' }).fill('Full-stack e-commerce platform with payment integration');
    await page.getByRole('textbox', { name: 'Technologies' }).fill('React, Node.js, PostgreSQL, Stripe');
    await page.getByRole('textbox', { name: 'Start Date' }).fill('2020-03');
    await page.getByRole('textbox', { name: 'End Date' }).fill('2020-08');
    
    // Submit the form
    console.log('Submitting project form...');
    await page.getByTestId('submit-button').click();
    
    // Wait for the submission to complete and modal to close
    await expect(page.locator('dialog[aria-labelledby]')).not.toBeVisible({ timeout: 10000 });
    
    // Wait for the timeline to refresh
    await page.waitForTimeout(3000);
    
    console.log('✅ Project creation test completed successfully');
  });

  test('Modal opens from primary timeline and shows correct node types', async ({ page }) => {
    console.log('Testing primary timeline modal...');
    
    // Look for plus buttons on edges in the primary timeline
    // We need to find an edge that has a plus button between main timeline nodes
    const edgeWithPlus = page.locator('[data-testid*="edge-plus-button"]').first();
    
    if (await edgeWithPlus.count() > 0) {
      await edgeWithPlus.click();
      
      // Verify modal opens
      await expect(page.locator('dialog[aria-labelledby]')).toBeVisible();
      
      // Verify we can see work experience, education, and other primary timeline types
      await expect(page.getByTestId('node-type-workExperience')).toBeVisible();
      await expect(page.getByTestId('node-type-education')).toBeVisible();
      
      // Close modal
      await page.getByTestId('close-modal').click();
    } else {
      console.log('⚠️ No primary timeline plus buttons found');
    }
  });

  test('Modal form validation works correctly', async ({ page }) => {
    console.log('Testing form validation...');
    
    // Open modal via child timeline button
    const addProjectButton = page.locator('button:has-text("Add project here")').first();
    await addProjectButton.click();
    
    // Select Project type and proceed to form
    await page.getByTestId('node-type-project').click();
    await page.getByTestId('next-button').click();
    
    // Try to submit without required fields
    await page.getByTestId('submit-button').click();
    
    // Should show validation errors for required fields
    await expect(page.locator('text="Project name is required"')).toBeVisible();
    
    // Fill only project name and try invalid date format
    await page.getByRole('textbox', { name: 'Project Name *' }).fill('Test Project');
    await page.getByRole('textbox', { name: 'Start Date' }).fill('invalid-date');
    
    await page.getByTestId('submit-button').click();
    
    // Should show date format validation error
    await expect(page.locator('text*="Invalid date format"')).toBeVisible();
    
    console.log('✅ Form validation test completed');
  });

  test('All node types can be selected and show appropriate forms', async ({ page }) => {
    console.log('Testing all node types...');
    
    // Open modal
    const addProjectButton = page.locator('button:has-text("Add project here")').first();
    await addProjectButton.click();
    
    const nodeTypes = [
      { testId: 'node-type-education', expectedFields: ['Institution', 'Degree', 'Field of Study'] },
      { testId: 'node-type-workExperience', expectedFields: ['Job Title', 'Company'] },
      { testId: 'node-type-project', expectedFields: ['Project Name', 'Technologies'] },
      { testId: 'node-type-event', expectedFields: ['Event Name', 'Event Type'] },
      { testId: 'node-type-action', expectedFields: ['Achievement Title', 'Category'] },
    ];
    
    for (const nodeType of nodeTypes) {
      console.log(`Testing ${nodeType.testId}...`);
      
      // Select the node type
      await page.getByTestId(nodeType.testId).click();
      await page.getByTestId('next-button').click();
      
      // Verify expected form fields are present
      for (const field of nodeType.expectedFields) {
        await expect(page.locator(`label:has-text("${field}")`)).toBeVisible();
      }
      
      // Go back to type selection
      await page.getByTestId('back-button').click();
    }
    
    console.log('✅ All node types test completed');
  });

  test('Modal can be cancelled and closed properly', async ({ page }) => {
    console.log('Testing modal cancellation...');
    
    // Open modal
    const addProjectButton = page.locator('button:has-text("Add project here")').first();
    await addProjectButton.click();
    
    // Test Cancel button
    await page.getByTestId('close-modal').click();
    await expect(page.locator('dialog[aria-labelledby]')).not.toBeVisible();
    
    // Open modal again
    await addProjectButton.click();
    
    // Test Close button (X)
    await page.locator('button[aria-label="Close"]').click();
    await expect(page.locator('dialog[aria-labelledby]')).not.toBeVisible();
    
    console.log('✅ Modal cancellation test completed');
  });
});
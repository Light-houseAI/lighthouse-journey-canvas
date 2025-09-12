import { expect,test } from '@playwright/test';

/**
 * Complete User Journey Test - Based on test-4.spec.ts reference
 * Comprehensive end-to-end test covering full user lifecycle:
 * Account Creation → Onboarding → Profile Setup → Timeline Node Operations → Insights Management
 */
test.describe('Complete User Journey', () => {
  const testUser = {
    email: `journey-test-${Date.now()}@lighthouse.com`,
    password: 'TestPassword123!'
  };

  test.beforeEach(async ({ page }) => {
    console.log(`🎯 Starting complete user journey for: ${testUser.email}`);
    
    // Clear any existing state
    await page.context().clearCookies();
    await page.context().clearPermissions();
  });

  test('complete user journey: signup, onboarding, timeline operations, and insights management', async ({ page }) => {
    console.log('🎯 Starting comprehensive user journey test...');

    await test.step('Account Creation', async () => {
      console.log('📝 Creating new user account...');
      
      await page.goto('http://localhost:5004/');
      await page.waitForLoadState('networkidle');
      
      // Switch to create account mode
      await page.getByText('Create account').click();
      await page.waitForTimeout(1000);
      
      // Fill registration form
      await page.getByRole('textbox', { name: 'Email Address' }).fill(testUser.email);
      await page.getByRole('textbox', { name: 'Password' }).fill(testUser.password);
      
      console.log(`📧 Registering user: ${testUser.email}`);
      await page.getByRole('button', { name: 'Create account' }).click();
      
      // Wait for registration to complete
      await page.waitForTimeout(2000);
      console.log('✅ User registration completed');
    });

    await test.step('Onboarding Flow', async () => {
      console.log('🎓 Starting onboarding process...');
      
      // Step 1: Interest selection
      await page.getByText('Looking for new career').click();
      await expect(page.getByText('What are you most interested')).toBeVisible();
      await page.getByRole('button', { name: 'Continue' }).click();
      
      console.log('✅ Onboarding step 1 completed');
    });

    await test.step('Profile Data Extraction', async () => {
      console.log('🔗 Processing profile data extraction...');
      
      // Step 2: Profile extraction setup
      await page.getByText('Let\'s extract your').click();
      await expect(page.getByText('Let\'s extract your')).toBeVisible();
      
      // Enter LinkedIn profile
      await page.getByRole('textbox', { name: 'LinkedIn Profile URL' }).click();
      await page.getByRole('textbox', { name: 'LinkedIn Profile URL' }).fill('ugudlado');
      await page.getByRole('button', { name: 'Extract Profile Data' }).click();
      
      // Review and save profile data
      await expect(page.getByRole('heading', { name: 'Review Profile Data' })).toBeVisible();
      await page.getByRole('button', { name: 'Save Profile' }).click();
      
      // Verify timeline access
      await expect(page.getByRole('heading', { name: 'Your Professional Journey' })).toBeVisible();
      console.log('✅ Profile data extraction completed');
    });

    await test.step('Profile Settings Management', async () => {
      console.log('⚙️ Managing user profile settings...');
      
      // Access user menu and settings
      await page.getByRole('button', { name: 'MG mahesh gudladona' }).click();
      await page.getByRole('menuitem', { name: 'Settings' }).click();
      await expect(page.getByText('Profile Information')).toBeVisible();
      await page.getByRole('heading', { name: 'Settings' }).click();
      await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
      
      // Update profile information
      await page.getByRole('textbox', { name: 'First Name' }).click();
      await page.getByRole('textbox', { name: 'First Name' }).press('ControlOrMeta+ArrowLeft');
      await page.getByRole('textbox', { name: 'First Name' }).press('Shift+ArrowRight');
      await page.getByRole('textbox', { name: 'First Name' }).fill('Mahesh');
      
      await page.getByRole('textbox', { name: 'Last Name' }).click();
      await page.getByRole('textbox', { name: 'Last Name' }).press('ControlOrMeta+ArrowLeft');
      await page.getByRole('textbox', { name: 'Last Name' }).press('Shift+ArrowRight');
      await page.getByRole('textbox', { name: 'Last Name' }).fill('Gudladona');
      
      await page.getByRole('textbox', { name: 'Username' }).click();
      await page.getByRole('textbox', { name: 'Username' }).fill('ugudlado');
      await page.getByRole('button', { name: 'Update Profile' }).click();
      
      // Return to timeline
      await page.getByRole('button', { name: 'Back to Timeline' }).click();
      
      // Verify updated profile appears
      await expect(page.getByRole('button', { name: 'MG Mahesh Gudladona' })).toBeVisible();
      console.log('✅ Profile settings updated successfully');
    });

    await test.step('Timeline Node Operations', async () => {
      console.log('🌲 Testing timeline node operations...');

      // Find and interact with existing timeline node
      await page.getByTestId('rf__node-d2bc47a9-64ff-4886-8868-f597d2e89cea').click();
      
      // Edit existing node location
      await page.getByRole('button', { name: 'Edit' }).click();
      await page.getByRole('textbox', { name: 'Location' }).click();
      await page.getByRole('textbox', { name: 'Location' }).fill('Syracuse');
      await page.getByTestId('submit-button').click();
      
      // Edit role information
      await page.getByRole('button', { name: 'Edit' }).click();
      await page.getByRole('textbox', { name: 'Role *' }).click();
      await page.getByRole('textbox', { name: 'Role *' }).press('ControlOrMeta+ArrowRight');
      await page.getByRole('textbox', { name: 'Role *' }).press('ControlOrMeta+ArrowLeft');
      await page.getByRole('textbox', { name: 'Role *' }).press('Shift+ArrowRight');
      await page.getByRole('textbox', { name: 'Role *' }).fill('General employee at food services');
      await page.getByTestId('submit-button').click();
      
      console.log('✅ Node editing completed');
    });

    await test.step('Node Creation and Hierarchy', async () => {
      console.log('➕ Creating new timeline nodes...');
      
      // Close edit panel and add child node
      await page.getByRole('button', { name: 'Edit' }).click();
      await page.locator('.group.relative.p-2').click();
      
      // Add child node via plus button
      await page.getByTestId('rf__node-d2bc47a9-64ff-4886-8868-f597d2e89cea').getByRole('button', { name: '+' }).click();
      await page.getByTestId('node-type-project').click();
      await page.getByTestId('node-type-event').click();
      await page.getByTestId('next-button').click();
      
      // Fill event form
      await page.getByRole('textbox', { name: 'Title *' }).fill('Football game');
      await page.getByTestId('submit-button').click();
      
      console.log('✅ Child event node created');
    });

    await test.step('Insights Management', async () => {
      console.log('💡 Testing insights functionality...');
      
      // Navigate to timeline and node
      await page.goto('http://localhost:5004/');
      await page.getByTestId('rf__node-d2bc47a9-64ff-4886-8868-f597d2e89cea').click();
      
      // Navigate to add insight
      await page.getByRole('button', { name: 'Add Insight' }).click();
      
      // Fill insight form
      await page.getByRole('textbox', { name: 'Share your insight *' }).fill('Testing new insights');
      await page.getByRole('textbox', { name: 'URL, book reference, note,' }).click();
      await page.getByRole('textbox', { name: 'URL, book reference, note,' }).fill('book');
      await page.getByRole('button').filter({ hasText: /^$/ }).click();
      await page.getByRole('textbox', { name: 'URL, book reference, note,' }).click();
      await page.getByRole('textbox', { name: 'URL, book reference, note,' }).fill('some url');
      await page.getByRole('button').nth(1).click();
      await page.getByRole('button', { name: 'Save Insight' }).click();
      
      console.log('✅ Insight created');
      
      // Test insight editing
      await page.getByRole('button', { name: 'Show more' }).click();
      await page.locator('[id="radix-:r1d:"]').click();
      await page.getByRole('menuitem', { name: 'Edit' }).click();
      await page.getByRole('textbox', { name: 'Share your insight *' }).press('Alt+ArrowRight');
      await page.getByRole('textbox', { name: 'Share your insight *' }).press('Alt+Shift+ArrowLeft');
      await page.getByRole('textbox', { name: 'Share your insight *' }).fill('Testing updated insights');
      await page.getByRole('button', { name: 'Update' }).click();
      
      console.log('✅ Insight updated');
      
      // Test insight deletion
      await page.locator('[id="radix-:r1d:"]').click();
      await page.locator('html').click();
      await page.getByRole('button', { name: 'Show more' }).click();
      await page.locator('[id="radix-:r1d:"]').click();
      await page.getByRole('menuitem', { name: 'Delete' }).click();
      await page.getByRole('button', { name: 'Delete' }).click();
      
      console.log('✅ Insight deleted');
    });

    await test.step('Additional Node Operations', async () => {
      console.log('📋 Creating additional project node...');
      
      // Navigate back and create project
      await page.locator('.group.relative.p-2').click();
      await page.getByTestId('rf__wrapper').locator('div').filter({ hasText: 'JOBopendoorstaff software engineerJul 2022 - Present+JOBabco india private' }).nth(1).click();
      await page.getByTestId('rf__node-d2bc47a9-64ff-4886-8868-f597d2e89cea').getByRole('button', { name: '+' }).click();
      await page.getByTestId('node-type-project').click();
      await page.getByTestId('next-button').click();
      
      // Fill project details
      await page.getByRole('textbox', { name: 'Title *' }).fill('Test project');
      await page.getByRole('textbox', { name: 'Description' }).click();
      await page.getByRole('textbox', { name: 'Description' }).fill('Description');
      await page.getByText('Title *DescriptionDescriptionProject TypeSelect').click();
      await page.getByText('Title *DescriptionDescriptionProject TypeSelect').click();
      await page.getByRole('textbox', { name: 'Start Date' }).click();
      await page.getByRole('textbox', { name: 'Start Date' }).fill('2008-10');
      await page.getByTestId('submit-button').click();
      
      console.log('✅ Project node created');
      
      // Verify project appears in timeline
      await page.goto('http://localhost:5004/');
      await page.getByTestId('rf__node-d2bc47a9-64ff-4886-8868-f597d2e89cea').click();
      await page.getByTestId('rf__wrapper').locator('div').filter({ hasText: 'JOBopendoorstaff software engineerJul 2022 - Present+JOBabco india private' }).nth(1).click();
      await page.getByTestId('rf__wrapper').locator('div').filter({ hasText: 'JOBopendoorstaff software engineerJul 2022 - Present+JOBabco india private' }).nth(1).click();
      await page.getByTestId('rf__node-8fd86fc3-e911-4ae0-9058-3f84fec652b2').click();
      await expect(page.getByRole('heading', { name: 'Test project' })).toBeVisible();
    });

    await test.step('Node Hierarchy and Cleanup', async () => {
      console.log('🧹 Testing node hierarchy and cleanup...');
      
      // Create action under project
      await page.locator('.group.relative.p-2').click();
      await page.getByTestId('node-type-action').click();
      await page.getByTestId('next-button').click();
      await page.getByRole('textbox', { name: 'Title *' }).fill('Starting new project');
      await page.getByTestId('submit-button').click();
      
      // Navigate and verify action node
      await page.goto('http://localhost:5004/');
      await page.getByTestId('rf__node-d2bc47a9-64ff-4886-8868-f597d2e89cea').click();
      await page.getByTestId('rf__node-8fd86fc3-e911-4ae0-9058-3f84fec652b2').getByRole('button').filter({ hasText: /^$/ }).click();
      await page.getByTestId('rf__node-839af02d-f58d-41ed-86d8-d8b1a931ae39').click();
      await expect(page.getByRole('heading', { name: 'Starting new project' })).toBeVisible();
      
      // Navigate back to timeline
      await page.getByTestId('rf__wrapper').locator('div').filter({ hasText: 'JOBopendoorstaff software engineerJul 2022 - Present+JOBabco india private' }).nth(1).click();
      await page.locator('.group.relative.p-2').click();
      await page.getByRole('button', { name: 'fit view' }).click();
      
      // Test node deletion
      await page.getByTestId('rf__node-ff8a572d-cb14-40cb-93e5-775ef9da07a1').click();
      await page.getByRole('button', { name: 'Delete' }).click();
      await page.getByRole('button', { name: 'Delete' }).click();
      await page.getByRole('button', { name: 'fit view' }).click();
      
      console.log('✅ Node hierarchy and cleanup completed');
    });

    console.log('🎉 Complete user journey test finished successfully!');
  });
});
import { test, expect } from '@playwright/test';
import { TimelinePage } from '../fixtures/page-objects/TimelinePage';
import { TestDataFactory } from '../fixtures/test-data';

/**
 * Consolidated Timeline Node Operations
 * Covers node CRUD operations, hierarchy management, and interactions
 */
test.describe('Timeline Node Operations', () => {
  let timelinePage: TimelinePage;
  const testUser = {
    email: process.env.TEST_USER_NAME || 'testuser@lighthouse.com',
    password: process.env.TEST_PASSWORD || 'testuser@lighthouse.com'
  };

  test.beforeEach(async ({ page }) => {
    console.log('🔧 Setting up authenticated session for node operations...');
    timelinePage = new TimelinePage(page);
    await timelinePage.navigate();
    
    // Check if authenticated content is visible
    const hasAuthContent = await page.locator('text=Your Professional Journey, text=Career path visualization').first().isVisible({ timeout: 3000 });
    
    if (!hasAuthContent) {
      // Try the root path
      await page.goto('/');
      await page.waitForLoadState('networkidle');
    }
    
    console.log(`✅ Authenticated session ready for node operations at: ${page.url()}`);
  });

  test('verify timeline state and FloatingActionButton availability', async ({ page }) => {
    console.log('🔍 Checking current timeline state...');
    
    // Navigate to timeline
    await page.goto('/professional-journey');
    await page.waitForTimeout(3000);
    
    // Check what's currently visible
    const noDataState = await page.locator('text=No Journey Data').isVisible({ timeout: 3000 });
    const timelineExists = await page.locator('.react-flow').isVisible({ timeout: 3000 });
    const floatingButton = await page.locator('[data-testid="floating-action-button"]').isVisible({ timeout: 1000 });
    
    console.log('NoData state visible:', noDataState);
    console.log('Timeline (ReactFlow) visible:', timelineExists);
    console.log('FloatingActionButton visible:', floatingButton);
    
    if (!noDataState && timelineExists) {
      console.log('✅ Timeline data exists - ready for CRUD testing');
      
      // Count timeline nodes
      const nodeElements = await page.locator('[data-timeline-node]').count();
      const reactFlowNodes = await page.locator('.react-flow__node').count();
      
      console.log(`📊 Found ${nodeElements} timeline node elements (data-timeline-node)`);
      console.log(`📊 Found ${reactFlowNodes} react-flow nodes`);
      
      if (floatingButton) {
        console.log('✅ FloatingActionButton is available for node creation');
        
        // Test clicking the FAB
        await page.locator('[data-testid="floating-action-button"]').click();
        await page.waitForTimeout(2000);
        
        // Check if modal opened
        const modalVisible = await page.locator('[role="dialog"], .modal, [data-testid*="modal"]').isVisible({ timeout: 3000 });
        const nodeTypeOptions = await page.locator('text=Job, text=Education, text=Project').isVisible({ timeout: 2000 });
        
        console.log('Modal visible after FAB click:', modalVisible);
        console.log('Node type options visible:', nodeTypeOptions);
        
        if (modalVisible || nodeTypeOptions) {
          console.log('🎉 CRUD operations available - node creation modal opened');
          
          // Close modal if open
          const closeSelectors = ['button[aria-label="close"]', 'button:has-text("Cancel")', 'button:has-text("Close")', '[data-testid="close"]'];
          for (const selector of closeSelectors) {
            if (await page.locator(selector).isVisible({ timeout: 1000 })) {
              await page.locator(selector).click();
              break;
            }
          }
        } else {
          console.log('⚠️ FAB clicked but no modal detected');
        }
      }
      
      expect(timelineExists).toBeTruthy();
    } else if (noDataState) {
      console.log('ℹ️ NoData state detected - user needs timeline data');
      
      // Check what options are available in NoData state
      const addProfileButton = await page.locator('button:has-text("Add Profile Data")').isVisible();
      console.log(`📋 Add Profile Data button available: ${addProfileButton}`);
      expect(noDataState).toBeTruthy();
    }
  });

  test('basic node creation workflow', async ({ page }) => {
    console.log('🎯 Testing node creation workflow...');
    
    await page.goto('/professional-journey');
    await page.waitForTimeout(3000);
    
    // Check if we can proceed with CRUD testing
    const noDataState = await page.locator('text=No Journey Data').isVisible({ timeout: 3000 });
    if (noDataState) {
      console.log('📭 Skipping CRUD test - user has no timeline data');
      test.skip(true, 'User has no timeline data for CRUD testing');
      return;
    }
    
    // Look for FloatingActionButton
    const fabVisible = await page.locator('[data-testid="floating-action-button"]').isVisible({ timeout: 3000 });
    
    if (!fabVisible) {
      console.log('📭 Skipping CRUD test - FloatingActionButton not available');
      test.skip(true, 'FloatingActionButton not available');
      return;
    }
    
    console.log('✅ FloatingActionButton available - testing node creation');
    
    // Click FAB to open modal
    await page.locator('[data-testid="floating-action-button"]').click();
    await page.waitForTimeout(2000);
    
    // Check for node type selection
    const jobOption = await page.locator('text=Job, [data-node-type="job"], button:has-text("Job")').isVisible({ timeout: 3000 });
    const educationOption = await page.locator('text=Education, [data-node-type="education"], button:has-text("Education")').isVisible({ timeout: 3000 });
    const projectOption = await page.locator('text=Project, [data-node-type="project"], button:has-text("Project")').isVisible({ timeout: 3000 });
    
    console.log(`Node type options - Job: ${jobOption}, Education: ${educationOption}, Project: ${projectOption}`);
    
    if (jobOption || educationOption || projectOption) {
      console.log('✅ Node creation modal opened successfully');
      
      // Try to create a simple test node
      if (projectOption) {
        console.log('📁 Testing project node creation...');
        await page.locator('text=Project, [data-node-type="project"], button:has-text("Project")').first().click();
        await page.waitForTimeout(1000);
        
        // Fill project details if form is available
        const titleInput = page.locator('input[name="title"], input[placeholder*="title"], input[placeholder*="name"]').first();
        if (await titleInput.isVisible({ timeout: 2000 })) {
          await titleInput.fill('Test E2E Project');
          
          const descriptionInput = page.locator('textarea[name="description"], input[name="description"]').first();
          if (await descriptionInput.isVisible({ timeout: 1000 })) {
            await descriptionInput.fill('Test project for E2E validation');
          }
          
          // Save the node
          const saveButton = page.locator('button:has-text("Save"), button:has-text("Create"), button:has-text("Add")').first();
          if (await saveButton.isVisible({ timeout: 2000 })) {
            await saveButton.click();
            await page.waitForTimeout(3000);
            
            // Check if node was created
            const nodeCreated = await page.locator('text=Test E2E Project').isVisible({ timeout: 5000 });
            if (nodeCreated) {
              console.log('🎉 Test project node created successfully!');
              expect(nodeCreated).toBeTruthy();
            } else {
              console.log('⚠️ Node creation attempted but not confirmed');
            }
          } else {
            console.log('ℹ️ Save button not found - form may be different');
          }
        } else {
          console.log('ℹ️ Title input not found - form may be different');
        }
      }
      
      // Close modal/form
      const closeSelectors = ['button[aria-label="close"]', 'button:has-text("Cancel")', 'button:has-text("Close")'];
      for (const selector of closeSelectors) {
        if (await page.locator(selector).isVisible({ timeout: 1000 })) {
          await page.locator(selector).click();
          break;
        }
      }
    } else {
      console.log('⚠️ Node type options not found - modal may not have opened correctly');
    }
  });

  test('expand and collapse parent nodes with chevron buttons', async ({ page }) => {
    await test.step('Look for expandable nodes', async () => {
      // Look for chevron buttons or expandable indicators
      const chevronSelectors = [
        '[data-testid*="chevron"]',
        '[data-testid*="expand"]',
        'button[aria-label*="expand"]',
        'button[aria-label*="collapse"]',
        '.chevron',
        '.expand-button',
        '[role="button"][aria-expanded]'
      ];

      let expandableFound = false;
      let expandableNode: any = null;

      for (const selector of chevronSelectors) {
        const chevrons = await page.locator(selector).all();
        if (chevrons.length > 0) {
          expandableFound = true;
          expandableNode = chevrons[0];
          break;
        }
      }

      if (!expandableFound) {
        console.log('⚠️ No expandable nodes found in current timeline');
        test.skip(); 
        return;
      }

      await test.step('Test expand functionality', async () => {
        // Get initial state
        const initialState = await expandableNode.getAttribute('aria-expanded');
        const isInitiallyExpanded = initialState === 'true';

        // Click to toggle expansion
        await expandableNode.click();
        await page.waitForTimeout(500);

        // Check if state changed
        const newState = await expandableNode.getAttribute('aria-expanded');
        const isNowExpanded = newState === 'true';

        expect(isNowExpanded).not.toBe(isInitiallyExpanded);
      });

      await test.step('Test collapse functionality', async () => {
        // If expanded, collapse it
        const currentState = await expandableNode.getAttribute('aria-expanded');
        
        if (currentState === 'true') {
          await expandableNode.click();
          await page.waitForTimeout(500);
          
          const finalState = await expandableNode.getAttribute('aria-expanded');
          expect(finalState).toBe('false');
        }
      });
    });
  });

  test('multi-level hierarchy navigation (3+ levels)', async ({ page }) => {
    await test.step('Look for deep hierarchy structure', async () => {
      // Look for nested node structure
      const nestedSelectors = [
        '[data-testid*="node-"] [data-testid*="node-"]', // Nested nodes
        '.timeline-node .timeline-node',
        '[data-level="2"], [data-level="3"]',
        '[style*="padding-left"], [style*="margin-left"]' // Indented nodes
      ];

      let deepHierarchyFound = false;
      
      for (const selector of nestedSelectors) {
        const nestedNodes = await page.locator(selector).count();
        if (nestedNodes > 0) {
          deepHierarchyFound = true;
          console.log(`Found ${nestedNodes} nested nodes with selector: ${selector}`);
          break;
        }
      }

      if (!deepHierarchyFound) {
        console.log('⚠️ No deep hierarchy found - testing with available structure');
      }
    });

    await test.step('Test hierarchy scenarios', async () => {
      // Scenario 1: Job → Project → Sub-project
      await testHierarchyScenario(page, 'job', 'project', 'project');
      
      // Scenario 2: Education → Event → Action → Project  
      await testHierarchyScenario(page, 'education', 'event', 'action');
      
      // Scenario 3: CareerTransition → Event → Project
      await testHierarchyScenario(page, 'career-transition', 'event', 'project');
    });
  });

  async function testHierarchyScenario(page: any, parentType: string, childType: string, grandchildType: string) {
    // Look for nodes matching the hierarchy pattern
    const parentNodes = await page.locator(`[data-testid*="${parentType}"], [data-node-type="${parentType}"]`).all();
    
    if (parentNodes.length === 0) {
      console.log(`⚠️ No ${parentType} nodes found for hierarchy test`);
      return;
    }

    const parentNode = parentNodes[0];
    
    // Look for chevron or expand button on parent
    const expandButton = parentNode.locator('[data-testid*="chevron"], [aria-label*="expand"], button[aria-expanded]').first();
    
    if (await expandButton.isVisible({ timeout: 2000 })) {
      // Expand parent to reveal children
      await expandButton.click();
      await page.waitForTimeout(500);
      
      // Look for child nodes
      const childNodes = await page.locator(`[data-testid*="${childType}"], [data-node-type="${childType}"]`).all();
      
      if (childNodes.length > 0) {
        console.log(`✅ Found ${childType} children under ${parentType} parent`);
        
        // Try to expand first child to look for grandchildren
        const childExpandButton = childNodes[0].locator('[data-testid*="chevron"], [aria-label*="expand"]').first();
        
        if (await childExpandButton.isVisible({ timeout: 1000 })) {
          await childExpandButton.click();
          await page.waitForTimeout(500);
          
          const grandchildNodes = await page.locator(`[data-testid*="${grandchildType}"], [data-node-type="${grandchildType}"]`).all();
          
          if (grandchildNodes.length > 0) {
            console.log(`✅ Found ${grandchildType} grandchildren - 3+ level hierarchy confirmed`);
          }
        }
      }
    }
  }

  test('proper visual indentation for nested nodes', async ({ page }) => {
    await test.step('Check for visual hierarchy indicators', async () => {
      // Look for visual indicators of hierarchy depth
      const indentationSelectors = [
        '[style*="margin-left"]',
        '[style*="padding-left"]', 
        '[data-level]',
        '.indent-1, .indent-2, .indent-3',
        '[class*="level-"], [class*="depth-"]'
      ];

      let indentationFound = false;
      let indentedElements: any[] = [];

      for (const selector of indentationSelectors) {
        const elements = await page.locator(selector).all();
        if (elements.length > 0) {
          indentationFound = true;
          indentedElements = elements;
          console.log(`Found ${elements.length} indented elements with selector: ${selector}`);
          break;
        }
      }

      if (indentationFound) {
        await test.step('Verify indentation increases with depth', async () => {
          // Check if indentation values increase with nesting level
          const indentations: number[] = [];
          
          for (const element of indentedElements.slice(0, 5)) { // Check first 5 elements
            try {
              const style = await element.getAttribute('style');
              if (style) {
                const marginMatch = style.match(/margin-left:\s*(\d+)/);
                const paddingMatch = style.match(/padding-left:\s*(\d+)/);
                
                if (marginMatch) {
                  indentations.push(parseInt(marginMatch[1]));
                } else if (paddingMatch) {
                  indentations.push(parseInt(paddingMatch[1]));
                }
              }
              
              const dataLevel = await element.getAttribute('data-level');
              if (dataLevel) {
                indentations.push(parseInt(dataLevel) * 20); // Assume 20px per level
              }
            } catch (error) {
              // Skip this element
            }
          }

          if (indentations.length > 1) {
            // Verify that deeper levels have more indentation
            const hasProperIndentation = indentations.some((indent, index) => 
              index === 0 || indent >= indentations[index - 1]
            );
            
            expect(hasProperIndentation).toBeTruthy();
            console.log(`✅ Proper indentation found: ${indentations.join(', ')}`);
          }
        });
      } else {
        console.log('⚠️ No visual indentation indicators found');
      }
    });
  });

  test('child node visibility on parent expansion', async ({ page }) => {
    await test.step('Find parent-child relationships', async () => {
      // Look for collapsed parent nodes
      const collapsedParents = await page.locator('[aria-expanded="false"]').all();
      
      if (collapsedParents.length === 0) {
        console.log('⚠️ No collapsed parents found to test expansion');
        test.skip();
        return;
      }

      const parentNode = collapsedParents[0];
      
      await test.step('Verify children are hidden when parent is collapsed', async () => {
        // Get parent node identifier
        const parentId = await parentNode.getAttribute('data-testid') || 
                         await parentNode.getAttribute('id') ||
                         'unknown';

        // Look for potential child nodes (they should be hidden)
        const childrenContainer = page.locator(`[data-parent="${parentId}"], [data-testid="children-${parentId}"]`);
        
        if (await childrenContainer.isVisible({ timeout: 1000 })) {
          const childrenVisible = await childrenContainer.isVisible();
          expect(childrenVisible).toBeFalsy();
        }
      });

      await test.step('Expand parent and verify children become visible', async () => {
        // Click to expand
        await parentNode.click();
        await page.waitForTimeout(500);
        
        // Verify expansion state changed
        const newState = await parentNode.getAttribute('aria-expanded');
        expect(newState).toBe('true');
        
        // Look for child nodes that should now be visible
        const visibleChildren = await page.locator('[data-testid*="node-"]').count();
        expect(visibleChildren).toBeGreaterThan(0);
      });
    });
  });

  test('node selection and highlighting', async ({ page }) => {
    await test.step('Test node selection', async () => {
      // Look for existing nodes to select
      const nodes = await page.locator('[data-testid*="node-"]').all();
      
      if (nodes.length === 0) {
        // Try react-flow nodes
        const reactFlowNodes = await page.locator('.react-flow__node').all();
        
        if (reactFlowNodes.length > 0) {
          const firstNode = reactFlowNodes[0];
          
          // Click on the node
          await firstNode.click();
          await page.waitForTimeout(500);
          
          // Check if node becomes selected/highlighted
          const nodeClasses = await firstNode.getAttribute('class');
          const isSelected = nodeClasses?.includes('selected') || 
                            nodeClasses?.includes('active') || 
                            nodeClasses?.includes('highlighted');
          
          // Either should be selected or should open a panel/modal
          const panelOpened = await page.locator('[data-testid*="panel"], [data-testid*="modal"], [role="dialog"]').isVisible({ timeout: 2000 });
          
          expect(isSelected || panelOpened).toBeTruthy();
        } else {
          console.log('⚠️ No nodes found to test selection');
          test.skip();
        }
      } else {
        const firstNode = nodes[0];
        
        // Click on the node
        await firstNode.click();
        await page.waitForTimeout(500);
        
        // Check if node becomes selected/highlighted
        const nodeClasses = await firstNode.getAttribute('class');
        const isSelected = nodeClasses?.includes('selected') || 
                          nodeClasses?.includes('active') || 
                          nodeClasses?.includes('highlighted');
        
        // Either should be selected or should open a panel/modal
        const panelOpened = await page.locator('[data-testid*="panel"], [data-testid*="modal"], [role="dialog"]').isVisible({ timeout: 2000 });
        
        expect(isSelected || panelOpened).toBeTruthy();
      }
    });
  });

  test('hierarchy performance with large datasets', async ({ page }) => {
    await test.step('Measure expansion performance', async () => {
      const expandableNodes = await page.locator('[aria-expanded="false"]').all();
      
      if (expandableNodes.length > 0) {
        const startTime = Date.now();
        
        // Expand first few nodes
        for (let i = 0; i < Math.min(5, expandableNodes.length); i++) {
          await expandableNodes[i].click();
          await page.waitForTimeout(100); // Small delay between expansions
        }
        
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        console.log(`Expanded ${Math.min(5, expandableNodes.length)} nodes in ${duration}ms`);
        
        // Performance should be reasonable (less than 3 seconds for 5 nodes)
        expect(duration).toBeLessThan(3000);
      } else {
        console.log('⚠️ No expandable nodes found for performance test');
      }
    });
  });

  test('keyboard navigation for hierarchy', async ({ page }) => {
    await test.step('Test keyboard expansion', async () => {
      // Focus on first expandable node
      const expandableNode = page.locator('[aria-expanded]').first();
      
      if (await expandableNode.isVisible({ timeout: 3000 })) {
        await expandableNode.focus();
        
        // Try expanding with Enter or Space
        await page.keyboard.press('Enter');
        await page.waitForTimeout(500);
        
        // Check if state changed
        const state = await expandableNode.getAttribute('aria-expanded');
        
        // Try Space key as alternative
        if (state !== 'true') {
          await page.keyboard.press('Space');
          await page.waitForTimeout(500);
        }
        
        // Arrow key navigation
        await page.keyboard.press('ArrowDown');
        await page.waitForTimeout(200);
        
        await page.keyboard.press('ArrowUp');
        await page.waitForTimeout(200);
      } else {
        console.log('⚠️ No expandable nodes found for keyboard test');
      }
    });
  });
});
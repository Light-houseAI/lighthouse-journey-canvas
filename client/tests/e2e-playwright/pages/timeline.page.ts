/**
 * Timeline Page Object
 *
 * Handles timeline and node management workflows:
 * 1. Node creation and editing
 * 2. Hierarchy management
 * 3. Node sharing and permissions
 * 4. Timeline navigation and filtering
 */

import { expect,type Locator, type Page } from '@playwright/test';

import { BasePage } from './base.page.js';

export class TimelinePage extends BasePage {
  // Locators
  private readonly createNodeButton: Locator;
  private readonly nodeTypeSelect: Locator;
  private readonly nodeTitleInput: Locator;
  private readonly nodeDescriptionInput: Locator;
  private readonly saveNodeButton: Locator;
  private readonly cancelButton: Locator;
  private readonly nodesList: Locator;
  private readonly searchInput: Locator;
  private readonly filterDropdown: Locator;
  private readonly shareButton: Locator;
  private readonly deleteButton: Locator;
  private readonly editButton: Locator;

  constructor(page: Page) {
    super(page);
    
    // Initialize locators
    this.createNodeButton = page.locator('button:has-text("Create Node"), button:has-text("Add Node"), [data-testid="create-node-button"]');
    this.nodeTypeSelect = page.locator('select[name="type"], [data-testid="node-type-select"]');
    this.nodeTitleInput = page.locator('input[name="title"], [data-testid="node-title"]');
    this.nodeDescriptionInput = page.locator('textarea[name="description"], [data-testid="node-description"]');
    this.saveNodeButton = page.locator('button[type="submit"]:has-text("Save"), button:has-text("Create")');
    this.cancelButton = page.locator('button:has-text("Cancel")');
    this.nodesList = page.locator('.timeline-nodes, .nodes-list, [data-testid="nodes-list"]');
    this.searchInput = page.locator('input[placeholder*="Search"], [data-testid="search-input"]');
    this.filterDropdown = page.locator('select:has(option:text("All")), [data-testid="filter-dropdown"]');
    this.shareButton = page.locator('button:has-text("Share"), [data-testid="share-button"]');
    this.deleteButton = page.locator('button:has-text("Delete"), [data-testid="delete-button"]');
    this.editButton = page.locator('button:has-text("Edit"), [data-testid="edit-button"]');
  }

  /**
   * Navigate to timeline page
   */
  async navigateToTimeline() {
    await this.goto('/timeline');
    await this.waitForElement(this.nodesList);
    await this.waitForLoading();
  }

  /**
   * Create a new timeline node
   */
  async createNode(nodeData: {
    type: string;
    title: string;
    description?: string;
    parentId?: string;
    [key: string]: any;
  }) {
    // Click create button
    await this.clickElement(this.createNodeButton);
    
    // Wait for form to appear
    await this.waitForElement(this.nodeTypeSelect);
    
    // Fill form
    await this.selectOption(this.nodeTypeSelect, nodeData.type);
    await this.fillInput(this.nodeTitleInput, nodeData.title);
    
    if (nodeData.description) {
      await this.fillInput(this.nodeDescriptionInput, nodeData.description);
    }
    
    // Handle additional fields based on node type
    await this.fillTypeSpecificFields(nodeData);
    
    // Submit form
    await this.clickElement(this.saveNodeButton);
    await this.waitForLoading();
    
    // Verify node was created
    const createdNode = await this.findNodeByTitle(nodeData.title);
    expect(createdNode).toBeTruthy();
    
    return { 
      success: true, 
      nodeElement: createdNode,
      title: nodeData.title 
    };
  }

  /**
   * Fill type-specific fields based on node type
   */
  private async fillTypeSpecificFields(nodeData: any) {
    switch (nodeData.type.toLowerCase()) {
      case 'job':
        await this.fillJobFields(nodeData);
        break;
      case 'project':
        await this.fillProjectFields(nodeData);
        break;
      case 'education':
        await this.fillEducationFields(nodeData);
        break;
      // Add more types as needed
    }
  }

  /**
   * Fill job-specific fields
   */
  private async fillJobFields(nodeData: any) {
    const companyInput = this.page.locator('input[name="company"], [data-testid="company-input"]');
    const startDateInput = this.page.locator('input[name="startDate"], [data-testid="start-date"]');
    const endDateInput = this.page.locator('input[name="endDate"], [data-testid="end-date"]');
    
    if (nodeData.company && await this.isVisible(companyInput)) {
      await this.fillInput(companyInput, nodeData.company);
    }
    
    if (nodeData.startDate && await this.isVisible(startDateInput)) {
      await this.fillInput(startDateInput, nodeData.startDate);
    }
    
    if (nodeData.endDate && await this.isVisible(endDateInput)) {
      await this.fillInput(endDateInput, nodeData.endDate);
    }
  }

  /**
   * Fill project-specific fields
   */
  private async fillProjectFields(nodeData: any) {
    const technologiesInput = this.page.locator('input[name="technologies"], [data-testid="technologies-input"]');
    const urlInput = this.page.locator('input[name="url"], [data-testid="project-url"]');
    
    if (nodeData.technologies && await this.isVisible(technologiesInput)) {
      const techString = Array.isArray(nodeData.technologies) 
        ? nodeData.technologies.join(', ')
        : nodeData.technologies;
      await this.fillInput(technologiesInput, techString);
    }
    
    if (nodeData.url && await this.isVisible(urlInput)) {
      await this.fillInput(urlInput, nodeData.url);
    }
  }

  /**
   * Fill education-specific fields
   */
  private async fillEducationFields(nodeData: any) {
    const institutionInput = this.page.locator('input[name="institution"], [data-testid="institution-input"]');
    const degreeInput = this.page.locator('input[name="degree"], [data-testid="degree-input"]');
    
    if (nodeData.institution && await this.isVisible(institutionInput)) {
      await this.fillInput(institutionInput, nodeData.institution);
    }
    
    if (nodeData.degree && await this.isVisible(degreeInput)) {
      await this.fillInput(degreeInput, nodeData.degree);
    }
  }

  /**
   * Find node by title in the timeline
   */
  async findNodeByTitle(title: string): Promise<Locator | null> {
    const nodeElement = this.page.locator(`.node-item:has-text("${title}"), .timeline-node:has-text("${title}"), [data-testid="node-item"]:has-text("${title}")`);
    
    if (await this.isVisible(nodeElement)) {
      return nodeElement;
    }
    
    return null;
  }

  /**
   * Edit an existing node
   */
  async editNode(nodeTitle: string, updates: Record<string, any>) {
    const nodeElement = await this.findNodeByTitle(nodeTitle);
    if (!nodeElement) {
      throw new Error(`Node with title "${nodeTitle}" not found`);
    }
    
    // Click edit button on the node
    const editButton = nodeElement.locator('button:has-text("Edit"), [data-testid="edit-button"]');
    await this.clickElement(editButton);
    
    // Wait for edit form
    await this.waitForElement(this.nodeTitleInput);
    
    // Update fields
    if (updates.title) {
      await this.fillInput(this.nodeTitleInput, updates.title);
    }
    
    if (updates.description) {
      await this.fillInput(this.nodeDescriptionInput, updates.description);
    }
    
    // Fill any additional fields
    await this.fillTypeSpecificFields(updates);
    
    // Save changes
    await this.clickElement(this.saveNodeButton);
    await this.waitForLoading();
    
    return { success: true };
  }

  /**
   * Delete a node
   */
  async deleteNode(nodeTitle: string) {
    const nodeElement = await this.findNodeByTitle(nodeTitle);
    if (!nodeElement) {
      throw new Error(`Node with title "${nodeTitle}" not found`);
    }
    
    // Click delete button
    const deleteButton = nodeElement.locator('button:has-text("Delete"), [data-testid="delete-button"]');
    await this.clickElement(deleteButton);
    
    // Handle confirmation dialog
    await this.handleModal('accept');
    await this.waitForLoading();
    
    // Verify node is gone
    const deletedNode = await this.findNodeByTitle(nodeTitle);
    expect(deletedNode).toBeNull();
    
    return { success: true };
  }

  /**
   * Share a node
   */
  async shareNode(nodeTitle: string, shareType: 'public' | 'organization' = 'public') {
    const nodeElement = await this.findNodeByTitle(nodeTitle);
    if (!nodeElement) {
      throw new Error(`Node with title "${nodeTitle}" not found`);
    }
    
    // Click share button
    const shareButton = nodeElement.locator('button:has-text("Share"), [data-testid="share-button"]');
    await this.clickElement(shareButton);
    
    // Wait for share dialog
    const shareDialog = this.page.locator('.share-dialog, .modal:has-text("Share"), [data-testid="share-dialog"]');
    await this.waitForElement(shareDialog);
    
    // Select share type
    const shareTypeSelect = shareDialog.locator('select, [data-testid="share-type-select"]');
    if (await this.isVisible(shareTypeSelect)) {
      await this.selectOption(shareTypeSelect, shareType);
    }
    
    // Confirm sharing
    const confirmButton = shareDialog.locator('button:has-text("Share"), button:has-text("Confirm")');
    await this.clickElement(confirmButton);
    
    // Wait for dialog to close
    await shareDialog.waitFor({ state: 'hidden' });
    
    return { success: true };
  }

  /**
   * Search for nodes
   */
  async searchNodes(query: string) {
    await this.fillInput(this.searchInput, query);
    await this.waitForLoading();
    
    // Get visible nodes after search
    const visibleNodes = this.page.locator('.node-item:visible, .timeline-node:visible');
    const nodeCount = await visibleNodes.count();
    
    const results = [];
    for (let i = 0; i < nodeCount; i++) {
      const node = visibleNodes.nth(i);
      const title = await this.getTextContent(node.locator('.node-title, .title'));
      results.push({ title, element: node });
    }
    
    return results;
  }

  /**
   * Filter nodes by type
   */
  async filterByType(nodeType: string) {
    await this.selectOption(this.filterDropdown, nodeType);
    await this.waitForLoading();
    
    return await this.getVisibleNodes();
  }

  /**
   * Get all visible nodes
   */
  async getVisibleNodes() {
    const nodeElements = this.page.locator('.node-item:visible, .timeline-node:visible');
    const nodeCount = await nodeElements.count();
    
    const nodes = [];
    for (let i = 0; i < nodeCount; i++) {
      const node = nodeElements.nth(i);
      const title = await this.getTextContent(node.locator('.node-title, .title'));
      const type = await node.getAttribute('data-type') || 'unknown';
      
      nodes.push({ title, type, element: node });
    }
    
    return nodes;
  }

  /**
   * Verify node hierarchy relationships
   */
  async verifyNodeHierarchy(parentTitle: string, childTitles: string[]) {
    const parentNode = await this.findNodeByTitle(parentTitle);
    if (!parentNode) {
      throw new Error(`Parent node "${parentTitle}" not found`);
    }
    
    // Look for children in the hierarchy
    for (const childTitle of childTitles) {
      const childNode = await this.findNodeByTitle(childTitle);
      if (!childNode) {
        throw new Error(`Child node "${childTitle}" not found`);
      }
      
      // Verify child is visually under parent (this depends on UI implementation)
      const childRect = await childNode.boundingBox();
      const parentRect = await parentNode.boundingBox();
      
      if (childRect && parentRect) {
        expect(childRect.y).toBeGreaterThan(parentRect.y);
      }
    }
    
    return { success: true };
  }

  /**
   * Wait for timeline to load completely
   */
  async waitForTimelineLoad() {
    await this.waitForElement(this.nodesList);
    await this.waitForLoading();
    
    // Wait for any animations to complete
    await this.page.waitForTimeout(500);
  }
}
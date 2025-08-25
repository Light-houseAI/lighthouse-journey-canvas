/**
 * Permission actions for node access control
 * Note: Only 'view' permission is supported for cross-user access.
 * Edit, Share, and Delete operations are owner-only.
 */
export type PermissionAction = 'view';

/**
 * Permission levels for granular access control
 */
export type PermissionLevel = 'overview' | 'full';

/**
 * NodeFilter - Encapsulates filtering logic for timeline nodes with enhanced permissions
 * Usage: NodeFilter.Of(currentUserId).For(targetUserId).WithAction('view').AtLevel('overview')
 */
/**
 * NodeFilter - Encapsulates filtering logic for timeline nodes with enhanced permissions
 * Usage: NodeFilter.Of(currentUserId).For(targetUserId).WithAction('view').AtLevel('overview')
 */
export class NodeFilter {
  public readonly currentUserId: number;
  public readonly targetUserId: number;
  public readonly action: PermissionAction;
  public readonly level: PermissionLevel;
  public readonly nodeIds?: string[]; // For batch authorization

  private constructor(
    currentUserId: number,
    targetUserId?: number,
    action: PermissionAction = 'view',
    level: PermissionLevel = 'overview',
    nodeIds?: string[]
  ) {
    this.currentUserId = currentUserId;
    this.targetUserId = targetUserId ?? currentUserId;
    this.action = action;
    this.level = level;
    this.nodeIds = nodeIds;
  }

  /**
   * Start building a filter for the current user
   * @param currentUserId - The user making the request
   */
  static Of(currentUserId: number): NodeFilterBuilder {
    return new NodeFilterBuilder(currentUserId);
  }

  /**
   * Create a batch filter for checking permissions on multiple specific nodes
   * @param currentUserId - The user making the request
   * @param nodeIds - Array of node IDs to check permissions for
   */
  static ForNodes(currentUserId: number, nodeIds: string[]): NodeFilterBuilder {
    return new NodeFilterBuilder(currentUserId, nodeIds);
  }
}

/**
 * Builder class for fluent API
 */
/**
 * Builder class for fluent API
 */
class NodeFilterBuilder {
  private currentUserId: number;
  private targetUserId?: number;
  private action: PermissionAction = 'view';
  private level: PermissionLevel = 'overview';
  private nodeIds?: string[];

  constructor(currentUserId: number, nodeIds?: string[]) {
    this.currentUserId = currentUserId;
    this.nodeIds = nodeIds;
  }

  /**
   * Specify the target user whose nodes to fetch
   * @param targetUserId - The user whose nodes are being requested
   */
  For(targetUserId: number): NodeFilterBuilder {
    this.targetUserId = targetUserId;
    return this;
  }

  /**
   * Specify the permission action to check
   * @param action - The action being requested (only 'view' is supported)
   */
  WithAction(action: PermissionAction): NodeFilterBuilder {
    this.action = action;
    return this;
  }

  /**
   * Specify the permission level to check
   * @param level - The level of detail being requested (overview, full)
   */
  AtLevel(level: PermissionLevel): NodeFilterBuilder {
    this.level = level;
    return this;
  }

  /**
   * Specify specific node IDs to check (for batch authorization)
   * @param nodeIds - Array of node IDs to check permissions for
   */
  ForNodeIds(nodeIds: string[]): NodeFilterBuilder {
    this.nodeIds = nodeIds;
    return this;
  }

  /**
   * Build the final filter
   */
  build(): NodeFilter {
    return new NodeFilter(
      this.currentUserId,
      this.targetUserId,
      this.action,
      this.level,
      this.nodeIds
    );
  }
}

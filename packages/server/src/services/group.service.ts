/**
 * GroupService
 * Business logic layer for group management.
 * Groups are user-created collections of sessions, workflows, or steps.
 */

import type { Logger } from '../core/logger.js';
import type {
  GroupRepository,
  CreateGroupData,
  UpdateGroupData,
  CreateGroupItemData,
  Group,
  GroupItem,
  GroupWithItemCount,
  ResolvedSessionData,
} from '../repositories/group.repository.js';

// ============================================================================
// SERVICE
// ============================================================================

export class GroupService {
  private readonly groupRepository: GroupRepository;
  private readonly logger: Logger;

  constructor({
    groupRepository,
    logger,
  }: {
    groupRepository: GroupRepository;
    logger: Logger;
  }) {
    this.groupRepository = groupRepository;
    this.logger = logger;
  }

  async createGroup(
    userId: number,
    data: { name: string; description?: string; nodeId?: string }
  ): Promise<Group> {
    return this.groupRepository.createGroup({
      userId,
      name: data.name,
      description: data.description,
      nodeId: data.nodeId,
    });
  }

  async getUserGroups(
    userId: number,
    nodeId?: string
  ): Promise<GroupWithItemCount[]> {
    if (nodeId) {
      return this.groupRepository.getGroupsByNode(userId, nodeId);
    }
    return this.groupRepository.getGroupsByUser(userId);
  }

  async getGroup(
    groupId: string,
    userId: number
  ): Promise<{ group: Group; items: GroupItem[] } | null> {
    const group = await this.groupRepository.getGroupById(groupId, userId);
    if (!group) return null;

    const items = await this.groupRepository.getGroupItems(groupId);
    return { group, items };
  }

  async updateGroup(
    groupId: string,
    userId: number,
    data: UpdateGroupData
  ): Promise<Group> {
    return this.groupRepository.updateGroup(groupId, userId, data);
  }

  async deleteGroup(groupId: string, userId: number): Promise<void> {
    return this.groupRepository.deleteGroup(groupId, userId);
  }

  async addItemsToGroup(
    groupId: string,
    userId: number,
    items: CreateGroupItemData[]
  ): Promise<GroupItem[]> {
    // Verify the group belongs to the user
    const group = await this.groupRepository.getGroupById(groupId, userId);
    if (!group) {
      throw new Error(`Group not found: ${groupId}`);
    }

    return this.groupRepository.addItems(groupId, items);
  }

  async removeItemFromGroup(
    groupId: string,
    userId: number,
    itemId: string
  ): Promise<void> {
    // Verify the group belongs to the user
    const group = await this.groupRepository.getGroupById(groupId, userId);
    if (!group) {
      throw new Error(`Group not found: ${groupId}`);
    }

    return this.groupRepository.removeItem(groupId, itemId);
  }

  /**
   * Resolve all items in a group to their session_mappings data.
   * Returns deduplicated sessions with 4 vectors + 2 JSONB columns.
   */
  async resolveGroupContext(
    groupId: string,
    userId: number
  ): Promise<ResolvedSessionData[]> {
    // Verify the group belongs to the user
    const group = await this.groupRepository.getGroupById(groupId, userId);
    if (!group) {
      throw new Error(`Group not found: ${groupId}`);
    }

    return this.groupRepository.resolveGroupSessions(groupId);
  }
}

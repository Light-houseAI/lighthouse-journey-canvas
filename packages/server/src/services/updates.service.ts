import {
  Update,
  CreateUpdateRequest,
  UpdateUpdateRequest,
  UpdateResponse,
  UpdatesListResponse,
} from '@journey/schema';

import type { Logger } from '../core/logger.js';
import type { UpdatesRepository } from '../repositories/updates.repository.js';
import type { NodePermissionService } from './node-permission.service.js';

export interface PaginationOptions {
  page: number;
  limit: number;
}

export class UpdatesService {
  constructor({
    updatesRepository,
    nodePermissionService,
    logger,
  }: {
    updatesRepository: UpdatesRepository;
    nodePermissionService: NodePermissionService;
    logger: Logger;
  }) {
    this.updatesRepository = updatesRepository;
    this.nodePermissionService = nodePermissionService;
    this.logger = logger;
  }

  private readonly updatesRepository: UpdatesRepository;
  private readonly nodePermissionService: NodePermissionService;
  private readonly logger: Logger;

  /**
   * Create a new update
   */
  async createUpdate(
    userId: number,
    nodeId: string,
    data: CreateUpdateRequest
  ): Promise<UpdateResponse> {
    try {
      // Check permissions
      const canEdit = await this.nodePermissionService.canEdit(userId, nodeId);
      if (!canEdit) {
        throw new Error('Insufficient permissions to create update');
      }

      // Create the update (all activity flags are stored in meta)
      const update = await this.updatesRepository.create(nodeId, data);

      this.logger.info('Created update', {
        updateId: update.id,
        nodeId,
        userId,
      });

      return this.formatUpdateResponse(update);
    } catch (error) {
      this.logger.error('Failed to create update', {
        error: error instanceof Error ? error.message : String(error),
        nodeId,
        userId,
      });
      throw error;
    }
  }

  /**
   * Get updates for a node with pagination
   */
  async getUpdatesByNodeId(
    userId: number,
    nodeId: string,
    options: PaginationOptions
  ): Promise<UpdatesListResponse> {
    try {
      // Check permissions
      const canView = await this.nodePermissionService.canView(userId, nodeId);
      if (!canView) {
        throw new Error('Insufficient permissions to view updates');
      }

      // Get updates
      const { updates, total } = await this.updatesRepository.getByNodeId(
        nodeId,
        options
      );

      // Format updates for response
      const updatesFormatted = updates.map((update) => 
        this.formatUpdateResponse(update)
      );

      const { page, limit } = options;
      const hasNext = page * limit < total;
      const hasPrev = page > 1;

      this.logger.debug('Retrieved updates for node', {
        nodeId,
        userId,
        page,
        limit,
        total,
        count: updates.length,
      });

      return {
        updates: updatesFormatted,
        pagination: {
          page,
          limit,
          total,
          hasNext,
          hasPrev,
        },
      };
    } catch (error) {
      this.logger.error('Failed to get updates by node ID', {
        error: error instanceof Error ? error.message : String(error),
        nodeId,
        userId,
      });
      throw error;
    }
  }

  /**
   * Get a specific update by ID
   */
  async getUpdateById(
    userId: number,
    nodeId: string,
    updateId: string
  ): Promise<UpdateResponse | null> {
    try {
      // Check permissions
      const canView = await this.nodePermissionService.canView(userId, nodeId);
      if (!canView) {
        throw new Error('Insufficient permissions to view update');
      }

      // Get update
      const update = await this.updatesRepository.getById(updateId);
      if (!update) {
        return null;
      }

      // Verify update belongs to the node
      if (update.nodeId !== nodeId) {
        throw new Error('Update does not belong to the specified node');
      }

      return this.formatUpdateResponse(update);
    } catch (error) {
      this.logger.error('Failed to get update by ID', {
        error: error instanceof Error ? error.message : String(error),
        updateId,
        nodeId,
        userId,
      });
      throw error;
    }
  }

  /**
   * Update an existing update
   */
  async updateUpdate(
    userId: number,
    nodeId: string,
    updateId: string,
    data: UpdateUpdateRequest
  ): Promise<UpdateResponse | null> {
    try {
      // Check permissions
      const canEdit = await this.nodePermissionService.canEdit(userId, nodeId);
      if (!canEdit) {
        throw new Error('Insufficient permissions to update');
      }

      // Verify update exists and belongs to node
      const existingUpdate = await this.updatesRepository.getById(updateId);
      if (!existingUpdate || existingUpdate.nodeId !== nodeId) {
        return null;
      }

      // Update the update (all activity flags are stored in meta)
      const updated = await this.updatesRepository.update(updateId, data);
      if (!updated) {
        return null;
      }

      this.logger.info('Updated update', {
        updateId,
        nodeId,
        userId,
      });

      return this.formatUpdateResponse(updated);
    } catch (error) {
      this.logger.error('Failed to update update', {
        error: error instanceof Error ? error.message : String(error),
        updateId,
        nodeId,
        userId,
      });
      throw error;
    }
  }

  /**
   * Delete an update
   */
  async deleteUpdate(
    userId: number,
    nodeId: string,
    updateId: string
  ): Promise<boolean> {
    try {
      // Check permissions
      const canEdit = await this.nodePermissionService.canEdit(userId, nodeId);
      if (!canEdit) {
        throw new Error('Insufficient permissions to delete update');
      }

      // Verify update exists and belongs to node
      const belongsToNode = await this.updatesRepository.belongsToNode(
        updateId,
        nodeId
      );
      if (!belongsToNode) {
        return false;
      }

      // Soft delete the update
      const deleted = await this.updatesRepository.softDelete(updateId);

      if (deleted) {
        this.logger.info('Deleted update', {
          updateId,
          nodeId,
          userId,
        });
      }

      return deleted;
    } catch (error) {
      this.logger.error('Failed to delete update', {
        error: error instanceof Error ? error.message : String(error),
        updateId,
        nodeId,
        userId,
      });
      throw error;
    }
  }

  /**
   * Format update for API response
   */
  private formatUpdateResponse(update: Update): UpdateResponse {
    const meta = (update.meta || {}) as any;

    return {
      id: update.id,
      nodeId: update.nodeId,
      notes: update.notes || undefined,
      meta: {
        appliedToJobs: meta.appliedToJobs || false,
        updatedResumeOrPortfolio: meta.updatedResumeOrPortfolio || false,
        networked: meta.networked || false,
        developedSkills: meta.developedSkills || false,
        pendingInterviews: meta.pendingInterviews || false,
        completedInterviews: meta.completedInterviews || false,
        practicedMock: meta.practicedMock || false,
        receivedOffers: meta.receivedOffers || false,
        receivedRejections: meta.receivedRejections || false,
        possiblyGhosted: meta.possiblyGhosted || false,
      },
      renderedText: update.renderedText || undefined,
      createdAt: update.createdAt.toISOString(),
      updatedAt: update.updatedAt.toISOString(),
    };
  }
}
/**
 * OrganizationController
 * API endpoints for organization and membership management
 */

import type { Request, Response } from 'express';
import type { Logger } from '../core/logger';
import { OrganizationService } from '../services/organization.service';
import {
  organizationCreateSchema,
  organizationUpdateSchema,
  orgMemberCreateSchema,
  orgMemberUpdateSchema,
  OrganizationType
} from '@shared/schema';
import { z } from 'zod';

// Request schemas for validation
const organizationParamsSchema = z.object({
  orgId: z.coerce.number().int().positive('Invalid organization ID')
});

const memberParamsSchema = z.object({
  orgId: z.coerce.number().int().positive('Invalid organization ID'),
  userId: z.coerce.number().int().positive('Invalid user ID')
});



export class OrganizationController {
  constructor({
    organizationService,
    logger
  }: {
    organizationService: OrganizationService;
    logger: Logger;
  }) {
    this.organizationService = organizationService;
    this.logger = logger;
  }

  private readonly organizationService: OrganizationService;
  private readonly logger: Logger;

  /**
   * Create a new organization
   * POST /api/v2/organizations
   */
  async createOrganization(req: Request, res: Response): Promise<void> {
    try {
      const organizationData = organizationCreateSchema.parse(req.body);
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const organization = await this.organizationService.createOrganization(organizationData);

      // Auto-add creator as admin
      await this.organizationService.addMember(organization.id, {
        userId,
        role: 'admin' as any
      });

      res.status(201).json(organization);
    } catch (error) {
      this.logger.error('Error creating organization', {
        userId: req.user?.id,
        data: req.body,
        error: error instanceof Error ? error.message : String(error)
      });

      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'Invalid request data',
          details: error.errors
        });
      } else if (error instanceof Error && error.message.includes('already exists')) {
        res.status(409).json({
          error: error.message
        });
      } else {
        res.status(500).json({
          error: 'Failed to create organization'
        });
      }
    }
  }

  /**
   * Update an organization
   * PUT /api/v2/organizations/:orgId
   */
  async updateOrganization(req: Request, res: Response): Promise<void> {
    try {
      const { orgId } = organizationParamsSchema.parse(req.params);
      const updateData = organizationUpdateSchema.parse(req.body);
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const organization = await this.organizationService.updateOrganization(orgId, updateData);

      res.json(organization);
    } catch (error) {
      this.logger.error('Error updating organization', {
        orgId: req.params.orgId,
        userId: req.user?.id,
        error: error instanceof Error ? error.message : String(error)
      });

      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'Invalid request data',
          details: error.errors
        });
      } else if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({
          error: error.message
        });
      } else if (error instanceof Error && error.message.includes('already exists')) {
        res.status(409).json({
          error: error.message
        });
      } else {
        res.status(500).json({
          error: 'Failed to update organization'
        });
      }
    }
  }

  /**
   * Delete an organization
   * DELETE /api/v2/organizations/:orgId
   */
  async deleteOrganization(req: Request, res: Response): Promise<void> {
    try {
      const { orgId } = organizationParamsSchema.parse(req.params);
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      await this.organizationService.deleteOrganization(orgId);

      res.json({ message: 'Organization deleted successfully' });
    } catch (error) {
      this.logger.error('Error deleting organization', {
        orgId: req.params.orgId,
        userId: req.user?.id,
        error: error instanceof Error ? error.message : String(error)
      });

      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'Invalid request parameters',
          details: error.errors
        });
      } else if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({
          error: error.message
        });
      } else {
        res.status(500).json({
          error: 'Failed to delete organization'
        });
      }
    }
  }

  /**
   * Get organization by ID
   * GET /api/v2/organizations/:orgId
   */
  async getOrganization(req: Request, res: Response): Promise<void> {
    try {
      const { orgId } = organizationParamsSchema.parse(req.params);
      const userId = req.user?.id;

      const organization = await this.organizationService.getOrganizationById(orgId);

      res.json({
        ...organization,
        userRole: null, // Remove complex role checking for now
        memberCount: 0  // Remove statistics for now
      });
    } catch (error) {
      this.logger.error('Error getting organization', {
        orgId: req.params.orgId,
        userId: req.user?.id,
        error: error instanceof Error ? error.message : String(error)
      });

      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'Invalid request parameters',
          details: error.errors
        });
      } else if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({
          error: error.message
        });
      } else {
        res.status(500).json({
          error: 'Failed to get organization'
        });
      }
    }
  }





  /**
   * Add member to organization
   * POST /api/v2/organizations/:orgId/members
   */
  async addMember(req: Request, res: Response): Promise<void> {
    try {
      const { orgId } = organizationParamsSchema.parse(req.params);
      const memberData = orgMemberCreateSchema.parse(req.body);
      const adminUserId = req.user?.id;

      if (!adminUserId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const member = await this.organizationService.addMemberAsAdmin(
        orgId,
        adminUserId,
        memberData
      );

      res.status(201).json(member);
    } catch (error) {
      this.logger.error('Error adding member', {
        orgId: req.params.orgId,
        adminUserId: req.user?.id,
        memberData: req.body,
        error: error instanceof Error ? error.message : String(error)
      });

      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'Invalid request data',
          details: error.errors
        });
      } else if (error instanceof Error && error.message.includes('admin')) {
        res.status(403).json({
          error: error.message
        });
      } else if (error instanceof Error && error.message.includes('already a member')) {
        res.status(409).json({
          error: error.message
        });
      } else {
        res.status(500).json({
          error: 'Failed to add member'
        });
      }
    }
  }

  /**
   * Remove member from organization
   * DELETE /api/v2/organizations/:orgId/members/:userId
   */
  async removeMember(req: Request, res: Response): Promise<void> {
    try {
      const { orgId, userId } = memberParamsSchema.parse(req.params);
      const adminUserId = req.user?.id;

      if (!adminUserId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      await this.organizationService.removeMemberAsAdmin(orgId, adminUserId, userId);

      res.json({ message: 'Member removed successfully' });
    } catch (error) {
      this.logger.error('Error removing member', {
        orgId: req.params.orgId,
        userId: req.params.userId,
        adminUserId: req.user?.id,
        error: error instanceof Error ? error.message : String(error)
      });

      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'Invalid request parameters',
          details: error.errors
        });
      } else if (error instanceof Error && error.message.includes('admin')) {
        res.status(403).json({
          error: error.message
        });
      } else if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({
          error: error.message
        });
      } else {
        res.status(500).json({
          error: 'Failed to remove member'
        });
      }
    }
  }

  /**
   * Update member role
   * PUT /api/v2/organizations/:orgId/members/:userId
   */
  async updateMemberRole(req: Request, res: Response): Promise<void> {
    try {
      const { orgId, userId } = memberParamsSchema.parse(req.params);
      const updateData = orgMemberUpdateSchema.parse(req.body);
      const adminUserId = req.user?.id;

      if (!adminUserId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      // Check if user is admin
      const adminRole = await this.organizationService.getUserRole(adminUserId, orgId);
      if (adminRole !== 'admin') {
        res.status(403).json({
          error: 'Only organization admins can update member roles'
        });
        return;
      }

      const member = await this.organizationService.updateMemberRole(orgId, userId, updateData);

      res.json(member);
    } catch (error) {
      this.logger.error('Error updating member role', {
        orgId: req.params.orgId,
        userId: req.params.userId,
        adminUserId: req.user?.id,
        updateData: req.body,
        error: error instanceof Error ? error.message : String(error)
      });

      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'Invalid request data',
          details: error.errors
        });
      } else if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({
          error: error.message
        });
      } else {
        res.status(500).json({
          error: 'Failed to update member role'
        });
      }
    }
  }



  /**
   * Get user's organizations
   * GET /api/v2/organizations/mine
   */
  async getUserOrganizations(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const organizations = await this.organizationService.getUserOrganizations(userId);

      res.json({ organizations });
    } catch (error) {
      this.logger.error('Error getting user organizations', {
        userId: req.user?.id,
        error: error instanceof Error ? error.message : String(error)
      });

      res.status(500).json({
        error: 'Failed to get user organizations'
      });
    }
  }

  /**
   * Join an organization (self-service)
   * POST /api/v2/organizations/:orgId/join
   */
  async joinOrganization(req: Request, res: Response): Promise<void> {
    try {
      const { orgId } = organizationParamsSchema.parse(req.params);
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const member = await this.organizationService.addMember(orgId, {
        userId,
        role: 'member' as any
      });

      res.status(201).json({
        message: 'Successfully joined organization',
        member
      });
    } catch (error) {
      this.logger.error('Error joining organization', {
        orgId: req.params.orgId,
        userId: req.user?.id,
        error: error instanceof Error ? error.message : String(error)
      });

      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'Invalid request parameters',
          details: error.errors
        });
      } else if (error instanceof Error && error.message.includes('already a member')) {
        res.status(409).json({
          error: error.message
        });
      } else {
        res.status(500).json({
          error: 'Failed to join organization'
        });
      }
    }
  }

  /**
   * Leave an organization (self-service)
   * POST /api/v2/organizations/:orgId/leave
   */
  async leaveOrganization(req: Request, res: Response): Promise<void> {
    try {
      const { orgId } = organizationParamsSchema.parse(req.params);
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      await this.organizationService.removeMember(orgId, userId);

      res.json({
        message: 'Successfully left organization'
      });
    } catch (error) {
      this.logger.error('Error leaving organization', {
        orgId: req.params.orgId,
        userId: req.user?.id,
        error: error instanceof Error ? error.message : String(error)
      });

      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'Invalid request parameters',
          details: error.errors
        });
      } else if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({
          error: 'You are not a member of this organization'
        });
      } else {
        res.status(500).json({
          error: 'Failed to leave organization'
        });
      }
    }
  }
}
/**
 * Desktop Track Controller
 * Handles track creation from the desktop app during onboarding
 *
 * This controller creates job nodes with the same structure as LinkedIn-extracted profiles,
 * ensuring backward compatibility with existing journey page functionality.
 */

import { z } from 'zod';
import type { Request, Response } from 'express';

import { HttpStatus } from '../core/index.js';
import {
  type CreateNodeDTO,
  HierarchyService,
} from '../services/hierarchy-service.js';
import {
  OrganizationService,
  OrganizationType,
} from '../services/organization.service.js';
import { UserService } from '../services/user-service.js';
import { BaseController } from './base.controller.js';

/**
 * Request schema for desktop track creation
 * This mirrors the data structure we get from LinkedIn extraction
 */
const desktopTrackRequestSchema = z.object({
  companyName: z.string().min(1, 'Company name is required'),
  role: z.string().min(1, 'Role is required'),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}$/, 'Start date must be in YYYY-MM format'),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}$/, 'End date must be in YYYY-MM format')
    .optional(),
  description: z.string().optional(),
  location: z.string().optional(),
});

export type DesktopTrackRequest = z.infer<typeof desktopTrackRequestSchema>;

export class DesktopTrackController extends BaseController {
  private hierarchyService: HierarchyService;
  private organizationService: OrganizationService;
  private userService: UserService;

  constructor({
    hierarchyService,
    organizationService,
    userService,
  }: {
    hierarchyService: HierarchyService;
    organizationService: OrganizationService;
    userService: UserService;
  }) {
    super();
    this.hierarchyService = hierarchyService;
    this.organizationService = organizationService;
    this.userService = userService;
  }

  /**
   * POST /api/v2/desktop/track
   * Create a track from desktop app data
   *
   * This endpoint:
   * 1. Validates the track data
   * 2. Finds or creates an organization for the company
   * 3. Creates a job node with the same structure as LinkedIn-extracted data
   * 4. Marks onboarding as complete (first track triggers onboarding completion)
   */
  async createTrack(req: Request, res: Response): Promise<void> {
    const user = this.getAuthenticatedUser(req);
    const trackData = desktopTrackRequestSchema.parse(req.body);

    console.log(
      `[DesktopTrack] Creating track for user ${user.id}: ${trackData.role} at ${trackData.companyName}`
    );

    // Find or create organization for the company
    const organization = await this.organizationService.findOrCreateByName(
      trackData.companyName,
      OrganizationType.Company
    );

    // Create job node with same structure as LinkedIn-extracted nodes
    const jobNodeData: CreateNodeDTO = {
      type: 'job',
      parentId: null, // Top-level node
      meta: {
        orgId: organization.id,
        role: trackData.role,
        location: trackData.location,
        description: trackData.description,
        startDate: trackData.startDate,
        endDate: trackData.endDate,
      },
    };

    const createdNode = await this.hierarchyService.createNode(
      jobNodeData,
      user.id
    );

    console.log(
      `[DesktopTrack] Created job node: ${createdNode.id} for user ${user.id}`
    );

    // Check if this is the user's first track (no previous nodes)
    // If so, complete onboarding automatically
    const allNodes = await this.hierarchyService.getAllNodes(user.id);

    // If this is the first node (count is 1 after creation), complete onboarding
    if (allNodes.length === 1) {
      console.log(
        `[DesktopTrack] First track created, completing onboarding for user ${user.id}`
      );
      await this.userService.completeOnboarding(user.id);
    }

    res.status(HttpStatus.CREATED).json({
      success: true,
      data: {
        nodeId: createdNode.id,
        type: createdNode.type,
        meta: createdNode.meta,
        onboardingCompleted: allNodes.length === 1,
      },
    });
  }
}



import type { Profile, Milestone, InsertProfile } from "@shared/schema";
import type { IProfileRepository } from '../repositories/interfaces';
import type { IProfileService } from './interfaces';
import type { BaseNode, NodeType } from '../core/interfaces/base-node.interface';
import type { Job, Education, Project, Action, Event, CareerTransition, AnyNode } from '../types/node-types';
import type { IRepository } from '../core/interfaces/repository.interface';

/**
 * Response type for getAllNodes aggregation
 */
export interface AllNodesResponse {
  workExperiences: Job[];
  education: Education[];
  projects: Project[];
  events: any[];
  actions: any[];
  careerTransitions: any[];
  totalCount: number;
  lastUpdated: string;
}

/**
 * Profile statistics type
 */
export interface ProfileStats {
  totalNodes: number;
  nodesByType: Record<string, number>;
  dateRanges: {
    earliest?: string;
    latest?: string;
    span?: string;
  };
  activeCounts: {
    workExperiences: number;
    education: number;
    projects: number;
  };
  recentActivity: {
    lastUpdated?: string;
    recentlyCreated: number; // Count of nodes created in last 30 days
    recentlyUpdated: number; // Count of nodes updated in last 7 days
  };
}

export class ProfileService implements IProfileService {
  constructor(
    private profileRepository: IProfileRepository,
    private workExperienceRepository?: IRepository<Job>,
    private educationRepository?: IRepository<Education>,
    private projectRepository?: IRepository<Project>,
    private actionRepository?: IRepository<Action>,
    private eventRepository?: IRepository<Event>,
    private careerTransitionRepository?: IRepository<CareerTransition>
  ) {}

  async getProfileById(id: number): Promise<Profile | null> {
    return await this.profileRepository.findById(id);
  }

  async getProfileByUserId(userId: number): Promise<Profile | null> {
    return await this.profileRepository.findByUserId(userId);
  }

  async getProfileByUsername(username: string): Promise<Profile | null> {
    return await this.profileRepository.findByUsername(username);
  }

  async createProfile(profileData: InsertProfile): Promise<Profile> {
    // Validate username is unique
    const existingProfile = await this.profileRepository.findByUsername(profileData.username);
    if (existingProfile) {
      throw new Error('Username already taken');
    }

    return await this.profileRepository.create(profileData);
  }

  async updateProfile(id: number, updates: Partial<Profile>): Promise<Profile | null> {
    // If updating username, check it's not already taken
    if (updates.username) {
      const existingProfile = await this.profileRepository.findByUsername(updates.username);
      if (existingProfile && existingProfile.id !== id) {
        throw new Error('Username already taken');
      }
    }

    return await this.profileRepository.update(id, updates);
  }

  async addMilestone(profileId: number, milestone: Milestone): Promise<boolean> {
    // Validate milestone has required fields
    if (!milestone.id || !milestone.title || !milestone.type) {
      throw new Error('Milestone must have id, title, and type');
    }

    return await this.profileRepository.addMilestone(profileId, milestone);
  }

  async updateMilestone(
    profileId: number,
    milestoneId: string,
    updates: Partial<Milestone>
  ): Promise<boolean> {
    return await this.profileRepository.updateMilestone(profileId, milestoneId, updates);
  }

  async removeMilestone(profileId: number, milestoneId: string): Promise<boolean> {
    return await this.profileRepository.removeMilestone(profileId, milestoneId);
  }

  async getMilestones(profileId: number): Promise<Milestone[]> {
    const profile = await this.profileRepository.findById(profileId);
    return profile?.projects || [];
  }

  /**
   * Enhanced ProfileService Methods for Node Aggregation
   */

  /**
   * Get all nodes aggregated from all repositories
   */
  async getAllNodes(profileId: number): Promise<AllNodesResponse> {
    this.validateProfileId(profileId);

    // Fetch all nodes in parallel
    const [workExperiences, education, projects] = await Promise.all([
      this.workExperienceRepository?.findAll(profileId) || Promise.resolve([]),
      this.educationRepository?.findAll(profileId) || Promise.resolve([]),
      this.projectRepository?.findAll(profileId) || Promise.resolve([]),
    ]);

    // Future repositories for events, actions, careerTransitions would be added here

    const totalCount = workExperiences.length + education.length + projects.length;

    // Find the most recent update across all nodes
    const allNodes = [...workExperiences, ...education, ...projects];
    const lastUpdated = this.findLatestUpdateTime(allNodes);

    return {
      workExperiences,
      education,
      projects,
      events: [], // Future implementation
      actions: [], // Future implementation
      careerTransitions: [], // Future implementation
      totalCount,
      lastUpdated,
    };
  }

  /**
   * Get nodes by specific type
   */
  async getNodesByType(profileId: number, type: NodeType): Promise<BaseNode[]> {
    this.validateProfileId(profileId);

    switch (type) {
      case NodeType.Job:
        return this.workExperienceRepository?.findAll(profileId) || [];
      case NodeType.Education:
        return this.educationRepository?.findAll(profileId) || [];
      case NodeType.Project:
        return this.projectRepository?.findAll(profileId) || [];
      case NodeType.Event:
        // Future implementation
        return [];
      case NodeType.Action:
        // Future implementation
        return [];
      case NodeType.CareerTransition:
        // Future implementation
        return [];
      default:
        throw new Error(`Unsupported node type: ${type}`);
    }
  }

  /**
   * Get comprehensive profile statistics
   */
  async getNodeStats(profileId: number): Promise<ProfileStats> {
    this.validateProfileId(profileId);

    const allNodesResponse = await this.getAllNodes(profileId);
    const allNodes = [
      ...allNodesResponse.workExperiences,
      ...allNodesResponse.education,
      ...allNodesResponse.projects,
    ];

    // Count by type
    const nodesByType: Record<string, number> = {
      workExperience: allNodesResponse.workExperiences.length,
      education: allNodesResponse.education.length,
      project: allNodesResponse.projects.length,
      event: 0, // Future
      action: 0, // Future
      careerTransition: 0, // Future
    };

    // Calculate date ranges
    const dateRanges = this.calculateDateRanges(allNodes);

    // Count active items
    const activeCounts = {
      workExperiences: allNodesResponse.workExperiences.filter(we =>
        !we.endDate || we.endDate.toLowerCase() === 'present'
      ).length,
      education: allNodesResponse.education.filter(edu =>
        !edu.endDate || edu.endDate.toLowerCase() === 'present'
      ).length,
      projects: allNodesResponse.projects.filter(proj =>
        proj.status === 'in-progress' || proj.status === 'planning'
      ).length,
    };

    // Calculate recent activity
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const recentlyCreated = allNodes.filter(node => {
      try {
        return new Date(node.createdAt) > thirtyDaysAgo;
      } catch {
        return false;
      }
    }).length;

    const recentlyUpdated = allNodes.filter(node => {
      try {
        return new Date(node.updatedAt) > sevenDaysAgo;
      } catch {
        return false;
      }
    }).length;

    return {
      totalNodes: allNodesResponse.totalCount,
      nodesByType,
      dateRanges,
      activeCounts,
      recentActivity: {
        lastUpdated: allNodesResponse.lastUpdated,
        recentlyCreated,
        recentlyUpdated,
      },
    };
  }

  /**
   * Get filtering and sorting capabilities for nodes
   */
  async getFilteredNodes(
    profileId: number,
    options: {
      types?: NodeType[];
      startDateAfter?: string;
      startDateBefore?: string;
      endDateAfter?: string;
      endDateBefore?: string;
      searchText?: string;
      limit?: number;
      sortBy?: 'startDate' | 'endDate' | 'createdAt' | 'updatedAt' | 'title';
      sortOrder?: 'asc' | 'desc';
    } = {}
  ): Promise<BaseNode[]> {
    this.validateProfileId(profileId);

    // Get all nodes or filtered by type
    let allNodes: BaseNode[] = [];

    if (options.types && options.types.length > 0) {
      // Get only specified types
      const nodePromises = options.types.map(type => this.getNodesByType(profileId, type));
      const nodeArrays = await Promise.all(nodePromises);
      allNodes = nodeArrays.flat();
    } else {
      // Get all nodes
      const allNodesResponse = await this.getAllNodes(profileId);
      allNodes = [
        ...allNodesResponse.workExperiences,
        ...allNodesResponse.education,
        ...allNodesResponse.projects,
      ];
    }

    // Apply filters
    let filteredNodes = allNodes;

    // Date range filters
    if (options.startDateAfter) {
      const afterDate = new Date(options.startDateAfter);
      filteredNodes = filteredNodes.filter(node => {
        if (!node.startDate) return false;
        try {
          return new Date(node.startDate) > afterDate;
        } catch {
          return false;
        }
      });
    }

    if (options.startDateBefore) {
      const beforeDate = new Date(options.startDateBefore);
      filteredNodes = filteredNodes.filter(node => {
        if (!node.startDate) return false;
        try {
          return new Date(node.startDate) < beforeDate;
        } catch {
          return false;
        }
      });
    }

    // Search text filter
    if (options.searchText) {
      const searchLower = options.searchText.toLowerCase();
      filteredNodes = filteredNodes.filter(node =>
        node.title.toLowerCase().includes(searchLower) ||
        (node.description && node.description.toLowerCase().includes(searchLower))
      );
    }

    // Sort nodes
    if (options.sortBy) {
      filteredNodes.sort((a, b) => {
        const aVal = this.getNodeSortValue(a, options.sortBy!);
        const bVal = this.getNodeSortValue(b, options.sortBy!);

        if (aVal === null && bVal === null) return 0;
        if (aVal === null) return 1;
        if (bVal === null) return -1;

        let comparison = 0;
        if (aVal < bVal) comparison = -1;
        else if (aVal > bVal) comparison = 1;

        return options.sortOrder === 'desc' ? -comparison : comparison;
      });
    }

    // Apply limit
    if (options.limit && options.limit > 0) {
      filteredNodes = filteredNodes.slice(0, options.limit);
    }

    return filteredNodes;
  }

  /**
   * Utility methods
   */

  private validateProfileId(profileId: number): void {
    if (!Number.isInteger(profileId) || profileId <= 0) {
      throw new Error('Invalid profile ID');
    }
  }

  private findLatestUpdateTime(nodes: BaseNode[]): string {
    if (nodes.length === 0) return new Date().toISOString();

    const latestUpdate = nodes.reduce((latest, node) => {
      try {
        const nodeUpdate = new Date(node.updatedAt);
        return nodeUpdate > latest ? nodeUpdate : latest;
      } catch {
        return latest;
      }
    }, new Date(0));

    return latestUpdate.toISOString();
  }

  private calculateDateRanges(nodes: BaseNode[]): ProfileStats['dateRanges'] {
    const dates: Date[] = [];

    nodes.forEach(node => {
      try {
        if (node.startDate) {
          dates.push(new Date(node.startDate));
        }
        if (node.endDate && node.endDate.toLowerCase() !== 'present') {
          dates.push(new Date(node.endDate));
        }
      } catch {
        // Ignore invalid dates
      }
    });

    if (dates.length === 0) {
      return {};
    }

    dates.sort((a, b) => a.getTime() - b.getTime());
    const earliest = dates[0];
    const latest = dates[dates.length - 1];

    const spanMs = latest.getTime() - earliest.getTime();
    const spanYears = Math.floor(spanMs / (1000 * 60 * 60 * 24 * 365.25));
    const span = spanYears > 0 ? `${spanYears} year${spanYears === 1 ? '' : 's'}` : 'Less than 1 year';

    return {
      earliest: earliest.toISOString(),
      latest: latest.toISOString(),
      span,
    };
  }

  private getNodeSortValue(node: BaseNode, sortBy: string): any {
    switch (sortBy) {
      case 'startDate':
        return node.startDate ? new Date(node.startDate) : null;
      case 'endDate':
        return node.endDate && node.endDate.toLowerCase() !== 'present' ? new Date(node.endDate) : null;
      case 'createdAt':
        return node.createdAt ? new Date(node.createdAt) : null;
      case 'updatedAt':
        return node.updatedAt ? new Date(node.updatedAt) : null;
      case 'title':
        return node.title.toLowerCase();
      default:
        return null;
    }
  }
}

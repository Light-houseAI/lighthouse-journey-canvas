/**
 * Tests for test data factories
 * Validates factory functions generate correct data with overrides
 */

import { describe, expect, it, beforeEach } from 'vitest';
import { TimelineNodeType, OrganizationType, VisibilityLevel } from '@journey/schema';
import {
  createMockUser,
  createMockUsers,
  createMockOrganization,
  createMockOrganizations,
  createMockTimelineNode,
  createMockJobNode,
  createMockEducationNode,
  createMockTimelineNodes,
  createMockHierarchyNode,
  createMockNodePolicy,
  createMockNodeInsight,
  createMockProfileData,
  createMockSearchResult,
  createMockTimeline,
  resetIdCounter,
} from './factories';

describe('Test Data Factories', () => {
  beforeEach(() => {
    // Reset ID counter between tests for consistency
    resetIdCounter();
  });

  describe('User Factories', () => {
    it('creates a user with default values', () => {
      const user = createMockUser();

      expect(user.id).toBe(1);
      expect(user.email).toBe('user1@example.com');
      expect(user.firstName).toBe('Test');
      expect(user.lastName).toBe('User');
      expect(user.userName).toBe('testuser1');
      expect(user.hasCompletedOnboarding).toBe(true);
    });

    it('creates a user with overrides', () => {
      const user = createMockUser({
        overrides: {
          email: 'custom@test.com',
          firstName: 'Custom',
          hasCompletedOnboarding: false,
        },
      });

      expect(user.email).toBe('custom@test.com');
      expect(user.firstName).toBe('Custom');
      expect(user.lastName).toBe('User'); // Default preserved
      expect(user.hasCompletedOnboarding).toBe(false);
    });

    it('creates multiple users with unique IDs', () => {
      const users = createMockUsers(3);

      expect(users).toHaveLength(3);
      expect(users[0].id).toBe(1);
      expect(users[1].id).toBe(2);
      expect(users[2].id).toBe(3);
      expect(users[0].email).toBe('user1@example.com');
      expect(users[1].email).toBe('user2@example.com');
      expect(users[2].email).toBe('user3@example.com');
    });

    it('creates multiple users with override function', () => {
      const users = createMockUsers(2, {
        overrides: (index) => ({
          firstName: `User${index}`,
          email: `custom${index}@test.com`,
        }),
      });

      expect(users[0].firstName).toBe('User0');
      expect(users[0].email).toBe('custom0@test.com');
      expect(users[1].firstName).toBe('User1');
      expect(users[1].email).toBe('custom1@test.com');
    });
  });

  describe('Organization Factories', () => {
    it('creates an organization with default values', () => {
      const org = createMockOrganization();

      expect(org.id).toBe(1);
      expect(org.name).toBe('Organization 1');
      expect(org.type).toBe(OrganizationType.Company);
      expect(org.description).toBe('Description for organization 1');
    });

    it('creates an organization with overrides', () => {
      const org = createMockOrganization({
        overrides: {
          name: 'Test University',
          type: OrganizationType.EducationalInstitution,
        },
      });

      expect(org.name).toBe('Test University');
      expect(org.type).toBe(OrganizationType.EducationalInstitution);
    });

    it('creates multiple organizations', () => {
      const orgs = createMockOrganizations(2, {
        overrides: (index) => ({
          type: index === 0
            ? OrganizationType.Company
            : OrganizationType.EducationalInstitution,
        }),
      });

      expect(orgs).toHaveLength(2);
      expect(orgs[0].type).toBe(OrganizationType.Company);
      expect(orgs[1].type).toBe(OrganizationType.EducationalInstitution);
    });
  });

  describe('Timeline Node Factories', () => {
    it('creates a timeline node with default values', () => {
      const node = createMockTimelineNode();

      expect(node.id).toBe('node-1');
      expect(node.type).toBe(TimelineNodeType.Job);
      expect(node.title).toBe('job Node node-1');
      expect(node.parentId).toBeNull();
      expect(node.childrenIds).toEqual([]);
      expect(node.userId).toBe(1);
      expect(node.meta).toBeDefined();
    });

    it('creates a job node with job-specific meta', () => {
      const node = createMockJobNode();

      expect(node.type).toBe(TimelineNodeType.Job);
      expect(node.title).toBe('Software Engineer');
      expect(node.meta.company).toBe('Test Company');
      expect(node.meta.startDate).toBe('2023-01');
      expect(node.meta.location).toBe('Remote');
    });

    it('creates an education node with education-specific meta', () => {
      const node = createMockEducationNode();

      expect(node.type).toBe(TimelineNodeType.Education);
      expect(node.title).toBe('Computer Science');
      expect(node.meta.school).toBe('Test University');
      expect(node.meta.degree).toBe('Bachelor');
      expect(node.meta.field).toBe('Computer Science');
    });

    it('creates multiple timeline nodes', () => {
      const nodes = createMockTimelineNodes(3, {
        overrides: (index) => ({
          type: index % 2 === 0
            ? TimelineNodeType.Job
            : TimelineNodeType.Education,
        }),
      });

      expect(nodes).toHaveLength(3);
      expect(nodes[0].type).toBe(TimelineNodeType.Job);
      expect(nodes[1].type).toBe(TimelineNodeType.Education);
      expect(nodes[2].type).toBe(TimelineNodeType.Job);
    });
  });

  describe('Hierarchy Node Factories', () => {
    it('creates a hierarchy node with UI state', () => {
      const node = createMockHierarchyNode();

      expect(node.id).toBe('node-1');
      expect(node.canAccess).toBe(true);
      expect(node.canShare).toBe(true);
      expect(node.isOwner).toBe(true);
      expect(node.visibility).toBe(VisibilityLevel.Private);
      expect(node.showMatches).toBe(false);
    });

    it('creates a hierarchy node with overrides', () => {
      const node = createMockHierarchyNode({
        overrides: {
          canAccess: false,
          visibility: VisibilityLevel.Public,
          showMatches: true,
        },
      });

      expect(node.canAccess).toBe(false);
      expect(node.visibility).toBe(VisibilityLevel.Public);
      expect(node.showMatches).toBe(true);
    });
  });

  describe('Profile Data Factory', () => {
    it('creates profile data with default values', () => {
      const profile = createMockProfileData();

      expect(profile.name).toBe('Test User');
      expect(profile.headline).toBe('Software Engineer at TestCorp');
      expect(profile.location).toBe('San Francisco, CA');
      expect(profile.experiences).toHaveLength(2);
      expect(profile.education).toHaveLength(1);
    });

    it('creates profile data with overrides', () => {
      const profile = createMockProfileData({
        overrides: {
          name: 'Custom Name',
          experiences: [],
          education: [],
        },
      });

      expect(profile.name).toBe('Custom Name');
      expect(profile.experiences).toHaveLength(0);
      expect(profile.education).toHaveLength(0);
    });
  });

  describe('Search Result Factory', () => {
    it('creates a search result with default values', () => {
      const result = createMockSearchResult();

      expect(result.id).toBe(1);
      expect(result.userId).toBe(1);
      expect(result.userName).toBe('user1');
      expect(result.userEmail).toBe('user1@example.com');
      expect(result.matchScore).toBe(0.95);
      expect(result.highlights).toEqual(['JavaScript', 'React', 'Node.js']);
    });
  });

  describe('Timeline Factory', () => {
    it('creates a complete timeline with connected nodes', () => {
      const timeline = createMockTimeline({
        jobCount: 2,
        educationCount: 1,
      });

      expect(timeline).toHaveLength(3);

      // Check education node
      const eduNode = timeline.find(n => n.id === 'edu-1');
      expect(eduNode?.type).toBe(TimelineNodeType.Education);
      expect(eduNode?.title).toBe('Bachelor Degree');

      // Check job nodes
      const job1 = timeline.find(n => n.id === 'job-1');
      const job2 = timeline.find(n => n.id === 'job-2');

      expect(job1?.type).toBe(TimelineNodeType.Job);
      expect(job1?.parentId).toBeNull();
      expect(job1?.childrenIds).toContain('job-2');

      expect(job2?.type).toBe(TimelineNodeType.Job);
      expect(job2?.parentId).toBe('job-1');
      expect(job2?.title).toBe('Senior Developer');
    });

    it('creates a timeline with hierarchy nodes', () => {
      const timeline = createMockTimeline({
        jobCount: 1,
        educationCount: 1,
        withHierarchy: true,
      });

      expect(timeline).toHaveLength(2);

      // Check that hierarchy properties are present
      const node = timeline[0];
      expect(node).toHaveProperty('canAccess');
      expect(node).toHaveProperty('canShare');
      expect(node).toHaveProperty('isOwner');
      expect(node).toHaveProperty('visibility');
    });
  });

  describe('ID Generation', () => {
    it('generates sequential IDs', () => {
      const user1 = createMockUser();
      const user2 = createMockUser();
      const org1 = createMockOrganization();

      expect(user1.id).toBe(1);
      expect(user2.id).toBe(2);
      expect(org1.id).toBe(3);
    });

    it('resets ID counter', () => {
      const user1 = createMockUser();
      expect(user1.id).toBe(1);

      resetIdCounter();

      const user2 = createMockUser();
      expect(user2.id).toBe(1); // Reset to 1
    });
  });
});
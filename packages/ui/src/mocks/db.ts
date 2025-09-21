/**
 * MSW Data Model Definitions
 * Using @mswjs/data for better type safety and relationships
 */

import { factory, primaryKey, oneOf, manyOf, nullable } from '@mswjs/data';
import { faker } from '@faker-js/faker';

/**
 * Create the mock database with all models
 */
export const db = factory({
  // User model
  user: {
    id: primaryKey(() => faker.string.uuid()),
    email: () => faker.internet.email(),
    firstName: () => faker.person.firstName(),
    lastName: () => faker.person.lastName(),
    userName: () => faker.internet.userName(),
    bio: nullable(() => faker.lorem.sentence()),
    avatarUrl: nullable(() => faker.image.avatar()),
    createdAt: () => faker.date.past(),
    updatedAt: () => new Date(),
  },

  // Timeline Node model
  timelineNode: {
    id: primaryKey(() => `node-${faker.string.uuid()}`),
    type: () => faker.helpers.arrayElement(['job', 'education', 'project']),
    parentId: nullable(String),
    userId: oneOf('user'),
    title: () => faker.company.name(),
    company: nullable(() => faker.company.name()),
    institution: nullable(() => faker.company.name()),
    startDate: () => faker.date.past().toISOString(),
    endDate: nullable(() => faker.date.recent().toISOString()),
    description: nullable(() => faker.lorem.paragraph()),
    isCurrent: () => faker.datatype.boolean(),
    depth: () => faker.number.int({ min: 0, max: 3 }),
    createdAt: () => faker.date.past(),
    updatedAt: () => new Date(),
    // Permissions
    canView: () => true,
    canEdit: () => true,
    canDelete: () => true,
    canShare: () => true,
  },

  // Organization model
  organization: {
    id: primaryKey(() => `org-${faker.string.uuid()}`),
    name: () => faker.company.name(),
    type: () => faker.helpers.arrayElement(['company', 'school', 'nonprofit']),
    domain: () => faker.internet.domainName(),
    logoUrl: nullable(() => faker.image.url()),
    memberCount: () => faker.number.int({ min: 10, max: 10000 }),
    createdAt: () => faker.date.past(),
    updatedAt: () => new Date(),
  },

  // Permission model
  permission: {
    id: primaryKey(() => `perm-${faker.string.uuid()}`),
    nodeId: oneOf('timelineNode'),
    organizationId: nullable(oneOf('organization')),
    userId: nullable(oneOf('user')),
    accessLevel: () => faker.helpers.arrayElement(['overview', 'full', 'none']),
    canView: () => true,
    canEdit: () => faker.datatype.boolean(),
    canShare: () => faker.datatype.boolean(),
    grantedAt: () => faker.date.past(),
    expiresAt: nullable(() => faker.date.future()),
  },

  // Profile (composite model)
  profile: {
    id: primaryKey(() => `profile-${faker.string.uuid()}`),
    user: oneOf('user'),
    nodes: manyOf('timelineNode'),
    currentExperiences: manyOf('timelineNode'),
    pastExperiences: manyOf('timelineNode'),
    totalNodes: () => faker.number.int({ min: 1, max: 50 }),
    profileUrl: () => faker.internet.url(),
    isPublic: () => faker.datatype.boolean(),
  },
});

/**
 * Factory functions for common test scenarios
 */
export const testFactories = {
  /**
   * Create a complete user profile with timeline nodes
   */
  createUserProfile: (overrides?: {
    userName?: string;
    nodeCount?: number;
  }) => {
    const user = db.user.create({
      userName: overrides?.userName || 'testuser',
    });

    const nodeCount = overrides?.nodeCount || 3;
    const nodes = Array.from({ length: nodeCount }, () =>
      db.timelineNode.create({
        userId: user,
      })
    );

    return db.profile.create({
      user,
      nodes,
      currentExperiences: nodes.filter((n) => n.isCurrent),
      pastExperiences: nodes.filter((n) => !n.isCurrent),
      totalNodes: nodeCount,
      profileUrl: `https://app.lighthouse.ai/${user.userName}`,
    });
  },

  /**
   * Create organizations with permissions
   */
  createOrganizationWithPermissions: (
    nodeIds: string[],
    accessLevel: 'overview' | 'full' | 'none' = 'overview'
  ) => {
    const org = db.organization.create();

    const permissions = nodeIds
      .map((nodeId) => {
        const node = db.timelineNode.findFirst({
          where: { id: { equals: nodeId } },
        });

        if (node) {
          return db.permission.create({
            nodeId: node,
            organizationId: org,
            accessLevel,
          });
        }
        return null;
      })
      .filter(Boolean);

    return { organization: org, permissions };
  },

  /**
   * Reset database for tests
   */
  reset: () => {
    // Clear all data from all models
    const models = [
      'user',
      'timelineNode',
      'organization',
      'permission',
      'profile',
    ] as const;
    models.forEach((model) => {
      const allRecords = db[model].findMany({});
      allRecords.forEach((record) => {
        db[model].delete({
          where: { id: { equals: record.id } },
        });
      });
    });
  },
};

/**
 * Type-safe handler generation
 */
export const generateHandlers = (baseUrl?: string) => {
  return [
    ...db.user.toHandlers('rest', baseUrl),
    ...db.timelineNode.toHandlers('rest', baseUrl),
    ...db.organization.toHandlers('rest', baseUrl),
    ...db.permission.toHandlers('rest', baseUrl),
    ...db.profile.toHandlers('rest', baseUrl),
  ];
};

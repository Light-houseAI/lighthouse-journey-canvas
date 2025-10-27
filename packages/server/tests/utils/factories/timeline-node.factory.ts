/**
 * TimelineNode Test Data Factory
 *
 * Provides consistent test data creation for TimelineNode entities across all tests.
 * Supports partial overrides for test-specific scenarios.
 */

import type { TimelineNode } from '@journey/schema';
import { TimelineNodeType } from '@journey/schema';

/**
 * Creates a test TimelineNode with sensible defaults
 * @param overrides - Partial node data to override defaults
 * @returns Complete TimelineNode object for testing
 */
export const createTestNode = (
  overrides: Partial<TimelineNode> = {}
): TimelineNode => ({
  id: `test-node-${Math.random().toString(36).substring(2, 9)}`,
  type: TimelineNodeType.Project,
  parentId: null,
  userId: 1,
  meta: { title: 'Test Node', description: 'Test Description' },
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  ...overrides,
});

/**
 * Creates a job experience timeline node
 */
export const createTestJobNode = (
  overrides: Partial<TimelineNode> = {}
): TimelineNode =>
  createTestNode({
    type: TimelineNodeType.Job,
    meta: {
      title: 'Software Engineer',
      company: 'Test Company',
      description: 'Test job description',
      startDate: '2024-01-01',
      endDate: null,
    },
    ...overrides,
  });

/**
 * Creates an education timeline node
 */
export const createTestEducationNode = (
  overrides: Partial<TimelineNode> = {}
): TimelineNode =>
  createTestNode({
    type: TimelineNodeType.Education,
    meta: {
      title: 'Bachelor of Science',
      institution: 'Test University',
      field: 'Computer Science',
      description: 'Test education description',
      startDate: '2020-09-01',
      endDate: '2024-05-01',
    },
    ...overrides,
  });

/**
 * Creates a project timeline node
 */
export const createTestProjectNode = (
  overrides: Partial<TimelineNode> = {}
): TimelineNode =>
  createTestNode({
    type: TimelineNodeType.Project,
    meta: {
      title: 'Test Project',
      description: 'Test project description',
      technologies: ['TypeScript', 'React'],
    },
    ...overrides,
  });

/**
 * Creates multiple test nodes with unique IDs
 * @param count - Number of nodes to create
 * @param userId - User ID for all nodes (defaults to 1)
 * @returns Array of TimelineNode objects
 */
export const createTestNodeBatch = (
  count: number,
  userId: number = 1
): TimelineNode[] =>
  Array.from({ length: count }, (_, i) =>
    createTestNode({
      id: `test-node-${i}`,
      userId,
      meta: { title: `Test Node ${i}`, description: `Description ${i}` },
    })
  );

/**
 * Creates a parent-child node hierarchy
 * @param userId - User ID for all nodes
 * @returns Object with parent, child, and grandchild nodes
 */
export const createTestNodeHierarchy = (userId: number = 1) => {
  const grandParent = createTestNode({
    id: 'grandparent-node',
    userId,
    meta: { title: 'Grand Parent Node', description: 'Root of hierarchy' },
  });

  const parent = createTestNode({
    id: 'parent-node',
    parentId: grandParent.id,
    userId,
    meta: { title: 'Parent Node', description: 'Middle of hierarchy' },
  });

  const child = createTestNode({
    id: 'child-node',
    parentId: parent.id,
    userId,
    meta: { title: 'Child Node', description: 'Leaf of hierarchy' },
  });

  return { grandParent, parent, child };
};

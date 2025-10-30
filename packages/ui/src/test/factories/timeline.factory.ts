/**
 * Timeline Test Data Factory
 *
 * Provides factory functions for creating mock timeline node objects in tests.
 */

interface TimelineNode {
  id: string;
  type: string;
  title: string;
  userId: number;
  createdAt: Date;
  [key: string]: any;
}

/**
 * Creates a mock timeline node with sensible defaults.
 *
 * @example
 * const node = createMockTimelineNode();
 * const jobNode = createMockTimelineNode({ type: 'job', title: 'Senior Engineer' });
 */
export const createMockTimelineNode = (
  overrides?: Partial<TimelineNode>
): TimelineNode => ({
  id: 'node-1',
  type: 'job',
  title: 'Software Engineer',
  userId: 1,
  createdAt: new Date('2024-01-01T00:00:00Z'),
  ...overrides,
});

/**
 * Creates multiple mock timeline nodes with incremental IDs.
 *
 * @example
 * const nodes = createMockTimelineNodes(3);
 * const jobNodes = createMockTimelineNodes(2, { type: 'job' });
 */
export const createMockTimelineNodes = (
  count: number,
  baseOverrides?: Partial<TimelineNode>
): TimelineNode[] => {
  return Array.from({ length: count }, (_, index) =>
    createMockTimelineNode({
      ...baseOverrides,
      id: `node-${index + 1}`,
      title: `${baseOverrides?.type || 'Item'} ${index + 1}`,
    })
  );
};

/**
 * Creates a mock job node with job-specific fields.
 */
export const createMockJobNode = (
  overrides?: Partial<TimelineNode>
): TimelineNode => ({
  ...createMockTimelineNode({
    type: 'job',
    title: 'Software Engineer',
    company: 'Tech Corp',
    location: 'San Francisco, CA',
    startDate: '2024-01-01',
    ...overrides,
  }),
});

/**
 * Creates a mock education node with education-specific fields.
 */
export const createMockEducationNode = (
  overrides?: Partial<TimelineNode>
): TimelineNode => ({
  ...createMockTimelineNode({
    type: 'education',
    title: 'Computer Science',
    institution: 'University',
    degree: 'Bachelor',
    ...overrides,
  }),
});

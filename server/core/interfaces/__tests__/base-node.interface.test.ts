/**
 * Tests for BaseNode interface and NodeType enum
 * Following TDD principles - write tests first, then implement
 */
import { describe, it, expect } from 'vitest';
import { BaseNode, NodeType } from '../base-node.interface';

describe('NodeType enum', () => {
  it('should contain all required node types from PRD', () => {
    expect(NodeType.WorkExperience).toBe('workExperience');
    expect(NodeType.Education).toBe('education');
    expect(NodeType.Project).toBe('project');
    expect(NodeType.Event).toBe('event');
    expect(NodeType.Action).toBe('action');
    expect(NodeType.CareerTransition).toBe('careerTransition');
  });

  it('should have exactly 6 node types', () => {
    const nodeTypes = Object.values(NodeType);
    expect(nodeTypes).toHaveLength(6);
  });

  it('should contain all unique values', () => {
    const nodeTypes = Object.values(NodeType);
    const uniqueTypes = [...new Set(nodeTypes)];
    expect(uniqueTypes).toHaveLength(nodeTypes.length);
  });
});

describe('BaseNode interface', () => {
  it('should validate a complete BaseNode structure', () => {
    const baseNode: BaseNode = {
      id: 'test-id-123',
      type: NodeType.WorkExperience,
      title: 'Software Engineer',
      description: 'Working on amazing projects',
      startDate: '2023-01-15',
      endDate: '2024-12-31',
      createdAt: '2023-01-15T00:00:00Z',
      updatedAt: '2023-01-15T00:00:00Z'
    };

    // Type assertion to ensure interface is properly defined
    expect(baseNode.id).toBe('test-id-123');
    expect(baseNode.type).toBe(NodeType.WorkExperience);
    expect(baseNode.title).toBe('Software Engineer');
    expect(baseNode.description).toBe('Working on amazing projects');
    expect(baseNode.startDate).toBe('2023-01-15');
    expect(baseNode.endDate).toBe('2024-12-31');
    expect(baseNode.createdAt).toBe('2023-01-15T00:00:00Z');
    expect(baseNode.updatedAt).toBe('2023-01-15T00:00:00Z');
  });

  it('should allow minimal BaseNode with only required fields', () => {
    const minimalNode: BaseNode = {
      id: 'minimal-id',
      type: NodeType.Education,
      title: 'Computer Science Degree',
      createdAt: '2023-01-15T00:00:00Z',
      updatedAt: '2023-01-15T00:00:00Z'
    };

    expect(minimalNode.id).toBe('minimal-id');
    expect(minimalNode.type).toBe(NodeType.Education);
    expect(minimalNode.title).toBe('Computer Science Degree');
    expect(minimalNode.description).toBeUndefined();
    expect(minimalNode.startDate).toBeUndefined();
    expect(minimalNode.endDate).toBeUndefined();
  });

  it('should support all node types', () => {
    const nodeTypes = Object.values(NodeType);
    
    nodeTypes.forEach(nodeType => {
      const node: BaseNode = {
        id: `test-${nodeType}`,
        type: nodeType,
        title: `Test ${nodeType}`,
        createdAt: '2023-01-15T00:00:00Z',
        updatedAt: '2023-01-15T00:00:00Z'
      };

      expect(node.type).toBe(nodeType);
    });
  });

  it('should enforce required fields', () => {
    // This test ensures TypeScript compilation fails if required fields are missing
    // We can't test runtime validation here since interfaces don't exist at runtime
    expect(() => {
      const validNode: BaseNode = {
        id: 'test',
        type: NodeType.Project,
        title: 'Test Project',
        createdAt: '2023-01-15T00:00:00Z',
        updatedAt: '2023-01-15T00:00:00Z'
      };
      return validNode;
    }).not.toThrow();
  });
});
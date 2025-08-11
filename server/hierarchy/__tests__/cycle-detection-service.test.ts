/**
 * CycleDetectionService Unit Tests
 * 
 * Comprehensive test suite for cycle detection algorithms and hierarchy analysis.
 * Tests DFS-based cycle detection, path analysis, and recovery suggestions.
 */

import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CycleDetectionService, type CycleDetectionResult, type PathAnalysis } from '../services/cycle-detection-service';
import { HierarchyRepository } from '../infrastructure/hierarchy-repository';
import type { TimelineNode } from '../../../shared/schema';

// Test constants
const TEST_USER_ID = 123;
const TEST_NODE_A = 'node-a';
const TEST_NODE_B = 'node-b';
const TEST_NODE_C = 'node-c';
const TEST_NODE_D = 'node-d';

// Mock logger
const mockLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

// Mock repository
const mockRepository = {
  getAncestors: vi.fn(),
  getFullTree: vi.fn(),
} as any;

// Test data factory
const createTestNode = (id: string, parentId?: string): TimelineNode => ({
  id,
  type: 'project',
  label: `Node ${id}`,
  parentId: parentId || null,
  meta: {},
  userId: TEST_USER_ID,
  createdAt: new Date('2024-01-01T00:00:00Z'),
  updatedAt: new Date('2024-01-01T00:00:00Z'),
});

const createTreeNode = (id: string, parentId?: string, children?: any[]): any => ({
  ...createTestNode(id, parentId),
  children: children || []
});

describe('CycleDetectionService', () => {
  let cycleDetectionService: CycleDetectionService;

  beforeEach(() => {
    cycleDetectionService = new CycleDetectionService(mockRepository, mockLogger);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('wouldCreateCycle', () => {
    it('should return true when moving node to itself', async () => {
      // Arrange & Act
      const result = await cycleDetectionService.wouldCreateCycle(
        TEST_NODE_A, 
        TEST_NODE_A, 
        TEST_USER_ID
      );

      // Assert
      expect(result).toBe(true);
      expect(mockRepository.getAncestors).not.toHaveBeenCalled(); // Short-circuits
    });

    it('should return true when move would create cycle', async () => {
      // Arrange - A -> B -> C, trying to move A under C would create cycle
      const ancestors = [
        createTestNode(TEST_NODE_C),
        createTestNode(TEST_NODE_B, TEST_NODE_A),
        createTestNode(TEST_NODE_A)
      ];
      mockRepository.getAncestors.mockResolvedValue(ancestors);

      // Act
      const result = await cycleDetectionService.wouldCreateCycle(
        TEST_NODE_A,
        TEST_NODE_C,
        TEST_USER_ID
      );

      // Assert
      expect(result).toBe(true);
      expect(mockRepository.getAncestors).toHaveBeenCalledWith(TEST_NODE_C, TEST_USER_ID);
    });

    it('should return false when move is safe', async () => {
      // Arrange - A -> B, C -> D, moving C under B is safe
      const ancestors = [
        createTestNode(TEST_NODE_B, TEST_NODE_A),
        createTestNode(TEST_NODE_A)
      ];
      mockRepository.getAncestors.mockResolvedValue(ancestors);

      // Act
      const result = await cycleDetectionService.wouldCreateCycle(
        TEST_NODE_C,
        TEST_NODE_B,
        TEST_USER_ID
      );

      // Assert
      expect(result).toBe(false);
    });

    it('should handle repository errors by being conservative', async () => {
      // Arrange
      mockRepository.getAncestors.mockRejectedValue(new Error('Database error'));

      // Act
      const result = await cycleDetectionService.wouldCreateCycle(
        TEST_NODE_A,
        TEST_NODE_B,
        TEST_USER_ID
      );

      // Assert
      expect(result).toBe(true); // Conservative approach on error
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error during cycle detection',
        expect.objectContaining({
          nodeId: TEST_NODE_A,
          proposedParentId: TEST_NODE_B,
          userId: TEST_USER_ID
        })
      );
    });
  });

  describe('detectCycleForMove', () => {
    it('should detect self-referential cycle', async () => {
      // Arrange & Act
      const result = await cycleDetectionService.detectCycleForMove(
        TEST_NODE_A,
        TEST_NODE_A,
        TEST_USER_ID
      );

      // Assert
      expect(result).toEqual({
        wouldCreateCycle: true,
        cyclePath: [TEST_NODE_A],
        reason: 'Node cannot be parent of itself'
      });
    });

    it('should detect complex cycle with path information', async () => {
      // Arrange - A -> B -> C, trying to move A under C
      const ancestors = [
        createTestNode(TEST_NODE_C),
        createTestNode(TEST_NODE_B, TEST_NODE_A),
        createTestNode(TEST_NODE_A)
      ];
      mockRepository.getAncestors.mockResolvedValue(ancestors);

      // Act
      const result = await cycleDetectionService.detectCycleForMove(
        TEST_NODE_A,
        TEST_NODE_C,
        TEST_USER_ID
      );

      // Assert
      expect(result.wouldCreateCycle).toBe(true);
      expect(result.cyclePath).toEqual([TEST_NODE_A, TEST_NODE_C, TEST_NODE_C, TEST_NODE_B, TEST_NODE_A]);
      expect(result.reason).toContain('Moving node would create cycle');
    });

    it('should return no cycle for safe moves', async () => {
      // Arrange
      const ancestors = [createTestNode(TEST_NODE_B)];
      mockRepository.getAncestors.mockResolvedValue(ancestors);

      // Act
      const result = await cycleDetectionService.detectCycleForMove(
        TEST_NODE_C,
        TEST_NODE_B,
        TEST_USER_ID
      );

      // Assert
      expect(result).toEqual({
        wouldCreateCycle: false
      });
    });

    it('should handle errors gracefully', async () => {
      // Arrange
      mockRepository.getAncestors.mockRejectedValue(new Error('Network timeout'));

      // Act
      const result = await cycleDetectionService.detectCycleForMove(
        TEST_NODE_A,
        TEST_NODE_B,
        TEST_USER_ID
      );

      // Assert
      expect(result).toEqual({
        wouldCreateCycle: true,
        reason: 'Error during cycle detection - operation blocked for safety'
      });
    });

    it('should log debug information', async () => {
      // Arrange
      mockRepository.getAncestors.mockResolvedValue([]);

      // Act
      await cycleDetectionService.detectCycleForMove(TEST_NODE_A, TEST_NODE_B, TEST_USER_ID);

      // Assert
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Detecting cycle for move operation',
        {
          nodeId: TEST_NODE_A,
          proposedParentId: TEST_NODE_B,
          userId: TEST_USER_ID
        }
      );
    });
  });

  describe('analyzeHierarchyForCycles', () => {
    it('should detect no cycles in clean hierarchy', async () => {
      // Arrange - Clean tree: A -> B -> C, D -> E
      const cleanTree = [
        createTreeNode(TEST_NODE_A, null, [
          createTreeNode(TEST_NODE_B, TEST_NODE_A, [
            createTreeNode(TEST_NODE_C, TEST_NODE_B, [])
          ])
        ]),
        createTreeNode(TEST_NODE_D, null, [
          createTreeNode('node-e', TEST_NODE_D, [])
        ])
      ];
      mockRepository.getFullTree.mockResolvedValue(cleanTree);

      // Act
      const result = await cycleDetectionService.analyzeHierarchyForCycles(TEST_USER_ID);

      // Assert
      expect(result.hasCycles).toBe(false);
      expect(result.cycles).toHaveLength(0);
      expect(result.orphanedNodes).toHaveLength(0);
      expect(result.maxDepth).toBe(2); // A->B->C is depth 2
    });

    it('should detect cycles in corrupted hierarchy', async () => {
      // Arrange - Cycle: A -> B -> C -> A
      const corruptedTree = [
        createTreeNode(TEST_NODE_A, TEST_NODE_C, [
          createTreeNode(TEST_NODE_B, TEST_NODE_A, [
            createTreeNode(TEST_NODE_C, TEST_NODE_B, [])
          ])
        ])
      ];
      mockRepository.getFullTree.mockResolvedValue(corruptedTree);

      // Act
      const result = await cycleDetectionService.analyzeHierarchyForCycles(TEST_USER_ID);

      // Assert
      expect(result.hasCycles).toBe(true);
      expect(result.cycles.length).toBeGreaterThan(0);
      expect(result.cycles[0].severity).toBe('minor'); // Small cycle
    });

    it('should detect orphaned nodes', async () => {
      // Arrange - Node references non-existent parent
      const treeWithOrphan = [
        createTreeNode(TEST_NODE_A, 'nonexistent-parent', [])
      ];
      mockRepository.getFullTree.mockResolvedValue(treeWithOrphan);

      // Act
      const result = await cycleDetectionService.analyzeHierarchyForCycles(TEST_USER_ID);

      // Assert
      expect(result.orphanedNodes).toContain('nonexistent-parent');
    });

    it('should calculate maximum depth correctly', async () => {
      // Arrange - Deep hierarchy: A -> B -> C -> D -> E (depth 4)
      const deepTree = [
        createTreeNode(TEST_NODE_A, null, [
          createTreeNode(TEST_NODE_B, TEST_NODE_A, [
            createTreeNode(TEST_NODE_C, TEST_NODE_B, [
              createTreeNode(TEST_NODE_D, TEST_NODE_C, [
                createTreeNode('node-e', TEST_NODE_D, [])
              ])
            ])
          ])
        ])
      ];
      mockRepository.getFullTree.mockResolvedValue(deepTree);

      // Act
      const result = await cycleDetectionService.analyzeHierarchyForCycles(TEST_USER_ID);

      // Assert
      expect(result.maxDepth).toBe(4);
    });

    it('should classify cycle severity correctly', async () => {
      // Arrange - Large cycle with 6+ nodes
      const largeCycle = Array.from({ length: 7 }, (_, i) => 
        createTreeNode(`node-${i}`, i === 6 ? 'node-0' : `node-${i + 1}`, [])
      );
      mockRepository.getFullTree.mockResolvedValue(largeCycle);

      // Act
      const result = await cycleDetectionService.analyzeHierarchyForCycles(TEST_USER_ID);

      // Assert
      expect(result.hasCycles).toBe(true);
      expect(result.cycles[0].severity).toBe('major'); // Large cycle
    });

    it('should handle empty hierarchy', async () => {
      // Arrange
      mockRepository.getFullTree.mockResolvedValue([]);

      // Act
      const result = await cycleDetectionService.analyzeHierarchyForCycles(TEST_USER_ID);

      // Assert
      expect(result).toEqual({
        hasCycles: false,
        cycles: [],
        orphanedNodes: [],
        maxDepth: 0
      });
    });

    it('should log analysis results', async () => {
      // Arrange
      mockRepository.getFullTree.mockResolvedValue([]);

      // Act
      await cycleDetectionService.analyzeHierarchyForCycles(TEST_USER_ID);

      // Assert
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Analyzing hierarchy for cycles',
        { userId: TEST_USER_ID }
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Hierarchy analysis complete',
        expect.objectContaining({
          userId: TEST_USER_ID,
          hasCycles: false,
          cycleCount: 0,
          orphanedCount: 0,
          maxDepth: 0
        })
      );
    });
  });

  describe('validateHierarchyChange', () => {
    it('should validate safe single change', async () => {
      // Arrange
      mockRepository.getAncestors.mockResolvedValue([createTestNode(TEST_NODE_B)]);
      const changes = [{ nodeId: TEST_NODE_C, newParentId: TEST_NODE_B }];

      // Act
      const result = await cycleDetectionService.validateHierarchyChange(changes, TEST_USER_ID);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it('should reject changes that create cycles', async () => {
      // Arrange
      const ancestors = [createTestNode(TEST_NODE_A)];
      mockRepository.getAncestors.mockResolvedValue(ancestors);
      const changes = [{ nodeId: TEST_NODE_A, newParentId: TEST_NODE_B }];

      // Act
      const result = await cycleDetectionService.validateHierarchyChange(changes, TEST_USER_ID);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('cannot be moved');
    });

    it('should allow changes to root (null parent)', async () => {
      // Arrange
      const changes = [{ nodeId: TEST_NODE_A, newParentId: null }];

      // Act
      const result = await cycleDetectionService.validateHierarchyChange(changes, TEST_USER_ID);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should warn about bulk changes', async () => {
      // Arrange
      mockRepository.getAncestors.mockResolvedValue([]);
      const bulkChanges = [
        { nodeId: TEST_NODE_A, newParentId: TEST_NODE_B },
        { nodeId: TEST_NODE_C, newParentId: TEST_NODE_D }
      ];

      // Act
      const result = await cycleDetectionService.validateHierarchyChange(bulkChanges, TEST_USER_ID);

      // Assert
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('Bulk hierarchy changes');
    });

    it('should detect duplicate node IDs in changes', async () => {
      // Arrange
      const duplicateChanges = [
        { nodeId: TEST_NODE_A, newParentId: TEST_NODE_B },
        { nodeId: TEST_NODE_A, newParentId: TEST_NODE_C } // Duplicate node ID
      ];

      // Act
      const result = await cycleDetectionService.validateHierarchyChange(duplicateChanges, TEST_USER_ID);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual('Duplicate node IDs found in change set');
    });
  });

  describe('getRecoverySuggestions', () => {
    it('should provide suggestions for cycles', async () => {
      // Arrange - Mock analysis with cycles
      const cycleDetectionServiceSpy = vi.spyOn(cycleDetectionService, 'analyzeHierarchyForCycles');
      cycleDetectionServiceSpy.mockResolvedValue({
        hasCycles: true,
        cycles: [
          { cycleId: 'cycle-1', nodes: [TEST_NODE_A, TEST_NODE_B, TEST_NODE_C], severity: 'minor' }
        ],
        orphanedNodes: ['orphan-1'],
        maxDepth: 5
      });

      // Act
      const suggestions = await cycleDetectionService.getRecoverySuggestions(TEST_USER_ID);

      // Assert
      expect(suggestions.length).toBeGreaterThan(0);
      
      // Check cycle suggestion
      const cycleSuggestion = suggestions.find(s => s.issue.includes('Cycle detected'));
      expect(cycleSuggestion).toBeDefined();
      expect(cycleSuggestion!.severity).toBe('medium');
      expect(cycleSuggestion!.automaticFix).toEqual({
        action: 'remove_parent',
        nodeId: TEST_NODE_C, // Last node in cycle
        details: expect.stringContaining('Remove parent relationship')
      });
    });

    it('should provide suggestions for orphaned nodes', async () => {
      // Arrange
      const cycleDetectionServiceSpy = vi.spyOn(cycleDetectionService, 'analyzeHierarchyForCycles');
      cycleDetectionServiceSpy.mockResolvedValue({
        hasCycles: false,
        cycles: [],
        orphanedNodes: ['orphan-1', 'orphan-2'],
        maxDepth: 3
      });

      // Act
      const suggestions = await cycleDetectionService.getRecoverySuggestions(TEST_USER_ID);

      // Assert
      const orphanSuggestions = suggestions.filter(s => s.issue.includes('Orphaned parent'));
      expect(orphanSuggestions).toHaveLength(2);
      expect(orphanSuggestions[0].severity).toBe('medium');
      expect(orphanSuggestions[0].automaticFix?.action).toBe('remove_parent');
    });

    it('should provide suggestions for excessive depth', async () => {
      // Arrange
      const cycleDetectionServiceSpy = vi.spyOn(cycleDetectionService, 'analyzeHierarchyForCycles');
      cycleDetectionServiceSpy.mockResolvedValue({
        hasCycles: false,
        cycles: [],
        orphanedNodes: [],
        maxDepth: 15 // Excessive depth
      });

      // Act
      const suggestions = await cycleDetectionService.getRecoverySuggestions(TEST_USER_ID);

      // Assert
      const depthSuggestion = suggestions.find(s => s.issue.includes('depth exceeds'));
      expect(depthSuggestion).toBeDefined();
      expect(depthSuggestion!.severity).toBe('low');
      expect(depthSuggestion!.suggestion).toContain('flattening the hierarchy');
    });

    it('should handle major cycles with high severity', async () => {
      // Arrange
      const cycleDetectionServiceSpy = vi.spyOn(cycleDetectionService, 'analyzeHierarchyForCycles');
      cycleDetectionServiceSpy.mockResolvedValue({
        hasCycles: true,
        cycles: [
          { cycleId: 'major-cycle', nodes: Array.from({length: 8}, (_, i) => `node-${i}`), severity: 'major' }
        ],
        orphanedNodes: [],
        maxDepth: 5
      });

      // Act
      const suggestions = await cycleDetectionService.getRecoverySuggestions(TEST_USER_ID);

      // Assert
      const majorCycleSuggestion = suggestions.find(s => s.issue.includes('Cycle detected'));
      expect(majorCycleSuggestion!.severity).toBe('high');
    });

    it('should return empty suggestions for clean hierarchy', async () => {
      // Arrange
      const cycleDetectionServiceSpy = vi.spyOn(cycleDetectionService, 'analyzeHierarchyForCycles');
      cycleDetectionServiceSpy.mockResolvedValue({
        hasCycles: false,
        cycles: [],
        orphanedNodes: [],
        maxDepth: 5 // Normal depth
      });

      // Act
      const suggestions = await cycleDetectionService.getRecoverySuggestions(TEST_USER_ID);

      // Assert
      expect(suggestions).toHaveLength(0);
    });
  });

  describe('DFS cycle detection algorithm', () => {
    it('should handle complex hierarchies without false positives', async () => {
      // Arrange - Complex but valid tree structure
      const complexTree = [
        createTreeNode('root1', null, [
          createTreeNode('branch1a', 'root1', [
            createTreeNode('leaf1a1', 'branch1a', []),
            createTreeNode('leaf1a2', 'branch1a', [])
          ]),
          createTreeNode('branch1b', 'root1', [
            createTreeNode('leaf1b1', 'branch1b', [])
          ])
        ]),
        createTreeNode('root2', null, [
          createTreeNode('branch2a', 'root2', [])
        ])
      ];
      mockRepository.getFullTree.mockResolvedValue(complexTree);

      // Act
      const result = await cycleDetectionService.analyzeHierarchyForCycles(TEST_USER_ID);

      // Assert
      expect(result.hasCycles).toBe(false);
      expect(result.cycles).toHaveLength(0);
    });

    it('should detect multiple independent cycles', async () => {
      // Arrange - Two separate cycles
      const multiCycleTree = [
        // Cycle 1: A -> B -> A
        createTreeNode('a1', 'b1', []),
        createTreeNode('b1', 'a1', []),
        // Cycle 2: C -> D -> E -> C  
        createTreeNode('c1', 'e1', []),
        createTreeNode('d1', 'c1', []),
        createTreeNode('e1', 'd1', [])
      ];
      mockRepository.getFullTree.mockResolvedValue(multiCycleTree);

      // Act
      const result = await cycleDetectionService.analyzeHierarchyForCycles(TEST_USER_ID);

      // Assert
      expect(result.hasCycles).toBe(true);
      expect(result.cycles.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('error handling and edge cases', () => {
    it('should handle repository errors during hierarchy analysis', async () => {
      // Arrange
      mockRepository.getFullTree.mockRejectedValue(new Error('Database connection lost'));

      // Act & Assert
      await expect(cycleDetectionService.analyzeHierarchyForCycles(TEST_USER_ID))
        .rejects.toThrow('Database connection lost');
    });

    it('should handle malformed tree data', async () => {
      // Arrange - Tree with missing required fields
      const malformedTree = [
        { id: null, children: [] }, // Missing ID
        { children: [] } // Missing ID entirely
      ];
      mockRepository.getFullTree.mockResolvedValue(malformedTree);

      // Act & Assert - Should not crash
      await expect(cycleDetectionService.analyzeHierarchyForCycles(TEST_USER_ID))
        .resolves.toBeDefined();
    });

    it('should handle circular references in tree structure', async () => {
      // Arrange - Circular reference in children
      const node1: any = { id: 'node1', parentId: null, children: [] };
      const node2: any = { id: 'node2', parentId: 'node1', children: [] };
      node1.children = [node2];
      node2.children = [node1]; // Circular reference
      
      mockRepository.getFullTree.mockResolvedValue([node1]);

      // Act & Assert - Should handle gracefully
      const result = await cycleDetectionService.analyzeHierarchyForCycles(TEST_USER_ID);
      expect(result).toBeDefined();
    });

    it('should handle extremely deep hierarchies', async () => {
      // Arrange - Very deep hierarchy (100 levels)
      let currentNode = createTreeNode('root', null, []);
      const allNodes = [currentNode];
      
      for (let i = 1; i < 100; i++) {
        const parentId = i === 1 ? 'root' : `node-${i-1}`;
        const newNode = createTreeNode(`node-${i}`, parentId, []);
        currentNode.children = [newNode];
        allNodes.push(newNode);
        currentNode = newNode;
      }
      
      mockRepository.getFullTree.mockResolvedValue([allNodes[0]]);

      // Act
      const result = await cycleDetectionService.analyzeHierarchyForCycles(TEST_USER_ID);

      // Assert
      expect(result.maxDepth).toBe(99);
      expect(result.hasCycles).toBe(false);
    });

    it('should handle nodes with duplicate IDs', async () => {
      // Arrange - Duplicate node IDs (data corruption scenario)
      const duplicateTree = [
        createTreeNode('duplicate-id', null, []),
        createTreeNode('duplicate-id', null, []) // Same ID
      ];
      mockRepository.getFullTree.mockResolvedValue(duplicateTree);

      // Act & Assert - Should not crash
      const result = await cycleDetectionService.analyzeHierarchyForCycles(TEST_USER_ID);
      expect(result).toBeDefined();
    });

    it('should handle empty nodes array', async () => {
      // Arrange
      mockRepository.getFullTree.mockResolvedValue([]);

      // Act
      const result = await cycleDetectionService.analyzeHierarchyForCycles(TEST_USER_ID);

      // Assert
      expect(result).toEqual({
        hasCycles: false,
        cycles: [],
        orphanedNodes: [],
        maxDepth: 0
      });
    });
  });

  describe('performance considerations', () => {
    it('should handle large hierarchies efficiently', async () => {
      // Arrange - Large flat hierarchy (1000 nodes)
      const largeTree = Array.from({ length: 1000 }, (_, i) => 
        createTreeNode(`node-${i}`, null, [])
      );
      mockRepository.getFullTree.mockResolvedValue(largeTree);

      // Act
      const startTime = Date.now();
      const result = await cycleDetectionService.analyzeHierarchyForCycles(TEST_USER_ID);
      const endTime = Date.now();

      // Assert - Should complete in reasonable time (under 1 second)
      expect(endTime - startTime).toBeLessThan(1000);
      expect(result.hasCycles).toBe(false);
    });

    it('should cache analysis results implicitly through repository calls', async () => {
      // Arrange
      mockRepository.getAncestors.mockResolvedValue([]);

      // Act - Multiple calls
      await cycleDetectionService.wouldCreateCycle(TEST_NODE_A, TEST_NODE_B, TEST_USER_ID);
      await cycleDetectionService.wouldCreateCycle(TEST_NODE_A, TEST_NODE_B, TEST_USER_ID);

      // Assert - Repository should be called for each check (no caching at service level)
      expect(mockRepository.getAncestors).toHaveBeenCalledTimes(2);
    });
  });
});
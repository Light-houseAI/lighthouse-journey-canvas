/**
 * Tests for hierarchy store with MSW integration
 * Uses renderWithProviders and MSW handlers for testing hierarchy management
 */

import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import React from 'react';

import { renderWithProviders, http, HttpResponse } from '../test/renderWithProviders';
import { createMockHierarchyNodes, createMockNodeInsights, createMockTimelineNodes } from '../test/factories';
import { useHierarchyStore } from './hierarchy-store';
import { useAuthStore } from './auth-store';
import type { HierarchyNode } from './shared-timeline-types';

// Mock hierarchy API to avoid actual HTTP calls in tests
vi.mock('../services/hierarchy-api', async () => {
  const actual = await vi.importActual('../services/hierarchy-api');
  return {
    ...actual,
    hierarchyApi: {
      listNodesWithPermissions: vi.fn(),
      getUserTimelineNodes: vi.fn(),
      createNode: vi.fn(),
      updateNode: vi.fn(),
      deleteNode: vi.fn(),
      getNodeInsights: vi.fn(),
      createInsight: vi.fn(),
      updateInsight: vi.fn(),
      deleteInsight: vi.fn(),
    },
  };
});

// Test component that interacts with hierarchy store
const HierarchyStoreTestComponent: React.FC = () => {
  const hierarchyStore = useHierarchyStore();
  const [error, setError] = React.useState<string | null>(null);

  const handleLoadNodes = async () => {
    try {
      await hierarchyStore.loadNodes();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleLoadUserTimeline = async (username: string) => {
    try {
      await hierarchyStore.loadUserTimeline(username);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleCreateNode = async () => {
    try {
      await hierarchyStore.createNode({
        title: 'New Node',
        type: 'EXPERIENCE',
        parentId: hierarchyStore.nodes[0]?.id,
      });
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleUpdateNode = async (nodeId: string) => {
    try {
      await hierarchyStore.updateNode(nodeId, {
        title: 'Updated Title',
        description: 'Updated description',
      });
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeleteNode = async (nodeId: string) => {
    try {
      await hierarchyStore.deleteNode(nodeId);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleLoadInsights = async (nodeId: string) => {
    try {
      await hierarchyStore.getNodeInsights(nodeId);
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div>
      <h1>Hierarchy Store Test</h1>

      {hierarchyStore.loading && <div data-testid="loading">Loading...</div>}
      {error && <div data-testid="error">{error}</div>}
      {hierarchyStore.error && <div data-testid="store-error">{hierarchyStore.error}</div>}

      <div data-testid="node-count">Nodes: {hierarchyStore.nodes.length}</div>
      <div data-testid="has-data">{hierarchyStore.hasData ? 'Has Data' : 'No Data'}</div>
      <div data-testid="tree-nodes">Tree Nodes: {hierarchyStore.tree.nodes.length}</div>
      <div data-testid="tree-edges">Tree Edges: {hierarchyStore.tree.edges.length}</div>

      {hierarchyStore.selectedNodeId && (
        <div data-testid="selected-node">{hierarchyStore.selectedNodeId}</div>
      )}
      {hierarchyStore.focusedNodeId && (
        <div data-testid="focused-node">{hierarchyStore.focusedNodeId}</div>
      )}

      <div data-testid="expanded-count">
        Expanded: {hierarchyStore.expandedNodeIds.size}
      </div>

      <div data-testid="panel-mode">{hierarchyStore.panelMode}</div>
      <div data-testid="show-panel">{hierarchyStore.showPanel ? 'Panel Open' : 'Panel Closed'}</div>

      {/* Display nodes */}
      {hierarchyStore.nodes.map(node => (
        <div key={node.id} data-testid={`node-${node.id}`}>
          <span data-testid={`node-title-${node.id}`}>{node.title}</span>
          <span data-testid={`node-type-${node.id}`}>{node.type}</span>
          {hierarchyStore.isNodeExpanded(node.id) && (
            <span data-testid={`node-expanded-${node.id}`}>Expanded</span>
          )}
        </div>
      ))}

      {/* Display insights */}
      {Object.entries(hierarchyStore.insights).map(([nodeId, insights]) => (
        <div key={nodeId} data-testid={`insights-${nodeId}`}>
          {insights.map(insight => (
            <div key={insight.id} data-testid={`insight-${insight.id}`}>
              {insight.title}
            </div>
          ))}
        </div>
      ))}

      <button onClick={handleLoadNodes}>Load Nodes</button>
      <button onClick={() => handleLoadUserTimeline('testuser')}>
        Load User Timeline
      </button>
      <button onClick={handleCreateNode}>Create Node</button>
      <button onClick={() => handleUpdateNode(hierarchyStore.nodes[0]?.id || '1')}>
        Update First Node
      </button>
      <button onClick={() => handleDeleteNode(hierarchyStore.nodes[0]?.id || '1')}>
        Delete First Node
      </button>
      <button onClick={() => hierarchyStore.selectNode('node-1')}>
        Select Node 1
      </button>
      <button onClick={() => hierarchyStore.focusNode('node-1')}>
        Focus Node 1
      </button>
      <button onClick={() => hierarchyStore.clearFocus()}>Clear Focus</button>
      <button onClick={() => hierarchyStore.expandNode('node-1')}>
        Expand Node 1
      </button>
      <button onClick={() => hierarchyStore.collapseNode('node-1')}>
        Collapse Node 1
      </button>
      <button onClick={() => hierarchyStore.toggleNodeExpansion('node-1')}>
        Toggle Node 1
      </button>
      <button onClick={() => hierarchyStore.expandAllNodes()}>Expand All</button>
      <button onClick={() => hierarchyStore.collapseAllNodes()}>Collapse All</button>
      <button onClick={() => hierarchyStore.showSidePanel()}>Show Panel</button>
      <button onClick={() => hierarchyStore.hideSidePanel()}>Hide Panel</button>
      <button onClick={() => hierarchyStore.setPanelMode('edit')}>
        Set Panel Edit
      </button>
      <button onClick={() => handleLoadInsights('node-1')}>
        Load Node 1 Insights
      </button>
      <button onClick={() => hierarchyStore.clearUserData()}>Clear Data</button>
    </div>
  );
};

describe('Hierarchy Store', () => {
  beforeEach(() => {
    // Clear stores before each test
    useHierarchyStore.setState({
      nodes: [],
      tree: { nodes: [], edges: [] },
      loading: false,
      error: null,
      hasData: false,
      insights: {},
      insightLoading: {},
      selectedNodeId: null,
      focusedNodeId: null,
      expandedNodeIds: new Set<string>(),
      panelMode: 'view',
      showPanel: false,
    });

    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
    });
  });

  describe('Data Loading', () => {
    it('should load nodes successfully', async () => {
      const mockNodes = createMockHierarchyNodes(3);

      const { user } = renderWithProviders(<HierarchyStoreTestComponent />, {
        handlers: [
          http.get('/api/v2/timeline/nodes', () => {
            return HttpResponse.json({
              success: true,
              nodes: mockNodes,
            });
          }),
        ],
      });

      expect(screen.getByTestId('node-count')).toHaveTextContent('Nodes: 0');
      expect(screen.getByTestId('has-data')).toHaveTextContent('No Data');

      await user.click(screen.getByText('Load Nodes'));

      await waitFor(() => {
        expect(screen.getByTestId('node-count')).toHaveTextContent('Nodes: 3');
      });

      expect(screen.getByTestId('has-data')).toHaveTextContent('Has Data');
      expect(screen.queryByTestId('error')).not.toBeInTheDocument();
    });

    it('should handle load nodes error', async () => {
      const { user } = renderWithProviders(<HierarchyStoreTestComponent />, {
        handlers: [
          http.get('/api/v2/timeline/nodes', () => {
            return HttpResponse.json(
              { error: 'Failed to load nodes' },
              { status: 500 }
            );
          }),
        ],
      });

      await user.click(screen.getByText('Load Nodes'));

      await waitFor(() => {
        expect(screen.getByTestId('store-error')).toBeInTheDocument();
      });

      expect(screen.getByTestId('store-error')).toHaveTextContent('Failed to load nodes');
      expect(screen.getByTestId('has-data')).toHaveTextContent('No Data');
    });

    it('should load user timeline', async () => {
      const mockNodes = createMockTimelineNodes(2);

      const { user } = renderWithProviders(<HierarchyStoreTestComponent />, {
        handlers: [
          http.get('/api/timeline/nodes', ({ request }) => {
            const url = new URL(request.url);
            const username = url.searchParams.get('username');

            if (username === 'testuser') {
              return HttpResponse.json({
                success: true,
                data: {
                  nodes: mockNodes,
                },
              });
            }

            return HttpResponse.json(
              { error: 'User not found' },
              { status: 404 }
            );
          }),
        ],
      });

      await user.click(screen.getByText('Load User Timeline'));

      await waitFor(() => {
        expect(screen.getByTestId('node-count')).toHaveTextContent('Nodes: 2');
      });

      expect(screen.getByTestId('has-data')).toHaveTextContent('Has Data');
    });

    it('should clear user data', async () => {
      const mockNodes = createMockHierarchyNodes(2);

      const { user } = renderWithProviders(<HierarchyStoreTestComponent />, {
        hierarchyState: {
          nodes: mockNodes,
          hasData: true,
        },
      });

      expect(screen.getByTestId('node-count')).toHaveTextContent('Nodes: 2');
      expect(screen.getByTestId('has-data')).toHaveTextContent('Has Data');

      await user.click(screen.getByText('Clear Data'));

      await waitFor(() => {
        expect(screen.getByTestId('node-count')).toHaveTextContent('Nodes: 0');
      });

      expect(screen.getByTestId('has-data')).toHaveTextContent('No Data');
    });
  });

  describe('Node CRUD Operations', () => {
    it('should create a new node', async () => {
      const existingNodes = createMockHierarchyNodes(1);
      const newNode = createMockHierarchyNodes(1, {
        overrides: { id: 'new-node', title: 'New Node' },
      })[0];

      const { user } = renderWithProviders(<HierarchyStoreTestComponent />, {
        hierarchyState: {
          nodes: existingNodes,
          hasData: true,
        },
        handlers: [
          http.post('/api/v2/timeline/nodes', async ({ request }) => {
            const body = await request.json() as any;
            return HttpResponse.json({
              success: true,
              node: { ...newNode, ...body },
            });
          }),
        ],
      });

      expect(screen.getByTestId('node-count')).toHaveTextContent('Nodes: 1');

      await user.click(screen.getByText('Create Node'));

      await waitFor(() => {
        expect(screen.getByTestId('node-count')).toHaveTextContent('Nodes: 2');
      });
    });

    it('should update a node', async () => {
      const nodes = createMockHierarchyNodes(1, {
        overrides: { id: 'node-1', title: 'Original Title' },
      });

      const { user } = renderWithProviders(<HierarchyStoreTestComponent />, {
        hierarchyState: {
          nodes,
          hasData: true,
        },
        handlers: [
          http.patch('/api/v2/timeline/nodes/:nodeId', async ({ request, params }) => {
            const body = await request.json() as any;
            return HttpResponse.json({
              success: true,
              node: { id: params.nodeId, ...body },
            });
          }),
        ],
      });

      expect(screen.getByTestId('node-title-node-1')).toHaveTextContent('Original Title');

      await user.click(screen.getByText('Update First Node'));

      await waitFor(() => {
        expect(screen.getByTestId('node-title-node-1')).toHaveTextContent('Updated Title');
      });
    });

    it('should delete a node', async () => {
      const nodes = createMockHierarchyNodes(2);

      const { user } = renderWithProviders(<HierarchyStoreTestComponent />, {
        hierarchyState: {
          nodes,
          hasData: true,
        },
        handlers: [
          http.delete('/api/v2/timeline/nodes/:nodeId', () => {
            return HttpResponse.json({ success: true });
          }),
        ],
      });

      expect(screen.getByTestId('node-count')).toHaveTextContent('Nodes: 2');

      await user.click(screen.getByText('Delete First Node'));

      await waitFor(() => {
        expect(screen.getByTestId('node-count')).toHaveTextContent('Nodes: 1');
      });
    });
  });

  describe('Selection and Focus', () => {
    it('should select and deselect nodes', async () => {
      const nodes = createMockHierarchyNodes(2);

      const { user } = renderWithProviders(<HierarchyStoreTestComponent />, {
        hierarchyState: {
          nodes,
          hasData: true,
        },
      });

      expect(screen.queryByTestId('selected-node')).not.toBeInTheDocument();

      await user.click(screen.getByText('Select Node 1'));

      await waitFor(() => {
        expect(screen.getByTestId('selected-node')).toBeInTheDocument();
      });

      expect(screen.getByTestId('selected-node')).toHaveTextContent('node-1');
    });

    it('should focus and clear focus on nodes', async () => {
      const nodes = createMockHierarchyNodes(2);

      const { user } = renderWithProviders(<HierarchyStoreTestComponent />, {
        hierarchyState: {
          nodes,
          hasData: true,
        },
      });

      expect(screen.queryByTestId('focused-node')).not.toBeInTheDocument();

      await user.click(screen.getByText('Focus Node 1'));

      await waitFor(() => {
        expect(screen.getByTestId('focused-node')).toBeInTheDocument();
      });

      expect(screen.getByTestId('focused-node')).toHaveTextContent('node-1');

      await user.click(screen.getByText('Clear Focus'));

      await waitFor(() => {
        expect(screen.queryByTestId('focused-node')).not.toBeInTheDocument();
      });
    });
  });

  describe('Node Expansion', () => {
    it('should expand and collapse individual nodes', async () => {
      const nodes = createMockHierarchyNodes(2);

      const { user } = renderWithProviders(<HierarchyStoreTestComponent />, {
        hierarchyState: {
          nodes,
          hasData: true,
        },
      });

      expect(screen.getByTestId('expanded-count')).toHaveTextContent('Expanded: 0');
      expect(screen.queryByTestId('node-expanded-node-1')).not.toBeInTheDocument();

      await user.click(screen.getByText('Expand Node 1'));

      await waitFor(() => {
        expect(screen.getByTestId('expanded-count')).toHaveTextContent('Expanded: 1');
      });

      expect(screen.getByTestId('node-expanded-node-1')).toBeInTheDocument();

      await user.click(screen.getByText('Collapse Node 1'));

      await waitFor(() => {
        expect(screen.getByTestId('expanded-count')).toHaveTextContent('Expanded: 0');
      });

      expect(screen.queryByTestId('node-expanded-node-1')).not.toBeInTheDocument();
    });

    it('should toggle node expansion', async () => {
      const nodes = createMockHierarchyNodes(2);

      const { user } = renderWithProviders(<HierarchyStoreTestComponent />, {
        hierarchyState: {
          nodes,
          hasData: true,
        },
      });

      expect(screen.getByTestId('expanded-count')).toHaveTextContent('Expanded: 0');

      await user.click(screen.getByText('Toggle Node 1'));

      await waitFor(() => {
        expect(screen.getByTestId('expanded-count')).toHaveTextContent('Expanded: 1');
      });

      await user.click(screen.getByText('Toggle Node 1'));

      await waitFor(() => {
        expect(screen.getByTestId('expanded-count')).toHaveTextContent('Expanded: 0');
      });
    });

    it('should expand and collapse all nodes', async () => {
      const nodes = createMockHierarchyNodes(3);

      const { user } = renderWithProviders(<HierarchyStoreTestComponent />, {
        hierarchyState: {
          nodes,
          hasData: true,
        },
      });

      expect(screen.getByTestId('expanded-count')).toHaveTextContent('Expanded: 0');

      await user.click(screen.getByText('Expand All'));

      await waitFor(() => {
        expect(screen.getByTestId('expanded-count')).toHaveTextContent('Expanded: 3');
      });

      await user.click(screen.getByText('Collapse All'));

      await waitFor(() => {
        expect(screen.getByTestId('expanded-count')).toHaveTextContent('Expanded: 0');
      });
    });
  });

  describe('Panel Management', () => {
    it('should show and hide side panel', async () => {
      const { user } = renderWithProviders(<HierarchyStoreTestComponent />);

      expect(screen.getByTestId('show-panel')).toHaveTextContent('Panel Closed');

      await user.click(screen.getByText('Show Panel'));

      await waitFor(() => {
        expect(screen.getByTestId('show-panel')).toHaveTextContent('Panel Open');
      });

      await user.click(screen.getByText('Hide Panel'));

      await waitFor(() => {
        expect(screen.getByTestId('show-panel')).toHaveTextContent('Panel Closed');
      });
    });

    it('should change panel mode', async () => {
      const { user } = renderWithProviders(<HierarchyStoreTestComponent />);

      expect(screen.getByTestId('panel-mode')).toHaveTextContent('view');

      await user.click(screen.getByText('Set Panel Edit'));

      await waitFor(() => {
        expect(screen.getByTestId('panel-mode')).toHaveTextContent('edit');
      });
    });
  });

  describe('Insights Management', () => {
    it('should load node insights', async () => {
      const mockInsights = createMockNodeInsights(2);

      const { user } = renderWithProviders(<HierarchyStoreTestComponent />, {
        handlers: [
          http.get('/api/v2/timeline/nodes/:nodeId/insights', ({ params }) => {
            if (params.nodeId === 'node-1') {
              return HttpResponse.json({
                success: true,
                insights: mockInsights,
              });
            }
            return HttpResponse.json({ success: true, insights: [] });
          }),
        ],
      });

      expect(screen.queryByTestId('insights-node-1')).not.toBeInTheDocument();

      await user.click(screen.getByText('Load Node 1 Insights'));

      await waitFor(() => {
        expect(screen.getByTestId('insights-node-1')).toBeInTheDocument();
      });

      mockInsights.forEach(insight => {
        expect(screen.getByTestId(`insight-${insight.id}`)).toHaveTextContent(insight.title);
      });
    });

    it('should handle insights loading error', async () => {
      const { user } = renderWithProviders(<HierarchyStoreTestComponent />, {
        handlers: [
          http.get('/api/v2/timeline/nodes/:nodeId/insights', () => {
            return HttpResponse.json(
              { error: 'Failed to load insights' },
              { status: 500 }
            );
          }),
        ],
      });

      await user.click(screen.getByText('Load Node 1 Insights'));

      // The store should handle the error gracefully
      expect(screen.queryByTestId('insights-node-1')).not.toBeInTheDocument();
    });
  });

  describe('Tree Building', () => {
    it('should build tree structure correctly', async () => {
      const mockNodes = [
        createMockHierarchyNodes(1, { overrides: { id: 'root', parentId: null } })[0],
        createMockHierarchyNodes(1, { overrides: { id: 'child1', parentId: 'root' } })[0],
        createMockHierarchyNodes(1, { overrides: { id: 'child2', parentId: 'root' } })[0],
      ];

      const { user } = renderWithProviders(<HierarchyStoreTestComponent />, {
        handlers: [
          http.get('/api/v2/timeline/nodes', () => {
            return HttpResponse.json({
              success: true,
              nodes: mockNodes,
            });
          }),
        ],
      });

      await user.click(screen.getByText('Load Nodes'));

      await waitFor(() => {
        expect(screen.getByTestId('tree-nodes')).toHaveTextContent('Tree Nodes: 3');
      });

      // Tree should have 2 edges (root->child1, root->child2)
      expect(screen.getByTestId('tree-edges')).toHaveTextContent('Tree Edges: 2');
    });
  });

  describe('Utility Methods', () => {
    it('should get root nodes correctly', () => {
      const nodes = [
        createMockHierarchyNodes(1, { overrides: { id: 'root1', parentId: null } })[0],
        createMockHierarchyNodes(1, { overrides: { id: 'root2', parentId: null } })[0],
        createMockHierarchyNodes(1, { overrides: { id: 'child', parentId: 'root1' } })[0],
      ];

      renderWithProviders(<HierarchyStoreTestComponent />, {
        hierarchyState: {
          nodes,
          hasData: true,
        },
      });

      const rootNodes = useHierarchyStore.getState().getRootNodes();
      expect(rootNodes).toHaveLength(2);
      expect(rootNodes.map(n => n.id)).toContain('root1');
      expect(rootNodes.map(n => n.id)).toContain('root2');
    });

    it('should get node by id', () => {
      const nodes = createMockHierarchyNodes(3);

      renderWithProviders(<HierarchyStoreTestComponent />, {
        hierarchyState: {
          nodes,
          hasData: true,
        },
      });

      const node = useHierarchyStore.getState().getNodeById(nodes[1].id);
      expect(node).toBeDefined();
      expect(node?.id).toBe(nodes[1].id);

      const notFound = useHierarchyStore.getState().getNodeById('non-existent');
      expect(notFound).toBeUndefined();
    });

    it('should get children correctly', () => {
      const nodes = [
        createMockHierarchyNodes(1, { overrides: { id: 'parent', parentId: null } })[0],
        createMockHierarchyNodes(1, { overrides: { id: 'child1', parentId: 'parent' } })[0],
        createMockHierarchyNodes(1, { overrides: { id: 'child2', parentId: 'parent' } })[0],
      ];

      renderWithProviders(<HierarchyStoreTestComponent />, {
        hierarchyState: {
          nodes,
          hasData: true,
        },
      });

      const children = useHierarchyStore.getState().getChildren('parent');
      expect(children).toHaveLength(2);
      expect(children.map(c => c.id)).toContain('child1');
      expect(children.map(c => c.id)).toContain('child2');
    });

    it('should check if node has children', () => {
      const nodes = [
        createMockHierarchyNodes(1, { overrides: { id: 'parent', parentId: null } })[0],
        createMockHierarchyNodes(1, { overrides: { id: 'child', parentId: 'parent' } })[0],
        createMockHierarchyNodes(1, { overrides: { id: 'leaf', parentId: null } })[0],
      ];

      renderWithProviders(<HierarchyStoreTestComponent />, {
        hierarchyState: {
          nodes,
          hasData: true,
        },
      });

      expect(useHierarchyStore.getState().hasChildren('parent')).toBe(true);
      expect(useHierarchyStore.getState().hasChildren('leaf')).toBe(false);
      expect(useHierarchyStore.getState().hasChildren('child')).toBe(false);
    });
  });

  describe('Auth Integration', () => {
    it('should reset selection when loading new timeline', async () => {
      const mockNodes = createMockHierarchyNodes(2);

      const { user } = renderWithProviders(<HierarchyStoreTestComponent />, {
        hierarchyState: {
          selectedNodeId: 'old-selection',
          focusedNodeId: 'old-focus',
          showPanel: true,
          panelMode: 'edit',
        },
        handlers: [
          http.get('/api/v2/timeline/nodes', () => {
            return HttpResponse.json({
              success: true,
              nodes: mockNodes,
            });
          }),
        ],
      });

      expect(screen.getByTestId('selected-node')).toHaveTextContent('old-selection');
      expect(screen.getByTestId('focused-node')).toHaveTextContent('old-focus');
      expect(screen.getByTestId('show-panel')).toHaveTextContent('Panel Open');
      expect(screen.getByTestId('panel-mode')).toHaveTextContent('edit');

      await user.click(screen.getByText('Load Nodes'));

      await waitFor(() => {
        expect(screen.queryByTestId('selected-node')).not.toBeInTheDocument();
      });

      expect(screen.queryByTestId('focused-node')).not.toBeInTheDocument();
      expect(screen.getByTestId('show-panel')).toHaveTextContent('Panel Closed');
      expect(screen.getByTestId('panel-mode')).toHaveTextContent('view');
    });
  });
});
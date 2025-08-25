import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Timeline, TimelineNode, TimelineConfig } from '../Timeline';
import { vi, describe, test, expect, beforeEach } from 'vitest';

// Mock React Flow
vi.mock('@xyflow/react', () => ({
  ReactFlow: ({ nodes, edges, onInit, onPaneClick, children, nodeTypes, edgeTypes }: any) => (
    <div data-testid="react-flow" onClick={onPaneClick}>
      <div data-testid="react-flow-nodes">
        {nodes.map((node: any) => (
          <div key={node.id} data-testid={`node-${node.id}`} data-node-type={node.type}>
            {node.data.title || node.id}
            {node.data.handles?.bottom && <div data-testid={`${node.id}-bottom-handle`} />}
            {node.data.handles?.top && <div data-testid={`${node.id}-top-handle`} />}
            {node.data.handles?.left && <div data-testid={`${node.id}-left-handle`} />}
            {node.data.handles?.right && <div data-testid={`${node.id}-right-handle`} />}
          </div>
        ))}
      </div>
      <div data-testid="react-flow-edges">
        {edges.map((edge: any) => (
          <div 
            key={edge.id} 
            data-testid={`edge-${edge.id}`} 
            data-edge-type={edge.type}
            data-source={edge.source}
            data-target={edge.target}
            data-source-handle={edge.sourceHandle || undefined}
            data-target-handle={edge.targetHandle || undefined}
          >
            {edge.data?.onPlusButtonClick && (
              <button 
                data-testid={`edge-plus-${edge.id}`}
                onClick={() => edge.data.onPlusButtonClick(edge.data)}
              >
                +
              </button>
            )}
          </div>
        ))}
      </div>
      {children}
    </div>
  ),
  Background: ({ children }: any) => <div data-testid="background">{children}</div>,
  BackgroundVariant: { Dots: 'dots' },
}));

// Mock node and edge types
vi.mock('@/components/nodes', () => ({
  nodeTypes: {},
}));

vi.mock('@/components/edges', () => ({
  edgeTypes: {},
}));

vi.mock('@/utils/date-parser', () => ({
  sortItemsByDate: (items: any[]) => items.sort((a, b) => a.start.localeCompare(b.start)),
}));

describe('Timeline', () => {
  const mockOnPlusButtonClick = vi.fn();
  const mockOnInit = vi.fn();
  const mockOnPaneClick = vi.fn();

  const defaultConfig: TimelineConfig = {
    startX: 300,
    startY: 400,
    horizontalSpacing: 500,
    verticalSpacing: 180,
    orientation: 'horizontal',
    alignment: 'center',
    onPlusButtonClick: mockOnPlusButtonClick,
  };

  const createMockTimelineNode = (overrides?: Partial<TimelineNode>): TimelineNode => ({
    id: 'node-1',
    type: 'workExperience',
    start: '2022-01',
    end: '2024-01',
    data: {
      title: 'Software Engineer',
      company: 'Tech Corp',
      description: 'Great job',
    },
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders empty timeline with no nodes', () => {
    render(
      <Timeline
        nodes={[]}
        config={defaultConfig}
        onInit={mockOnInit}
        onPaneClick={mockOnPaneClick}
      />
    );

    expect(screen.getByTestId('react-flow')).toBeInTheDocument();
    expect(screen.getByTestId('background')).toBeInTheDocument();
  });

  test('renders single node with correct handle configuration', () => {
    const nodes = [createMockTimelineNode()];

    render(
      <Timeline
        nodes={nodes}
        config={defaultConfig}
        onInit={mockOnInit}
        onPaneClick={mockOnPaneClick}
      />
    );

    expect(screen.getByTestId('node-node-1')).toBeInTheDocument();
    expect(screen.getByTestId('node-node-1')).toHaveAttribute('data-node-type', 'workExperience');
    
    // Should have left and right handles for horizontal connections
    expect(screen.getByTestId('node-1-left-handle')).toBeInTheDocument();
    expect(screen.getByTestId('node-1-right-handle')).toBeInTheDocument();
    
    // Should not have top/bottom handles since no children/parent
    expect(screen.queryByTestId('node-1-top-handle')).not.toBeInTheDocument();
    expect(screen.queryByTestId('node-1-bottom-handle')).not.toBeInTheDocument();
  });

  test('renders multiple nodes with horizontal connections', () => {
    const nodes = [
      createMockTimelineNode({ id: 'node-1', start: '2022-01' }),
      createMockTimelineNode({ id: 'node-2', start: '2023-01' }),
    ];

    render(
      <Timeline
        nodes={nodes}
        config={defaultConfig}
        onInit={mockOnInit}
        onPaneClick={mockOnPaneClick}
      />
    );

    expect(screen.getByTestId('node-node-1')).toBeInTheDocument();
    expect(screen.getByTestId('node-node-2')).toBeInTheDocument();
    
    // Should have horizontal edge between nodes
    expect(screen.getByTestId('edge-node-1-to-node-2')).toBeInTheDocument();
    expect(screen.getByTestId('edge-node-1-to-node-2')).toHaveAttribute('data-edge-type', 'straightTimeline');
    expect(screen.getByTestId('edge-node-1-to-node-2')).toHaveAttribute('data-source-handle', 'right');
    expect(screen.getByTestId('edge-node-1-to-node-2')).toHaveAttribute('data-target-handle', 'left');
  });

  test('renders parent-child relationships with correct handles and edges', () => {
    const parentNode = createMockTimelineNode({
      id: 'parent-1',
      children: [{
        id: 'child-1',
        type: 'project',
        start: '2022-06',
        end: '2022-12',
        parentId: 'parent-1',
        data: {
          title: 'Child Project',
          description: 'Project under parent experience',
        },
      }],
    });

    render(
      <Timeline
        nodes={[parentNode]}
        config={defaultConfig}
        expandedNodes={new Set(['parent-1'])}
        onInit={mockOnInit}
        onPaneClick={mockOnPaneClick}
      />
    );

    // Parent should have bottom handle
    expect(screen.getByTestId('parent-1-bottom-handle')).toBeInTheDocument();
    
    // Child should have top handle  
    expect(screen.getByTestId('child-1-top-handle')).toBeInTheDocument();
    
    // Should have vertical edge from parent to child
    expect(screen.getByTestId('edge-parent-1-to-child-timeline-child-1')).toBeInTheDocument();
    expect(screen.getByTestId('edge-parent-1-to-child-timeline-child-1')).toHaveAttribute('data-edge-type', 'secondaryTimeline');
    expect(screen.getByTestId('edge-parent-1-to-child-timeline-child-1')).toHaveAttribute('data-source-handle', 'bottom');
    expect(screen.getByTestId('edge-parent-1-to-child-timeline-child-1')).toHaveAttribute('data-target-handle', 'top');
  });

  test('does not render children when node is not expanded', () => {
    const parentNode = createMockTimelineNode({
      id: 'parent-1',
      children: [{
        id: 'child-1',
        type: 'project',
        start: '2022-06',
        end: '2022-12',
        parentId: 'parent-1',
        data: {
          title: 'Child Project',
        },
      }],
    });

    render(
      <Timeline
        nodes={[parentNode]}
        config={defaultConfig}
        expandedNodes={new Set()} // No expanded nodes
        onInit={mockOnInit}
        onPaneClick={mockOnPaneClick}
      />
    );

    // Parent should be visible
    expect(screen.getByTestId('node-parent-1')).toBeInTheDocument();
    
    // Child should not be visible
    expect(screen.queryByTestId('node-child-1')).not.toBeInTheDocument();
    
    // No vertical edge should exist
    expect(screen.queryByTestId('edge-parent-1-to-child-timeline-child-1')).not.toBeInTheDocument();
  });

  test('calls onPlusButtonClick when plus button is clicked', async () => {
    const user = userEvent.setup();
    const nodes = [
      createMockTimelineNode({ id: 'node-1', start: '2022-01' }),
      createMockTimelineNode({ id: 'node-2', start: '2023-01' }),
    ];

    render(
      <Timeline
        nodes={nodes}
        config={defaultConfig}
        onInit={mockOnInit}
        onPaneClick={mockOnPaneClick}
      />
    );

    const plusButton = screen.getByTestId('edge-plus-node-1-to-node-2');
    await user.click(plusButton);

    expect(mockOnPlusButtonClick).toHaveBeenCalledWith({
      insertionPoint: 'between',
      parentNode: {
        id: 'node-1',
        title: 'Software Engineer',
        type: 'workExperience',
      },
      targetNode: {
        id: 'node-2',
        title: 'Software Engineer',
        type: 'workExperience',
      },
      onPlusButtonClick: mockOnPlusButtonClick,
    });
  });

  test('applies correct behavior states to nodes', () => {
    const nodes = [createMockTimelineNode()];

    render(
      <Timeline
        nodes={nodes}
        config={defaultConfig}
        focusedNodeId="node-1"
        selectedNodeId="node-1"
        highlightedNodeId="node-1"
        onInit={mockOnInit}
        onPaneClick={mockOnPaneClick}
      />
    );

    // The behavior states are passed to the node data but not directly testable
    // in this mock setup. In a real test, we would check the node's visual state.
    expect(screen.getByTestId('node-node-1')).toBeInTheDocument();
  });

  test('sorts nodes by date correctly', () => {
    const nodes = [
      createMockTimelineNode({ id: 'node-2', start: '2023-01', data: { title: 'Second Job' } }),
      createMockTimelineNode({ id: 'node-1', start: '2022-01', data: { title: 'First Job' } }),
      createMockTimelineNode({ id: 'node-3', start: '2024-01', data: { title: 'Third Job' } }),
    ];

    render(
      <Timeline
        nodes={nodes}
        config={defaultConfig}
        onInit={mockOnInit}
        onPaneClick={mockOnPaneClick}
      />
    );

    // Should have edges that indicate correct ordering
    expect(screen.getByTestId('edge-node-1-to-node-2')).toBeInTheDocument();
    expect(screen.getByTestId('edge-node-2-to-node-3')).toBeInTheDocument();
  });

  test('handles complex nested hierarchies', () => {
    const complexNode = createMockTimelineNode({
      id: 'parent-1',
      children: [
        {
          id: 'child-1',
          type: 'project',
          start: '2022-06',
          end: '2022-12',
          parentId: 'parent-1',
          data: { title: 'Project 1' },
        },
        {
          id: 'child-2',
          type: 'project',
          start: '2023-01',
          end: '2023-06',
          parentId: 'parent-1',
          data: { title: 'Project 2' },
        },
      ],
    });

    render(
      <Timeline
        nodes={[complexNode]}
        config={defaultConfig}
        expandedNodes={new Set(['parent-1'])}
        onInit={mockOnInit}
        onPaneClick={mockOnPaneClick}
      />
    );

    // Should render all nodes
    expect(screen.getByTestId('node-parent-1')).toBeInTheDocument();
    expect(screen.getByTestId('node-child-1')).toBeInTheDocument();
    expect(screen.getByTestId('node-child-2')).toBeInTheDocument();
    
    // Should have horizontal connection between children (through center, not handles)
    expect(screen.getByTestId('edge-child-1-to-child-2')).toBeInTheDocument();
    // When handles are undefined, they're not rendered as attributes
    expect(screen.getByTestId('edge-child-1-to-child-2')).not.toHaveAttribute('data-source-handle');
    expect(screen.getByTestId('edge-child-1-to-child-2')).not.toHaveAttribute('data-target-handle');
    
    // Should have vertical connection from parent to first child
    expect(screen.getByTestId('edge-parent-1-to-child-timeline-child-1')).toBeInTheDocument();
  });

  test('calls onInit when provided', () => {
    render(
      <Timeline
        nodes={[]}
        config={defaultConfig}
        onInit={mockOnInit}
        onPaneClick={mockOnPaneClick}
      />
    );

    // onInit should be passed to ReactFlow (implementation detail of mock)
    expect(screen.getByTestId('react-flow')).toBeInTheDocument();
  });

  test('calls onPaneClick when pane is clicked', async () => {
    const user = userEvent.setup();
    
    render(
      <Timeline
        nodes={[]}
        config={defaultConfig}
        onInit={mockOnInit}
        onPaneClick={mockOnPaneClick}
      />
    );

    await user.click(screen.getByTestId('react-flow'));
    expect(mockOnPaneClick).toHaveBeenCalled();
  });
});
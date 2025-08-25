import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Timeline, TimelineNode, TimelineConfig } from '../timeline/Timeline';
import { vi, describe, test, expect, beforeEach } from 'vitest';

// Mock React Flow
vi.mock('@xyflow/react', () => ({
  ReactFlow: ({ nodes, edges, onInit, onPaneClick, children, nodeTypes, edgeTypes }: any) => (
    <div data-testid="react-flow" onClick={onPaneClick}>
      <div data-testid="react-flow-nodes">
        {nodes.map((node: any) => (
          <div key={node.id} data-testid={`node-${node.id}`} data-node-type={node.type}>
            {node.data.title || node.id}
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
          >
            {edge.data?.onPlusButtonClick && (
              <button 
                data-testid={`timeline-end-plus-button-${edge.id}`}
                onClick={() => edge.data.onPlusButtonClick(edge.data)}
              >
                + {edge.data.insertionPoint}
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

describe('Timeline Plus Buttons', () => {
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
    },
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('adds start and end plus buttons for root timeline', () => {
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

    // Should have both start and end plus buttons for root timeline
    expect(screen.getByTestId('edge-timeline-start-plus-level-0')).toBeInTheDocument();
    expect(screen.getByTestId('edge-timeline-end-plus-level-0')).toBeInTheDocument();
    
    // Should use dotted timeline edge type
    expect(screen.getByTestId('edge-timeline-start-plus-level-0')).toHaveAttribute('data-edge-type', 'dottedTimeline');
    expect(screen.getByTestId('edge-timeline-end-plus-level-0')).toHaveAttribute('data-edge-type', 'dottedTimeline');
  });

  test('adds only end plus button for child timeline', () => {
    const parentNode = createMockTimelineNode({
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
        nodes={[parentNode]}
        config={defaultConfig}
        expandedNodes={new Set(['parent-1'])}
        onInit={mockOnInit}
        onPaneClick={mockOnPaneClick}
      />
    );

    // Root timeline should have both start and end buttons
    expect(screen.getByTestId('edge-timeline-start-plus-level-0')).toBeInTheDocument();
    expect(screen.getByTestId('edge-timeline-end-plus-level-0')).toBeInTheDocument();
    
    // Child timeline should only have end button (no start button)
    expect(screen.queryByTestId('edge-timeline-start-plus-level-1-parent-parent-1')).not.toBeInTheDocument();
    expect(screen.getByTestId('edge-timeline-end-plus-level-1-parent-parent-1')).toBeInTheDocument();
    
    // Child timeline end button should use dotted edge type
    expect(screen.getByTestId('edge-timeline-end-plus-level-1-parent-parent-1')).toHaveAttribute('data-edge-type', 'dottedTimeline');
  });

  test('start plus button triggers onPlusButtonClick with before insertion point', async () => {
    const user = userEvent.setup();
    const nodes = [createMockTimelineNode()];

    render(
      <Timeline
        nodes={nodes}
        config={defaultConfig}
        onInit={mockOnInit}
        onPaneClick={mockOnPaneClick}
      />
    );

    const startPlusButton = screen.getByTestId('timeline-end-plus-button-timeline-start-plus-level-0');
    await user.click(startPlusButton);

    expect(mockOnPlusButtonClick).toHaveBeenCalledWith({
      insertionPoint: 'before',
      targetNode: {
        id: 'node-1',
        title: 'Software Engineer',
        type: 'workExperience',
      },
      onPlusButtonClick: mockOnPlusButtonClick,
    });
  });

  test('end plus button triggers onPlusButtonClick with after insertion point', async () => {
    const user = userEvent.setup();
    const nodes = [createMockTimelineNode()];

    render(
      <Timeline
        nodes={nodes}
        config={defaultConfig}
        onInit={mockOnInit}
        onPaneClick={mockOnPaneClick}
      />
    );

    const endPlusButton = screen.getByTestId('timeline-end-plus-button-timeline-end-plus-level-0');
    await user.click(endPlusButton);

    expect(mockOnPlusButtonClick).toHaveBeenCalledWith({
      insertionPoint: 'after',
      parentNode: {
        id: 'node-1',
        title: 'Software Engineer',
        type: 'workExperience',
      },
      onPlusButtonClick: mockOnPlusButtonClick,
    });
  });

  test('child timeline end plus button works correctly', async () => {
    const user = userEvent.setup();
    const parentNode = createMockTimelineNode({
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
      ],
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

    const childEndPlusButton = screen.getByTestId('timeline-end-plus-button-timeline-end-plus-level-1-parent-parent-1');
    await user.click(childEndPlusButton);

    expect(mockOnPlusButtonClick).toHaveBeenCalledWith({
      insertionPoint: 'after',
      parentNode: {
        id: 'child-1',
        title: 'Project 1',
        type: 'project',
      },
      onPlusButtonClick: mockOnPlusButtonClick,
    });
  });

  test('plus buttons connect to helper nodes correctly', () => {
    const nodes = [createMockTimelineNode()];

    render(
      <Timeline
        nodes={nodes}
        config={defaultConfig}
        onInit={mockOnInit}
        onPaneClick={mockOnPaneClick}
      />
    );

    // Helper nodes should be created
    expect(screen.getByTestId('node-timeline-start-helper-level-0')).toBeInTheDocument();
    expect(screen.getByTestId('node-timeline-end-helper-level-0')).toBeInTheDocument();

    // Start edge should connect helper to first node
    expect(screen.getByTestId('edge-timeline-start-plus-level-0')).toHaveAttribute('data-source', 'timeline-start-helper-level-0');
    expect(screen.getByTestId('edge-timeline-start-plus-level-0')).toHaveAttribute('data-target', 'node-1');

    // End edge should connect last node to helper
    expect(screen.getByTestId('edge-timeline-end-plus-level-0')).toHaveAttribute('data-source', 'node-1');
    expect(screen.getByTestId('edge-timeline-end-plus-level-0')).toHaveAttribute('data-target', 'timeline-end-helper-level-0');
  });

  test('multiple timelines have independent plus buttons', () => {
    const parentNode1 = createMockTimelineNode({
      id: 'parent-1',
      children: [
        {
          id: 'child-1-1',
          type: 'project',
          start: '2022-06',
          parentId: 'parent-1',
          data: { title: 'Project 1.1' },
        },
      ],
    });

    const parentNode2 = createMockTimelineNode({
      id: 'parent-2',
      start: '2023-01',
      children: [
        {
          id: 'child-2-1',
          type: 'project',
          start: '2023-06',
          parentId: 'parent-2',
          data: { title: 'Project 2.1' },
        },
      ],
    });

    render(
      <Timeline
        nodes={[parentNode1, parentNode2]}
        config={defaultConfig}
        expandedNodes={new Set(['parent-1', 'parent-2'])}
        onInit={mockOnInit}
        onPaneClick={mockOnPaneClick}
      />
    );

    // Root timeline plus buttons
    expect(screen.getByTestId('edge-timeline-start-plus-level-0')).toBeInTheDocument();
    expect(screen.getByTestId('edge-timeline-end-plus-level-0')).toBeInTheDocument();

    // Child timeline plus buttons (only end buttons) - each child timeline has unique parent ID
    expect(screen.queryByTestId('edge-timeline-start-plus-level-1-parent-parent-1')).not.toBeInTheDocument();
    expect(screen.queryByTestId('edge-timeline-start-plus-level-1-parent-parent-2')).not.toBeInTheDocument();
    expect(screen.getByTestId('edge-timeline-end-plus-level-1-parent-parent-1')).toBeInTheDocument();
    expect(screen.getByTestId('edge-timeline-end-plus-level-1-parent-parent-2')).toBeInTheDocument();
  });

  test('adds plus buttons below leaf nodes (nodes without children)', () => {
    const leafNode1 = createMockTimelineNode({ id: 'leaf-1', start: '2022-01' });
    const leafNode2 = createMockTimelineNode({ id: 'leaf-2', start: '2023-01' });
    const nodes = [leafNode1, leafNode2];

    render(
      <Timeline
        nodes={nodes}
        config={defaultConfig}
        onInit={mockOnInit}
        onPaneClick={mockOnPaneClick}
      />
    );

    // Should have leaf plus buttons for each leaf node
    expect(screen.getByTestId('edge-leaf-plus-leaf-1')).toBeInTheDocument();
    expect(screen.getByTestId('edge-leaf-plus-leaf-2')).toBeInTheDocument();
    
    // Should use dotted timeline edge type
    expect(screen.getByTestId('edge-leaf-plus-leaf-1')).toHaveAttribute('data-edge-type', 'dottedTimeline');
    expect(screen.getByTestId('edge-leaf-plus-leaf-2')).toHaveAttribute('data-edge-type', 'dottedTimeline');

    // Helper nodes should be created
    expect(screen.getByTestId('node-leaf-helper-leaf-1')).toBeInTheDocument();
    expect(screen.getByTestId('node-leaf-helper-leaf-2')).toBeInTheDocument();

    // Leaf edges should connect node to helper (vertical connection)
    expect(screen.getByTestId('edge-leaf-plus-leaf-1')).toHaveAttribute('data-source', 'leaf-1');
    expect(screen.getByTestId('edge-leaf-plus-leaf-1')).toHaveAttribute('data-target', 'leaf-helper-leaf-1');
  });

  test('leaf node plus button triggers onPlusButtonClick with child insertion point', async () => {
    const user = userEvent.setup();
    const leafNode = createMockTimelineNode({ id: 'leaf-node' });

    render(
      <Timeline
        nodes={[leafNode]}
        config={defaultConfig}
        onInit={mockOnInit}
        onPaneClick={mockOnPaneClick}
      />
    );

    const leafPlusButton = screen.getByTestId('timeline-end-plus-button-leaf-plus-leaf-node');
    await user.click(leafPlusButton);

    expect(mockOnPlusButtonClick).toHaveBeenCalledWith({
      insertionPoint: 'child',
      parentNode: {
        id: 'leaf-node',
        title: 'Software Engineer',
        type: 'workExperience',
      },
      onPlusButtonClick: mockOnPlusButtonClick,
    });
  });

  test('does not add leaf plus buttons to nodes with children', () => {
    const parentNode = createMockTimelineNode({
      id: 'parent-with-children',
      children: [
        {
          id: 'child-1',
          type: 'project',
          start: '2022-06',
          end: '2022-12',
          parentId: 'parent-with-children',
          data: { title: 'Project 1' },
        },
      ],
    });

    render(
      <Timeline
        nodes={[parentNode]}
        config={defaultConfig}
        expandedNodes={new Set(['parent-with-children'])}
        onInit={mockOnInit}
        onPaneClick={mockOnPaneClick}
      />
    );

    // Parent node should NOT have a leaf plus button (it has children)
    expect(screen.queryByTestId('edge-leaf-plus-parent-with-children')).not.toBeInTheDocument();
    expect(screen.queryByTestId('node-leaf-helper-parent-with-children')).not.toBeInTheDocument();

    // Child node should have a leaf plus button (it's a leaf)
    expect(screen.getByTestId('edge-leaf-plus-child-1')).toBeInTheDocument();
    expect(screen.getByTestId('node-leaf-helper-child-1')).toBeInTheDocument();
  });
});
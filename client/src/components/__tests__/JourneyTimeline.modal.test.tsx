import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { JourneyTimeline } from '../JourneyTimeline';
import { vi, describe, test, expect, beforeEach } from 'vitest';
import { createMockProfileData } from '../../test/mock-data';

// Mock all the stores
const mockProfileData = createMockProfileData();
const mockRefreshProfileData = vi.fn();
const mockSetFocusedExperience = vi.fn();
const mockSetReactFlowInstance = vi.fn();
const mockAutoFitTimeline = vi.fn();

vi.mock('@/stores/journey-store', () => ({
  useJourneyStore: () => ({
    profileData: mockProfileData,
    refreshProfileData: mockRefreshProfileData,
    focusedExperienceId: null,
    setFocusedExperience: mockSetFocusedExperience,
    selectedNodeId: null,
    highlightedNodeId: null,
    isNodeExpanded: vi.fn(() => false),
    nodeExpansionState: {},
  }),
}));

vi.mock('@/stores/ui-coordinator-store', () => ({
  useUICoordinatorStore: () => ({
    setReactFlowInstance: mockSetReactFlowInstance,
    autoFitTimeline: mockAutoFitTimeline,
  }),
}));

vi.mock('@/stores/chat-toggle-store', () => ({
  useChatToggleStore: () => ({
    chatEnabled: false,
    setChatEnabled: vi.fn(),
  }),
}));

// Mock the Timeline component to capture plus button clicks
const mockTimelineData = {
  nodes: [
    {
      id: 'edu-1',
      type: 'education',
      position: { x: 300, y: 400 },
      data: { title: 'University of Technology', handles: { left: true, right: true } },
    },
    {
      id: 'exp-1', 
      type: 'workExperience',
      position: { x: 800, y: 400 },
      data: { title: 'Tech Company Inc.', handles: { left: true, right: true, bottom: true } },
    },
  ],
  edges: [
    {
      id: 'edu-1-to-exp-1',
      source: 'edu-1',
      target: 'exp-1',
      type: 'straightTimeline',
      data: {
        insertionPoint: 'between',
        parentNode: { id: 'edu-1', title: 'University of Technology', type: 'education' },
        targetNode: { id: 'exp-1', title: 'Tech Company Inc.', type: 'workExperience' },
      },
    },
  ],
};

vi.mock('../timeline/Timeline', () => ({
  Timeline: ({ config, onInit, onPaneClick }: any) => {
    React.useEffect(() => {
      if (onInit) {
        onInit({ fitView: vi.fn(), getNodes: vi.fn(), getEdges: vi.fn() });
      }
    }, [onInit]);

    return (
      <div data-testid="timeline" onClick={onPaneClick}>
        <div data-testid="timeline-nodes">
          {mockTimelineData.nodes.map((node) => (
            <div key={node.id} data-testid={`timeline-node-${node.id}`}>
              {node.data.title}
            </div>
          ))}
        </div>
        <div data-testid="timeline-edges">
          {mockTimelineData.edges.map((edge) => (
            <div key={edge.id} data-testid={`timeline-edge-${edge.id}`}>
              <button
                data-testid={`plus-button-${edge.id}`}
                onClick={() => config.onPlusButtonClick?.(edge.data)}
              >
                Add between nodes
              </button>
            </div>
          ))}
        </div>
        {/* Mock child timeline plus button */}
        <button
          data-testid="child-timeline-plus-button"
          onClick={() => config.onPlusButtonClick?.({
            insertionPoint: 'branch',
            parentNode: { id: 'exp-1', title: 'Tech Company Inc.', type: 'workExperience' },
            targetNode: null,
          })}
        >
          Add project here
        </button>
      </div>
    );
  },
}));

// Mock the transformers
vi.mock('../timeline/timelineTransformers', () => ({
  transformProfileToTimelineNodes: () => mockTimelineData.nodes,
  createMainTimelineConfig: (onPlusButtonClick: any) => ({
    startX: 300,
    startY: 400,
    horizontalSpacing: 500,
    verticalSpacing: 180,
    orientation: 'horizontal',
    alignment: 'center',
    onPlusButtonClick,
  }),
}));

// Mock the MultiStepAddNodeModal
vi.mock('../modals/MultiStepAddNodeModal', () => ({
  MultiStepAddNodeModal: ({ isOpen, onClose, onSubmit, context, isSubmitting }: any) => {
    if (!isOpen) return null;
    
    return (
      <div data-testid="multi-step-modal">
        <h2>Add New Milestone</h2>
        <p data-testid="context-info">{context?.insertionPoint || 'unknown'}</p>
        <p data-testid="parent-info">{context?.parentNode?.title || 'no parent'}</p>
        
        <form
          data-testid="modal-form"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit({
              type: 'project',
              title: 'Test Project',
              description: 'Test Description',
            });
          }}
        >
          <button type="submit" data-testid="submit-modal" disabled={isSubmitting}>
            {isSubmitting ? 'Submitting...' : 'Submit'}
          </button>
          <button type="button" onClick={onClose} data-testid="close-modal">
            Close
          </button>
        </form>
      </div>
    );
  },
}));

// Mock other components
vi.mock('../journey/JourneyHeader', () => ({
  JourneyHeader: () => <div data-testid="journey-header">Journey Header</div>,
}));

vi.mock('../ui/chat-toggle', () => ({
  ChatToggle: () => <div data-testid="chat-toggle">Chat Toggle</div>,
}));

vi.mock('../NaaviChat', () => ({
  NaaviChat: () => <div data-testid="naavi-chat">Naavi Chat</div>,
}));

// Mock fetch for API calls
global.fetch = vi.fn();

describe('JourneyTimeline Modal Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as any).mockClear();
  });

  test('renders timeline with header and controls', () => {
    render(<JourneyTimeline />);

    expect(screen.getByTestId('journey-header')).toBeInTheDocument();
    expect(screen.getByTestId('timeline')).toBeInTheDocument();
    expect(screen.getByTestId('timeline-node-edu-1')).toBeInTheDocument();
    expect(screen.getByTestId('timeline-node-exp-1')).toBeInTheDocument();
  });

  test('opens modal when plus button is clicked on primary timeline', async () => {
    const user = userEvent.setup();
    
    render(<JourneyTimeline />);

    // Click plus button between nodes
    const plusButton = screen.getByTestId('plus-button-edu-1-to-exp-1');
    await user.click(plusButton);

    // Modal should open
    expect(screen.getByTestId('multi-step-modal')).toBeInTheDocument();
    expect(screen.getByTestId('context-info')).toHaveTextContent('between');
    expect(screen.getByTestId('parent-info')).toHaveTextContent('University of Technology');
  });

  test('opens modal when plus button is clicked on child timeline', async () => {
    const user = userEvent.setup();
    
    render(<JourneyTimeline />);

    // Click plus button for child timeline (project)
    const childPlusButton = screen.getByTestId('child-timeline-plus-button');
    await user.click(childPlusButton);

    // Modal should open
    expect(screen.getByTestId('multi-step-modal')).toBeInTheDocument();
    expect(screen.getByTestId('context-info')).toHaveTextContent('branch');
    expect(screen.getByTestId('parent-info')).toHaveTextContent('Tech Company Inc.');
  });

  test('submits modal form and calls API successfully', async () => {
    const user = userEvent.setup();
    
    // Mock successful API response
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, milestone: { id: 'new-milestone' } }),
    });

    render(<JourneyTimeline />);

    // Open modal
    const plusButton = screen.getByTestId('plus-button-edu-1-to-exp-1');
    await user.click(plusButton);

    // Submit form
    const submitButton = screen.getByTestId('submit-modal');
    await user.click(submitButton);

    // Should call API
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/save-milestone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          milestone: {
            id: expect.stringContaining('project-'),
            type: 'project',
            title: 'Test Project',
            description: 'Test Description',
            company: undefined,
            organization: undefined,
            school: undefined,
            degree: undefined,
            field: undefined,
            startDate: undefined,
            endDate: undefined,
            date: undefined,
            ongoing: true,
            skills: [],
            technologies: [],
            location: undefined,
          },
        }),
      });
    });

    // Should refresh profile data
    expect(mockRefreshProfileData).toHaveBeenCalled();

    // Modal should close
    await waitFor(() => {
      expect(screen.queryByTestId('multi-step-modal')).not.toBeInTheDocument();
    });
  });

  test('handles API error gracefully', async () => {
    const user = userEvent.setup();
    
    // Mock API error
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Server error' }),
    });

    render(<JourneyTimeline />);

    // Open modal and submit
    const plusButton = screen.getByTestId('plus-button-edu-1-to-exp-1');
    await user.click(plusButton);
    
    const submitButton = screen.getByTestId('submit-modal');
    await user.click(submitButton);

    // Should call API but fail
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });

    // Modal should remain open for error handling
    expect(screen.getByTestId('multi-step-modal')).toBeInTheDocument();
  });

  test('prevents modal close during submission', async () => {
    const user = userEvent.setup();
    
    // Mock slow API response
    (global.fetch as any).mockImplementation(() => new Promise(() => {})); // Never resolves

    render(<JourneyTimeline />);

    // Open modal
    const plusButton = screen.getByTestId('plus-button-edu-1-to-exp-1');
    await user.click(plusButton);

    // Start submission
    const submitButton = screen.getByTestId('submit-modal');
    await user.click(submitButton);

    // Try to close modal during submission - should not be allowed
    const closeButton = screen.getByTestId('close-modal');
    await user.click(closeButton);

    // Modal should still be open
    expect(screen.getByTestId('multi-step-modal')).toBeInTheDocument();
  });

  test('closes modal when close button is clicked', async () => {
    const user = userEvent.setup();
    
    render(<JourneyTimeline />);

    // Open modal
    const plusButton = screen.getByTestId('plus-button-edu-1-to-exp-1');
    await user.click(plusButton);

    expect(screen.getByTestId('multi-step-modal')).toBeInTheDocument();

    // Close modal
    const closeButton = screen.getByTestId('close-modal');
    await user.click(closeButton);

    // Modal should close
    await waitFor(() => {
      expect(screen.queryByTestId('multi-step-modal')).not.toBeInTheDocument();
    });
  });

  test('handles different insertion point contexts correctly', async () => {
    const user = userEvent.setup();
    
    render(<JourneyTimeline />);

    // Test 'between' insertion point
    const betweenButton = screen.getByTestId('plus-button-edu-1-to-exp-1');
    await user.click(betweenButton);
    
    expect(screen.getByTestId('context-info')).toHaveTextContent('between');
    
    await user.click(screen.getByTestId('close-modal'));

    // Test 'branch' insertion point (child timeline)
    const branchButton = screen.getByTestId('child-timeline-plus-button');
    await user.click(branchButton);
    
    expect(screen.getByTestId('context-info')).toHaveTextContent('branch');
  });

  test('maintains timeline state after modal operations', async () => {
    const user = userEvent.setup();
    
    // Mock successful API response
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    });

    render(<JourneyTimeline />);

    // Verify initial state
    expect(screen.getByTestId('timeline-node-edu-1')).toBeInTheDocument();
    expect(screen.getByTestId('timeline-node-exp-1')).toBeInTheDocument();

    // Open modal, submit, and close
    await user.click(screen.getByTestId('plus-button-edu-1-to-exp-1'));
    await user.click(screen.getByTestId('submit-modal'));

    await waitFor(() => {
      expect(screen.queryByTestId('multi-step-modal')).not.toBeInTheDocument();
    });

    // Timeline should still be rendered
    expect(screen.getByTestId('timeline')).toBeInTheDocument();
    expect(screen.getByTestId('timeline-node-edu-1')).toBeInTheDocument();
    expect(screen.getByTestId('timeline-node-exp-1')).toBeInTheDocument();
  });
});
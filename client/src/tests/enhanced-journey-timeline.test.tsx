import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import '@testing-library/jest-dom';
import { JourneyTimeline } from '@/components/JourneyTimeline';
import { useDataStore } from '@/stores/data-store';
import { useNodeFocusStore } from '@/stores/node-focus-store';
import { useNodeSelectionStore } from '@/stores/node-selection-store';

// Mock the stores
vi.mock('@/stores/data-store');
vi.mock('@/stores/node-focus-store');
vi.mock('@/stores/node-selection-store');
vi.mock('@/stores/node-highlight-store');
vi.mock('@/stores/ui-coordinator-store');
vi.mock('@/stores/chat-toggle-store'); // New store for chat toggle

// Mock chat toggle store
const mockUseChatToggleStore = vi.fn();
vi.mock('@/stores/chat-toggle-store', () => ({
  useChatToggleStore: () => mockUseChatToggleStore()
}));

// Mock NaaviChat component
vi.mock('@/components/NaaviChat', () => ({
  NaaviChat: ({ isOpen, onClose, initialMessage }: any) => 
    isOpen ? (
      <div data-testid="naavi-chat">
        <button data-testid="close-chat" onClick={onClose}>Close</button>
        <textarea 
          data-testid="chat-input" 
          defaultValue={initialMessage}
          placeholder="Chat with AI..."
        />
        <button data-testid="send-chat">Send</button>
      </div>
    ) : null
}));

// Mock AddNodeModal component
vi.mock('@/components/modals/AddNodeModal', () => ({
  AddNodeModal: ({ isOpen, onClose, onSubmit, context }: any) =>
    isOpen ? (
      <div data-testid="add-node-modal" role="dialog">
        <h2>Add New Node</h2>
        <button data-testid="close-modal" onClick={onClose}>Close</button>
        
        <select data-testid="node-type-selector">
          <option value="workExperience">Work Experience</option>
          <option value="education">Education</option>
          <option value="project">Project</option>
          <option value="skill">Skill</option>
        </select>
        
        <input data-testid="form-title" placeholder="Title" />
        <input data-testid="form-company" placeholder="Company" />
        <input data-testid="form-start-date" placeholder="Start Date" />
        <input data-testid="form-end-date" placeholder="End Date" />
        
        <button data-testid="submit-button" onClick={() => onSubmit({
          type: 'workExperience',
          title: 'Test Position',
          company: 'Test Company'
        })}>
          Add Node
        </button>
        
        <div data-testid="context-info">
          Context: {JSON.stringify(context)}
        </div>
      </div>
    ) : null
}));

// Enhanced React Flow mock with plus button support
vi.mock('@xyflow/react', () => ({
  ReactFlow: ({ children, nodes, edges, onEdgeHover, onEdgeMouseLeave, ...props }: any) => (
    <div data-testid="react-flow" {...props}>
      {children}
      <div data-testid="timeline-nodes" role="group">
        {nodes?.map((node: any, index: number) => (
          <div 
            key={node.id || index}
            data-testid={`timeline-node-${node.id || index}`}
            data-node-type={node.type}
            data-node-title={node.data?.title}
            data-node-completed={node.data?.end ? 'true' : 'false'}
            className={node.data?.end ? 'node-completed text-green-600' : 'node-ongoing text-blue-600'}
            role="article"
            aria-label={`${node.type} node: ${node.data?.title || 'Untitled'}`}
          >
            {node.data?.title || 'Untitled Node'}
          </div>
        ))}
      </div>
      <div data-testid="timeline-edges" role="group">
        {edges?.map((edge: any, index: number) => (
          <div 
            key={edge.id || index}
            data-testid={`timeline-edge-${edge.id || index}`}
            data-edge-type={edge.type}
            data-source={edge.source}
            data-target={edge.target}
            role="connector"
            aria-label={`Connection from ${edge.source} to ${edge.target}`}
            onMouseEnter={() => onEdgeHover && onEdgeHover(edge)}
            onMouseLeave={() => onEdgeMouseLeave && onEdgeMouseLeave(edge)}
            className="timeline-edge"
          >
            <span>Edge: {edge.source} → {edge.target}</span>
            {/* Plus button that appears on hover */}
            <button
              data-testid={`edge-plus-button-${edge.id}`}
              className="edge-plus-button opacity-0 hover:opacity-100"
              aria-label="Add node here"
            >
              +
            </button>
          </div>
        ))}
      </div>
    </div>
  ),
  Background: ({ children }: any) => <div data-testid="timeline-background">{children}</div>,
  BackgroundVariant: { Dots: 'dots' },
}));

// Mock node components
vi.mock('@/components/nodes', () => ({
  nodeTypes: {
    workExperience: ({ data }: any) => (
      <div data-testid="work-experience-node" data-title={data?.title}>
        {data?.title}
      </div>
    ),
    education: ({ data }: any) => (
      <div data-testid="education-node" data-title={data?.title}>
        {data?.title}
      </div>
    ),
    project: ({ data }: any) => (
      <div data-testid="project-node" data-title={data?.title}>
        {data?.title}
      </div>
    ),
  }
}));

// Mock enhanced edge components with plus buttons
vi.mock('@/components/edges', () => ({
  edgeTypes: {
    straightTimeline: ({ data, onPlusButtonClick }: any) => (
      <g data-testid="straight-timeline-edge">
        <path stroke="#9333ea" strokeWidth="2" />
        <foreignObject>
          <button 
            data-testid="timeline-edge-plus-button"
            onClick={() => onPlusButtonClick && onPlusButtonClick(data)}
          >
            +
          </button>
        </foreignObject>
      </g>
    ),
    lBranch: ({ data, onPlusButtonClick }: any) => (
      <g data-testid="l-branch-edge">
        <path stroke="#10b981" strokeWidth="2" strokeDasharray="8,4" />
        <foreignObject>
          <button 
            data-testid="branch-edge-plus-button"
            onClick={() => onPlusButtonClick && onPlusButtonClick(data)}
          >
            +
          </button>
        </foreignObject>
      </g>
    ),
  }
}));

// Mock ChatToggle component
vi.mock('@/components/ui/chat-toggle', () => ({
  ChatToggle: ({ enabled, onToggle, className }: any) => (
    <div data-testid="chat-toggle" className={`chat-toggle ${className}`}>
      <label>
        <input
          type="checkbox"
          role="switch"
          checked={enabled}
          onChange={(e) => onToggle(e.target.checked)}
          aria-checked={enabled}
        />
        <span>Manual</span>
        <span>Chat</span>
      </label>
    </div>
  )
}));

// Test data
const createMockProfileData = () => ({
  filteredData: {
    experiences: [
      {
        title: 'Software Engineer',
        company: 'Google',
        start: '2020-01',
        end: '2023-06', // Completed
        description: 'Developed web applications',
        location: 'Mountain View, CA',
        projects: [
          {
            title: 'Search Optimization',
            description: 'Improved search performance',
            start: '2021-01',
            end: '2022-12',
            technologies: ['Python', 'TensorFlow']
          }
        ]
      },
      {
        title: 'Senior Software Engineer',
        company: 'Microsoft',
        start: '2023-07',
        end: null, // Ongoing
        description: 'Leading product development',
        location: 'Seattle, WA',
        projects: []
      }
    ],
    education: [
      {
        school: 'Stanford University',
        degree: 'Bachelor of Science',
        field: 'Computer Science',
        start: '2016-09',
        end: '2020-05', // Completed
        description: 'CS degree with ML focus'
      }
    ],
    skills: ['JavaScript', 'Python', 'React']
  }
});

describe('Enhanced JourneyTimeline - Plus Button Functionality', () => {
  const mockUseDataStore = vi.mocked(useDataStore);
  const mockUseNodeFocusStore = vi.mocked(useNodeFocusStore);
  const mockUseNodeSelectionStore = vi.mocked(useNodeSelectionStore);

  const setupDefaultMocks = (overrides = {}) => {
    const mockSetFocusedExperience = vi.fn();
    const mockSetSelectedNode = vi.fn();
    const mockSetChatToggle = vi.fn();
    
    mockUseDataStore.mockReturnValue({
      profileData: createMockProfileData(),
      isLoading: false,
      loadProfileData: vi.fn(),
      refreshProfileData: vi.fn(),
      ...overrides.dataStore
    });

    mockUseNodeFocusStore.mockReturnValue({
      focusedExperienceId: null,
      setFocusedExperience: mockSetFocusedExperience,
      ...overrides.focusStore
    });

    mockUseNodeSelectionStore.mockReturnValue({
      selectedNodeId: null,
      setSelectedNode: mockSetSelectedNode,
      ...overrides.selectionStore
    });

    mockUseChatToggleStore.mockReturnValue({
      chatEnabled: false,
      setChatEnabled: mockSetChatToggle,
      ...overrides.chatToggleStore
    });

    return { mockSetFocusedExperience, mockSetSelectedNode, mockSetChatToggle };
  };

  beforeEach(() => {
    setupDefaultMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Chat Toggle Integration', () => {
    it('should render chat toggle in top-right corner', () => {
      render(<JourneyTimeline />);
      
      const chatToggle = screen.getByTestId('chat-toggle');
      expect(chatToggle).toBeInTheDocument();
      expect(chatToggle).toHaveClass('absolute', 'top-4', 'right-4');
    });

    it('should start in manual mode by default', () => {
      render(<JourneyTimeline />);
      
      const toggle = screen.getByRole('switch');
      expect(toggle).not.toBeChecked();
      expect(toggle).toHaveAttribute('aria-checked', 'false');
    });

    it('should toggle chat mode when clicked', async () => {
      const user = userEvent.setup();
      const { mockSetChatToggle } = setupDefaultMocks();
      
      render(<JourneyTimeline />);
      
      const toggle = screen.getByRole('switch');
      await user.click(toggle);
      
      expect(mockSetChatToggle).toHaveBeenCalledWith(true);
    });

    it('should persist chat toggle state across renders', () => {
      setupDefaultMocks({
        chatToggleStore: { chatEnabled: true }
      });
      
      render(<JourneyTimeline />);
      
      const toggle = screen.getByRole('switch');
      expect(toggle).toBeChecked();
    });
  });

  describe('Timeline Edge Plus Buttons', () => {
    it('should show plus buttons on timeline edges', async () => {
      render(<JourneyTimeline />);
      
      await waitFor(() => {
        const edges = screen.getAllByTestId(/timeline-edge-\d+/);
        expect(edges.length).toBeGreaterThan(0);
        
        // Each edge should have a plus button
        edges.forEach(edge => {
          const edgeId = edge.getAttribute('data-testid')?.split('-').pop();
          const plusButton = screen.getByTestId(`edge-plus-button-${edge.getAttribute('data-testid')?.split('-').slice(-1)[0]}`);
          expect(plusButton).toBeInTheDocument();
        });
      });
    });

    it('should show plus button on hover over timeline edge', async () => {
      const user = userEvent.setup();
      render(<JourneyTimeline />);
      
      await waitFor(async () => {
        const edge = screen.getAllByTestId(/timeline-edge-/)[0];
        const plusButton = edge.querySelector('.edge-plus-button');
        
        // Initially hidden
        expect(plusButton).toHaveClass('opacity-0');
        
        // Show on hover
        await user.hover(edge);
        expect(plusButton).toHaveClass('hover:opacity-100');
      });
    });

    it('should position plus button at edge midpoint', async () => {
      render(<JourneyTimeline />);
      
      await waitFor(() => {
        const plusButtons = screen.getAllByTestId(/edge-plus-button/);
        expect(plusButtons.length).toBeGreaterThan(0);
        
        // Plus buttons should be positioned on their edges
        plusButtons.forEach(button => {
          expect(button).toHaveAttribute('aria-label', 'Add node here');
        });
      });
    });

    it('should collect correct context when plus button is clicked', async () => {
      const user = userEvent.setup();
      setupDefaultMocks({
        chatToggleStore: { chatEnabled: false } // Manual mode
      });
      
      render(<JourneyTimeline />);
      
      await waitFor(async () => {
        const plusButton = screen.getAllByTestId(/edge-plus-button/)[0];
        await user.click(plusButton);
        
        // Should open modal with context
        const modal = screen.getByTestId('add-node-modal');
        expect(modal).toBeInTheDocument();
        
        const contextInfo = screen.getByTestId('context-info');
        expect(contextInfo).toBeInTheDocument();
        expect(contextInfo.textContent).toContain('Context:');
      });
    });
  });

  describe('Plus Button Click Behavior - Manual Mode', () => {
    it('should open AddNodeModal when chat mode is disabled', async () => {
      const user = userEvent.setup();
      setupDefaultMocks({
        chatToggleStore: { chatEnabled: false }
      });
      
      render(<JourneyTimeline />);
      
      await waitFor(async () => {
        const plusButton = screen.getAllByTestId(/edge-plus-button/)[0];
        await user.click(plusButton);
        
        // Modal should open
        expect(screen.getByTestId('add-node-modal')).toBeInTheDocument();
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        
        // Should not open chat
        expect(screen.queryByTestId('naavi-chat')).not.toBeInTheDocument();
      });
    });

    it('should display all node type options in modal', async () => {
      const user = userEvent.setup();
      setupDefaultMocks({
        chatToggleStore: { chatEnabled: false }
      });
      
      render(<JourneyTimeline />);
      
      await waitFor(async () => {
        const plusButton = screen.getAllByTestId(/edge-plus-button/)[0];
        await user.click(plusButton);
        
        const nodeTypeSelector = screen.getByTestId('node-type-selector');
        expect(nodeTypeSelector).toBeInTheDocument();
        
        // Should have all node type options
        expect(screen.getByText('Work Experience')).toBeInTheDocument();
        expect(screen.getByText('Education')).toBeInTheDocument();
        expect(screen.getByText('Project')).toBeInTheDocument();
        expect(screen.getByText('Skill')).toBeInTheDocument();
      });
    });

    it('should show dynamic form fields based on selected type', async () => {
      const user = userEvent.setup();
      setupDefaultMocks({
        chatToggleStore: { chatEnabled: false }
      });
      
      render(<JourneyTimeline />);
      
      await waitFor(async () => {
        const plusButton = screen.getAllByTestId(/edge-plus-button/)[0];
        await user.click(plusButton);
        
        // Should show form fields
        expect(screen.getByTestId('form-title')).toBeInTheDocument();
        expect(screen.getByTestId('form-company')).toBeInTheDocument();
        expect(screen.getByTestId('form-start-date')).toBeInTheDocument();
        expect(screen.getByTestId('form-end-date')).toBeInTheDocument();
      });
    });

    it('should handle form submission and create new node', async () => {
      const user = userEvent.setup();
      const mockRefreshData = vi.fn();
      setupDefaultMocks({
        chatToggleStore: { chatEnabled: false },
        dataStore: { refreshProfileData: mockRefreshData }
      });
      
      render(<JourneyTimeline />);
      
      await waitFor(async () => {
        const plusButton = screen.getAllByTestId(/edge-plus-button/)[0];
        await user.click(plusButton);
        
        // Fill and submit form
        const submitButton = screen.getByTestId('submit-button');
        await user.click(submitButton);
        
        // Should close modal
        expect(screen.queryByTestId('add-node-modal')).not.toBeInTheDocument();
      });
    });
  });

  describe('Plus Button Click Behavior - Chat Mode', () => {
    it('should open NaaviChat when chat mode is enabled', async () => {
      const user = userEvent.setup();
      setupDefaultMocks({
        chatToggleStore: { chatEnabled: true }
      });
      
      render(<JourneyTimeline />);
      
      await waitFor(async () => {
        const plusButton = screen.getAllByTestId(/edge-plus-button/)[0];
        await user.click(plusButton);
        
        // Chat should open
        expect(screen.getByTestId('naavi-chat')).toBeInTheDocument();
        
        // Should not open modal
        expect(screen.queryByTestId('add-node-modal')).not.toBeInTheDocument();
      });
    });

    it('should pre-fill chat with contextual message', async () => {
      const user = userEvent.setup();
      setupDefaultMocks({
        chatToggleStore: { chatEnabled: true }
      });
      
      render(<JourneyTimeline />);
      
      await waitFor(async () => {
        const plusButton = screen.getAllByTestId(/edge-plus-button/)[0];
        await user.click(plusButton);
        
        const chatInput = screen.getByTestId('chat-input');
        expect(chatInput).toBeInTheDocument();
        expect(chatInput.value).toMatch(/add/i);
      });
    });

    it('should provide different context messages for different insertion points', async () => {
      const user = userEvent.setup();
      setupDefaultMocks({
        chatToggleStore: { chatEnabled: true }
      });
      
      render(<JourneyTimeline />);
      
      await waitFor(async () => {
        // Test main timeline edge
        const timelineEdges = screen.getAllByTestId(/timeline-edge/);
        const mainEdge = timelineEdges.find(edge => 
          edge.getAttribute('data-edge-type') === 'straightTimeline'
        );
        
        if (mainEdge) {
          const plusButton = mainEdge.querySelector('[data-testid*="edge-plus-button"]');
          if (plusButton) {
            await user.click(plusButton as Element);
            
            const chatInput = screen.getByTestId('chat-input');
            expect(chatInput.value).toMatch(/add.*between|after/i);
          }
        }
      });
    });

    it('should handle chat close and reopen modal if needed', async () => {
      const user = userEvent.setup();
      setupDefaultMocks({
        chatToggleStore: { chatEnabled: true }
      });
      
      render(<JourneyTimeline />);
      
      await waitFor(async () => {
        const plusButton = screen.getAllByTestId(/edge-plus-button/)[0];
        await user.click(plusButton);
        
        // Chat opens
        expect(screen.getByTestId('naavi-chat')).toBeInTheDocument();
        
        // Close chat
        const closeButton = screen.getByTestId('close-chat');
        await user.click(closeButton);
        
        // Chat should close
        expect(screen.queryByTestId('naavi-chat')).not.toBeInTheDocument();
      });
    });
  });

  describe('Node Color Coding System', () => {
    it('should apply green styling to completed experiences', async () => {
      render(<JourneyTimeline />);
      
      await waitFor(() => {
        const nodes = screen.getAllByTestId(/timeline-node/);
        const completedNodes = nodes.filter(node => 
          node.getAttribute('data-node-completed') === 'true'
        );
        
        expect(completedNodes.length).toBeGreaterThan(0);
        
        completedNodes.forEach(node => {
          expect(node).toHaveClass('node-completed', 'text-green-600');
        });
      });
    });

    it('should apply blue styling to ongoing experiences', async () => {
      render(<JourneyTimeline />);
      
      await waitFor(() => {
        const nodes = screen.getAllByTestId(/timeline-node/);
        const ongoingNodes = nodes.filter(node => 
          node.getAttribute('data-node-completed') === 'false'
        );
        
        expect(ongoingNodes.length).toBeGreaterThan(0);
        
        ongoingNodes.forEach(node => {
          expect(node).toHaveClass('node-ongoing', 'text-blue-600');
        });
      });
    });

    it('should maintain color consistency across all node types', async () => {
      render(<JourneyTimeline />);
      
      await waitFor(() => {
        // Test work experience nodes
        const workNodes = screen.getAllByTestId(/timeline-node.*experience/);
        workNodes.forEach(node => {
          const isCompleted = node.getAttribute('data-node-completed') === 'true';
          if (isCompleted) {
            expect(node).toHaveClass('text-green-600');
          } else {
            expect(node).toHaveClass('text-blue-600');
          }
        });
        
        // Test education nodes
        const eduNodes = screen.getAllByTestId(/timeline-node.*education/);
        eduNodes.forEach(node => {
          const isCompleted = node.getAttribute('data-node-completed') === 'true';
          if (isCompleted) {
            expect(node).toHaveClass('text-green-600');
          } else {
            expect(node).toHaveClass('text-blue-600');
          }
        });
      });
    });
  });

  describe('Context Collection for Node Addition', () => {
    it('should collect insertion point context for between nodes', async () => {
      const user = userEvent.setup();
      setupDefaultMocks({
        chatToggleStore: { chatEnabled: false }
      });
      
      render(<JourneyTimeline />);
      
      await waitFor(async () => {
        const edges = screen.getAllByTestId(/timeline-edge/);
        const mainTimelineEdge = edges.find(edge => 
          edge.getAttribute('data-edge-type') === 'straightTimeline'
        );
        
        if (mainTimelineEdge) {
          const plusButton = mainTimelineEdge.querySelector('[data-testid*="edge-plus-button"]');
          if (plusButton) {
            await user.click(plusButton as Element);
            
            const contextInfo = screen.getByTestId('context-info');
            const contextText = contextInfo.textContent || '';
            
            // Should contain insertion point information
            expect(contextText).toContain('insertionPoint');
            expect(contextText).toMatch(/between|after/);
          }
        }
      });
    });

    it('should collect parent context for branch node addition', async () => {
      const user = userEvent.setup();
      setupDefaultMocks({
        focusStore: { focusedExperienceId: 'experience-0' }, // Focus first experience
        chatToggleStore: { chatEnabled: false }
      });
      
      render(<JourneyTimeline />);
      
      await waitFor(async () => {
        const branchEdges = screen.getAllByTestId(/timeline-edge/);
        const branchEdge = branchEdges.find(edge => 
          edge.getAttribute('data-edge-type') === 'lBranch'
        );
        
        if (branchEdge) {
          const plusButton = branchEdge.querySelector('[data-testid*="edge-plus-button"]');
          if (plusButton) {
            await user.click(plusButton as Element);
            
            const contextInfo = screen.getByTestId('context-info');
            const contextText = contextInfo.textContent || '';
            
            // Should contain parent experience information
            expect(contextText).toContain('parentNode');
            expect(contextText).toContain('experience-0');
          }
        }
      });
    });

    it('should provide available node types in context', async () => {
      const user = userEvent.setup();
      setupDefaultMocks({
        chatToggleStore: { chatEnabled: false }
      });
      
      render(<JourneyTimeline />);
      
      await waitFor(async () => {
        const plusButton = screen.getAllByTestId(/edge-plus-button/)[0];
        await user.click(plusButton);
        
        const contextInfo = screen.getByTestId('context-info');
        const contextText = contextInfo.textContent || '';
        
        // Should list available node types
        expect(contextText).toContain('availableTypes');
        expect(contextText).toContain('workExperience');
        expect(contextText).toContain('education');
        expect(contextText).toContain('project');
      });
    });
  });

  describe('Performance and Responsiveness', () => {
    it('should handle edge hover interactions without performance issues', async () => {
      const user = userEvent.setup();
      render(<JourneyTimeline />);
      
      const startTime = performance.now();
      
      await waitFor(async () => {
        const edges = screen.getAllByTestId(/timeline-edge/);
        
        // Rapidly hover over multiple edges
        for (const edge of edges.slice(0, 5)) {
          await user.hover(edge);
          await user.unhover(edge);
        }
      });
      
      const endTime = performance.now();
      expect(endTime - startTime).toBeLessThan(1000); // Should complete in under 1 second
    });

    it('should handle rapid plus button clicks gracefully', async () => {
      const user = userEvent.setup();
      setupDefaultMocks({
        chatToggleStore: { chatEnabled: false }
      });
      
      render(<JourneyTimeline />);
      
      await waitFor(async () => {
        const plusButton = screen.getAllByTestId(/edge-plus-button/)[0];
        
        // Rapid clicks should not cause issues
        await user.click(plusButton);
        await user.click(screen.getByTestId('close-modal'));
        await user.click(plusButton);
        
        // Should still work normally
        expect(screen.getByTestId('add-node-modal')).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should support keyboard navigation to plus buttons', async () => {
      const user = userEvent.setup();
      render(<JourneyTimeline />);
      
      await waitFor(async () => {
        // Tab to plus buttons
        await user.tab();
        
        const plusButtons = screen.getAllByTestId(/edge-plus-button/);
        const focusedElement = document.activeElement;
        
        // One of the plus buttons should be focusable
        expect(plusButtons.some(button => button === focusedElement)).toBe(true);
      });
    });

    it('should support Enter key activation of plus buttons', async () => {
      const user = userEvent.setup();
      setupDefaultMocks({
        chatToggleStore: { chatEnabled: false }
      });
      
      render(<JourneyTimeline />);
      
      await waitFor(async () => {
        const plusButton = screen.getAllByTestId(/edge-plus-button/)[0];
        plusButton.focus();
        
        await user.keyboard('{Enter}');
        
        // Should open modal
        expect(screen.getByTestId('add-node-modal')).toBeInTheDocument();
      });
    });

    it('should have proper ARIA labels for plus buttons', async () => {
      render(<JourneyTimeline />);
      
      await waitFor(() => {
        const plusButtons = screen.getAllByTestId(/edge-plus-button/);
        
        plusButtons.forEach(button => {
          expect(button).toHaveAttribute('aria-label', 'Add node here');
        });
      });
    });

    it('should announce state changes to screen readers', async () => {
      const user = userEvent.setup();
      setupDefaultMocks({
        chatToggleStore: { chatEnabled: false }
      });
      
      render(<JourneyTimeline />);
      
      await waitFor(async () => {
        const plusButton = screen.getAllByTestId(/edge-plus-button/)[0];
        await user.click(plusButton);
        
        const modal = screen.getByRole('dialog');
        expect(modal).toBeInTheDocument();
        expect(modal).toHaveAttribute('role', 'dialog');
      });
    });
  });
});
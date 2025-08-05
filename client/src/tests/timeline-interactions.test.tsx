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

// Mock React Flow components
vi.mock('@xyflow/react', () => ({
  ReactFlow: ({ children, nodes, edges, ...props }: any) => (
    <div data-testid="react-flow" {...props}>
      {children}
      <div data-testid="timeline-nodes" role="group">
        {nodes?.map((node: any, index: number) => (
          <div 
            key={node.id || index}
            data-testid={`timeline-node-${node.id || index}`}
            data-node-type={node.type}
            data-node-title={node.data?.title}
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
          >
            Edge: {edge.source} → {edge.target}
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

// Mock edge components (these will be enhanced with plus buttons)
vi.mock('@/components/edges', () => ({
  edgeTypes: {
    straightTimeline: ({ data }: any) => (
      <div data-testid="straight-timeline-edge" data-edge-data={JSON.stringify(data)}>
        Timeline Edge
      </div>
    ),
    lBranch: ({ data }: any) => (
      <div data-testid="l-branch-edge" data-edge-data={JSON.stringify(data)}>
        Branch Edge
      </div>
    ),
  }
}));

// Mock journey components
vi.mock('@/components/journey/JourneyHeader', () => ({
  JourneyHeader: () => <div data-testid="journey-header">Career Journey</div>
}));

// Test data representing a typical user profile
const createMockProfileData = () => ({
  filteredData: {
    experiences: [
      {
        title: 'Software Engineer',
        company: 'Google',
        start: '2020-01',
        end: '2023-06', // Completed experience (should be green)
        description: 'Developed web applications using React and Node.js',
        location: 'Mountain View, CA',
        projects: [
          {
            title: 'Search Optimization',
            description: 'Improved search algorithm performance by 40%',
            start: '2021-01',
            end: '2022-12',
            technologies: ['Python', 'TensorFlow', 'Elasticsearch']
          },
          {
            title: 'Mobile App Redesign',
            description: 'Led UI/UX redesign for mobile application',
            start: '2022-06',
            end: '2023-03',
            technologies: ['React Native', 'TypeScript', 'Figma']
          }
        ]
      },
      {
        title: 'Senior Software Engineer',
        company: 'Microsoft',
        start: '2023-07',
        end: null, // Ongoing experience (should be blue)
        description: 'Leading product development for cloud services',
        location: 'Seattle, WA',
        projects: [
          {
            title: 'Azure Integration',
            description: 'Building microservices for Azure platform',
            start: '2023-08',
            end: null, // Ongoing project
            technologies: ['C#', 'Azure', 'Docker', 'Kubernetes']
          }
        ]
      }
    ],
    education: [
      {
        school: 'Stanford University',
        degree: 'Bachelor of Science',
        field: 'Computer Science',
        start: '2016-09',
        end: '2020-05', // Completed education (should be green)
        description: 'Focused on machine learning and distributed systems'
      },
      {
        school: 'Stanford University',
        degree: 'Master of Science',
        field: 'Artificial Intelligence', 
        start: '2024-01',
        end: null, // Ongoing education (should be blue)
        description: 'Currently pursuing advanced AI research'
      }
    ],
    skills: ['JavaScript', 'Python', 'React', 'Node.js', 'TypeScript', 'Machine Learning']
  }
});

describe('Timeline Interactions - Enhanced Test Suite', () => {
  const mockUseDataStore = vi.mocked(useDataStore);
  const mockUseNodeFocusStore = vi.mocked(useNodeFocusStore);
  const mockUseNodeSelectionStore = vi.mocked(useNodeSelectionStore);

  // Default mock setup
  const setupDefaultMocks = (overrides = {}) => {
    const mockSetFocusedExperience = vi.fn();
    const mockSetSelectedNode = vi.fn();
    
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

    return { mockSetFocusedExperience, mockSetSelectedNode };
  };

  beforeEach(() => {
    setupDefaultMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Timeline Rendering and Structure', () => {
    it('should render the complete timeline interface', () => {
      render(<JourneyTimeline />);
      
      // Core timeline components should be present
      expect(screen.getByTestId('react-flow')).toBeInTheDocument();
      expect(screen.getByTestId('timeline-background')).toBeInTheDocument();
      expect(screen.getByTestId('journey-header')).toBeInTheDocument();
      expect(screen.getByTestId('timeline-nodes')).toBeInTheDocument();
      expect(screen.getByTestId('timeline-edges')).toBeInTheDocument();
    });

    it('should create nodes for all profile experiences and education', async () => {
      render(<JourneyTimeline />);
      
      await waitFor(() => {
        // Should have nodes for experiences and education
        const nodeContainer = screen.getByTestId('timeline-nodes');
        expect(nodeContainer).toBeInTheDocument();
        
        // Check that we have multiple nodes rendered
        const nodes = screen.getAllByRole('article');
        expect(nodes.length).toBeGreaterThan(0);
      });
    });

    it('should create edges connecting timeline nodes', async () => {
      render(<JourneyTimeline />);
      
      await waitFor(() => {
        const edgeContainer = screen.getByTestId('timeline-edges');
        expect(edgeContainer).toBeInTheDocument();
        
        // Should have connecting edges
        const edges = screen.getAllByRole('connector');
        expect(edges.length).toBeGreaterThan(0);
      });
    });

    it('should handle empty profile data gracefully', () => {
      setupDefaultMocks({
        dataStore: { profileData: null }
      });

      render(<JourneyTimeline />);
      
      // Should still render basic structure without crashing
      expect(screen.getByTestId('react-flow')).toBeInTheDocument();
      expect(screen.getByTestId('timeline-nodes')).toBeInTheDocument();
    });

    it('should show loading state appropriately', () => {
      setupDefaultMocks({
        dataStore: { 
          profileData: null,
          isLoading: true 
        }
      });

      render(<JourneyTimeline />);
      
      // Timeline should still render during loading
      expect(screen.getByTestId('react-flow')).toBeInTheDocument();
    });
  });

  describe('Node Data Structure and Content', () => {
    it('should display work experience nodes with correct information', async () => {
      render(<JourneyTimeline />);
      
      await waitFor(() => {
        // Look for experience nodes by their content
        expect(screen.getByText(/Software Engineer/)).toBeInTheDocument();
        expect(screen.getByText(/Senior Software Engineer/)).toBeInTheDocument();
      });
    });

    it('should display education nodes with correct information', async () => {
      render(<JourneyTimeline />);
      
      await waitFor(() => {
        // Look for education nodes
        expect(screen.getByText(/Bachelor of Science/)).toBeInTheDocument();
        expect(screen.getByText(/Master of Science/)).toBeInTheDocument();
      });
    });

    it('should properly identify completed vs ongoing experiences for color coding', () => {
      const mockData = createMockProfileData();
      
      // Test our data structure expectations
      const experiences = mockData.filteredData.experiences;
      
      // First experience should be completed (has end date)
      expect(experiences[0].end).toBe('2023-06');
      
      // Second experience should be ongoing (no end date)
      expect(experiences[1].end).toBeNull();
      
      // Education should also have completed and ongoing items
      const education = mockData.filteredData.education;
      expect(education[0].end).toBe('2020-05'); // Completed
      expect(education[1].end).toBeNull(); // Ongoing
    });
  });

  describe('Project Node Expansion and Focus States', () => {
    it('should show project nodes when parent experience is focused', async () => {
      const { mockSetFocusedExperience } = setupDefaultMocks({
        focusStore: {
          focusedExperienceId: 'experience-0' // Focus first experience
        }
      });

      render(<JourneyTimeline />);
      
      await waitFor(() => {
        // When focused, should show project nodes
        const nodeContainer = screen.getByTestId('timeline-nodes');
        expect(nodeContainer).toBeInTheDocument();
        
        // Should have more nodes when projects are expanded
        const allNodes = screen.getAllByRole('article');
        expect(allNodes.length).toBeGreaterThan(2); // More than just main timeline nodes
      });
    });

    it('should hide project nodes when no experience is focused', async () => {
      setupDefaultMocks({
        focusStore: {
          focusedExperienceId: null // No focus
        }
      });

      render(<JourneyTimeline />);
      
      await waitFor(() => {
        // Should only show main timeline nodes, not projects
        const allNodes = screen.getAllByRole('article');
        // Exact count depends on implementation, but should be main nodes only
        expect(allNodes.length).toBeGreaterThanOrEqual(2);
      });
    });
  });

  describe('Edge Context and Insertion Points', () => {
    it('should provide context data for inserting nodes between experiences', async () => {
      render(<JourneyTimeline />);
      
      await waitFor(() => {
        // Should have edges connecting experiences
        const edges = screen.getAllByRole('connector');
        expect(edges.length).toBeGreaterThan(0);
        
        // Edges should have source and target information for context
        const firstEdge = edges[0];
        expect(firstEdge).toHaveAttribute('data-source');
        expect(firstEdge).toHaveAttribute('data-target');
      });
    });

    it('should identify different types of insertion points', async () => {
      render(<JourneyTimeline />);
      
      await waitFor(() => {
        // Should have different edge types for different connections
        const timelineEdges = screen.getAllByTestId(/timeline-edge/);
        expect(timelineEdges.length).toBeGreaterThan(0);
        
        // Each edge should have type information
        timelineEdges.forEach(edge => {
          expect(edge).toHaveAttribute('data-edge-type');
        });
      });
    });
  });
});

describe('Enhanced Timeline Features - Integration Tests', () => {
  // These tests will validate new functionality once implemented
  
  describe('Plus Button Functionality', () => {
    it.skip('should show plus button on timeline edge hover', async () => {
      const user = userEvent.setup();
      render(<JourneyTimeline />);
      
      // Find a timeline edge and hover over it
      const edge = screen.getByTestId(/timeline-edge/);
      await user.hover(edge);
      
      // Plus button should appear
      expect(screen.getByTestId('edge-plus-button')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /add node/i })).toBeInTheDocument();
    });

    it.skip('should hide plus button when not hovering', async () => {
      const user = userEvent.setup();
      render(<JourneyTimeline />);
      
      const edge = screen.getByTestId(/timeline-edge/);
      
      // Hover then unhover
      await user.hover(edge);
      await user.unhover(edge);
      
      // Plus button should be hidden
      expect(screen.queryByTestId('edge-plus-button')).not.toBeInTheDocument();
    });

    it.skip('should position plus button at edge midpoint', async () => {
      const user = userEvent.setup();
      render(<JourneyTimeline />);
      
      const edge = screen.getByTestId(/timeline-edge/);
      await user.hover(edge);
      
      const plusButton = screen.getByTestId('edge-plus-button');
      expect(plusButton).toBeInTheDocument();
      
      // Button should have appropriate positioning styles/attributes
      expect(plusButton).toHaveStyle({ position: 'absolute' });
    });
  });

  describe('Chat Toggle Integration', () => {
    it.skip('should render chat toggle in top-right corner', () => {
      render(<JourneyTimeline />);
      
      const chatToggle = screen.getByTestId('chat-toggle');
      expect(chatToggle).toBeInTheDocument();
      expect(chatToggle).toHaveClass(/top.*right/); // Should have top-right positioning
    });

    it.skip('should handle chat mode state changes', async () => {
      const user = userEvent.setup();
      render(<JourneyTimeline />);
      
      const chatToggle = screen.getByTestId('chat-toggle');
      
      // Should start in manual mode
      expect(chatToggle).toHaveAttribute('aria-checked', 'false');
      
      // Click to enable chat mode
      await user.click(chatToggle);
      
      expect(chatToggle).toHaveAttribute('aria-checked', 'true');
    });
  });

  describe('Node Addition Modal', () => {
    it.skip('should open modal when chat mode is disabled', async () => {
      const user = userEvent.setup();
      render(<JourneyTimeline />);
      
      // Ensure chat mode is disabled
      const chatToggle = screen.getByTestId('chat-toggle');
      if (chatToggle.getAttribute('aria-checked') === 'true') {
        await user.click(chatToggle);
      }
      
      // Click plus button
      const edge = screen.getByTestId(/timeline-edge/);
      await user.hover(edge);
      const plusButton = screen.getByTestId('edge-plus-button');
      await user.click(plusButton);
      
      // Modal should open
      expect(screen.getByTestId('add-node-modal')).toBeInTheDocument();
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it.skip('should display all node type options in modal', async () => {
      const user = userEvent.setup();
      render(<JourneyTimeline />);
      
      // Open modal (assuming chat mode is off)
      const edge = screen.getByTestId(/timeline-edge/);
      await user.hover(edge);
      await user.click(screen.getByTestId('edge-plus-button'));
      
      // Should show all node types
      expect(screen.getByText(/work experience/i)).toBeInTheDocument();
      expect(screen.getByText(/education/i)).toBeInTheDocument();
      expect(screen.getByText(/project/i)).toBeInTheDocument();
      expect(screen.getByText(/skill/i)).toBeInTheDocument();
    });
  });

  describe('Chat Integration', () => {
    it.skip('should open NaaviChat with context when chat mode enabled', async () => {
      const user = userEvent.setup();
      render(<JourneyTimeline />);
      
      // Enable chat mode
      const chatToggle = screen.getByTestId('chat-toggle');
      await user.click(chatToggle);
      
      // Click plus button
      const edge = screen.getByTestId(/timeline-edge/);
      await user.hover(edge);
      await user.click(screen.getByTestId('edge-plus-button'));
      
      // NaaviChat should open
      expect(screen.getByTestId('naavi-chat')).toBeInTheDocument();
      
      // Should have pre-filled context message
      const chatInput = screen.getByRole('textbox', { name: /chat input/i });
      expect(chatInput).toHaveValue(/add/i);
    });

    it.skip('should provide different context messages based on insertion point', async () => {
      const user = userEvent.setup();
      render(<JourneyTimeline />);
      
      // Enable chat mode
      await user.click(screen.getByTestId('chat-toggle'));
      
      // Click plus on different types of edges
      const timelineEdge = screen.getByTestId(/straight-timeline-edge/);
      await user.hover(timelineEdge);
      await user.click(screen.getByTestId('edge-plus-button'));
      
      // Should have contextual message
      const chatInput = screen.getByRole('textbox', { name: /chat input/i });
      expect(chatInput.value).toMatch(/add.*between|after/i);
    });
  });

  describe('Color Coding System', () => {
    it.skip('should apply green styling to completed nodes', async () => {
      render(<JourneyTimeline />);
      
      await waitFor(() => {
        // Find nodes with end dates (completed)
        const completedNodes = screen.getAllByRole('article').filter(node => {
          const title = node.getAttribute('data-node-title');
          return title?.includes('Software Engineer') && !title.includes('Senior');
        });
        
        expect(completedNodes.length).toBeGreaterThan(0);
        
        // Should have green styling class
        completedNodes.forEach(node => {
          expect(node).toHaveClass(/green|completed/);
        });
      });
    });

    it.skip('should apply blue styling to ongoing nodes', async () => {
      render(<JourneyTimeline />);
      
      await waitFor(() => {
        // Find nodes without end dates (ongoing)
        const ongoingNodes = screen.getAllByRole('article').filter(node => {
          const title = node.getAttribute('data-node-title');
          return title?.includes('Senior Software Engineer');
        });
        
        expect(ongoingNodes.length).toBeGreaterThan(0);
        
        // Should have blue styling class
        ongoingNodes.forEach(node => {
          expect(node).toHaveClass(/blue|ongoing/);
        });
      });
    });
  });
});

describe('Performance and Accessibility', () => {
  it('should handle large datasets without performance issues', () => {
    // Create large dataset
    const largeProfileData = {
      filteredData: {
        experiences: Array.from({ length: 50 }, (_, i) => ({
          title: `Position ${i}`,
          company: `Company ${i}`,
          start: `20${10 + Math.floor(i / 5)}-01`,
          end: i % 3 === 0 ? null : `20${11 + Math.floor(i / 5)}-12`,
          description: `Description for position ${i}`,
          location: 'Remote',
          projects: []
        })),
        education: Array.from({ length: 10 }, (_, i) => ({
          school: `University ${i}`,
          degree: `Degree ${i}`,
          field: `Field ${i}`,
          start: `20${5 + i}-09`,
          end: `20${9 + i}-05`,
          description: `Education description ${i}`
        })),
        skills: Array.from({ length: 100 }, (_, i) => `Skill ${i}`)
      }
    };

    setupDefaultMocks({
      dataStore: { profileData: largeProfileData }
    });

    const startTime = performance.now();
    render(<JourneyTimeline />);
    const endTime = performance.now();
    
    // Should render within reasonable time
    expect(endTime - startTime).toBeLessThan(2000); // 2 seconds max
  });

  it('should provide appropriate ARIA labels and roles', () => {
    render(<JourneyTimeline />);
    
    // Check for proper ARIA labeling
    expect(screen.getByTestId('timeline-nodes')).toHaveAttribute('role', 'group');
    expect(screen.getByTestId('timeline-edges')).toHaveAttribute('role', 'group');
    
    // Nodes should have proper article roles and labels
    const nodes = screen.getAllByRole('article');
    nodes.forEach(node => {
      expect(node).toHaveAttribute('aria-label');
    });
  });

  it('should handle malformed data gracefully', () => {
    const malformedData = {
      filteredData: {
        experiences: [
          { title: null, company: undefined }, // Missing required fields
          { start: 'invalid-date', end: 'also-invalid' }, // Invalid dates
          {} // Empty object
        ],
        education: null, // Invalid structure
        skills: undefined // Missing array
      }
    };

    setupDefaultMocks({
      dataStore: { profileData: malformedData }
    });

    // Should not crash with malformed data
    expect(() => render(<JourneyTimeline />)).not.toThrow();
  });
});
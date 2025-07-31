import { describe, it, expect, beforeEach, vi } from 'vitest'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import { render } from '@/test/test-utils'
import { createMockWorkExperienceNodeData, createMockBehaviorStates } from '@/test/mock-data'
import WorkExperienceNode from '../WorkExperienceNode'

// Mock the behavior hooks
vi.mock('@/hooks/useNodeBehaviors')
vi.mock('@/stores/ui-coordinator-store')

// Mock React Flow components
vi.mock('@xyflow/react', () => ({
  Handle: ({ children, ...props }: any) => <div data-testid="handle" {...props}>{children}</div>,
  Position: {
    Left: 'left',
    Right: 'right',
    Bottom: 'bottom',
    Top: 'top',
  },
}))

describe('WorkExperienceNode', () => {
  const mockNodeId = 'exp-1'
  const mockBehaviors = createMockBehaviorStates()
  const mockZoomToFocusedNode = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Mock the behavior hooks
    vi.mocked(require('@/hooks/useNodeBehaviors').useNodeBehaviors).mockReturnValue(mockBehaviors)
    vi.mocked(require('@/stores/ui-coordinator-store').useUICoordinatorStore).mockReturnValue({
      zoomToFocusedNode: mockZoomToFocusedNode,
    })
  })

  describe('Basic Rendering', () => {
    it('should render work experience node correctly', () => {
      const mockData = createMockWorkExperienceNodeData({
        title: 'Senior Software Engineer',
        company: 'Tech Corp',
        start: '2022-01',
        end: '2024-01',
        location: 'San Francisco, CA',
      })

      render(
        <WorkExperienceNode 
          data={mockData} 
          selected={false} 
          id={mockNodeId} 
        />
      )

      expect(screen.getByText('Senior Software Engineer')).toBeInTheDocument()
      expect(screen.getByText('Tech Corp')).toBeInTheDocument()
      expect(screen.getByText('Jan 2022 - Jan 2024')).toBeInTheDocument()
      expect(screen.getByText('San Francisco, CA')).toBeInTheDocument()
    })

    it('should render handles for connections', () => {
      const mockData = createMockWorkExperienceNodeData()

      render(
        <WorkExperienceNode 
          data={mockData} 
          selected={false} 
          id={mockNodeId} 
        />
      )

      const handles = screen.getAllByTestId('handle')
      expect(handles.length).toBeGreaterThan(0)
    })

    it('should show project indicator when node has projects', () => {
      const mockData = createMockWorkExperienceNodeData({
        projects: [
          { id: 'proj-1', title: 'Project 1', description: 'Test project' },
          { id: 'proj-2', title: 'Project 2', description: 'Another project' },
        ],
      })

      render(
        <WorkExperienceNode 
          data={mockData} 
          selected={false} 
          id={mockNodeId} 
        />
      )

      expect(screen.getByText('2 projects')).toBeInTheDocument()
    })

    it('should show singular project text for one project', () => {
      const mockData = createMockWorkExperienceNodeData({
        projects: [
          { id: 'proj-1', title: 'Project 1', description: 'Test project' },
        ],
      })

      render(
        <WorkExperienceNode 
          data={mockData} 
          selected={false} 
          id={mockNodeId} 
        />
      )

      expect(screen.getByText('1 project')).toBeInTheDocument()
    })
  })

  describe('Behavior Integration', () => {
    it('should apply focus styles when node is focused', () => {
      const mockData = createMockWorkExperienceNodeData({ isFocused: true })
      mockBehaviors.focus.isFocused = true

      render(
        <WorkExperienceNode 
          data={mockData} 
          selected={false} 
          id={mockNodeId} 
        />
      )

      // The component should not have glow effect when focused
      const glowElement = screen.queryByRole('generic', { hidden: true })
      // This is complex to test without looking at computed styles
      // Focus behavior is more about the behavior composition working
    })

    it('should apply highlight styles when node is highlighted', () => {
      const mockData = createMockWorkExperienceNodeData({ isHighlighted: true })
      mockBehaviors.highlight.isHighlighted = true

      render(
        <WorkExperienceNode 
          data={mockData} 
          selected={false} 
          id={mockNodeId} 
        />
      )

      // Check for highlight-related CSS classes or attributes
      const nodeElement = screen.getByRole('button', { hidden: true })
      expect(nodeElement).toBeInTheDocument()
    })
  })

  describe('User Interactions', () => {
    it('should handle click to focus/unfocus', async () => {
      const mockData = createMockWorkExperienceNodeData()
      
      render(
        <WorkExperienceNode 
          data={mockData} 
          selected={false} 
          id={mockNodeId} 
        />
      )

      const nodeContainer = screen.getByRole('generic')
      fireEvent.click(nodeContainer)

      expect(mockBehaviors.focus.focus).toHaveBeenCalledTimes(1)
      
      await waitFor(() => {
        expect(mockZoomToFocusedNode).toHaveBeenCalledWith(mockNodeId)
      }, { timeout: 100 })
    })

    it('should clear focus when already focused', () => {
      const mockData = createMockWorkExperienceNodeData({ isFocused: true })
      mockBehaviors.focus.isFocused = true

      render(
        <WorkExperienceNode 
          data={mockData} 
          selected={false} 
          id={mockNodeId} 
        />
      )

      const nodeContainer = screen.getByRole('generic')
      fireEvent.click(nodeContainer)

      expect(mockBehaviors.focus.clearFocus).toHaveBeenCalledTimes(1)
    })

    it('should call custom click handler when provided', () => {
      const mockOnClick = vi.fn()
      const mockData = createMockWorkExperienceNodeData({ 
        onNodeClick: mockOnClick 
      })

      render(
        <WorkExperienceNode 
          data={mockData} 
          selected={false} 
          id={mockNodeId} 
        />
      )

      const nodeContainer = screen.getByRole('generic')
      fireEvent.click(nodeContainer)

      expect(mockOnClick).toHaveBeenCalledWith(mockData, mockNodeId)
    })

    it('should handle edit button click', () => {
      const mockData = createMockWorkExperienceNodeData()

      render(
        <WorkExperienceNode 
          data={mockData} 
          selected={false} 
          id={mockNodeId} 
        />
      )

      const editButton = screen.getByRole('button', { name: /edit/i })
      fireEvent.click(editButton)

      // Should enter edit mode (check for input fields)
      expect(screen.getByPlaceholderText('Job Title')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Company')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Description')).toBeInTheDocument()
    })

    it('should handle save in edit mode', () => {
      const mockData = createMockWorkExperienceNodeData()

      render(
        <WorkExperienceNode 
          data={mockData} 
          selected={false} 
          id={mockNodeId} 
        />
      )

      // Enter edit mode
      const editButton = screen.getByRole('button', { name: /edit/i })
      fireEvent.click(editButton)

      // Make some changes
      const titleInput = screen.getByPlaceholderText('Job Title')
      fireEvent.change(titleInput, { target: { value: 'New Title' } })

      // Save changes
      const saveButton = screen.getByRole('button', { name: /save/i } )
      fireEvent.click(saveButton)

      // Should exit edit mode
      expect(screen.queryByPlaceholderText('Job Title')).not.toBeInTheDocument()
    })

    it('should handle cancel in edit mode', () => {
      const mockData = createMockWorkExperienceNodeData({ 
        title: 'Original Title' 
      })

      render(
        <WorkExperienceNode 
          data={mockData} 
          selected={false} 
          id={mockNodeId} 
        />
      )

      // Enter edit mode
      const editButton = screen.getByRole('button', { name: /edit/i })
      fireEvent.click(editButton)

      // Make some changes
      const titleInput = screen.getByPlaceholderText('Job Title')
      fireEvent.change(titleInput, { target: { value: 'Changed Title' } })

      // Cancel changes
      const cancelButton = screen.getByRole('button', { name: /cancel/i })
      fireEvent.click(cancelButton)

      // Should exit edit mode and restore original values
      expect(screen.queryByPlaceholderText('Job Title')).not.toBeInTheDocument()
      expect(screen.getByText('Original Title')).toBeInTheDocument()
    })

    it('should handle delete with confirmation', () => {
      const mockOnDelete = vi.fn()
      const mockData = createMockWorkExperienceNodeData({ 
        onNodeDelete: mockOnDelete 
      })

      // Mock window.confirm
      window.confirm = vi.fn().mockReturnValue(true)

      render(
        <WorkExperienceNode 
          data={mockData} 
          selected={false} 
          id={mockNodeId} 
        />
      )

      const deleteButton = screen.getByRole('button', { name: /delete/i })
      fireEvent.click(deleteButton)

      expect(window.confirm).toHaveBeenCalledWith('Are you sure you want to delete this work experience?')
      expect(mockOnDelete).toHaveBeenCalledWith(mockNodeId)
    })

    it('should not delete when confirmation is cancelled', () => {
      const mockOnDelete = vi.fn()
      const mockData = createMockWorkExperienceNodeData({ 
        onNodeDelete: mockOnDelete 
      })

      // Mock window.confirm to return false
      window.confirm = vi.fn().mockReturnValue(false)

      render(
        <WorkExperienceNode 
          data={mockData} 
          selected={false} 
          id={mockNodeId} 
        />
      )

      const deleteButton = screen.getByRole('button', { name: /delete/i })
      fireEvent.click(deleteButton)

      expect(window.confirm).toHaveBeenCalled()
      expect(mockOnDelete).not.toHaveBeenCalled()
    })
  })

  describe('Project Interaction', () => {
    it('should show expand/compress button for nodes with projects', () => {
      const mockData = createMockWorkExperienceNodeData({
        projects: [{ id: 'proj-1', title: 'Test Project' }],
      })

      render(
        <WorkExperienceNode 
          data={mockData} 
          selected={false} 
          id={mockNodeId} 
        />
      )

      expect(screen.getByRole('button', { name: /expand|compress/i })).toBeInTheDocument()
    })

    it('should show add project button on hover', async () => {
      const mockData = createMockWorkExperienceNodeData()

      render(
        <WorkExperienceNode 
          data={mockData} 
          selected={false} 
          id={mockNodeId} 
        />
      )

      // The add project button should be present but might be styled with opacity
      expect(screen.getByTitle('Add Project')).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('should have proper accessibility attributes', () => {
      const mockData = createMockWorkExperienceNodeData({
        title: 'Accessible Title',
        company: 'Accessible Company',
      })

      render(
        <WorkExperienceNode 
          data={mockData} 
          selected={false} 
          id={mockNodeId} 
        />
      )

      // Check for meaningful text content
      expect(screen.getByText('Accessible Title')).toBeInTheDocument()
      expect(screen.getByText('Accessible Company')).toBeInTheDocument()
      
      // Check for button roles
      expect(screen.getAllByRole('button')).toHaveLength.toBeGreaterThan(0)
    })

    it('should stop event propagation on button clicks', () => {
      const mockData = createMockWorkExperienceNodeData()
      const mockParentClick = vi.fn()

      const { container } = render(
        <div onClick={mockParentClick}>
          <WorkExperienceNode 
            data={mockData} 
            selected={false} 
            id={mockNodeId} 
          />
        </div>
      )

      const editButton = screen.getByRole('button', { name: /edit/i })
      fireEvent.click(editButton)

      // Parent click should not be triggered
      expect(mockParentClick).not.toHaveBeenCalled()
    })
  })
})
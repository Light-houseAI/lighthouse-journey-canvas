import { describe, it, expect, beforeEach, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useNodeBehaviors } from '../useNodeBehaviors'
import { useNodeFocusStore } from '@/stores/node-focus-store'
import { useNodeSelectionStore } from '@/stores/node-selection-store'
import { useNodeHighlightStore } from '@/stores/node-highlight-store'
import { useNodeInteractionStore } from '@/stores/node-interaction-store'

// Mock the individual stores
vi.mock('@/stores/node-focus-store')
vi.mock('@/stores/node-selection-store')
vi.mock('@/stores/node-highlight-store')
vi.mock('@/stores/node-interaction-store')

describe('useNodeBehaviors', () => {
  const mockNodeId = 'test-node-1'
  
  // Mock store functions
  const mockFocusStore = {
    focusedExperienceId: null,
    setFocusedExperience: vi.fn(),
    clearFocus: vi.fn(),
    isFocused: vi.fn(),
    isBlurred: vi.fn(),
  }
  
  const mockSelectionStore = {
    selectedNodeId: null,
    setSelectedNode: vi.fn(),
    clearSelection: vi.fn(),
    isSelected: vi.fn(),
    selectNext: vi.fn(),
    selectPrevious: vi.fn(),
  }
  
  const mockHighlightStore = {
    highlightedNodeId: null,
    setHighlightedNode: vi.fn(),
    clearHighlight: vi.fn(),
    isHighlighted: vi.fn(),
    highlightTemporary: vi.fn(),
    flashHighlight: vi.fn(),
  }
  
  const mockInteractionStore = {
    hoveredNodeId: null,
    draggedNodeId: null,
    contextMenuNodeId: null,
    isInteracting: false,
    setHoveredNode: vi.fn(),
    setDraggedNode: vi.fn(),
    setContextMenuNode: vi.fn(),
    isHovered: vi.fn(),
    isDragged: vi.fn(),
    hasContextMenu: vi.fn(),
    clearAllInteractions: vi.fn(),
  }

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks()
    
    // Setup store mocks
    vi.mocked(useNodeFocusStore).mockReturnValue(mockFocusStore)
    vi.mocked(useNodeSelectionStore).mockReturnValue(mockSelectionStore)
    vi.mocked(useNodeHighlightStore).mockReturnValue(mockHighlightStore)
    vi.mocked(useNodeInteractionStore).mockReturnValue(mockInteractionStore)
  })

  describe('Behavior Composition', () => {
    it('should compose all behavior stores correctly', () => {
      const { result } = renderHook(() => useNodeBehaviors(mockNodeId))

      // Should have all behavior objects
      expect(result.current.focus).toBeDefined()
      expect(result.current.selection).toBeDefined()
      expect(result.current.highlight).toBeDefined()
      expect(result.current.interaction).toBeDefined()
    })

    it('should provide convenience composed state', () => {
      // Mock some active states
      mockFocusStore.isFocused.mockReturnValue(true)
      mockSelectionStore.isSelected.mockReturnValue(false)
      mockHighlightStore.isHighlighted.mockReturnValue(false)
      mockInteractionStore.isHovered.mockReturnValue(false)
      mockInteractionStore.isDragged.mockReturnValue(false)

      const { result } = renderHook(() => useNodeBehaviors(mockNodeId))

      expect(result.current.isActive).toBe(true) // focused
      expect(result.current.isInteractive).toBe(false) // not hovered or dragged
    })

    it('should calculate isActive correctly with different states', () => {
      // Test with highlight active
      mockFocusStore.isFocused.mockReturnValue(false)
      mockSelectionStore.isSelected.mockReturnValue(false)
      mockHighlightStore.isHighlighted.mockReturnValue(true)

      const { result } = renderHook(() => useNodeBehaviors(mockNodeId))
      expect(result.current.isActive).toBe(true)

      // Test with selection active
      mockHighlightStore.isHighlighted.mockReturnValue(false)
      mockSelectionStore.isSelected.mockReturnValue(true)

      const { result } = renderHook(() => useNodeBehaviors(mockNodeId))
      expect(result.current.isActive).toBe(true)

      // Test with nothing active
      mockSelectionStore.isSelected.mockReturnValue(false)

      const { result } = renderHook(() => useNodeBehaviors(mockNodeId))
      expect(result.current.isActive).toBe(false)
    })

    it('should calculate isInteractive correctly', () => {
      // Test with hover active
      mockInteractionStore.isHovered.mockReturnValue(true)
      mockInteractionStore.isDragged.mockReturnValue(false)

      const { result } = renderHook(() => useNodeBehaviors(mockNodeId))
      expect(result.current.isInteractive).toBe(true)

      // Test with drag active
      mockInteractionStore.isHovered.mockReturnValue(false)
      mockInteractionStore.isDragged.mockReturnValue(true)

      const { result } = renderHook(() => useNodeBehaviors(mockNodeId))
      expect(result.current.isInteractive).toBe(true)

      // Test with both active
      mockInteractionStore.isHovered.mockReturnValue(true)
      mockInteractionStore.isDragged.mockReturnValue(true)

      const { result } = renderHook(() => useNodeBehaviors(mockNodeId))
      expect(result.current.isInteractive).toBe(true)

      // Test with nothing active
      mockInteractionStore.isHovered.mockReturnValue(false)
      mockInteractionStore.isDragged.mockReturnValue(false)

      const { result } = renderHook(() => useNodeBehaviors(mockNodeId))
      expect(result.current.isInteractive).toBe(false)
    })
  })

  describe('Focus Behavior Integration', () => {
    it('should call focus store methods correctly', () => {
      const { result } = renderHook(() => useNodeBehaviors(mockNodeId))

      // Test focus action
      act(() => {
        result.current.focus.focus()
      })
      expect(mockFocusStore.setFocusedExperience).toHaveBeenCalledWith(mockNodeId)

      // Test clear focus action
      act(() => {
        result.current.focus.clearFocus()
      })
      expect(mockFocusStore.clearFocus).toHaveBeenCalled()
    })

    it('should call store helper methods with correct nodeId', () => {
      renderHook(() => useNodeBehaviors(mockNodeId))

      // Verify that helper methods are called with the correct nodeId
      expect(mockFocusStore.isFocused).toHaveBeenCalledWith(mockNodeId)
      expect(mockFocusStore.isBlurred).toHaveBeenCalledWith(mockNodeId)
    })
  })

  describe('Selection Behavior Integration', () => {
    it('should call selection store methods correctly', () => {
      const { result } = renderHook(() => useNodeBehaviors(mockNodeId))

      // Test select action
      act(() => {
        result.current.selection.select()
      })
      expect(mockSelectionStore.setSelectedNode).toHaveBeenCalledWith(mockNodeId)

      // Test clear selection action
      act(() => {  
        result.current.selection.clearSelection()
      })
      expect(mockSelectionStore.clearSelection).toHaveBeenCalled()
    })
  })

  describe('Highlight Behavior Integration', () => {
    it('should call highlight store methods correctly', () => {
      const { result } = renderHook(() => useNodeBehaviors(mockNodeId))

      // Test highlight action
      act(() => {
        result.current.highlight.highlight(5000)
      })
      expect(mockHighlightStore.setHighlightedNode).toHaveBeenCalledWith(mockNodeId, 5000)

      // Test temporary highlight
      act(() => {
        result.current.highlight.highlightTemporary(2000)
      })
      expect(mockHighlightStore.highlightTemporary).toHaveBeenCalledWith(mockNodeId, 2000)

      // Test flash highlight
      act(() => {
        result.current.highlight.flashHighlight(3)
      })
      expect(mockHighlightStore.flashHighlight).toHaveBeenCalledWith(mockNodeId, 3)
    })
  })

  describe('Interaction Behavior Integration', () => {
    it('should call interaction store methods correctly', () => {
      const { result } = renderHook(() => useNodeBehaviors(mockNodeId))

      // Test hover actions
      act(() => {
        result.current.interaction.setHovered()
      })
      expect(mockInteractionStore.setHoveredNode).toHaveBeenCalledWith(mockNodeId)

      act(() => {
        result.current.interaction.clearHovered()
      })
      expect(mockInteractionStore.setHoveredNode).toHaveBeenCalledWith(null)

      // Test drag actions
      act(() => {
        result.current.interaction.setDragged()
      })
      expect(mockInteractionStore.setDraggedNode).toHaveBeenCalledWith(mockNodeId)

      act(() => {
        result.current.interaction.clearDragged()
      })
      expect(mockInteractionStore.setDraggedNode).toHaveBeenCalledWith(null)

      // Test context menu actions
      act(() => {
        result.current.interaction.setContextMenu()
      })
      expect(mockInteractionStore.setContextMenuNode).toHaveBeenCalledWith(mockNodeId)

      act(() => {
        result.current.interaction.clearContextMenu()
      })
      expect(mockInteractionStore.setContextMenuNode).toHaveBeenCalledWith(null)
    })
  })

  describe('Different Node IDs', () => {
    it('should work correctly with different node IDs', () => {
      const nodeId1 = 'node-1'
      const nodeId2 = 'node-2'

      const { result: result1 } = renderHook(() => useNodeBehaviors(nodeId1))
      const { result: result2 } = renderHook(() => useNodeBehaviors(nodeId2))

      // Focus different nodes
      act(() => {
        result1.current.focus.focus()
      })
      expect(mockFocusStore.setFocusedExperience).toHaveBeenLastCalledWith(nodeId1)

      act(() => {
        result2.current.focus.focus()
      })
      expect(mockFocusStore.setFocusedExperience).toHaveBeenLastCalledWith(nodeId2)
    })
  })
})
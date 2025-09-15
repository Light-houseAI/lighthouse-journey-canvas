import { fireEvent,render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { LBranchEdge } from '@/components/edges/LBranchEdge';
import { StraightTimelineEdge } from '@/components/edges/StraightTimelineEdge';

// Mock React Flow
vi.mock('@xyflow/react', () => ({
  getStraightPath: vi.fn(() => ['M0,0 L100,100']),
  getSmoothStepPath: vi.fn(() => ['M0,0 L50,0 L50,100 L100,100']),
  BaseEdge: ({ path, style }: any) => <path d={path} style={style} data-testid="base-edge" />,
}));

describe('Plus Button Components', () => {
  const mockEdgeProps = {
    id: 'test-edge-1',
    sourceX: 100,
    sourceY: 50,
    targetX: 200,
    targetY: 150,
    sourcePosition: 'right' as const,
    targetPosition: 'left' as const,
    data: {
      parentNode: { id: 'node-1', title: 'Test Node 1' },
      targetNode: { id: 'node-2', title: 'Test Node 2' },
      onPlusButtonClick: vi.fn(),
    },
  };

  describe('StraightTimelineEdge Plus Button', () => {
    it('should render without plus button initially', () => {
      render(<StraightTimelineEdge {...mockEdgeProps} />);
      
      // Edge should be rendered
      expect(screen.getByTestId('timeline-edge-test-edge-1')).toBeInTheDocument();
      
      // Plus button should not be visible initially
      expect(screen.queryByTestId('edge-plus-button-test-edge-1')).not.toBeInTheDocument();
    });

    it('should show plus button on hover', async () => {
      const user = userEvent.setup();
      render(<StraightTimelineEdge {...mockEdgeProps} />);
      
      const edge = screen.getByTestId('timeline-edge-test-edge-1');
      
      // Hover over the edge
      await user.hover(edge);
      
      // Plus button should appear
      expect(screen.getByTestId('edge-plus-button-test-edge-1')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /add node here/i })).toBeInTheDocument();
    });

    it('should hide plus button when not hovering', async () => {
      const user = userEvent.setup();
      render(<StraightTimelineEdge {...mockEdgeProps} />);
      
      const edge = screen.getByTestId('timeline-edge-test-edge-1');
      
      // Hover then unhover
      await user.hover(edge);
      expect(screen.getByTestId('edge-plus-button-test-edge-1')).toBeInTheDocument();
      
      await user.unhover(edge);
      expect(screen.queryByTestId('edge-plus-button-test-edge-1')).not.toBeInTheDocument();
    });

    it('should call onPlusButtonClick when plus button is clicked', async () => {
      const user = userEvent.setup();
      const mockOnClick = vi.fn();
      const propsWithMockClick = {
        ...mockEdgeProps,
        data: {
          ...mockEdgeProps.data,
          onPlusButtonClick: mockOnClick,
        },
      };
      
      render(<StraightTimelineEdge {...propsWithMockClick} />);
      
      const edge = screen.getByTestId('timeline-edge-test-edge-1');
      
      // Hover to show button
      await user.hover(edge);
      
      const plusButton = screen.getByTestId('edge-plus-button-test-edge-1');
      await user.click(plusButton);
      
      expect(mockOnClick).toHaveBeenCalledWith(propsWithMockClick.data);
    });

    it('should have proper accessibility attributes', async () => {
      const user = userEvent.setup();
      render(<StraightTimelineEdge {...mockEdgeProps} />);
      
      const edge = screen.getByTestId('timeline-edge-test-edge-1');
      await user.hover(edge);
      
      const plusButton = screen.getByTestId('edge-plus-button-test-edge-1');
      
      expect(plusButton).toHaveAttribute('aria-label', 'Add node here');
      expect(plusButton).toHaveAttribute('title', 'Add new milestone');
    });
  });

  describe('LBranchEdge Plus Button', () => {
    it('should render without plus button initially', () => {
      render(<LBranchEdge {...mockEdgeProps} />);
      
      // Edge should be rendered
      expect(screen.getByTestId('timeline-edge-test-edge-1')).toBeInTheDocument();
      
      // Plus button should not be visible initially
      expect(screen.queryByTestId('branch-edge-plus-button-test-edge-1')).not.toBeInTheDocument();
    });

    it('should show plus button on hover', async () => {
      const user = userEvent.setup();
      render(<LBranchEdge {...mockEdgeProps} />);
      
      const edge = screen.getByTestId('timeline-edge-test-edge-1');
      
      // Hover over the edge
      await user.hover(edge);
      
      // Plus button should appear
      expect(screen.getByTestId('branch-edge-plus-button-test-edge-1')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /add project here/i })).toBeInTheDocument();
    });

    it('should call onPlusButtonClick with branch context', async () => {
      const user = userEvent.setup();
      const mockOnClick = vi.fn();
      const propsWithMockClick = {
        ...mockEdgeProps,
        data: {
          ...mockEdgeProps.data,
          onPlusButtonClick: mockOnClick,
        },
      };
      
      render(<LBranchEdge {...propsWithMockClick} />);
      
      const edge = screen.getByTestId('timeline-edge-test-edge-1');
      
      // Hover to show button
      await user.hover(edge);
      
      const plusButton = screen.getByTestId('branch-edge-plus-button-test-edge-1');
      await user.click(plusButton);
      
      expect(mockOnClick).toHaveBeenCalledWith({
        ...propsWithMockClick.data,
        insertionPoint: 'branch',
      });
    });

    it('should have proper styling for branch edge', async () => {
      const user = userEvent.setup();
      render(<LBranchEdge {...mockEdgeProps} />);
      
      const edge = screen.getByTestId('timeline-edge-test-edge-1');
      await user.hover(edge);
      
      const plusButton = screen.getByTestId('branch-edge-plus-button-test-edge-1');
      
      // Should have emerald background for projects
      expect(plusButton).toHaveClass('bg-emerald-600');
      expect(plusButton).toHaveAttribute('title', 'Add new project');
    });
  });

  describe('Plus Button Visual State', () => {
    it('should position plus button at edge midpoint', async () => {
      const user = userEvent.setup();
      render(<StraightTimelineEdge {...mockEdgeProps} />);
      
      const edge = screen.getByTestId('timeline-edge-test-edge-1');
      await user.hover(edge);
      
      const plusButton = screen.getByTestId('edge-plus-button-test-edge-1');
      const foreignObject = plusButton.closest('foreignObject');
      
      // Should be positioned at midpoint coordinates
      // midX = (100 + 200) / 2 - 12 = 138
      // midY = (50 + 150) / 2 - 12 = 88
      expect(foreignObject).toHaveAttribute('x', '138');
      expect(foreignObject).toHaveAttribute('y', '88');
      expect(foreignObject).toHaveAttribute('width', '24');
      expect(foreignObject).toHaveAttribute('height', '24');
    });

    it('should have proper CSS classes for styling', async () => {
      const user = userEvent.setup();
      render(<StraightTimelineEdge {...mockEdgeProps} />);
      
      const edge = screen.getByTestId('timeline-edge-test-edge-1');
      await user.hover(edge);
      
      const plusButton = screen.getByTestId('edge-plus-button-test-edge-1');
      
      expect(plusButton).toHaveClass('edge-plus-button');
      expect(plusButton).toHaveClass('w-6', 'h-6');
      expect(plusButton).toHaveClass('bg-purple-600', 'hover:bg-purple-700');
      expect(plusButton).toHaveClass('text-white', 'rounded-full');
      expect(plusButton).toHaveClass('flex', 'items-center', 'justify-center');
      expect(plusButton).toHaveClass('shadow-lg', 'transition-all', 'duration-200', 'hover:scale-110');
    });
  });
});
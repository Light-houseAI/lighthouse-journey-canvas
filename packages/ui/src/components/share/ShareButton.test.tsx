/**
 * ShareButton Unit Tests
 *
 * Tests for ShareButton component with HStack layout
 */

import type { TimelineNode } from '@journey/schema';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ShareButton } from './ShareButton';

const mockOpenModal = vi.fn();

// Mock the stores
vi.mock('../../hooks/useTimelineStore', () => ({
  useTimelineStore: () => ({
    nodes: { data: [] },
  }),
}));

vi.mock('../../stores/profile-view-store', () => ({
  useProfileViewStore: () => null,
}));

vi.mock('../../stores/share-store', () => ({
  useShareStore: () => ({
    openModal: mockOpenModal,
    openModalWithSelection: vi.fn(),
  }),
}));

describe('ShareButton', () => {
  const mockNodes: TimelineNode[] = [
    { id: '1', type: 'Experience', parentId: null, meta: {} } as TimelineNode,
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render button with Share icon', () => {
    const { container } = render(<ShareButton allNodes={mockNodes} />);
    const button = container.querySelector('button');

    expect(button).toBeInTheDocument();
    // Icon should be rendered
    const icon = container.querySelector('svg');
    expect(icon).toBeInTheDocument();
  });

  it('should use HStack for layout', () => {
    const { container } = render(<ShareButton allNodes={mockNodes} />);

    // HStack should have gap-2, items-center, justify-center
    const hstack = container.querySelector(
      '.gap-2.items-center.justify-center'
    );
    expect(hstack).toBeInTheDocument();
  });

  it('should be disabled when no nodes available', () => {
    const { container } = render(<ShareButton allNodes={[]} />);
    const button = container.querySelector('button');

    expect(button).toBeDisabled();
  });

  it('should call openModal when clicked with specific nodes', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <ShareButton nodes={mockNodes} allNodes={mockNodes} />
    );
    const button = container.querySelector('button')!;

    await user.click(button);

    expect(mockOpenModal).toHaveBeenCalledWith(['1']);
  });

  it('should call openModal without args when no specific nodes', async () => {
    const user = userEvent.setup();
    const { container } = render(<ShareButton allNodes={mockNodes} />);
    const button = container.querySelector('button')!;

    await user.click(button);

    expect(mockOpenModal).toHaveBeenCalledWith();
  });

  it('should show label when showLabel is true', () => {
    render(<ShareButton allNodes={mockNodes} showLabel={true} />);

    expect(screen.getByText('Share profile')).toBeInTheDocument();
  });

  it('should not show label by default', () => {
    render(<ShareButton allNodes={mockNodes} />);

    expect(screen.queryByText('Share profile')).not.toBeInTheDocument();
  });
});

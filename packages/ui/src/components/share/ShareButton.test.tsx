/**
 * ShareButton Unit Tests
 *
 * Simple unit tests for HStack layout component migration
 */

import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ShareButton } from './ShareButton';
import { TimelineNode } from '@journey/schema';

// Mock the stores
vi.mock('../../hooks/useTimelineStore', () => ({
  useTimelineStore: () => ({ nodes: [] }),
}));

vi.mock('../../stores/profile-view-store', () => ({
  useProfileViewStore: () => null,
}));

vi.mock('../../stores/share-store', () => ({
  useShareStore: () => ({
    openModal: vi.fn(),
    openModalWithSelection: vi.fn(),
  }),
}));

describe('ShareButton - HStack Migration', () => {
  const mockNodes: TimelineNode[] = [
    { id: 1, type: 'job' } as TimelineNode,
  ];

  it('should use HStack instead of manual flex utilities', () => {
    const { container } = render(<ShareButton allNodes={mockNodes} />);
    const button = container.querySelector('button');

    // Button should NOT have manual flex layout classes
    expect(button?.className).not.toMatch(/\bflex\s+gap-2\b/);
    expect(button?.className).not.toMatch(/\bitems-center\b/);
    expect(button?.className).not.toMatch(/\bjustify-center\b/);
  });

  it('should render HStack with correct spacing and alignment', () => {
    const { container } = render(<ShareButton allNodes={mockNodes} />);

    // HStack should have gap-2, items-center, justify-center
    const hstack = container.querySelector('.gap-2.items-center.justify-center');
    expect(hstack).toBeInTheDocument();
  });
});

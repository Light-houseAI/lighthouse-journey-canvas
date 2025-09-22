/**
 * @vitest-environment jsdom
 * LeftPanel Component Tests
 *
 * Tests scrollable profile list container following existing patterns
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { LeftPanel } from './LeftPanel';

const mockResults = [
  {
    id: '1',
    name: 'John Doe',
    email: 'john@example.com',
    currentRole: 'Software Engineer',
    company: 'Google',
    whyMatched: ['React Developer'],
    matchedNodes: [],
  },
  {
    id: '2',
    name: 'Jane Smith',
    email: 'jane@example.com',
    currentRole: 'Product Manager',
    company: 'Meta',
    whyMatched: ['Product Strategy'],
    matchedNodes: [],
  },
  {
    id: '3',
    name: 'Bob Johnson',
    email: 'bob@example.com',
    currentRole: 'Designer',
    company: 'Apple',
    whyMatched: ['UX Design'],
    matchedNodes: [],
  },
];

describe('LeftPanel', () => {
  it('should render list of profile items', () => {
    const mockOnProfileSelect = vi.fn();

    render(
      <LeftPanel
        results={mockResults}
        selectedId="1"
        onProfileSelect={mockOnProfileSelect}
      />
    );

    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    expect(screen.getByText('Bob Johnson')).toBeInTheDocument();
  });

  it('should handle empty results', () => {
    const mockOnProfileSelect = vi.fn();

    render(
      <LeftPanel
        results={[]}
        selectedId={undefined}
        onProfileSelect={mockOnProfileSelect}
      />
    );

    expect(screen.getAllByText('No profiles found')).toHaveLength(2); // Header and empty state
    expect(screen.getByText('Try adjusting your search terms')).toBeInTheDocument();
  });

  it('should highlight selected profile', () => {
    const mockOnProfileSelect = vi.fn();

    render(
      <LeftPanel
        results={mockResults}
        selectedId="2"
        onProfileSelect={mockOnProfileSelect}
      />
    );

    // Jane Smith should be selected (highlighted)
    const janeButton = screen.getByLabelText('View details for Jane Smith');
    expect(janeButton).toHaveClass('bg-blue-50', 'border-blue-200');

    // John Doe should not be selected
    const johnButton = screen.getByLabelText('View details for John Doe');
    expect(johnButton).not.toHaveClass('bg-blue-50', 'border-blue-200');
  });

  it('should be scrollable', () => {
    const mockOnProfileSelect = vi.fn();

    render(
      <LeftPanel
        results={mockResults}
        selectedId="1"
        onProfileSelect={mockOnProfileSelect}
      />
    );

    const container = screen.getByTestId('left-panel-container');

    // Check that the scrollable area exists within the container
    const scrollableArea = container.querySelector('.overflow-y-auto');
    expect(scrollableArea).toBeInTheDocument();
  });

  it('should call onProfileSelect when profile is clicked', async () => {
    const user = userEvent.setup();
    const mockOnProfileSelect = vi.fn();

    render(
      <LeftPanel
        results={mockResults}
        selectedId="1"
        onProfileSelect={mockOnProfileSelect}
      />
    );

    const janeButton = screen.getByLabelText('View details for Jane Smith');
    await user.click(janeButton);

    expect(mockOnProfileSelect).toHaveBeenCalledWith('2');
  });

  it('should display total count', () => {
    const mockOnProfileSelect = vi.fn();

    render(
      <LeftPanel
        results={mockResults}
        selectedId="1"
        onProfileSelect={mockOnProfileSelect}
      />
    );

    expect(screen.getByText('3 profiles found')).toBeInTheDocument();
  });

  it('should handle singular count correctly', () => {
    const mockOnProfileSelect = vi.fn();
    const singleResult = [mockResults[0]];

    render(
      <LeftPanel
        results={singleResult}
        selectedId="1"
        onProfileSelect={mockOnProfileSelect}
      />
    );

    expect(screen.getByText('1 profile found')).toBeInTheDocument();
  });

  it('should be keyboard navigable', async () => {
    const user = userEvent.setup();
    const mockOnProfileSelect = vi.fn();

    render(
      <LeftPanel
        results={mockResults}
        selectedId="1"
        onProfileSelect={mockOnProfileSelect}
      />
    );

    const firstButton = screen.getByLabelText('View details for John Doe');
    const secondButton = screen.getByLabelText('View details for Jane Smith');

    // Tab to first button
    await user.tab();
    expect(firstButton).toHaveFocus();

    // Tab to second button
    await user.tab();
    expect(secondButton).toHaveFocus();

    // Activate with Enter
    await user.keyboard('{Enter}');
    expect(mockOnProfileSelect).toHaveBeenCalledWith('2');
  });
});
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ChatToggle } from './chat-toggle';

describe('ChatToggle Component', () => {
  const mockOnToggle = vi.fn();

  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders in default manual mode', () => {
    render(<ChatToggle enabled={false} onToggle={mockOnToggle} />);

    // Should show Manual and Chat labels
    expect(screen.getByText('Manual')).toBeInTheDocument();
    expect(screen.getByText('Chat')).toBeInTheDocument();

    // Switch should be unchecked (manual mode)
    const toggle = screen.getByRole('switch');
    expect(toggle).toBeInTheDocument();
    expect(toggle).not.toBeChecked();

    // Manual label should be highlighted (blue), Chat should be gray
    const manualLabel = screen.getByText('Manual');
    const chatLabel = screen.getByText('Chat');

    expect(manualLabel).toHaveClass('text-blue-600');
    expect(chatLabel).toHaveClass('text-gray-500');

    // Icons should have appropriate colors
    const editIcon = document.querySelector('[data-testid="edit-icon"]');
    const chatIcon = document.querySelector('[data-testid="chat-icon"]');

    expect(editIcon).toHaveClass('text-blue-600');
    expect(chatIcon).toHaveClass('text-gray-400');
  });

  it('renders in chat mode when enabled', () => {
    render(<ChatToggle enabled={true} onToggle={mockOnToggle} />);

    // Switch should be checked (chat mode)
    const toggle = screen.getByRole('switch');
    expect(toggle).toBeChecked();

    // Chat label should be highlighted (purple), Manual should be gray
    const manualLabel = screen.getByText('Manual');
    const chatLabel = screen.getByText('Chat');

    expect(manualLabel).toHaveClass('text-gray-500');
    expect(chatLabel).toHaveClass('text-purple-600');

    // Icons should have appropriate colors
    const editIcon = document.querySelector('[data-testid="edit-icon"]');
    const chatIcon = document.querySelector('[data-testid="chat-icon"]');

    expect(editIcon).toHaveClass('text-gray-400');
    expect(chatIcon).toHaveClass('text-purple-600');
  });

  it('toggles between chat and manual modes when clicked', async () => {
    const user = userEvent.setup();
    render(<ChatToggle enabled={false} onToggle={mockOnToggle} />);

    const toggle = screen.getByRole('switch');

    // Click to enable chat mode
    await user.click(toggle);

    expect(mockOnToggle).toHaveBeenCalledWith(true);
    expect(mockOnToggle).toHaveBeenCalledTimes(1);
  });

  it('can be toggled from chat mode to manual mode', async () => {
    const user = userEvent.setup();
    render(<ChatToggle enabled={true} onToggle={mockOnToggle} />);

    const toggle = screen.getByRole('switch');

    // Click to disable chat mode (switch to manual)
    await user.click(toggle);

    expect(mockOnToggle).toHaveBeenCalledWith(false);
    expect(mockOnToggle).toHaveBeenCalledTimes(1);
  });

  it('displays correct visual indicators for manual mode', () => {
    render(<ChatToggle enabled={false} onToggle={mockOnToggle} />);

    // Manual side should be active
    expect(screen.getByText('Manual')).toHaveClass('text-blue-600');
    expect(screen.getByText('Chat')).toHaveClass('text-gray-500');

    // Switch should have proper styling
    const toggle = screen.getByRole('switch');
    expect(toggle).toHaveAttribute('aria-checked', 'false');
  });

  it('displays correct visual indicators for chat mode', () => {
    render(<ChatToggle enabled={true} onToggle={mockOnToggle} />);

    // Chat side should be active
    expect(screen.getByText('Chat')).toHaveClass('text-purple-600');
    expect(screen.getByText('Manual')).toHaveClass('text-gray-500');

    // Switch should have purple background when checked
    const toggle = screen.getByRole('switch');
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    expect(toggle).toHaveClass('data-[state=checked]:bg-purple-600');
  });

  it('supports keyboard navigation', async () => {
    const user = userEvent.setup();
    render(<ChatToggle enabled={false} onToggle={mockOnToggle} />);

    const toggle = screen.getByRole('switch');

    // Focus the toggle with tab
    await user.tab();
    expect(toggle).toHaveFocus();

    // Activate with space
    await user.keyboard(' ');
    expect(mockOnToggle).toHaveBeenCalledWith(true);

    // Activate with enter
    vi.clearAllMocks();
    await user.keyboard('{Enter}');
    expect(mockOnToggle).toHaveBeenCalledWith(true);
  });

  it('applies custom className when provided', () => {
    const customClass = 'custom-test-class';
    render(
      <ChatToggle
        enabled={false}
        onToggle={mockOnToggle}
        className={customClass}
      />
    );

    const container = screen.getByRole('switch').closest('div');
    expect(container).toHaveClass(customClass);
  });

  it('has proper accessibility attributes', () => {
    render(<ChatToggle enabled={false} onToggle={mockOnToggle} />);

    const toggle = screen.getByRole('switch');

    // Should have proper ARIA attributes
    expect(toggle).toHaveAttribute('id', 'chat-toggle');
    expect(toggle).toHaveAttribute('aria-checked', 'false');

    // Labels should be associated with the switch
    const labels = screen.getAllByText(/Manual|Chat/);
    labels.forEach((label) => {
      expect(label).toHaveAttribute('for', 'chat-toggle');
    });
  });

  it('handles rapid clicking without issues', async () => {
    const user = userEvent.setup();
    render(<ChatToggle enabled={false} onToggle={mockOnToggle} />);

    const toggle = screen.getByRole('switch');

    // Rapidly click multiple times
    await user.click(toggle);
    await user.click(toggle);
    await user.click(toggle);

    // Should have been called for each click
    expect(mockOnToggle).toHaveBeenCalledTimes(3);
    expect(mockOnToggle).toHaveBeenNthCalledWith(1, true);
    expect(mockOnToggle).toHaveBeenNthCalledWith(2, false);
    expect(mockOnToggle).toHaveBeenNthCalledWith(3, true);
  });

  it('maintains consistent styling during state transitions', () => {
    const { rerender } = render(
      <ChatToggle enabled={false} onToggle={mockOnToggle} />
    );

    // Initial state - manual mode
    expect(screen.getByText('Manual')).toHaveClass('text-blue-600');
    expect(screen.getByText('Chat')).toHaveClass('text-gray-500');

    // Rerender with chat mode enabled
    rerender(<ChatToggle enabled={true} onToggle={mockOnToggle} />);

    // Should update styling
    expect(screen.getByText('Manual')).toHaveClass('text-gray-500');
    expect(screen.getByText('Chat')).toHaveClass('text-purple-600');
  });
});

describe('ChatToggle Integration with Timeline', () => {
  it('should be compatible with timeline positioning requirements', () => {
    render(
      <div className="relative">
        <ChatToggle
          enabled={false}
          onToggle={vi.fn()}
          className="absolute right-4 top-4"
        />
      </div>
    );

    const container = screen.getByRole('switch').closest('div');
    expect(container).toHaveClass('absolute', 'top-4', 'right-4');
  });

  it('should maintain consistent size for timeline layout', () => {
    render(<ChatToggle enabled={false} onToggle={vi.fn()} />);

    const toggle = screen.getByRole('switch');
    const container = toggle.closest('div');

    // Should have consistent spacing and sizing
    expect(container).toHaveClass('flex', 'items-center', 'space-x-3');
  });
});

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { SuccessScreen } from './SuccessScreen';

// Mock wouter's useLocation
vi.mock('wouter', () => ({
  useLocation: vi.fn(() => ['/current-path', vi.fn()]),
}));

describe('SuccessScreen', () => {
  const mockOnClose = vi.fn();
  const defaultProps = {
    nodeId: 'test-node-123',
    onClose: mockOnClose,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render success message', () => {
    render(<SuccessScreen {...defaultProps} />);

    expect(screen.getByText(/Successfully added update!/i)).toBeInTheDocument();
  });

  it('should render celebration icon', () => {
    render(<SuccessScreen {...defaultProps} />);

    // Check for success indicator visual element
    const successIcon = screen.getByTestId('success-icon');
    expect(successIcon).toBeInTheDocument();
  });

  it('should render "View my journey" button', () => {
    render(<SuccessScreen {...defaultProps} />);

    const viewJourneyButton = screen.getByRole('button', {
      name: /view my journey/i,
    });
    expect(viewJourneyButton).toBeInTheDocument();
  });

  it('should navigate to career transition detail view on button click', async () => {
    const user = userEvent.setup();
    const mockSetLocation = vi.fn();
    const { useLocation } = await import('wouter');
    vi.mocked(useLocation).mockReturnValue(['/current-path', mockSetLocation]);

    render(<SuccessScreen {...defaultProps} />);

    const viewJourneyButton = screen.getByRole('button', {
      name: /view my journey/i,
    });
    await user.click(viewJourneyButton);

    expect(mockSetLocation).toHaveBeenCalledWith(
      `/career-transition/${defaultProps.nodeId}`
    );
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should close modal when navigating', async () => {
    const user = userEvent.setup();
    const mockSetLocation = vi.fn();
    const { useLocation } = await import('wouter');
    vi.mocked(useLocation).mockReturnValue(['/current-path', mockSetLocation]);

    render(<SuccessScreen {...defaultProps} />);

    const viewJourneyButton = screen.getByRole('button', {
      name: /view my journey/i,
    });
    await user.click(viewJourneyButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should render with proper styling classes', () => {
    render(<SuccessScreen {...defaultProps} />);

    // Check for modal overlay
    const overlay = screen.getByTestId('success-screen-overlay');
    expect(overlay).toHaveClass('bg-black/50');
  });
});

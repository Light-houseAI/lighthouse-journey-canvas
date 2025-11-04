import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ConfirmDialog } from './confirm-dialog';

describe('ConfirmDialog', () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    title: 'Confirm Action',
    description: 'Are you sure you want to proceed?',
    onConfirm: vi.fn(),
  };

  it('should render with title and description', () => {
    render(<ConfirmDialog {...defaultProps} />);
    expect(screen.getByText('Confirm Action')).toBeInTheDocument();
    expect(
      screen.getByText('Are you sure you want to proceed?')
    ).toBeInTheDocument();
  });

  it('should not render when open is false', () => {
    render(<ConfirmDialog {...defaultProps} open={false} />);
    expect(screen.queryByText('Confirm Action')).not.toBeInTheDocument();
  });

  it('should render default button text', () => {
    render(<ConfirmDialog {...defaultProps} />);
    expect(screen.getByText('Confirm')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('should render custom button text', () => {
    render(
      <ConfirmDialog
        {...defaultProps}
        confirmText="Delete"
        cancelText="Go Back"
      />
    );
    expect(screen.getByText('Delete')).toBeInTheDocument();
    expect(screen.getByText('Go Back')).toBeInTheDocument();
  });

  it('should call onConfirm when confirm button is clicked', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    render(<ConfirmDialog {...defaultProps} onConfirm={onConfirm} />);

    const confirmButton = screen.getByText('Confirm');
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledTimes(1);
    });
  });

  it('should call onOpenChange after successful confirm', async () => {
    const onOpenChange = vi.fn();
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    render(
      <ConfirmDialog
        {...defaultProps}
        onOpenChange={onOpenChange}
        onConfirm={onConfirm}
      />
    );

    const confirmButton = screen.getByText('Confirm');
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it('should show loading state during async confirm', async () => {
    const onConfirm = vi.fn(
      () => new Promise((resolve) => setTimeout(resolve, 100))
    );
    render(<ConfirmDialog {...defaultProps} onConfirm={onConfirm} />);

    const confirmButton = screen.getByText('Confirm');
    fireEvent.click(confirmButton);

    // Should show loading text
    expect(screen.getByText('Loading...')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });
  });

  it('should disable buttons during loading', async () => {
    const onConfirm = vi.fn(
      () => new Promise((resolve) => setTimeout(resolve, 100))
    );
    render(<ConfirmDialog {...defaultProps} onConfirm={onConfirm} />);

    const confirmButton = screen.getByText('Confirm');
    const cancelButton = screen.getByText('Cancel');

    fireEvent.click(confirmButton);

    expect(confirmButton).toBeDisabled();
    expect(cancelButton).toBeDisabled();

    await waitFor(() => {
      expect(confirmButton).not.toBeDisabled();
    });
  });

  it('should handle confirm errors gracefully', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const onConfirm = vi.fn().mockRejectedValue(new Error('Confirm failed'));
    const onOpenChange = vi.fn();

    render(
      <ConfirmDialog
        {...defaultProps}
        onConfirm={onConfirm}
        onOpenChange={onOpenChange}
      />
    );

    const confirmButton = screen.getByText('Confirm');
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(consoleError).toHaveBeenCalledWith(
        'Confirm action failed:',
        expect.any(Error)
      );
    });

    // Should reset loading state
    expect(screen.getByText('Confirm')).toBeInTheDocument();

    consoleError.mockRestore();
  });

  it('should apply destructive styling when variant is destructive', () => {
    render(<ConfirmDialog {...defaultProps} variant="destructive" />);
    const confirmButton = screen.getByText('Confirm');
    expect(confirmButton).toHaveClass('bg-destructive');
  });

  it('should apply destructive styling when isDestructive is true', () => {
    render(<ConfirmDialog {...defaultProps} isDestructive={true} />);
    const confirmButton = screen.getByText('Confirm');
    expect(confirmButton).toHaveClass('bg-destructive');
  });

  it('should not apply destructive styling by default', () => {
    render(<ConfirmDialog {...defaultProps} />);
    const confirmButton = screen.getByText('Confirm');
    expect(confirmButton).not.toHaveClass('bg-destructive');
  });

  it('should call onOpenChange when cancel button is clicked', () => {
    const onOpenChange = vi.fn();
    render(<ConfirmDialog {...defaultProps} onOpenChange={onOpenChange} />);

    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('should handle synchronous onConfirm', async () => {
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <ConfirmDialog
        {...defaultProps}
        onConfirm={onConfirm}
        onOpenChange={onOpenChange}
      />
    );

    const confirmButton = screen.getByText('Confirm');
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledTimes(1);
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it('should remain disabled after error until reset', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const onConfirm = vi.fn().mockRejectedValue(new Error('Failed'));

    render(<ConfirmDialog {...defaultProps} onConfirm={onConfirm} />);

    const confirmButton = screen.getByText('Confirm');
    fireEvent.click(confirmButton);

    // Wait for error handling
    await waitFor(() => {
      expect(consoleError).toHaveBeenCalled();
    });

    // Button should be re-enabled after error
    await waitFor(() => {
      expect(confirmButton).not.toBeDisabled();
    });

    consoleError.mockRestore();
  });
});

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { SearchStates } from './SearchStates';

describe('SearchStates', () => {
  describe('Loading State', () => {
    it('should render loading skeletons', () => {
      render(<SearchStates type="loading" />);

      // Should render 3 skeleton items
      const skeletons = screen
        .getAllByRole('generic')
        .filter((el) => el.className.includes('animate-pulse'));
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('should apply custom className', () => {
      const { container } = render(
        <SearchStates type="loading" className="custom-class" />
      );

      expect(container.firstChild).toHaveClass('custom-class');
    });
  });

  describe('Empty State', () => {
    it('should render empty state with default message', () => {
      render(<SearchStates type="empty" />);

      expect(screen.getByText(/no profiles found/i)).toBeInTheDocument();
      expect(
        screen.getByText(/try different keywords or search terms/i)
      ).toBeInTheDocument();
    });

    it('should render empty state with custom message', () => {
      render(<SearchStates type="empty" message="No results for your query" />);

      expect(
        screen.getByText(/no results for your query/i)
      ).toBeInTheDocument();
    });

    it('should render search icon', () => {
      const { container } = render(<SearchStates type="empty" />);

      const icon = container.querySelector('svg');
      expect(icon).toBeInTheDocument();
    });

    it('should apply custom className', () => {
      const { container } = render(
        <SearchStates type="empty" className="custom-empty" />
      );

      expect(container.firstChild).toHaveClass('custom-empty');
    });
  });

  describe('Error State', () => {
    it('should render error state with default message', () => {
      render(<SearchStates type="error" />);

      expect(
        screen.getByText(/search temporarily unavailable/i)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/please check your connection and try again/i)
      ).toBeInTheDocument();
    });

    it('should render error state with custom message', () => {
      render(<SearchStates type="error" message="Something went wrong" />);

      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    });

    it('should render alert icon', () => {
      const { container } = render(<SearchStates type="error" />);

      const icon = container.querySelector('svg');
      expect(icon).toBeInTheDocument();
    });

    it('should render retry button when onRetry is provided', () => {
      const mockRetry = vi.fn();
      render(<SearchStates type="error" onRetry={mockRetry} />);

      const retryButton = screen.getByRole('button', { name: /try again/i });
      expect(retryButton).toBeInTheDocument();
    });

    it('should not render retry button when onRetry is not provided', () => {
      render(<SearchStates type="error" />);

      expect(
        screen.queryByRole('button', { name: /try again/i })
      ).not.toBeInTheDocument();
    });

    it('should call onRetry when retry button is clicked', async () => {
      const user = userEvent.setup();
      const mockRetry = vi.fn();
      render(<SearchStates type="error" onRetry={mockRetry} />);

      const retryButton = screen.getByRole('button', { name: /try again/i });
      await user.click(retryButton);

      expect(mockRetry).toHaveBeenCalledOnce();
    });

    it('should apply custom className', () => {
      const { container } = render(
        <SearchStates type="error" className="custom-error" />
      );

      expect(container.firstChild).toHaveClass('custom-error');
    });
  });

  describe('Edge Cases', () => {
    it('should render null for invalid type', () => {
      const { container } = render(<SearchStates type={'invalid' as any} />);

      expect(container.firstChild).toBeNull();
    });

    it('should handle undefined type', () => {
      const { container } = render(<SearchStates type={undefined as any} />);

      expect(container.firstChild).toBeNull();
    });
  });
});

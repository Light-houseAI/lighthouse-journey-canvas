import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { SearchResultsView } from './SearchResultsView';
import type { ProfileResult } from './types/search.types';

// Mock the child components
vi.mock('./page/LeftPanel', () => ({
  LeftPanel: ({ results, onProfileSelect }: any) => (
    <div data-testid="left-panel">
      {results.map((r: ProfileResult) => (
        <button
          key={r.id}
          onClick={() => onProfileSelect(r.id)}
          data-testid={`profile-${r.id}`}
        >
          {r.name}
        </button>
      ))}
    </div>
  ),
}));

vi.mock('./page/ProfileView', () => ({
  ProfileView: ({ profile }: any) => (
    <div data-testid="profile-view">{profile.name}</div>
  ),
}));

vi.mock('./SearchStates', () => ({
  SearchStates: ({ type, message }: any) => (
    <div data-testid={`search-state-${type}`}>{message}</div>
  ),
}));

describe('SearchResultsView', () => {
  const mockResults: ProfileResult[] = [
    {
      id: '1',
      name: 'John Doe',
      headline: 'Software Engineer',
      location: 'San Francisco, CA',
      profilePictureUrl: 'https://example.com/john.jpg',
      overallMatchScore: 85,
    },
    {
      id: '2',
      name: 'Jane Smith',
      headline: 'Product Manager',
      location: 'New York, NY',
      profilePictureUrl: 'https://example.com/jane.jpg',
      overallMatchScore: 90,
    },
  ];

  describe('Loading State', () => {
    it('should render loading spinner when isLoading is true', () => {
      render(<SearchResultsView results={[]} query="test" isLoading={true} />);

      expect(screen.getByTestId('search-loading')).toBeInTheDocument();
      expect(screen.getByText(/searching/i)).toBeInTheDocument();
    });

    it('should show spinning animation', () => {
      const { container } = render(
        <SearchResultsView results={[]} query="test" isLoading={true} />
      );

      const spinner = container.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('should render error state when error is provided', () => {
      const error = new Error('Network error');
      render(<SearchResultsView results={[]} query="test" error={error} />);

      expect(screen.getByTestId('search-state-error')).toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('should render empty state when no results', () => {
      render(<SearchResultsView results={[]} query="software engineer" />);

      expect(screen.getByTestId('search-state-empty')).toBeInTheDocument();
      expect(
        screen.getByText(/no results found for "software engineer"/i)
      ).toBeInTheDocument();
    });

    it('should render empty state with custom query', () => {
      render(<SearchResultsView results={[]} query="product manager" />);

      expect(
        screen.getByText(/no results found for "product manager"/i)
      ).toBeInTheDocument();
    });
  });

  describe('Results Display', () => {
    it('should render search results view with results', () => {
      render(<SearchResultsView results={mockResults} query="test" />);

      expect(screen.getByTestId('search-results-view')).toBeInTheDocument();
      expect(screen.getByTestId('left-panel')).toBeInTheDocument();
    });

    it('should render all profile items in left panel', () => {
      render(<SearchResultsView results={mockResults} query="test" />);

      expect(screen.getByTestId('profile-1')).toBeInTheDocument();
      expect(screen.getByTestId('profile-2')).toBeInTheDocument();
    });

    it('should show selection prompt when no profile selected', () => {
      render(<SearchResultsView results={mockResults} query="test" />);

      expect(screen.getByText(/2 results found/i)).toBeInTheDocument();
      expect(
        screen.getByText(/select a profile from the left panel/i)
      ).toBeInTheDocument();
    });

    it('should show "1 result" for single result', () => {
      render(<SearchResultsView results={[mockResults[0]]} query="test" />);

      expect(screen.getByText(/1 result found/i)).toBeInTheDocument();
    });
  });

  describe('Profile Selection', () => {
    it('should display profile view when profile is selected', async () => {
      const user = userEvent.setup();
      render(<SearchResultsView results={mockResults} query="test" />);

      const profileButton = screen.getByTestId('profile-1');
      await user.click(profileButton);

      expect(screen.getByTestId('profile-view')).toBeInTheDocument();
      expect(screen.getAllByText('John Doe').length).toBeGreaterThan(0);
    });

    it('should call onProfileSelect when profile is clicked', async () => {
      const user = userEvent.setup();
      const mockOnProfileSelect = vi.fn();
      render(
        <SearchResultsView
          results={mockResults}
          query="test"
          onProfileSelect={mockOnProfileSelect}
        />
      );

      const profileButton = screen.getByTestId('profile-1');
      await user.click(profileButton);

      expect(mockOnProfileSelect).toHaveBeenCalledWith('1');
    });

    it('should pre-select profile when initialSelectedId is provided', () => {
      render(
        <SearchResultsView
          results={mockResults}
          query="test"
          initialSelectedId="1"
        />
      );

      expect(screen.getByTestId('profile-view')).toBeInTheDocument();
      expect(screen.getAllByText('John Doe').length).toBeGreaterThan(0);
    });

    it('should update selection when initialSelectedId changes', () => {
      const { rerender } = render(
        <SearchResultsView
          results={mockResults}
          query="test"
          initialSelectedId="1"
        />
      );

      expect(screen.getAllByText('John Doe').length).toBeGreaterThan(0);

      rerender(
        <SearchResultsView
          results={mockResults}
          query="test"
          initialSelectedId="2"
        />
      );

      expect(screen.getAllByText('Jane Smith').length).toBeGreaterThan(0);
    });
  });

  describe('Custom Styling', () => {
    it('should apply custom className', () => {
      const { container } = render(
        <SearchResultsView
          results={mockResults}
          query="test"
          className="custom-class"
        />
      );

      const view = container.querySelector('.custom-class');
      expect(view).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty results array gracefully', () => {
      render(<SearchResultsView results={[]} query="" />);

      expect(screen.getByTestId('search-state-empty')).toBeInTheDocument();
    });

    it('should handle selecting non-existent profile', async () => {
      render(
        <SearchResultsView
          results={mockResults}
          query="test"
          initialSelectedId="999"
        />
      );

      // Should show selection prompt since profile not found
      expect(screen.getByText(/select a profile/i)).toBeInTheDocument();
    });
  });
});

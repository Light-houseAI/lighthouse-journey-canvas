/**
 * @vitest-environment jsdom
 * SearchResultsPage Tests
 *
 * Tests the search results page following the SearchPeopleComponent pattern:
 * - Uses centralized mock data from mock-data.ts
 * - Fetches data from MSW-mocked APIs
 * - Follows scenario-based testing patterns
 * - Tests TDD implementation with proper async/await patterns
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import SearchResultsPage from './search-results';

// Test wrapper with providers following SearchPeopleComponent pattern
const TestWrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

// Mock wouter hooks following settings.test.tsx pattern
vi.mock('wouter', () => ({
  useLocation: () => ['/search?q=engineer', vi.fn()],
  useParams: () => ({ q: 'engineer' }),
}));

// Mock theme context
vi.mock('../contexts/ThemeContext', () => ({
  useTheme: () => ({
    theme: {
      backgroundGradient: 'bg-gradient-to-br from-blue-50 to-indigo-100',
    },
  }),
}));

// Mock framer motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
}));

describe('SearchResultsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Component Rendering', () => {
    it('should render page with proper layout', () => {
      render(
        <TestWrapper>
          <SearchResultsPage />
        </TestWrapper>
      );

      // Should render the main container with proper background
      const container = screen.getByRole('main');
      expect(container).toBeInTheDocument();
      expect(container).toHaveClass('relative', 'h-screen', 'w-full', 'overflow-hidden');
    });

    it('should display loading spinner on initial mount with query', () => {
      render(
        <TestWrapper>
          <SearchResultsPage />
        </TestWrapper>
      );

      // Should show loading state initially
      expect(screen.getByTestId('search-loading')).toBeInTheDocument();
    });

    it('should render two-column layout on desktop', () => {
      // Mock window.innerWidth for desktop
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1024,
      });

      render(
        <TestWrapper>
          <SearchResultsPage />
        </TestWrapper>
      );

      // Should have grid layout for desktop
      const container = screen.getByTestId('search-results-container');
      expect(container).toBeInTheDocument();
      expect(container).toHaveClass('grid', 'grid-cols-[30%_70%]');
    });

    it('should stack columns on mobile', () => {
      // Mock window.innerWidth for mobile
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 768,
      });

      render(
        <TestWrapper>
          <SearchResultsPage />
        </TestWrapper>
      );

      // Should stack columns on mobile
      const container = screen.getByTestId('search-results-container');
      expect(container).toBeInTheDocument();
      expect(container).toHaveClass('flex', 'flex-col');
    });
  });
});
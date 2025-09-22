/**
 * @vitest-environment jsdom
 * useSearchPageQuery Hook Tests
 *
 * Tests URL parameter management following settings.test.tsx mock patterns
 */

import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useSearchPageQuery } from './useSearchPageQuery';

// Mock wouter hooks following settings.test.tsx pattern
const mockSetLocation = vi.fn();
vi.mock('wouter', () => ({
  useLocation: () => ['/search?q=engineer', mockSetLocation],
}));

describe('useSearchPageQuery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset URL
    delete (window as any).location;
    (window as any).location = {
      search: '?q=engineer',
      href: 'http://localhost:3000/search?q=engineer',
    };
  });

  it('should extract query from URL parameters', () => {
    // Mock URL with search query
    (window as any).location.search = '?q=product%20manager';

    const { result } = renderHook(() => useSearchPageQuery());

    expect(result.current.query).toBe('product manager');
  });

  it('should handle missing query parameter', () => {
    // Mock URL without search query
    (window as any).location.search = '';

    const { result } = renderHook(() => useSearchPageQuery());

    expect(result.current.query).toBe('');
  });

  it('should decode URL-encoded search terms', () => {
    // Mock URL with encoded characters
    (window as any).location.search = '?q=software%20engineer%20%40%20google';

    const { result } = renderHook(() => useSearchPageQuery());

    expect(result.current.query).toBe('software engineer @ google');
  });

  it('should update URL when query changes', () => {
    const { result } = renderHook(() => useSearchPageQuery());

    act(() => {
      result.current.setQuery('new search term');
    });

    // Should call setLocation with updated URL
    expect(mockSetLocation).toHaveBeenCalledWith('/search?q=new%20search%20term');
  });

  it('should handle empty string in setQuery', () => {
    const { result } = renderHook(() => useSearchPageQuery());

    act(() => {
      result.current.setQuery('');
    });

    // Should navigate to search page without query parameter
    expect(mockSetLocation).toHaveBeenCalledWith('/search');
  });

  it('should encode special characters when updating URL', () => {
    const { result } = renderHook(() => useSearchPageQuery());

    act(() => {
      result.current.setQuery('search with @#$%');
    });

    // Should properly encode special characters
    expect(mockSetLocation).toHaveBeenCalledWith('/search?q=search%20with%20%40%23%24%25');
  });
});
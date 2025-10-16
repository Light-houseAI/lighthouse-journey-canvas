/**
 * Tests for MSW search handlers
 * Validates search and experience matching functionality
 */

import { describe, expect, it, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import React from 'react';

import { renderWithProviders } from '../test/renderWithProviders';
import { resetSearchState } from './search-handlers';

// Test component for search operations
const SearchTestComponent: React.FC = () => {
  const [searchResults, setSearchResults] = React.useState<any>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const handleBasicSearch = async (query: string, type?: string, page?: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ q: query });
      if (type) params.append('type', type);
      if (page) params.append('page', page.toString());

      const response = await fetch(`/api/search?${params}`);
      const data = await response.json();

      if (response.ok) {
        setSearchResults(data.data);
        setError(null);
      } else {
        setError(data.error);
        setSearchResults(null);
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  const handleAdvancedSearch = async (body: any) => {
    setLoading(true);
    try {
      const response = await fetch('/api/search/advanced', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (response.ok) {
        setSearchResults(data.data);
        setError(null);
      } else {
        setError(data.error);
        setSearchResults(null);
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1>Search Test</h1>

      {loading && <div data-testid="loading">Loading...</div>}
      {error && <div data-testid="error">{error}</div>}

      {searchResults && (
        <div data-testid="search-results">
          <div data-testid="result-count">
            Found {searchResults.total} results
          </div>
          <div data-testid="page-info">
            Page {searchResults.page} of {Math.ceil(searchResults.total / searchResults.pageSize)}
          </div>
          {searchResults.results.map((result: any) => (
            <div key={result.id} data-testid={`result-${result.id}`}>
              <span data-testid="result-title">{result.title}</span>
              <span data-testid="result-type">{result.type}</span>
              {result.score && (
                <span data-testid="result-score">{result.score}</span>
              )}
            </div>
          ))}
          {searchResults.hasMore && (
            <div data-testid="has-more">More results available</div>
          )}
        </div>
      )}

      <button onClick={() => handleBasicSearch('john')}>Search John</button>
      <button onClick={() => handleBasicSearch('engineer', 'node')}>
        Search Engineer (Nodes Only)
      </button>
      <button onClick={() => handleBasicSearch('john', undefined, 2)}>
        Search John Page 2
      </button>
      <button
        onClick={() =>
          handleAdvancedSearch({
            query: 'test',
            filters: { type: ['user', 'organization'] },
          })
        }
      >
        Advanced Search
      </button>
    </div>
  );
};

// Test component for experience matches
const ExperienceMatchesComponent: React.FC = () => {
  const [matches, setMatches] = React.useState<any>(null);
  const [error, setError] = React.useState<string | null>(null);

  const fetchMatches = async (nodeId: string) => {
    try {
      const response = await fetch(`/api/experience-matches/${nodeId}`);
      const data = await response.json();

      if (response.ok) {
        setMatches(data.data);
        setError(null);
      } else {
        setError(data.error);
        setMatches(null);
      }
    } catch (err) {
      setError('Network error');
    }
  };

  return (
    <div>
      <h1>Experience Matches</h1>

      {error && <div data-testid="error">{error}</div>}

      {matches && (
        <div data-testid="matches">
          <div data-testid="has-matches">
            {matches.hasMatches ? 'Has matches' : 'No matches'}
          </div>
          {matches.matches.map((match: any, idx: number) => (
            <div key={idx} data-testid={`match-${idx}`}>
              <span data-testid="match-type">{match.matchType}</span>
              <span data-testid="match-confidence">{match.confidence}</span>
              <span data-testid="match-reason">{match.reason}</span>
            </div>
          ))}
          {matches.averageConfidence > 0 && (
            <div data-testid="avg-confidence">{matches.averageConfidence}</div>
          )}
        </div>
      )}

      <button onClick={() => fetchMatches('123')}>Fetch Matches for 123</button>
      <button onClick={() => fetchMatches('non-existent')}>
        Fetch Non-existent
      </button>
      <button onClick={() => fetchMatches('no-matches')}>
        Fetch No Matches
      </button>
    </div>
  );
};

describe('Search Handlers', () => {
  beforeEach(() => {
    resetSearchState();
  });

  describe('Basic Search', () => {
    it('performs basic search with query', async () => {
      const { user } = renderWithProviders(<SearchTestComponent />);

      await user.click(screen.getByText('Search John'));

      await waitFor(() => {
        expect(screen.getByTestId('search-results')).toBeInTheDocument();
      });

      expect(screen.getByTestId('result-count')).toBeInTheDocument();
      expect(screen.queryByTestId('error')).not.toBeInTheDocument();
    });

    it('filters search by type', async () => {
      const { user } = renderWithProviders(<SearchTestComponent />);

      await user.click(screen.getByText('Search Engineer (Nodes Only)'));

      await waitFor(() => {
        expect(screen.getByTestId('search-results')).toBeInTheDocument();
      });

      // Check if there are any results with type 'node'
      const types = screen.queryAllByTestId('result-type');
      if (types.length > 0) {
        types.forEach(type => {
          expect(type.textContent).toBe('node');
        });
      } else {
        // If no results, check that the query returned 0 results
        expect(screen.getByTestId('result-count')).toHaveTextContent('Found 0 results');
      }
    });

    it('handles pagination', async () => {
      const { user } = renderWithProviders(<SearchTestComponent />);

      // First page
      await user.click(screen.getByText('Search John'));

      await waitFor(() => {
        expect(screen.getByTestId('page-info')).toBeInTheDocument();
      });

      const firstPageInfo = screen.getByTestId('page-info').textContent;

      // Second page
      await user.click(screen.getByText('Search John Page 2'));

      await waitFor(() => {
        expect(screen.getByTestId('page-info')).toHaveTextContent('Page 2');
      });
    });

    it('returns error for missing query', async () => {
      const SearchWithoutQuery = () => {
        const [error, setError] = React.useState<string | null>(null);

        const handleSearch = async () => {
          const response = await fetch('/api/search?q=');
          const data = await response.json();
          if (!response.ok) {
            setError(data.error);
          }
        };

        return (
          <div>
            <button onClick={handleSearch}>Search Empty</button>
            {error && <div data-testid="error">{error}</div>}
          </div>
        );
      };

      const { user } = renderWithProviders(<SearchWithoutQuery />);

      await user.click(screen.getByText('Search Empty'));

      await waitFor(() => {
        expect(screen.getByTestId('error')).toBeInTheDocument();
      });

      expect(screen.getByTestId('error')).toHaveTextContent('Query parameter is required');
    });
  });

  describe('Advanced Search', () => {
    it('performs advanced search with filters', async () => {
      const { user } = renderWithProviders(<SearchTestComponent />);

      await user.click(screen.getByText('Advanced Search'));

      await waitFor(() => {
        expect(screen.getByTestId('search-results')).toBeInTheDocument();
      });

      // Check that results are filtered to users and organizations only
      const types = screen.queryAllByTestId('result-type');
      if (types.length > 0) {
        types.forEach(type => {
          expect(['user', 'organization']).toContain(type.textContent);
        });
      } else {
        // If no results, verify search was performed
        expect(screen.getByTestId('result-count')).toBeInTheDocument();
      }
    });

    it('handles advanced search without query', async () => {
      const AdvancedSearchComponent = () => {
        const [results, setResults] = React.useState<any>(null);

        const handleSearch = async () => {
          const response = await fetch('/api/search/advanced', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              filters: { type: ['user'] },
              sort: { field: 'title', order: 'asc' },
            }),
          });

          const data = await response.json();
          if (response.ok) {
            setResults(data.data);
          }
        };

        return (
          <div>
            <button onClick={handleSearch}>Search Without Query</button>
            {results && (
              <div data-testid="results">Found {results.total} results</div>
            )}
          </div>
        );
      };

      const { user } = renderWithProviders(<AdvancedSearchComponent />);

      await user.click(screen.getByText('Search Without Query'));

      await waitFor(() => {
        expect(screen.getByTestId('results')).toBeInTheDocument();
      });
    });
  });

  describe('Experience Matches', () => {
    it('fetches matches for a valid node', async () => {
      const { user } = renderWithProviders(<ExperienceMatchesComponent />);

      await user.click(screen.getByText('Fetch Matches for 123'));

      await waitFor(() => {
        expect(screen.getByTestId('matches')).toBeInTheDocument();
      });

      expect(screen.getByTestId('has-matches')).toHaveTextContent('Has matches');
      expect(screen.getByTestId('match-0')).toBeInTheDocument();

      // Use getAllByTestId since there are multiple matches
      const matchTypes = screen.getAllByTestId('match-type');
      expect(matchTypes.length).toBeGreaterThan(0);
      expect(matchTypes[0]).toBeInTheDocument();

      const matchConfidences = screen.getAllByTestId('match-confidence');
      expect(matchConfidences.length).toBeGreaterThan(0);

      expect(screen.getByTestId('avg-confidence')).toBeInTheDocument();
    });

    it('handles non-existent node', async () => {
      const { user } = renderWithProviders(<ExperienceMatchesComponent />);

      await user.click(screen.getByText('Fetch Non-existent'));

      await waitFor(() => {
        expect(screen.getByTestId('error')).toBeInTheDocument();
      });

      expect(screen.getByTestId('error')).toHaveTextContent('Node not found');
    });

    it('handles node with no matches', async () => {
      const { user } = renderWithProviders(<ExperienceMatchesComponent />);

      await user.click(screen.getByText('Fetch No Matches'));

      await waitFor(() => {
        expect(screen.getByTestId('matches')).toBeInTheDocument();
      });

      expect(screen.getByTestId('has-matches')).toHaveTextContent('No matches');
      expect(screen.queryByTestId('match-0')).not.toBeInTheDocument();
    });
  });

  describe('Search Suggestions', () => {
    it('fetches search suggestions', async () => {
      const SuggestionsComponent = () => {
        const [suggestions, setSuggestions] = React.useState<any[]>([]);

        const fetchSuggestions = async (query: string) => {
          const response = await fetch(`/api/search/suggestions?q=${query}&limit=3`);
          const data = await response.json();
          if (response.ok) {
            setSuggestions(data.suggestions);
          }
        };

        return (
          <div>
            <button onClick={() => fetchSuggestions('eng')}>Get Suggestions</button>
            <div data-testid="suggestions">
              {suggestions.map((s, idx) => (
                <div key={idx} data-testid={`suggestion-${idx}`}>
                  {s.text} ({s.count})
                </div>
              ))}
            </div>
          </div>
        );
      };

      const { user } = renderWithProviders(<SuggestionsComponent />);

      await user.click(screen.getByText('Get Suggestions'));

      await waitFor(() => {
        expect(screen.getByTestId('suggestion-0')).toBeInTheDocument();
      });

      // Check that suggestions contain 'eng' (case-insensitive)
      const suggestions = screen.getAllByTestId(/^suggestion-/);
      suggestions.forEach(s => {
        expect(s.textContent?.toLowerCase()).toContain('eng');
      });
    });

    it('returns empty suggestions for short query', async () => {
      const SuggestionsComponent = () => {
        const [suggestions, setSuggestions] = React.useState<any[]>([]);

        const fetchSuggestions = async () => {
          const response = await fetch('/api/search/suggestions?q=e');
          const data = await response.json();
          setSuggestions(data.suggestions);
        };

        return (
          <div>
            <button onClick={fetchSuggestions}>Get Short Query</button>
            <div data-testid="suggestions-count">{suggestions.length}</div>
          </div>
        );
      };

      const { user } = renderWithProviders(<SuggestionsComponent />);

      await user.click(screen.getByText('Get Short Query'));

      await waitFor(() => {
        expect(screen.getByTestId('suggestions-count')).toHaveTextContent('0');
      });
    });
  });
});
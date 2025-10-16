/**
 * MSW Search Handlers
 *
 * Handles search and experience matching endpoints for testing search functionality
 */

import { http, HttpResponse } from 'msw';
import {
  createMockUser,
  createMockOrganizations,
  createMockHierarchyNodes,
  createMockTimelineNodes,
  createMockProfile
} from '../test/factories';

// Types for search results
interface SearchResult {
  id: string | number;
  type: 'user' | 'organization' | 'node';
  title: string;
  description?: string;
  metadata?: Record<string, any>;
  score?: number;
}

interface SearchResponse {
  results: SearchResult[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

interface ExperienceMatch {
  nodeId: string;
  matchType: 'skill' | 'role' | 'company' | 'industry';
  confidence: number;
  reason: string;
  metadata?: Record<string, any>;
}

// Store for managing search state (useful for testing pagination)
let searchResultsCache: SearchResult[] = [];

/**
 * Generate mock search results based on query
 */
function generateSearchResults(query: string, type?: string): SearchResult[] {
  const results: SearchResult[] = [];

  // Generate user results
  if (!type || type === 'user') {
    const users = [
      createMockUser({ overrides: {
        email: 'john.doe@example.com',
        firstName: 'John',
        lastName: 'Doe'
      }}),
      createMockUser({ overrides: {
        email: 'jane.smith@example.com',
        firstName: 'Jane',
        lastName: 'Smith'
      }}),
      createMockUser({ overrides: {
        email: 'alex.jones@example.com',
        firstName: 'Alex',
        lastName: 'Jones'
      }})
    ];

    users.forEach(user => {
      const fullName = `${user.firstName} ${user.lastName}`;
      if (!query || fullName.toLowerCase().includes(query.toLowerCase()) ||
          user.email.toLowerCase().includes(query.toLowerCase())) {
        results.push({
          id: user.id,
          type: 'user',
          title: fullName,
          description: user.email,
          metadata: { userName: user.userName },
          score: 0.9
        });
      }
    });
  }

  // Generate organization results
  if (!type || type === 'organization') {
    const orgs = createMockOrganizations(3);
    orgs.forEach(org => {
      if (!query || org.name.toLowerCase().includes(query.toLowerCase()) ||
          org.description?.toLowerCase().includes(query.toLowerCase())) {
        results.push({
          id: org.id,
          type: 'organization',
          title: org.name,
          description: org.description,
          metadata: { type: org.type },
          score: 0.85
        });
      }
    });
  }

  // Generate node results
  if (!type || type === 'node') {
    const nodes = [
      ...createMockTimelineNodes(3, {
        overrides: (index) => ({
          title: `Software Engineer ${index + 1}`,
          description: `Engineering role at company ${index + 1}`
        })
      }),
      ...createMockTimelineNodes(2, {
        overrides: (index) => ({
          title: `Engineering Manager ${index + 1}`,
          description: `Management role at organization ${index + 1}`
        })
      })
    ];

    nodes.forEach(node => {
      if (!query || node.title.toLowerCase().includes(query.toLowerCase()) ||
          node.description?.toLowerCase().includes(query.toLowerCase())) {
        results.push({
          id: node.id,
          type: 'node',
          title: node.title,
          description: node.description,
          metadata: {
            type: node.type,
            startDate: node.startDate,
            endDate: node.endDate
          },
          score: 0.8
        });
      }
    });
  }

  // Sort by score descending
  return results.sort((a, b) => (b.score || 0) - (a.score || 0));
}

/**
 * Generate mock experience matches for a node
 */
function generateExperienceMatches(nodeId: string): ExperienceMatch[] {
  // Simulate different match types based on nodeId
  const matches: ExperienceMatch[] = [];

  // Skill matches
  matches.push({
    nodeId,
    matchType: 'skill',
    confidence: 0.95,
    reason: 'Strong match in React and TypeScript skills',
    metadata: {
      skills: ['React', 'TypeScript', 'Node.js'],
      overlap: 0.85
    }
  });

  // Role matches
  matches.push({
    nodeId,
    matchType: 'role',
    confidence: 0.88,
    reason: 'Similar senior engineering role',
    metadata: {
      currentRole: 'Senior Software Engineer',
      matchedRole: 'Staff Engineer',
      yearsExperience: 5
    }
  });

  // Company culture match
  if (parseInt(nodeId) % 2 === 0) {
    matches.push({
      nodeId,
      matchType: 'company',
      confidence: 0.76,
      reason: 'Company culture aligns with preferences',
      metadata: {
        companySize: 'medium',
        culture: ['collaborative', 'innovative'],
        workStyle: 'hybrid'
      }
    });
  }

  // Industry match
  if (parseInt(nodeId) % 3 === 0) {
    matches.push({
      nodeId,
      matchType: 'industry',
      confidence: 0.82,
      reason: 'Experience in similar industry sectors',
      metadata: {
        industries: ['FinTech', 'SaaS'],
        domainExpertise: ['payments', 'B2B']
      }
    });
  }

  return matches;
}

export const searchHandlers = [
  // ============================================================================
  // BASIC SEARCH
  // ============================================================================

  // GET /api/search - Basic search with query params
  http.get('/api/search', ({ request }) => {
    const url = new URL(request.url);
    const query = url.searchParams.get('q') || '';
    const type = url.searchParams.get('type') || undefined;
    const page = parseInt(url.searchParams.get('page') || '1');
    const pageSize = parseInt(url.searchParams.get('pageSize') || '10');

    // Validate query
    if (!query) {
      return HttpResponse.json(
        {
          error: 'Query parameter is required',
          success: false
        },
        { status: 400 }
      );
    }

    // Generate or use cached results
    if (page === 1) {
      searchResultsCache = generateSearchResults(query, type);
    }

    // Paginate results
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedResults = searchResultsCache.slice(startIndex, endIndex);

    const response: SearchResponse = {
      results: paginatedResults,
      total: searchResultsCache.length,
      page,
      pageSize,
      hasMore: endIndex < searchResultsCache.length
    };

    return HttpResponse.json({
      success: true,
      data: response
    });
  }),

  // ============================================================================
  // ADVANCED SEARCH
  // ============================================================================

  // POST /api/search/advanced - Advanced search with filters
  http.post('/api/search/advanced', async ({ request }) => {
    const body = await request.json() as {
      query?: string;
      filters?: {
        type?: string[];
        dateRange?: { start: string; end: string };
        tags?: string[];
        skills?: string[];
        organizations?: string[];
      };
      sort?: {
        field: 'relevance' | 'date' | 'title';
        order: 'asc' | 'desc';
      };
      page?: number;
      pageSize?: number;
    };

    const page = body.page || 1;
    const pageSize = body.pageSize || 10;

    // Generate results based on filters
    let results: SearchResult[] = [];

    // If query provided, use basic search first
    if (body.query) {
      results = generateSearchResults(body.query);
    } else {
      // Generate all results and filter
      results = [
        ...generateSearchResults(''),
        ...generateSearchResults('engineer'),
        ...generateSearchResults('tech')
      ];
    }

    // Apply type filters
    if (body.filters?.type?.length) {
      results = results.filter(r => body.filters!.type!.includes(r.type));
    }

    // Apply sorting
    if (body.sort) {
      results.sort((a, b) => {
        const order = body.sort!.order === 'asc' ? 1 : -1;
        switch (body.sort!.field) {
          case 'relevance':
            return ((b.score || 0) - (a.score || 0)) * order;
          case 'title':
            return a.title.localeCompare(b.title) * order;
          default:
            return 0;
        }
      });
    }

    // Paginate
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedResults = results.slice(startIndex, endIndex);

    const response: SearchResponse = {
      results: paginatedResults,
      total: results.length,
      page,
      pageSize,
      hasMore: endIndex < results.length
    };

    return HttpResponse.json({
      success: true,
      data: response
    });
  }),

  // ============================================================================
  // EXPERIENCE MATCHES
  // ============================================================================

  // GET /api/experience-matches/:nodeId - Get experience matches for a node
  http.get('/api/experience-matches/:nodeId', ({ params }) => {
    const { nodeId } = params as { nodeId: string };

    // Simulate node not found
    if (nodeId === 'non-existent') {
      return HttpResponse.json(
        {
          error: 'Node not found',
          success: false
        },
        { status: 404 }
      );
    }

    // Simulate no matches
    if (nodeId === 'no-matches') {
      return HttpResponse.json({
        success: true,
        data: {
          nodeId,
          matches: [],
          hasMatches: false
        }
      });
    }

    // Generate matches
    const matches = generateExperienceMatches(nodeId);

    return HttpResponse.json({
      success: true,
      data: {
        nodeId,
        matches,
        hasMatches: matches.length > 0,
        topMatch: matches[0] || null,
        averageConfidence: matches.length > 0
          ? matches.reduce((sum, m) => sum + m.confidence, 0) / matches.length
          : 0
      }
    });
  }),

  // GET /api/nodes/:nodeId/matches - Alternative endpoint
  http.get('/api/nodes/:nodeId/matches', ({ params }) => {
    const { nodeId } = params as { nodeId: string };

    const matches = generateExperienceMatches(nodeId);

    return HttpResponse.json({
      success: true,
      matches
    });
  }),

  // ============================================================================
  // SEARCH SUGGESTIONS
  // ============================================================================

  // GET /api/search/suggestions - Get search suggestions/autocomplete
  http.get('/api/search/suggestions', ({ request }) => {
    const url = new URL(request.url);
    const query = url.searchParams.get('q') || '';
    const limit = parseInt(url.searchParams.get('limit') || '5');

    if (!query || query.length < 2) {
      return HttpResponse.json({
        success: true,
        suggestions: []
      });
    }

    // Generate suggestions based on query
    const suggestions = [
      'Software Engineer',
      'Senior Developer',
      'Staff Engineer',
      'Engineering Manager',
      'Technical Lead',
      'Product Manager',
      'Data Scientist',
      'DevOps Engineer',
      'Full Stack Developer',
      'Frontend Developer'
    ]
      .filter(s => s.toLowerCase().includes(query.toLowerCase()))
      .slice(0, limit)
      .map(s => ({
        text: s,
        type: 'role',
        count: Math.floor(Math.random() * 100) + 10
      }));

    return HttpResponse.json({
      success: true,
      suggestions
    });
  }),

  // ============================================================================
  // SEARCH HISTORY
  // ============================================================================

  // GET /api/search/history - Get user's search history
  http.get('/api/search/history', () => {
    const history = [
      { query: 'React Developer', timestamp: new Date().toISOString(), resultCount: 42 },
      { query: 'Node.js', timestamp: new Date(Date.now() - 86400000).toISOString(), resultCount: 28 },
      { query: 'TypeScript', timestamp: new Date(Date.now() - 172800000).toISOString(), resultCount: 35 },
    ];

    return HttpResponse.json({
      success: true,
      history
    });
  }),

  // DELETE /api/search/history - Clear search history
  http.delete('/api/search/history', () => {
    return HttpResponse.json({
      success: true,
      message: 'Search history cleared'
    });
  }),
];

/**
 * Reset search state (useful between tests)
 */
export function resetSearchState() {
  searchResultsCache = [];
}
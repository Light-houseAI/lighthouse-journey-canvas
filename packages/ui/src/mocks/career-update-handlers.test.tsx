/**
 * Tests for Career Update MSW Handlers
 *
 * Validates CRUD operations for career transition updates
 */

import React from 'react';
import { describe, expect, it, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders, http, HttpResponse } from '../test/renderWithProviders';
import {
  careerUpdateHandlers,
  resetCareerUpdatesState,
  seedCareerUpdates,
} from './career-update-handlers';

describe('Career Update Handlers', () => {
  beforeEach(() => {
    resetCareerUpdatesState();
  });

  // ============================================================================
  // CREATE TESTS
  // ============================================================================

  describe('POST /api/nodes/:nodeId/updates', () => {
    it('should create a new career update', async () => {
      const TestComponent = () => {
        const [result, setResult] = React.useState<any>(null);

        const createUpdate = async () => {
          const response = await fetch('/api/nodes/node-1/updates', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              notes: 'Applied to 5 companies',
              meta: {
                appliedToJobs: true,
                networked: true,
              }
            })
          });
          const data = await response.json();
          setResult(data);
        };

        return (
          <div>
            <button onClick={createUpdate}>Create Update</button>
            {result && (
              <>
                <div data-testid="success">{result.success ? 'success' : 'failure'}</div>
                <div data-testid="notes">{result.data?.notes}</div>
                <div data-testid="applied">{result.data?.meta?.appliedToJobs?.toString()}</div>
                <div data-testid="rendered">{result.data?.renderedText}</div>
              </>
            )}
          </div>
        );
      };

      const { user } = renderWithProviders(<TestComponent />, {
        handlers: careerUpdateHandlers
      });

      await user.click(screen.getByText('Create Update'));

      await waitFor(() => {
        expect(screen.getByTestId('success')).toHaveTextContent('success');
        expect(screen.getByTestId('notes')).toHaveTextContent('Applied to 5 companies');
        expect(screen.getByTestId('applied')).toHaveTextContent('true');
        expect(screen.getByTestId('rendered')).toHaveTextContent('Applied to jobs, Networked');
      });
    });

    it('should return 404 for non-existent node', async () => {
      const TestComponent = () => {
        const [error, setError] = React.useState<any>(null);

        const createUpdate = async () => {
          const response = await fetch('/api/nodes/non-existent/updates', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ notes: 'Test' })
          });
          const data = await response.json();
          setError(data);
        };

        return (
          <div>
            <button onClick={createUpdate}>Create Update</button>
            {error && <div data-testid="error">{error.error}</div>}
          </div>
        );
      };

      const { user } = renderWithProviders(<TestComponent />, {
        handlers: careerUpdateHandlers
      });

      await user.click(screen.getByText('Create Update'));

      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent('Node not found');
      });
    });

    it('should validate request body', async () => {
      const TestComponent = () => {
        const [error, setError] = React.useState<any>(null);

        const createUpdate = async () => {
          const response = await fetch('/api/nodes/node-1/updates', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
          });
          const data = await response.json();
          setError(data);
        };

        return (
          <div>
            <button onClick={createUpdate}>Create Update</button>
            {error && <div data-testid="error">{error.error}</div>}
          </div>
        );
      };

      const { user } = renderWithProviders(<TestComponent />, {
        handlers: careerUpdateHandlers
      });

      await user.click(screen.getByText('Create Update'));

      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent('At least notes or meta must be provided');
      });
    });
  });

  // ============================================================================
  // READ TESTS
  // ============================================================================

  describe('GET /api/nodes/:nodeId/updates', () => {
    it('should get paginated updates for a node', async () => {
      // Seed data
      seedCareerUpdates('node-1', 5);

      const TestComponent = () => {
        const [result, setResult] = React.useState<any>(null);

        const getUpdates = async () => {
          const response = await fetch('/api/nodes/node-1/updates?page=1&limit=3');
          const data = await response.json();
          setResult(data);
        };

        return (
          <div>
            <button onClick={getUpdates}>Get Updates</button>
            {result && (
              <>
                <div data-testid="total">{result.data?.total}</div>
                <div data-testid="count">{result.data?.updates?.length}</div>
                <div data-testid="has-more">{result.data?.hasMore?.toString()}</div>
              </>
            )}
          </div>
        );
      };

      const { user } = renderWithProviders(<TestComponent />, {
        handlers: careerUpdateHandlers
      });

      await user.click(screen.getByText('Get Updates'));

      await waitFor(() => {
        expect(screen.getByTestId('total')).toHaveTextContent('5');
        expect(screen.getByTestId('count')).toHaveTextContent('3');
        expect(screen.getByTestId('has-more')).toHaveTextContent('true');
      });
    });

    it('should return empty list for node with no updates', async () => {
      const TestComponent = () => {
        const [result, setResult] = React.useState<any>(null);

        const getUpdates = async () => {
          const response = await fetch('/api/nodes/node-empty/updates');
          const data = await response.json();
          setResult(data);
        };

        return (
          <div>
            <button onClick={getUpdates}>Get Updates</button>
            {result && (
              <>
                <div data-testid="total">{result.data?.total}</div>
                <div data-testid="count">{result.data?.updates?.length}</div>
              </>
            )}
          </div>
        );
      };

      const { user } = renderWithProviders(<TestComponent />, {
        handlers: careerUpdateHandlers
      });

      await user.click(screen.getByText('Get Updates'));

      await waitFor(() => {
        expect(screen.getByTestId('total')).toHaveTextContent('0');
        expect(screen.getByTestId('count')).toHaveTextContent('0');
      });
    });
  });

  describe('GET /api/nodes/:nodeId/updates/:updateId', () => {
    it('should get specific update', async () => {
      const updates = seedCareerUpdates('node-1', 1);
      const updateId = updates[0].id;

      const TestComponent = () => {
        const [result, setResult] = React.useState<any>(null);

        const getUpdate = async () => {
          const response = await fetch(`/api/nodes/node-1/updates/${updateId}`);
          const data = await response.json();
          setResult(data);
        };

        return (
          <div>
            <button onClick={getUpdate}>Get Update</button>
            {result && (
              <>
                <div data-testid="id">{result.data?.id}</div>
                <div data-testid="node-id">{result.data?.nodeId}</div>
              </>
            )}
          </div>
        );
      };

      const { user } = renderWithProviders(<TestComponent />, {
        handlers: careerUpdateHandlers
      });

      await user.click(screen.getByText('Get Update'));

      await waitFor(() => {
        expect(screen.getByTestId('id')).toHaveTextContent(updateId);
        expect(screen.getByTestId('node-id')).toHaveTextContent('node-1');
      });
    });

    it('should return 404 for non-existent update', async () => {
      const TestComponent = () => {
        const [error, setError] = React.useState<any>(null);

        const getUpdate = async () => {
          const response = await fetch('/api/nodes/node-1/updates/fake-id');
          const data = await response.json();
          setError(data);
        };

        return (
          <div>
            <button onClick={getUpdate}>Get Update</button>
            {error && <div data-testid="error">{error.error}</div>}
          </div>
        );
      };

      const { user } = renderWithProviders(<TestComponent />, {
        handlers: careerUpdateHandlers
      });

      await user.click(screen.getByText('Get Update'));

      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent('Update not found');
      });
    });
  });

  // ============================================================================
  // UPDATE TESTS
  // ============================================================================

  describe('PUT /api/nodes/:nodeId/updates/:updateId', () => {
    it('should update existing update', async () => {
      const updates = seedCareerUpdates('node-1', 1);
      const updateId = updates[0].id;

      const TestComponent = () => {
        const [result, setResult] = React.useState<any>(null);

        const updateUpdate = async () => {
          const response = await fetch(`/api/nodes/node-1/updates/${updateId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              notes: 'Updated notes',
              meta: { receivedOffers: true }
            })
          });
          const data = await response.json();
          setResult(data);
        };

        return (
          <div>
            <button onClick={updateUpdate}>Update Update</button>
            {result && (
              <>
                <div data-testid="notes">{result.data?.notes}</div>
                <div data-testid="offers">{result.data?.meta?.receivedOffers?.toString()}</div>
              </>
            )}
          </div>
        );
      };

      const { user } = renderWithProviders(<TestComponent />, {
        handlers: careerUpdateHandlers
      });

      await user.click(screen.getByText('Update Update'));

      await waitFor(() => {
        expect(screen.getByTestId('notes')).toHaveTextContent('Updated notes');
        expect(screen.getByTestId('offers')).toHaveTextContent('true');
      });
    });

    it('should return 404 for non-existent update', async () => {
      const TestComponent = () => {
        const [error, setError] = React.useState<any>(null);

        const updateUpdate = async () => {
          const response = await fetch('/api/nodes/node-1/updates/fake-id', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ notes: 'Test' })
          });
          const data = await response.json();
          setError(data);
        };

        return (
          <div>
            <button onClick={updateUpdate}>Update Update</button>
            {error && <div data-testid="error">{error.error}</div>}
          </div>
        );
      };

      const { user } = renderWithProviders(<TestComponent />, {
        handlers: careerUpdateHandlers
      });

      await user.click(screen.getByText('Update Update'));

      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent('Update not found');
      });
    });
  });

  // ============================================================================
  // DELETE TESTS
  // ============================================================================

  describe('DELETE /api/nodes/:nodeId/updates/:updateId', () => {
    it('should delete update', async () => {
      const updates = seedCareerUpdates('node-1', 1);
      const updateId = updates[0].id;

      const TestComponent = () => {
        const [status, setStatus] = React.useState<number | null>(null);

        const deleteUpdate = async () => {
          const response = await fetch(`/api/nodes/node-1/updates/${updateId}`, {
            method: 'DELETE'
          });
          setStatus(response.status);
        };

        return (
          <div>
            <button onClick={deleteUpdate}>Delete Update</button>
            {status && <div data-testid="status">{status}</div>}
          </div>
        );
      };

      const { user } = renderWithProviders(<TestComponent />, {
        handlers: careerUpdateHandlers
      });

      await user.click(screen.getByText('Delete Update'));

      await waitFor(() => {
        expect(screen.getByTestId('status')).toHaveTextContent('204');
      });
    });

    it('should return 404 for non-existent update', async () => {
      const TestComponent = () => {
        const [error, setError] = React.useState<any>(null);

        const deleteUpdate = async () => {
          const response = await fetch('/api/nodes/node-1/updates/fake-id', {
            method: 'DELETE'
          });
          const data = await response.json();
          setError(data);
        };

        return (
          <div>
            <button onClick={deleteUpdate}>Delete Update</button>
            {error && <div data-testid="error">{error.error}</div>}
          </div>
        );
      };

      const { user } = renderWithProviders(<TestComponent />, {
        handlers: careerUpdateHandlers
      });

      await user.click(screen.getByText('Delete Update'));

      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent('Update not found');
      });
    });
  });

  // ============================================================================
  // SEED FUNCTION TESTS
  // ============================================================================

  describe('seedCareerUpdates', () => {
    it('should seed multiple updates for a node', async () => {
      seedCareerUpdates('node-1', 10);

      const TestComponent = () => {
        const [result, setResult] = React.useState<any>(null);

        const getUpdates = async () => {
          const response = await fetch('/api/nodes/node-1/updates?page=1&limit=100');
          const data = await response.json();
          setResult(data);
        };

        return (
          <div>
            <button onClick={getUpdates}>Get Updates</button>
            {result && <div data-testid="total">{result.data?.total}</div>}
          </div>
        );
      };

      const { user } = renderWithProviders(<TestComponent />, {
        handlers: careerUpdateHandlers
      });

      await user.click(screen.getByText('Get Updates'));

      await waitFor(() => {
        expect(screen.getByTestId('total')).toHaveTextContent('10');
      });
    });
  });
});

/**
 * Tests for Permission MSW Handlers
 *
 * Validates permission management operations for node sharing and access control
 */

import React from 'react';
import { describe, expect, it, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../test/renderWithProviders';
import {
  permissionHandlers,
  setMockPermissionsScenario,
  resetMockPermissions,
} from './permission-handlers';
import { VisibilityLevel, SubjectType, PermissionAction, PolicyEffect } from '@journey/schema';

describe('Permission Handlers', () => {
  beforeEach(() => {
    resetMockPermissions();
  });

  // ============================================================================
  // GET PERMISSIONS
  // ============================================================================

  describe('GET /api/v2/timeline/nodes/:nodeId/permissions', () => {
    it('should return empty permissions initially', async () => {
      const TestComponent = () => {
        const [result, setResult] = React.useState<any>(null);

        const getPermissions = async () => {
          const response = await fetch('/api/v2/timeline/nodes/node-1/permissions');
          const data = await response.json();
          setResult(data);
        };

        return (
          <div>
            <button onClick={getPermissions}>Get Permissions</button>
            {result && (
              <>
                <div data-testid="success">{result.success ? 'success' : 'failure'}</div>
                <div data-testid="count">{result.count}</div>
              </>
            )}
          </div>
        );
      };

      const { user } = renderWithProviders(<TestComponent />, {
        handlers: permissionHandlers
      });

      await user.click(screen.getByText('Get Permissions'));

      await waitFor(() => {
        expect(screen.getByTestId('success')).toHaveTextContent('success');
        expect(screen.getByTestId('count')).toHaveTextContent('0');
      });
    });
  });

  // ============================================================================
  // CREATE PERMISSION
  // ============================================================================

  describe('POST /api/v2/timeline/nodes/:nodeId/permissions', () => {
    it('should create a new permission', async () => {
      const TestComponent = () => {
        const [result, setResult] = React.useState<any>(null);

        const createPermission = async () => {
          const response = await fetch('/api/v2/timeline/nodes/node-1/permissions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              subjectType: 'user',
              subjectId: 123,
              level: 'overview',
              principalName: 'Test User',
              principalEmail: 'test@example.com'
            })
          });
          const data = await response.json();
          setResult(data);
        };

        return (
          <div>
            <button onClick={createPermission}>Create Permission</button>
            {result && (
              <>
                <div data-testid="success">{result.success ? 'success' : 'failure'}</div>
                <div data-testid="subject-id">{result.data?.subjectId}</div>
                <div data-testid="level">{result.data?.level}</div>
              </>
            )}
          </div>
        );
      };

      const { user } = renderWithProviders(<TestComponent />, {
        handlers: permissionHandlers
      });

      await user.click(screen.getByText('Create Permission'));

      await waitFor(() => {
        expect(screen.getByTestId('success')).toHaveTextContent('success');
        expect(screen.getByTestId('subject-id')).toHaveTextContent('123');
        expect(screen.getByTestId('level')).toHaveTextContent('overview');
      });
    });

    it('should support alternative field names from frontend', async () => {
      const TestComponent = () => {
        const [result, setResult] = React.useState<any>(null);

        const createPermission = async () => {
          const response = await fetch('/api/v2/timeline/nodes/node-1/permissions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              principalType: 'user',
              principalId: '456',
              accessLevel: 'full',
              principalName: 'Another User'
            })
          });
          const data = await response.json();
          setResult(data);
        };

        return (
          <div>
            <button onClick={createPermission}>Create Permission</button>
            {result && (
              <>
                <div data-testid="subject-type">{result.data?.subjectType}</div>
                <div data-testid="subject-id">{result.data?.subjectId}</div>
                <div data-testid="level">{result.data?.level}</div>
              </>
            )}
          </div>
        );
      };

      const { user } = renderWithProviders(<TestComponent />, {
        handlers: permissionHandlers
      });

      await user.click(screen.getByText('Create Permission'));

      await waitFor(() => {
        expect(screen.getByTestId('subject-type')).toHaveTextContent('user');
        expect(screen.getByTestId('subject-id')).toHaveTextContent('456');
        expect(screen.getByTestId('level')).toHaveTextContent('full');
      });
    });
  });

  // ============================================================================
  // UPDATE PERMISSION
  // ============================================================================

  describe('PUT /api/v2/timeline/permissions/:policyId', () => {
    it('should update permission level', async () => {
      // First create a permission
      const createResponse = await fetch('/api/v2/timeline/nodes/node-1/permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subjectType: 'user',
          subjectId: 789,
          level: 'overview'
        })
      });
      const created = await createResponse.json();
      const policyId = created.data.id;

      const TestComponent = () => {
        const [result, setResult] = React.useState<any>(null);

        const updatePermission = async () => {
          const response = await fetch(`/api/v2/timeline/permissions/${policyId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ level: 'full' })
          });
          const data = await response.json();
          setResult(data);
        };

        return (
          <div>
            <button onClick={updatePermission}>Update Permission</button>
            {result && (
              <>
                <div data-testid="success">{result.success ? 'success' : 'failure'}</div>
                <div data-testid="level">{result.data?.level}</div>
              </>
            )}
          </div>
        );
      };

      const { user } = renderWithProviders(<TestComponent />, {
        handlers: permissionHandlers
      });

      await user.click(screen.getByText('Update Permission'));

      await waitFor(() => {
        expect(screen.getByTestId('success')).toHaveTextContent('success');
        expect(screen.getByTestId('level')).toHaveTextContent('full');
      });
    });

    it('should return 404 for non-existent permission', async () => {
      const TestComponent = () => {
        const [error, setError] = React.useState<any>(null);

        const updatePermission = async () => {
          const response = await fetch('/api/v2/timeline/permissions/fake-policy-id', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ level: 'full' })
          });
          const data = await response.json();
          setError(data);
        };

        return (
          <div>
            <button onClick={updatePermission}>Update Permission</button>
            {error && <div data-testid="error">{error.error}</div>}
          </div>
        );
      };

      const { user } = renderWithProviders(<TestComponent />, {
        handlers: permissionHandlers
      });

      await user.click(screen.getByText('Update Permission'));

      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent('Permission not found');
      });
    });
  });

  // ============================================================================
  // DELETE PERMISSION
  // ============================================================================

  describe('DELETE /api/v2/timeline/nodes/:nodeId/permissions/:policyId', () => {
    it('should delete permission', async () => {
      // First create a permission
      const createResponse = await fetch('/api/v2/timeline/nodes/node-1/permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subjectType: 'user',
          subjectId: 999,
          level: 'overview'
        })
      });
      const created = await createResponse.json();
      const policyId = created.data.id;

      const TestComponent = () => {
        const [result, setResult] = React.useState<any>(null);

        const deletePermission = async () => {
          const response = await fetch(`/api/v2/timeline/nodes/node-1/permissions/${policyId}`, {
            method: 'DELETE'
          });
          const data = await response.json();
          setResult(data);
        };

        return (
          <div>
            <button onClick={deletePermission}>Delete Permission</button>
            {result && (
              <>
                <div data-testid="success">{result.success ? 'success' : 'failure'}</div>
                <div data-testid="message">{result.message}</div>
              </>
            )}
          </div>
        );
      };

      const { user } = renderWithProviders(<TestComponent />, {
        handlers: permissionHandlers
      });

      await user.click(screen.getByText('Delete Permission'));

      await waitFor(() => {
        expect(screen.getByTestId('success')).toHaveTextContent('success');
        expect(screen.getByTestId('message')).toHaveTextContent('Permission removed successfully');
      });
    });

    it('should return 404 for non-existent permission', async () => {
      const TestComponent = () => {
        const [error, setError] = React.useState<any>(null);

        const deletePermission = async () => {
          const response = await fetch('/api/v2/timeline/nodes/node-1/permissions/fake-policy-id', {
            method: 'DELETE'
          });
          const data = await response.json();
          setError(data);
        };

        return (
          <div>
            <button onClick={deletePermission}>Delete Permission</button>
            {error && <div data-testid="error">{error.error}</div>}
          </div>
        );
      };

      const { user } = renderWithProviders(<TestComponent />, {
        handlers: permissionHandlers
      });

      await user.click(screen.getByText('Delete Permission'));

      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent('Permission not found');
      });
    });
  });

  // ============================================================================
  // BULK OPERATIONS
  // ============================================================================

  describe('POST /api/v2/timeline/nodes/permissions/bulk', () => {
    it('should get bulk permissions for multiple nodes (empty scenario)', async () => {
      setMockPermissionsScenario('empty');

      const TestComponent = () => {
        const [result, setResult] = React.useState<any>(null);

        const getBulkPermissions = async () => {
          const response = await fetch('/api/v2/timeline/nodes/permissions/bulk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nodeIds: ['node-1', 'node-2'] })
          });
          const data = await response.json();
          setResult(data);
        };

        return (
          <div>
            <button onClick={getBulkPermissions}>Get Bulk Permissions</button>
            {result && (
              <>
                <div data-testid="node-count">{Object.keys(result).length}</div>
              </>
            )}
          </div>
        );
      };

      const { user } = renderWithProviders(<TestComponent />, {
        handlers: permissionHandlers
      });

      await user.click(screen.getByText('Get Bulk Permissions'));

      await waitFor(() => {
        expect(screen.getByTestId('node-count')).toHaveTextContent('2');
      });
    });

    it('should create bulk permissions for multiple nodes', async () => {
      const TestComponent = () => {
        const [result, setResult] = React.useState<any>(null);

        const createBulkPermissions = async () => {
          const response = await fetch('/api/v2/timeline/nodes/permissions/bulk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              nodeIds: ['node-1', 'node-2', 'node-3'],
              targets: [
                { type: 'user', id: 1, name: 'User 1', level: 'overview' },
                { type: 'user', id: 2, name: 'User 2', level: 'full' }
              ]
            })
          });
          const data = await response.json();
          setResult(data);
        };

        return (
          <div>
            <button onClick={createBulkPermissions}>Create Bulk Permissions</button>
            {result && (
              <>
                <div data-testid="success">{result.success ? 'success' : 'failure'}</div>
                <div data-testid="count">{result.count}</div>
              </>
            )}
          </div>
        );
      };

      const { user } = renderWithProviders(<TestComponent />, {
        handlers: permissionHandlers
      });

      await user.click(screen.getByText('Create Bulk Permissions'));

      await waitFor(() => {
        expect(screen.getByTestId('success')).toHaveTextContent('success');
        // 3 nodes * 2 targets = 6 permissions
        expect(screen.getByTestId('count')).toHaveTextContent('6');
      });
    });
  });

  // ============================================================================
  // SEARCH ENDPOINTS
  // ============================================================================

  describe('GET /api/v2/users/search', () => {
    it('should search users by first name', async () => {
      const TestComponent = () => {
        const [result, setResult] = React.useState<any>(null);

        const searchUsers = async () => {
          const response = await fetch('/api/v2/users/search?q=alice');
          const data = await response.json();
          setResult(data);
        };

        return (
          <div>
            <button onClick={searchUsers}>Search Users</button>
            {result && <div data-testid="count">{result.length}</div>}
          </div>
        );
      };

      const { user } = renderWithProviders(<TestComponent />, {
        handlers: permissionHandlers
      });

      await user.click(screen.getByText('Search Users'));

      await waitFor(() => {
        expect(screen.getByTestId('count')).toHaveTextContent('1');
      });
    });

    it('should return empty array for no query', async () => {
      const TestComponent = () => {
        const [result, setResult] = React.useState<any>(null);

        const searchUsers = async () => {
          const response = await fetch('/api/v2/users/search?q=');
          const data = await response.json();
          setResult(data);
        };

        return (
          <div>
            <button onClick={searchUsers}>Search Users</button>
            {result && <div data-testid="count">{result.length}</div>}
          </div>
        );
      };

      const { user } = renderWithProviders(<TestComponent />, {
        handlers: permissionHandlers
      });

      await user.click(screen.getByText('Search Users'));

      await waitFor(() => {
        expect(screen.getByTestId('count')).toHaveTextContent('0');
      });
    });
  });

  describe('GET /api/v2/organizations/search', () => {
    it('should search organizations by name', async () => {
      const TestComponent = () => {
        const [result, setResult] = React.useState<any>(null);

        const searchOrgs = async () => {
          const response = await fetch('/api/v2/organizations/search?q=paypal');
          const data = await response.json();
          setResult(data);
        };

        return (
          <div>
            <button onClick={searchOrgs}>Search Organizations</button>
            {result && <div data-testid="count">{result.length}</div>}
          </div>
        );
      };

      const { user } = renderWithProviders(<TestComponent />, {
        handlers: permissionHandlers
      });

      await user.click(screen.getByText('Search Organizations'));

      await waitFor(() => {
        expect(screen.getByTestId('count')).toHaveTextContent('1');
      });
    });
  });

  // ============================================================================
  // UTILITY ENDPOINTS
  // ============================================================================

  describe('GET /api/v2/users/:userId', () => {
    it('should get user by id', async () => {
      const TestComponent = () => {
        const [result, setResult] = React.useState<any>(null);

        const getUser = async () => {
          const response = await fetch('/api/v2/users/1');
          const data = await response.json();
          setResult(data);
        };

        return (
          <div>
            <button onClick={getUser}>Get User</button>
            {result && (
              <>
                <div data-testid="id">{result.id}</div>
                <div data-testid="name">{result.firstName} {result.lastName}</div>
              </>
            )}
          </div>
        );
      };

      const { user } = renderWithProviders(<TestComponent />, {
        handlers: permissionHandlers
      });

      await user.click(screen.getByText('Get User'));

      await waitFor(() => {
        expect(screen.getByTestId('id')).toHaveTextContent('1');
      });
    });

    it('should return 404 for non-existent user', async () => {
      const TestComponent = () => {
        const [status, setStatus] = React.useState<number | null>(null);

        const getUser = async () => {
          const response = await fetch('/api/v2/users/99999');
          setStatus(response.status);
        };

        return (
          <div>
            <button onClick={getUser}>Get User</button>
            {status && <div data-testid="status">{status}</div>}
          </div>
        );
      };

      const { user } = renderWithProviders(<TestComponent />, {
        handlers: permissionHandlers
      });

      await user.click(screen.getByText('Get User'));

      await waitFor(() => {
        expect(screen.getByTestId('status')).toHaveTextContent('404');
      });
    });
  });

  describe('POST /api/v2/users/by-ids', () => {
    it('should get multiple users by IDs', async () => {
      const TestComponent = () => {
        const [result, setResult] = React.useState<any>(null);

        const getUsers = async () => {
          const response = await fetch('/api/v2/users/by-ids', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: [1, 2] })
          });
          const data = await response.json();
          setResult(data);
        };

        return (
          <div>
            <button onClick={getUsers}>Get Users</button>
            {result && <div data-testid="count">{result.length}</div>}
          </div>
        );
      };

      const { user } = renderWithProviders(<TestComponent />, {
        handlers: permissionHandlers
      });

      await user.click(screen.getByText('Get Users'));

      await waitFor(() => {
        expect(screen.getByTestId('count')).toHaveTextContent('2');
      });
    });
  });

  describe('GET /api/v2/organizations/:orgId', () => {
    it('should get organization by id', async () => {
      const TestComponent = () => {
        const [result, setResult] = React.useState<any>(null);

        const getOrg = async () => {
          const response = await fetch('/api/v2/organizations/111');
          const data = await response.json();
          setResult(data);
        };

        return (
          <div>
            <button onClick={getOrg}>Get Organization</button>
            {result && (
              <>
                <div data-testid="id">{result.id}</div>
                <div data-testid="name">{result.name}</div>
              </>
            )}
          </div>
        );
      };

      const { user } = renderWithProviders(<TestComponent />, {
        handlers: permissionHandlers
      });

      await user.click(screen.getByText('Get Organization'));

      await waitFor(() => {
        expect(screen.getByTestId('id')).toHaveTextContent('111');
      });
    });
  });

  describe('GET /api/v2/organizations/user', () => {
    it('should get user organizations', async () => {
      const TestComponent = () => {
        const [result, setResult] = React.useState<any>(null);

        const getUserOrgs = async () => {
          const response = await fetch('/api/v2/organizations/user');
          const data = await response.json();
          setResult(data);
        };

        return (
          <div>
            <button onClick={getUserOrgs}>Get User Organizations</button>
            {result && <div data-testid="count">{result.length}</div>}
          </div>
        );
      };

      const { user } = renderWithProviders(<TestComponent />, {
        handlers: permissionHandlers
      });

      await user.click(screen.getByText('Get User Organizations'));

      await waitFor(() => {
        expect(screen.getByTestId('count')).toHaveTextContent('2');
      });
    });
  });
});

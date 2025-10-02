/**
 * Updates API Service Tests
 */

import { expect, it, vi } from 'vitest';

import type { CreateUpdateRequest, Update } from '@journey/schema';

import { httpClient } from './http-client';
import { createUpdate } from './updates-api';

// Mock httpClient
vi.mock('./http-client', () => ({
  httpClient: {
    request: vi.fn(),
  },
}));

it('should create a new update for a node', async () => {
  const nodeId = 'test-node-id';
  const requestData: CreateUpdateRequest = {
    notes: 'Applied to 5 companies',
    meta: {
      appliedToJobs: true,
      networked: true,
    },
  };

  const mockResponse: Update = {
    id: 'update-123',
    nodeId,
    notes: 'Applied to 5 companies',
    meta: {
      appliedToJobs: true,
      updatedResumeOrPortfolio: false,
      networked: true,
      developedSkills: false,
    },
    renderedText: null,
    isDeleted: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  vi.mocked(httpClient.request).mockResolvedValueOnce(mockResponse);

  const result = await createUpdate(nodeId, requestData);

  expect(httpClient.request).toHaveBeenCalledWith(
    `/api/v2/nodes/${nodeId}/updates`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestData),
    }
  );
  expect(result).toEqual(mockResponse);
});
it('should get paginated updates for a node', async () => {
  const nodeId = 'test-node-id';
  const mockResponse = {
    updates: [
      {
        id: 'update-1',
        nodeId,
        notes: 'Update 1',
        meta: {
          appliedToJobs: true,
          updatedResumeOrPortfolio: false,
          networked: false,
          developedSkills: false,
        },
        renderedText: null,
        isDeleted: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
    pagination: {
      page: 1,
      limit: 20,
      total: 1,
      totalPages: 1,
    },
  };

  vi.mocked(httpClient.request).mockResolvedValueOnce(mockResponse);

  const { getUpdatesByNodeId } = await import('./updates-api');
  const result = await getUpdatesByNodeId(nodeId, { page: 1, limit: 20 });

  expect(httpClient.request).toHaveBeenCalledWith(
    `/api/v2/nodes/${nodeId}/updates?page=1&limit=20`
  );
  expect(result).toEqual(mockResponse);
});

it('should get a single update by ID', async () => {
  const nodeId = 'test-node-id';
  const updateId = 'update-123';
  const mockResponse: Update = {
    id: updateId,
    nodeId,
    notes: 'Test update',
    meta: {
      appliedToJobs: true,
      updatedResumeOrPortfolio: false,
      networked: true,
      developedSkills: false,
    },
    renderedText: null,
    isDeleted: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  vi.mocked(httpClient.request).mockResolvedValueOnce(mockResponse);

  const { getUpdateById } = await import('./updates-api');
  const result = await getUpdateById(nodeId, updateId);

  expect(httpClient.request).toHaveBeenCalledWith(
    `/api/v2/nodes/${nodeId}/updates/${updateId}`
  );
  expect(result).toEqual(mockResponse);
});

it('should update an existing update', async () => {
  const nodeId = 'test-node-id';
  const updateId = 'update-123';
  const updateData = {
    notes: 'Updated notes',
    meta: {
      appliedToJobs: false,
      networked: true,
    },
  };

  const mockResponse: Update = {
    id: updateId,
    nodeId,
    notes: 'Updated notes',
    meta: {
      appliedToJobs: false,
      updatedResumeOrPortfolio: false,
      networked: true,
      developedSkills: false,
    },
    renderedText: null,
    isDeleted: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  vi.mocked(httpClient.request).mockResolvedValueOnce(mockResponse);

  const { updateUpdate } = await import('./updates-api');
  const result = await updateUpdate(nodeId, updateId, updateData);

  expect(httpClient.request).toHaveBeenCalledWith(
    `/api/v2/nodes/${nodeId}/updates/${updateId}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updateData),
    }
  );
  expect(result).toEqual(mockResponse);
});

it('should delete an update', async () => {
  const nodeId = 'test-node-id';
  const updateId = 'update-123';

  vi.mocked(httpClient.request).mockResolvedValueOnce(undefined);

  const { deleteUpdate } = await import('./updates-api');
  await deleteUpdate(nodeId, updateId);

  expect(httpClient.request).toHaveBeenCalledWith(
    `/api/v2/nodes/${nodeId}/updates/${updateId}`,
    {
      method: 'DELETE',
    }
  );
});

/**
 * Share Store Mock Helper
 * Provides consistent mock data for share store tests
 */

import { VisibilityLevel } from '@journey/schema';
import { vi } from 'vitest';

import type { ShareState } from '../stores/share-store';

export const createMockShareStore = (
  overrides?: Partial<ShareState>
): ShareState => ({
  // Modal state
  isModalOpen: true,
  isLoading: false,
  error: null,

  // Share configuration with proper structure
  config: {
    selectedNodes: [],
    shareAllNodes: false,
    targets: [],
    ...overrides?.config,
  },

  // Current permissions state
  currentPermissions: {
    users: [],
    organizations: [],
    public: null,
    ...overrides?.currentPermissions,
  },
  isLoadingPermissions: false,

  // Available data for selection
  userNodes: [],
  searchResults: {
    users: [],
    organizations: [],
  },

  // Actions - all mocked functions
  openModal: vi.fn(),
  closeModal: vi.fn(),
  setLoading: vi.fn(),
  setError: vi.fn(),
  setUserNodes: vi.fn(),
  loadCurrentPermissions: vi.fn(),
  toggleNodeSelection: vi.fn(),
  toggleShareAll: vi.fn(),
  addTarget: vi.fn(),
  removeTarget: vi.fn(),
  updateTargetAccess: vi.fn(),
  searchUsers: vi.fn(),
  searchOrganizations: vi.fn(),
  clearSearchResults: vi.fn(),
  updateAccessLevel: vi.fn(),
  executeShare: vi.fn(),
  resetConfiguration: vi.fn(),
  getUserSubjectKey: vi.fn((userId: number) => `user:${userId}`),
  getOrgSubjectKey: vi.fn((orgId: number) => `organization:${orgId}`),
  getPublicSubjectKey: vi.fn(() => 'public'),

  // Apply any overrides
  ...overrides,
});

export const mockShareStoreWithPermissions = () =>
  createMockShareStore({
    currentPermissions: {
      users: [
        {
          id: 1,
          name: 'John Doe',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          accessLevel: VisibilityLevel.Overview,
          policyIds: ['policy-1'],
          nodes: [
            {
              nodeId: 'node-1',
              nodeTitle: 'Software Engineer',
              nodeType: 'job',
            },
          ],
        },
      ],
      organizations: [
        {
          id: 1,
          name: 'Syracuse University',
          type: 'educational_institution' as any,
          accessLevel: VisibilityLevel.Overview,
          policyIds: [],
          nodes: [],
        },
      ],
      public: null,
    },
  });

export const mockShareStoreWithSelectedNodes = () =>
  createMockShareStore({
    config: {
      selectedNodes: ['node-1', 'node-2'],
      shareAllNodes: false,
      targets: [],
    },
    userNodes: [
      {
        id: 'node-1',
        type: 'job',
        parentId: null,
        meta: {
          title: 'Software Engineer',
          organization: 'Tech Corp',
          startDate: '2020-01-01',
          endDate: '2022-12-31',
        },
      } as any,
      {
        id: 'node-2',
        type: 'education',
        parentId: null,
        meta: {
          title: 'Computer Science',
          organization: 'Syracuse University',
          degree: 'Bachelor of Science',
          startDate: '2016-09-01',
          endDate: '2020-05-31',
        },
      } as any,
    ],
  });

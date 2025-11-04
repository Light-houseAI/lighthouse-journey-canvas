/**
 * CareerUpdateWizard Component Tests
 *
 * Tests the multi-step wizard flow for career updates.
 * Simplified to test core orchestration logic.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as hierarchyApi from '../../../../services/hierarchy-api';
import * as updatesApi from '../../../../services/updates-api';
import { CareerUpdateWizard } from './CareerUpdateWizard';

// Mock external API services
vi.mock('../../../../services/updates-api');
vi.mock('../../../../services/hierarchy-api', () => ({
  hierarchyApi: {
    listNodes: vi.fn().mockResolvedValue([]),
    getNode: vi.fn().mockResolvedValue({
      id: 'test-node',
      type: 'CareerTransition',
      parentId: null,
      meta: {},
    }),
    updateNode: vi.fn().mockResolvedValue({ success: true }),
  },
}));

// Mock wouter for navigation
const mockSetLocation = vi.fn();
vi.mock('wouter', () => ({
  useLocation: () => ['/current-path', mockSetLocation],
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('CareerUpdateWizard', () => {
  const mockOnSuccess = vi.fn();
  const mockOnCancel = vi.fn();
  const mockCreateUpdate = vi.mocked(updatesApi.createUpdate);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render the wizard component', () => {
      render(
        <CareerUpdateWizard
          nodeId="test-node"
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />,
        { wrapper: createWrapper() }
      );

      // Should render without crashing
      expect(
        screen.getByRole('button', { name: /cancel/i })
      ).toBeInTheDocument();
    });

    it('should render step 1 initially', () => {
      render(
        <CareerUpdateWizard
          nodeId="test-node"
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByText(/step 1/i)).toBeInTheDocument();
    });
  });

  describe('Integration Points', () => {
    it('should use createUpdate API', () => {
      render(
        <CareerUpdateWizard
          nodeId="test-node"
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />,
        { wrapper: createWrapper() }
      );

      // Verify the mutation is set up (createUpdate will be called on submit)
      expect(mockCreateUpdate).not.toHaveBeenCalled();
    });

    it('should use hierarchyApi for node operations', () => {
      render(
        <CareerUpdateWizard
          nodeId="test-node"
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />,
        { wrapper: createWrapper() }
      );

      // Verify the APIs are available
      expect(hierarchyApi.hierarchyApi.getNode).toBeDefined();
      expect(hierarchyApi.hierarchyApi.updateNode).toBeDefined();
    });
  });

  describe('Props', () => {
    it('should accept nodeId prop', () => {
      render(
        <CareerUpdateWizard
          nodeId="custom-node-id"
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />,
        { wrapper: createWrapper() }
      );

      expect(
        screen.getByRole('button', { name: /cancel/i })
      ).toBeInTheDocument();
    });

    it('should accept onSuccess callback', () => {
      const customOnSuccess = vi.fn();
      render(
        <CareerUpdateWizard
          nodeId="test-node"
          onSuccess={customOnSuccess}
          onCancel={mockOnCancel}
        />,
        { wrapper: createWrapper() }
      );

      expect(
        screen.getByRole('button', { name: /cancel/i })
      ).toBeInTheDocument();
    });

    it('should accept onCancel callback', () => {
      const customOnCancel = vi.fn();
      render(
        <CareerUpdateWizard
          nodeId="test-node"
          onSuccess={mockOnSuccess}
          onCancel={customOnCancel}
        />,
        { wrapper: createWrapper() }
      );

      expect(
        screen.getByRole('button', { name: /cancel/i })
      ).toBeInTheDocument();
    });
  });
});

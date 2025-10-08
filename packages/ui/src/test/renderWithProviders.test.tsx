/**
 * Tests for renderWithProviders helper
 * Validates that the helper correctly sets up the testing environment
 */

import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import React from 'react';

import { renderWithProviders, resetAllStores } from './renderWithProviders';
import { useAuthStore } from '../stores/auth-store';
import { useHierarchyStore } from '../stores/hierarchy-store';
import { useProfileViewStore } from '../stores/profile-view-store';
import type { User } from '../stores/auth-store';

// Mock user for testing
const mockUser: User = {
  id: 1,
  email: 'test@example.com',
  firstName: 'Test',
  lastName: 'User',
  userName: 'testuser',
  hasCompletedOnboarding: true,
  createdAt: '2024-01-01T00:00:00Z',
};

// Simple test components
const TestComponent: React.FC = () => {
  const authState = useAuthStore();
  const hierarchyState = useHierarchyStore();
  const profileViewState = useProfileViewStore();

  return (
    <div>
      <h1>Test Component</h1>
      <div data-testid="auth-status">
        {authState.isAuthenticated ? 'Authenticated' : 'Not Authenticated'}
      </div>
      {authState.user && (
        <div data-testid="user-email">{authState.user.email}</div>
      )}
      <div data-testid="hierarchy-nodes">
        Nodes: {hierarchyState.nodes.length}
      </div>
      <div data-testid="panel-status">
        Panel: {profileViewState.isPanelOpen ? 'Open' : 'Closed'}
      </div>
    </div>
  );
};

const RouterTestComponent: React.FC = () => {
  return (
    <div>
      <h1>Router Test</h1>
      <div data-testid="location">{window.location.pathname}</div>
    </div>
  );
};

describe('renderWithProviders', () => {
  // Reset stores after each test
  afterEach(() => {
    resetAllStores();
  });

  it('renders component with default state', () => {
    renderWithProviders(<TestComponent />);

    expect(screen.getByText('Test Component')).toBeInTheDocument();
    expect(screen.getByTestId('auth-status')).toHaveTextContent('Not Authenticated');
    expect(screen.getByTestId('hierarchy-nodes')).toHaveTextContent('Nodes: 0');
    expect(screen.getByTestId('panel-status')).toHaveTextContent('Panel: Closed');
  });

  it('initializes auth state correctly', () => {
    renderWithProviders(<TestComponent />, {
      authState: {
        user: mockUser,
        isAuthenticated: true
      },
    });

    expect(screen.getByTestId('auth-status')).toHaveTextContent('Authenticated');
    expect(screen.getByTestId('user-email')).toHaveTextContent('test@example.com');
  });

  it('initializes hierarchy state correctly', () => {
    const mockNodes = [
      { id: '1', title: 'Node 1', type: 'job' },
      { id: '2', title: 'Node 2', type: 'education' },
    ];

    renderWithProviders(<TestComponent />, {
      hierarchyState: {
        nodes: mockNodes as any,
        hasData: true
      },
    });

    expect(screen.getByTestId('hierarchy-nodes')).toHaveTextContent('Nodes: 2');
  });

  it('initializes profile view state correctly', () => {
    renderWithProviders(<TestComponent />, {
      profileViewState: {
        isPanelOpen: true,
        panelNodeId: 'node-123'
      },
    });

    expect(screen.getByTestId('panel-status')).toHaveTextContent('Panel: Open');
  });

  it('returns user event instance', async () => {
    const handleClick = vi.fn();
    const ButtonComponent = () => (
      <button onClick={handleClick}>Click me</button>
    );

    const { user } = renderWithProviders(<ButtonComponent />);

    const button = screen.getByText('Click me');
    await user.click(button);

    expect(handleClick).toHaveBeenCalledOnce();
  });

  it('initializes with custom route', () => {
    const { router } = renderWithProviders(<RouterTestComponent />, {
      initialRoute: '/profile/123',
    });

    expect(router.location).toBe('/profile/123');
  });

  it('returns query client instance', () => {
    const { queryClient } = renderWithProviders(<TestComponent />);

    expect(queryClient).toBeDefined();
    expect(queryClient.getDefaultOptions().queries?.retry).toBe(false);
  });

  it('can combine multiple store states', () => {
    renderWithProviders(<TestComponent />, {
      authState: {
        user: mockUser,
        isAuthenticated: true
      },
      hierarchyState: {
        nodes: [{ id: '1', title: 'Node 1' }] as any
      },
      profileViewState: {
        isPanelOpen: true
      },
    });

    expect(screen.getByTestId('auth-status')).toHaveTextContent('Authenticated');
    expect(screen.getByTestId('hierarchy-nodes')).toHaveTextContent('Nodes: 1');
    expect(screen.getByTestId('panel-status')).toHaveTextContent('Panel: Open');
  });
});

describe('resetAllStores', () => {
  it('resets all stores to initial state', () => {
    // Set some state
    useAuthStore.setState({
      user: mockUser,
      isAuthenticated: true
    });
    useHierarchyStore.setState({
      nodes: [{ id: '1' }] as any,
      hasData: true
    });
    useProfileViewStore.setState({
      isPanelOpen: true
    });

    // Reset all stores
    resetAllStores();

    // Check all stores are reset
    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useHierarchyStore.getState().nodes).toHaveLength(0);
    expect(useHierarchyStore.getState().hasData).toBe(false);
    expect(useProfileViewStore.getState().isPanelOpen).toBe(false);
  });
});
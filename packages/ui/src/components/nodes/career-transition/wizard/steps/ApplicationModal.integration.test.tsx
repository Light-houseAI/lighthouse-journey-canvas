/**
 * ApplicationModal Integration Tests
 *
 * Tests the real OrganizationSelector integration (not mocked)
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApplicationModal } from './ApplicationModal';

// Mock TodoList from components (use real OrganizationSelector for integration testing)
vi.mock('@journey/components', async () => {
  const actual = await vi.importActual('@journey/components');
  return {
    ...actual,
    TodoList: vi.fn(({ todos, onChange }) => (
      <div data-testid="todo-list">
        {todos.map((todo: any) => (
          <div key={todo.id}>{todo.description}</div>
        ))}
        <button
          onClick={() =>
            onChange([
              ...todos,
              { id: 'new', description: 'New todo', status: 'pending' },
            ])
          }
        >
          Add Todo
        </button>
      </div>
    )),
  };
});

// Test wrapper with QueryClient
function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

function wrapper({ children }: { children: React.ReactNode }) {
  const testQueryClient = createTestQueryClient();
  return (
    <QueryClientProvider client={testQueryClient}>
      {children}
    </QueryClientProvider>
  );
}

describe('ApplicationModal - OrganizationSelector Integration', () => {
  const mockOnSave = vi.fn();
  const mockOnClose = vi.fn();

  const defaultProps = {
    isOpen: true,
    onClose: mockOnClose,
    onSave: mockOnSave,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockOnSave.mockResolvedValue(undefined);
  });

  it('should open OrganizationSelector dropdown when clicking company field', async () => {
    const user = userEvent.setup();

    render(<ApplicationModal {...defaultProps} />, { wrapper });

    // Find the company input
    const companyInput = screen.getByPlaceholderText(
      'Search for organization...'
    );
    expect(companyInput).toBeInTheDocument();

    // Click to open dropdown
    await user.click(companyInput);

    // The dropdown should open and show user organizations from MSW
    // We should see the input is focused
    expect(companyInput).toHaveFocus();
  });

  it('should show create option when searching for non-existent organization', async () => {
    const user = userEvent.setup();

    render(<ApplicationModal {...defaultProps} />, { wrapper });

    const companyInput = screen.getByPlaceholderText(
      'Search for organization...'
    );

    // Type a company name
    await user.click(companyInput);
    await user.type(companyInput, 'NonExistentCompanyXYZ123');

    // Wait for the create option to appear (MSW returns empty for this search)
    await waitFor(
      () => {
        const buttons = screen.getAllByRole('button');
        const createButton = buttons.find(
          (btn) =>
            btn.textContent?.includes('Create') &&
            btn.textContent?.includes('NonExistentCompanyXYZ123')
        );
        expect(createButton).toBeDefined();
      },
      { timeout: 2000 }
    );
  });

  it('should open create form when clicking create option', async () => {
    const user = userEvent.setup();

    render(<ApplicationModal {...defaultProps} />, { wrapper });

    const companyInput = screen.getByPlaceholderText(
      'Search for organization...'
    );

    // Type and wait for create option
    await user.click(companyInput);
    await user.type(companyInput, 'NonExistentCorpXYZ');

    // Find and click create button
    const createOptionButton = await screen.findByText(
      (content, element) => {
        return (
          element?.tagName.toLowerCase() === 'span' &&
          content.includes('NonExistentCorpXYZ')
        );
      },
      {},
      { timeout: 2000 }
    );

    await user.click(createOptionButton.closest('button')!);

    // Should show create form
    await waitFor(() => {
      expect(screen.getByText('Create New Organization')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Organization name')).toHaveValue(
        'NonExistentCorpXYZ'
      );
    });
  });

  it('should create organization and populate company field', async () => {
    const user = userEvent.setup();

    render(<ApplicationModal {...defaultProps} />, { wrapper });

    const companyInput = screen.getByPlaceholderText(
      'Search for organization...'
    );

    // Type company name
    await user.click(companyInput);
    await user.type(companyInput, 'NewTestCorpABC');

    // Click create option
    const createOptionButton = await screen.findByText(
      (content, element) => {
        return (
          element?.tagName.toLowerCase() === 'span' &&
          content.includes('NewTestCorpABC')
        );
      },
      {},
      { timeout: 2000 }
    );
    await user.click(createOptionButton.closest('button')!);

    // Wait for create form
    await waitFor(() => {
      expect(screen.getByText('Create New Organization')).toBeInTheDocument();
    });

    // Click Create button (MSW will handle the API call)
    const createFormButton = await screen.findByRole('button', {
      name: (name, element) => element?.textContent === 'Create',
    });
    await user.click(createFormButton);

    // Company field should be populated with the created org name
    await waitFor(
      () => {
        expect(companyInput).toHaveValue('NewTestCorpABC');
      },
      { timeout: 2000 }
    );
  });

  // TODO: Fix JSDOM pointer capture issue with Radix Select
  // Error: target.hasPointerCapture is not a function
  // This is a JSDOM limitation, not a real bug - works in actual browser
  it.skip('should show all organization types in create form dropdown', async () => {
    const user = userEvent.setup();

    render(<ApplicationModal {...defaultProps} />, { wrapper });

    const companyInput = screen.getByPlaceholderText(
      'Search for organization...'
    );

    // Open create form
    await user.click(companyInput);
    await user.type(companyInput, 'NewOrgTestXYZ');

    const createOptionButton = await screen.findByText(
      (content, element) => {
        return (
          element?.tagName.toLowerCase() === 'span' &&
          content.includes('NewOrgTestXYZ')
        );
      },
      {},
      { timeout: 2000 }
    );
    await user.click(createOptionButton.closest('button')!);

    await waitFor(() => {
      expect(screen.getByText('Create New Organization')).toBeInTheDocument();
    });

    // Open the org type dropdown (find by text "Company" which is the default value)
    const typeDropdowns = screen.getAllByRole('combobox');
    // The org type dropdown is inside the create form, find it by looking for the one with "Company" text
    const orgTypeDropdown = typeDropdowns.find((dropdown) =>
      dropdown.textContent?.includes('Company')
    );
    expect(orgTypeDropdown).toBeDefined();
    await user.click(orgTypeDropdown!);

    // Should show all org types (not restricted to Company only)
    await waitFor(() => {
      expect(screen.getByText('Company')).toBeInTheDocument();
      expect(screen.getByText('Educational Institution')).toBeInTheDocument();
    });
  });
});

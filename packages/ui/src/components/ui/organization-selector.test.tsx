/**
 * OrganizationSelector Unit Tests
 *
 * Functional tests for organization selection and creation
 */

import { Organization, OrganizationType } from '@journey/schema';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { OrganizationSelector } from './organization-selector';

// Mock API functions
const mockGetUserOrganizations = vi.fn();
const mockSearchOrganizations = vi.fn();
const mockCreateOrganization = vi.fn();

vi.mock('../../services/organization-api', () => ({
  getUserOrganizations: () => mockGetUserOrganizations(),
  searchOrganizations: (query: string) => mockSearchOrganizations(query),
  createOrganization: (data: any) => mockCreateOrganization(data),
  getOrganizationById: vi.fn(),
}));

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

describe('OrganizationSelector', () => {
  const mockOrganization: Organization = {
    id: 1,
    name: 'Test Company',
    type: OrganizationType.Company,
    userId: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockOnSelect = vi.fn();
  const mockOnClear = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUserOrganizations.mockResolvedValue([]);
    mockSearchOrganizations.mockResolvedValue([]);
  });

  describe('Basic Rendering', () => {
    it('should render with placeholder', () => {
      render(
        <OrganizationSelector
          onSelect={mockOnSelect}
          placeholder="Select organization..."
        />,
        { wrapper }
      );

      expect(
        screen.getByPlaceholderText('Select organization...')
      ).toBeInTheDocument();
    });

    it('should display selected organization', () => {
      render(
        <OrganizationSelector
          value={mockOrganization}
          onSelect={mockOnSelect}
        />,
        { wrapper }
      );

      expect(screen.getByDisplayValue('Test Company')).toBeInTheDocument();
    });

    it('should be disabled when disabled prop is true', () => {
      render(<OrganizationSelector onSelect={mockOnSelect} disabled={true} />, {
        wrapper,
      });

      const input = screen.getByRole('textbox');
      expect(input).toBeDisabled();
    });
  });

  describe('Search Functionality', () => {
    it('should trigger search when typing', async () => {
      const user = userEvent.setup();
      mockSearchOrganizations.mockResolvedValue([mockOrganization]);

      render(<OrganizationSelector onSelect={mockOnSelect} />, { wrapper });

      const input = screen.getByRole('textbox');
      await user.type(input, 'Test');

      await waitFor(() => {
        expect(mockSearchOrganizations).toHaveBeenCalledWith('Test');
      });
    });

    it('should display search results', async () => {
      const user = userEvent.setup();
      mockSearchOrganizations.mockResolvedValue([mockOrganization]);

      render(<OrganizationSelector onSelect={mockOnSelect} />, { wrapper });

      const input = screen.getByRole('textbox');
      await user.type(input, 'Test');

      await waitFor(() => {
        expect(screen.getByText('Test Company')).toBeInTheDocument();
      });
    });
  });

  describe('Organization Selection', () => {
    it('should call onSelect when organization is clicked', async () => {
      const user = userEvent.setup();
      mockSearchOrganizations.mockResolvedValue([mockOrganization]);

      render(<OrganizationSelector onSelect={mockOnSelect} />, { wrapper });

      const input = screen.getByRole('textbox');
      await user.type(input, 'Test');

      await waitFor(() => {
        expect(screen.getByText('Test Company')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Test Company'));

      expect(mockOnSelect).toHaveBeenCalledWith(mockOrganization);
    });

    it('should display clear button when organization is selected', () => {
      const { container } = render(
        <OrganizationSelector
          value={mockOrganization}
          onSelect={mockOnSelect}
          onClear={mockOnClear}
        />,
        { wrapper }
      );

      // X button should be present
      const clearButton = container.querySelector('.lucide-x');
      expect(clearButton).toBeInTheDocument();
    });
  });

  describe('Create Organization', () => {
    it('should show create option when no results found', async () => {
      const user = userEvent.setup();
      mockSearchOrganizations.mockResolvedValue([]);

      render(<OrganizationSelector onSelect={mockOnSelect} />, { wrapper });

      const input = screen.getByRole('textbox');
      await user.type(input, 'New Org');

      // Check for the Plus icon which indicates the create button is present
      await waitFor(() => {
        const createButtons = screen.getAllByRole('button');
        const hasCreateButton = createButtons.some((btn) =>
          btn.textContent?.includes('New Org')
        );
        expect(hasCreateButton).toBe(true);
      });
    });

    it('should open create form on create button click', async () => {
      const user = userEvent.setup();
      mockSearchOrganizations.mockResolvedValue([]);

      render(<OrganizationSelector onSelect={mockOnSelect} />, { wrapper });

      const input = screen.getByRole('textbox');
      await user.type(input, 'New Company');

      // Find the create button by looking for text content
      await waitFor(async () => {
        const buttons = screen.getAllByRole('button');
        const createButton = buttons.find((btn) =>
          btn.textContent?.includes('New Company')
        );
        expect(createButton).toBeDefined();

        if (createButton) {
          await user.click(createButton);
        }
      });

      expect(screen.getByText('Create New Organization')).toBeInTheDocument();
    });

    it('should show create form with organization name pre-filled', async () => {
      const user = userEvent.setup();
      mockSearchOrganizations.mockResolvedValue([]);

      render(<OrganizationSelector onSelect={mockOnSelect} />, { wrapper });

      const input = screen.getByRole('textbox');
      await user.type(input, 'New Company');

      // Open create form
      await waitFor(async () => {
        const buttons = screen.getAllByRole('button');
        const createButton = buttons.find((btn) =>
          btn.textContent?.includes('New Company')
        );
        if (createButton) {
          await user.click(createButton);
        }
      });

      // Wait for create form to appear with pre-filled name
      await waitFor(() => {
        expect(screen.getByText('Create New Organization')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Organization name')).toHaveValue(
          'New Company'
        );
      });
    });

    it('should create organization and call onSelect', async () => {
      const user = userEvent.setup();
      const newOrg: Organization = {
        id: 2,
        name: 'New Company',
        type: OrganizationType.Company,
        userId: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockSearchOrganizations.mockResolvedValue([]);
      mockCreateOrganization.mockResolvedValue(newOrg);
      mockGetUserOrganizations.mockResolvedValue([newOrg]);

      render(<OrganizationSelector onSelect={mockOnSelect} />, { wrapper });

      const input = screen.getByRole('textbox');

      // Click input to open dropdown
      await user.click(input);
      await user.type(input, 'New Company');

      // Wait for and click the "Create" option button
      const createOptionButton = await screen.findByText((content, element) => {
        return (
          element?.tagName.toLowerCase() === 'span' &&
          content.includes('New Company')
        );
      });

      await user.click(createOptionButton.closest('button')!);

      // Wait for form to appear
      await waitFor(() => {
        expect(screen.getByText('Create New Organization')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Organization name')).toHaveValue(
          'New Company'
        );
      });

      // Find and click the Create button in the form
      const createFormButton = await screen.findByRole('button', {
        name: (name, element) => {
          // Look for button with just "Create" text (not "Create New Organization")
          return element?.textContent === 'Create';
        },
      });

      await user.click(createFormButton);

      // Should call createOrganization with correct data
      await waitFor(() => {
        expect(mockCreateOrganization).toHaveBeenCalledWith({
          name: 'New Company',
          type: OrganizationType.Company,
        });
        expect(mockOnSelect).toHaveBeenCalledWith(newOrg);
      });
    });

    it('should use defaultOrgType when creating organization', async () => {
      const user = userEvent.setup();
      const newOrg: Organization = {
        id: 3,
        name: 'Test Institution',
        type: OrganizationType.EducationalInstitution,
        userId: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockSearchOrganizations.mockResolvedValue([]);
      mockCreateOrganization.mockResolvedValue(newOrg);
      mockGetUserOrganizations.mockResolvedValue([newOrg]);

      render(
        <OrganizationSelector
          onSelect={mockOnSelect}
          defaultOrgType={OrganizationType.EducationalInstitution}
        />,
        { wrapper }
      );

      const input = screen.getByRole('textbox');

      // Click input to open dropdown
      await user.click(input);
      await user.type(input, 'Test Institution');

      // Wait for and click the "Create" option button
      const createOptionButton = await screen.findByText((content, element) => {
        return (
          element?.tagName.toLowerCase() === 'span' &&
          content.includes('Test Institution')
        );
      });

      await user.click(createOptionButton.closest('button')!);

      // Wait for form to appear
      await waitFor(() => {
        expect(screen.getByText('Create New Organization')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Organization name')).toHaveValue(
          'Test Institution'
        );
      });

      // Find and click the Create button
      const createFormButton = await screen.findByRole('button', {
        name: (name, element) => element?.textContent === 'Create',
      });

      await user.click(createFormButton);

      // Should use the defaultOrgType
      await waitFor(() => {
        expect(mockCreateOrganization).toHaveBeenCalledWith({
          name: 'Test Institution',
          type: OrganizationType.EducationalInstitution,
        });
        expect(mockOnSelect).toHaveBeenCalledWith(newOrg);
      });
    });
  });

  describe('Error Display', () => {
    it('should display error message when provided', () => {
      render(
        <OrganizationSelector
          onSelect={mockOnSelect}
          error="Organization is required"
        />,
        { wrapper }
      );

      expect(screen.getByText('Organization is required')).toBeInTheDocument();
    });
  });
});

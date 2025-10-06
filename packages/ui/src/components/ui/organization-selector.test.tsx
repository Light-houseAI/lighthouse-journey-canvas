/**
 * OrganizationSelector Unit Tests
 *
 * Functional tests for organization selection and creation
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OrganizationSelector } from './organization-selector';
import { Organization, OrganizationType } from '@journey/schema';

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
        />
      );

      expect(screen.getByPlaceholderText('Select organization...')).toBeInTheDocument();
    });

    it('should display selected organization', () => {
      render(
        <OrganizationSelector
          value={mockOrganization}
          onSelect={mockOnSelect}
        />
      );

      expect(screen.getByDisplayValue('Test Company')).toBeInTheDocument();
    });

    it('should be disabled when disabled prop is true', () => {
      render(
        <OrganizationSelector
          onSelect={mockOnSelect}
          disabled={true}
        />
      );

      const input = screen.getByRole('textbox');
      expect(input).toBeDisabled();
    });
  });

  describe('Search Functionality', () => {
    it('should trigger search when typing', async () => {
      const user = userEvent.setup();
      mockSearchOrganizations.mockResolvedValue([mockOrganization]);

      render(<OrganizationSelector onSelect={mockOnSelect} />);

      const input = screen.getByRole('textbox');
      await user.type(input, 'Test');

      await waitFor(() => {
        expect(mockSearchOrganizations).toHaveBeenCalledWith('Test');
      });
    });

    it('should display search results', async () => {
      const user = userEvent.setup();
      mockSearchOrganizations.mockResolvedValue([mockOrganization]);

      render(<OrganizationSelector onSelect={mockOnSelect} />);

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

      render(<OrganizationSelector onSelect={mockOnSelect} />);

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
        />
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

      render(<OrganizationSelector onSelect={mockOnSelect} />);

      const input = screen.getByRole('textbox');
      await user.type(input, 'New Org');

      // Check for the Plus icon which indicates the create button is present
      await waitFor(() => {
        const createButtons = screen.getAllByRole('button');
        const hasCreateButton = createButtons.some(btn =>
          btn.textContent?.includes('New Org')
        );
        expect(hasCreateButton).toBe(true);
      });
    });

    it('should open create form on create button click', async () => {
      const user = userEvent.setup();
      mockSearchOrganizations.mockResolvedValue([]);

      render(<OrganizationSelector onSelect={mockOnSelect} />);

      const input = screen.getByRole('textbox');
      await user.type(input, 'New Company');

      // Find the create button by looking for text content
      await waitFor(async () => {
        const buttons = screen.getAllByRole('button');
        const createButton = buttons.find(btn =>
          btn.textContent?.includes('New Company')
        );
        expect(createButton).toBeDefined();

        if (createButton) {
          await user.click(createButton);
        }
      });

      expect(screen.getByText('Create New Organization')).toBeInTheDocument();
    });
  });

  describe('Error Display', () => {
    it('should display error message when provided', () => {
      render(
        <OrganizationSelector
          onSelect={mockOnSelect}
          error="Organization is required"
        />
      );

      expect(screen.getByText('Organization is required')).toBeInTheDocument();
    });
  });
});

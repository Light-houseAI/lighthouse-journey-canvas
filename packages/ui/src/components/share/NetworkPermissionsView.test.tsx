/**
 * @vitest-environment jsdom
 * NetworkPermissionsView Tests
 * Testing the permissions assignment flow for organizations
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  NetworkPermissionsView,
  NetworkPermissions,
} from './NetworkPermissionsView';
import { Organization } from '@journey/schema';
import { OrganizationType } from '@journey/schema';

const mockOrganization: Organization = {
  id: 1,
  name: 'Syracuse University',
  type: OrganizationType.EducationalInstitution,
  description: 'A leading research university',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

describe('NetworkPermissionsView', () => {
  let onBackMock: ReturnType<typeof vi.fn>;
  let onSaveMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onBackMock = vi.fn();
    onSaveMock = vi.fn();
  });

  describe('Component Rendering', () => {
    it('should display organization information', () => {
      render(
        <NetworkPermissionsView
          organization={mockOrganization}
          onBack={onBackMock}
          onSave={onSaveMock}
        />
      );

      // Check organization name is displayed
      expect(screen.getByText('Syracuse University')).toBeInTheDocument();
      expect(
        screen.getByText('A leading research university')
      ).toBeInTheDocument();
      expect(screen.getByText('educational institution')).toBeInTheDocument();
    });

    it('should display correct icon for educational institution', () => {
      render(
        <NetworkPermissionsView
          organization={mockOrganization}
          onBack={onBackMock}
          onSave={onSaveMock}
        />
      );

      // Should have GraduationCap icon for educational institution
      const iconContainer = screen
        .getByText('Syracuse University')
        .closest('.space-y-4')
        ?.querySelector('.h-12.w-12');
      expect(iconContainer).toBeInTheDocument();
      expect(
        iconContainer?.querySelector('.text-green-600')
      ).toBeInTheDocument();
    });

    it('should display correct icon for company', () => {
      const companyOrg: Organization = {
        ...mockOrganization,
        type: OrganizationType.Company,
        name: 'PayPal',
        description: 'Digital payments company',
      };

      render(
        <NetworkPermissionsView
          organization={companyOrg}
          onBack={onBackMock}
          onSave={onSaveMock}
        />
      );

      // Should have Building icon for company
      const iconContainer = screen
        .getByText('PayPal')
        .closest('.space-y-4')
        ?.querySelector('.h-12.w-12');
      expect(iconContainer).toBeInTheDocument();
      expect(
        iconContainer?.querySelector('.text-green-600')
      ).toBeInTheDocument();
    });
  });

  describe('Journey Scope Selection', () => {
    it('should have "all" selected by default', () => {
      render(
        <NetworkPermissionsView
          organization={mockOrganization}
          onBack={onBackMock}
          onSave={onSaveMock}
        />
      );

      const allRadio = screen.getByRole('radio', { name: /All/i });
      expect(allRadio).toBeChecked();

      const noneRadio = screen.getByRole('radio', { name: /None/i });
      expect(noneRadio).not.toBeChecked();

      const selectRadio = screen.getByRole('radio', {
        name: /Select journeys/i,
      });
      expect(selectRadio).not.toBeChecked();
    });

    it('should allow changing journey scope', async () => {
      const user = userEvent.setup();

      render(
        <NetworkPermissionsView
          organization={mockOrganization}
          onBack={onBackMock}
          onSave={onSaveMock}
        />
      );

      // Click on "None"
      const noneRadio = screen.getByRole('radio', { name: /None/i });
      await user.click(noneRadio);
      expect(noneRadio).toBeChecked();

      // Click on "Select journeys"
      const selectRadio = screen.getByRole('radio', {
        name: /Select journeys/i,
      });
      await user.click(selectRadio);
      expect(selectRadio).toBeChecked();
      expect(noneRadio).not.toBeChecked();
    });
  });

  describe('Detail Level Selection', () => {
    it('should have "overview" selected by default', () => {
      render(
        <NetworkPermissionsView
          organization={mockOrganization}
          onBack={onBackMock}
          onSave={onSaveMock}
        />
      );

      const overviewRadio = screen.getByRole('radio', { name: /Overview/i });
      expect(overviewRadio).toBeChecked();

      const fullRadio = screen.getByRole('radio', { name: /Full/i });
      expect(fullRadio).not.toBeChecked();
    });

    it('should allow changing detail level', async () => {
      const user = userEvent.setup();

      render(
        <NetworkPermissionsView
          organization={mockOrganization}
          onBack={onBackMock}
          onSave={onSaveMock}
        />
      );

      const fullRadio = screen.getByRole('radio', { name: /Full/i });
      await user.click(fullRadio);
      expect(fullRadio).toBeChecked();

      const overviewRadio = screen.getByRole('radio', { name: /Overview/i });
      expect(overviewRadio).not.toBeChecked();
    });

    it('should update preview based on detail level', async () => {
      const user = userEvent.setup();

      render(
        <NetworkPermissionsView
          organization={mockOrganization}
          onBack={onBackMock}
          onSave={onSaveMock}
        />
      );

      // Initially overview is selected - should show X for chapter content and files
      let chapterRow = screen.getByText('Chapter content').closest('.flex');
      let filesRow = screen.getByText('Files and assets').closest('.flex');

      expect(chapterRow?.querySelector('.text-gray-300')).toBeInTheDocument(); // X icon
      expect(filesRow?.querySelector('.text-gray-300')).toBeInTheDocument(); // X icon

      // Select Full access
      const fullRadio = screen.getByRole('radio', { name: /Full/i });
      await user.click(fullRadio);

      // Should now show checkmarks for chapter content and files
      chapterRow = screen.getByText('Chapter content').closest('.flex');
      filesRow = screen.getByText('Files and assets').closest('.flex');

      expect(chapterRow?.querySelector('.text-purple-500')).toBeInTheDocument(); // Check icon
      expect(filesRow?.querySelector('.text-purple-500')).toBeInTheDocument(); // Check icon
    });
  });

  describe('Always Visible Items', () => {
    it('should always show checkmarks for basic items', () => {
      render(
        <NetworkPermissionsView
          organization={mockOrganization}
          onBack={onBackMock}
          onSave={onSaveMock}
        />
      );

      // Use getAllByText since there's a radio label "Overview" and the preview item "Overview"
      const overviewElements = screen.getAllByText('Overview');
      const overviewRow =
        overviewElements[overviewElements.length - 1].closest('.flex');

      expect(
        overviewRow?.querySelector('.text-purple-500')
      ).toBeInTheDocument();
    });
  });

  describe('Actions', () => {
    it('should call onBack when Back button is clicked', async () => {
      const user = userEvent.setup();

      render(
        <NetworkPermissionsView
          organization={mockOrganization}
          onBack={onBackMock}
          onSave={onSaveMock}
        />
      );

      const backButton = screen.getByRole('button', { name: /Back/i });
      await user.click(backButton);

      expect(onBackMock).toHaveBeenCalledOnce();
    });

    it('should call onSave with correct data when Save button is clicked', async () => {
      const user = userEvent.setup();

      render(
        <NetworkPermissionsView
          organization={mockOrganization}
          onBack={onBackMock}
          onSave={onSaveMock}
        />
      );

      // Change to specific settings
      const selectRadio = screen.getByRole('radio', {
        name: /Select journeys/i,
      });
      await user.click(selectRadio);

      const fullRadio = screen.getByRole('radio', { name: /Full/i });
      await user.click(fullRadio);

      // Click save
      const saveButton = screen.getByRole('button', {
        name: /Save access settings/i,
      });
      await user.click(saveButton);

      // Should be called with the expected permissions object
      expect(onSaveMock).toHaveBeenCalledWith({
        organizationId: 1,
        journeyScope: 'select',
        detailLevel: 'full',
      } as NetworkPermissions);
    });

    it('should save with default values if not changed', async () => {
      const user = userEvent.setup();

      render(
        <NetworkPermissionsView
          organization={mockOrganization}
          onBack={onBackMock}
          onSave={onSaveMock}
        />
      );

      // Click save without changing anything
      const saveButton = screen.getByRole('button', {
        name: /Save access settings/i,
      });
      await user.click(saveButton);

      // Should be called with default values
      expect(onSaveMock).toHaveBeenCalledWith({
        organizationId: 1,
        journeyScope: 'all',
        detailLevel: 'overview',
      } as NetworkPermissions);
    });
  });

  describe('Visual Elements', () => {
    it('should display journey preview cards', () => {
      render(
        <NetworkPermissionsView
          organization={mockOrganization}
          onBack={onBackMock}
          onSave={onSaveMock}
        />
      );

      // Should have two journey preview cards
      const journeyCards = screen
        .getAllByRole('generic')
        .filter((el) => el.classList.contains('bg-purple-100'));

      expect(journeyCards.length).toBeGreaterThanOrEqual(2);
    });

    it('should display network label', () => {
      render(
        <NetworkPermissionsView
          organization={mockOrganization}
          onBack={onBackMock}
          onSave={onSaveMock}
        />
      );

      expect(screen.getByText('Network')).toBeInTheDocument();
    });

    it('should display section separators', () => {
      const { container } = render(
        <NetworkPermissionsView
          organization={mockOrganization}
          onBack={onBackMock}
          onSave={onSaveMock}
        />
      );

      // Should have separators between sections (Radix UI Separator renders as div with specific classes)
      const separators = container.querySelectorAll(
        '[data-orientation="horizontal"]'
      );
      expect(separators.length).toBeGreaterThanOrEqual(2);
    });
  });
});

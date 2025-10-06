/**
 * NetworkPermissionsView Unit Tests
 *
 * Tests for network/organization permissions configuration
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

// Mock the stores and utils
vi.mock('../../stores/share-store', () => ({
  useShareStore: () => ({
    config: {
      shareAllNodes: false,
      selectedNodes: [1, 2],
    },
    userNodes: [],
  }),
}));

vi.mock('../../utils/node-title', () => ({
  getSelectedNodesLabel: () => '2 selected journeys',
}));

const mockOrganization: Organization = {
  id: 1,
  name: 'Syracuse University',
  type: OrganizationType.EducationalInstitution,
  userId: 1,
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

  describe('Organization Information', () => {
    it('should display organization name and type', () => {
      render(
        <NetworkPermissionsView
          organization={mockOrganization}
          onBack={onBackMock}
          onSave={onSaveMock}
        />
      );

      expect(screen.getByText('Syracuse University')).toBeInTheDocument();
      expect(screen.getByText('educational institution')).toBeInTheDocument();
    });

    it('should display GraduationCap icon for educational institution', () => {
      const { container } = render(
        <NetworkPermissionsView
          organization={mockOrganization}
          onBack={onBackMock}
          onSave={onSaveMock}
        />
      );

      const iconContainer = container.querySelector('.bg-green-100');
      expect(iconContainer).toBeInTheDocument();
      expect(iconContainer?.querySelector('.text-green-600')).toBeInTheDocument();
    });

    it('should display Building icon for company', () => {
      const companyOrg: Organization = {
        ...mockOrganization,
        type: OrganizationType.Company,
      };

      const { container } = render(
        <NetworkPermissionsView
          organization={companyOrg}
          onBack={onBackMock}
          onSave={onSaveMock}
        />
      );

      const iconContainer = container.querySelector('.bg-green-100');
      expect(iconContainer).toBeInTheDocument();
    });
  });

  describe('Viewable Journeys', () => {
    it('should display viewable journeys label from store', () => {
      render(
        <NetworkPermissionsView
          organization={mockOrganization}
          onBack={onBackMock}
          onSave={onSaveMock}
        />
      );

      expect(screen.getByText('2 selected journeys')).toBeInTheDocument();
    });
  });

  describe('Access Level Selection', () => {
    it('should have "Limited access" selected by default', () => {
      render(
        <NetworkPermissionsView
          organization={mockOrganization}
          onBack={onBackMock}
          onSave={onSaveMock}
        />
      );

      const limitedRadio = screen.getByLabelText('Limited access');
      const fullRadio = screen.getByLabelText('Full access');

      expect(limitedRadio).toBeChecked();
      expect(fullRadio).not.toBeChecked();
    });

    it('should use provided currentAccessLevel as initial value', () => {
      render(
        <NetworkPermissionsView
          organization={mockOrganization}
          currentAccessLevel="full"
          onBack={onBackMock}
          onSave={onSaveMock}
        />
      );

      const fullRadio = screen.getByLabelText('Full access');
      expect(fullRadio).toBeChecked();
    });

    it('should allow changing access level', async () => {
      const user = userEvent.setup();

      render(
        <NetworkPermissionsView
          organization={mockOrganization}
          onBack={onBackMock}
          onSave={onSaveMock}
        />
      );

      const fullRadio = screen.getByLabelText('Full access');
      await user.click(fullRadio);

      expect(fullRadio).toBeChecked();
    });

    it('should display correct description for limited access', () => {
      render(
        <NetworkPermissionsView
          organization={mockOrganization}
          onBack={onBackMock}
          onSave={onSaveMock}
        />
      );

      expect(screen.getByText('Can view basic information and milestones')).toBeInTheDocument();
    });

    it('should display correct description for full access', async () => {
      const user = userEvent.setup();

      render(
        <NetworkPermissionsView
          organization={mockOrganization}
          onBack={onBackMock}
          onSave={onSaveMock}
        />
      );

      const fullRadio = screen.getByLabelText('Full access');
      await user.click(fullRadio);

      expect(screen.getByText('Can view all details including personal notes')).toBeInTheDocument();
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

    it('should call onSave with correct data when saving', async () => {
      const user = userEvent.setup();

      render(
        <NetworkPermissionsView
          organization={mockOrganization}
          onBack={onBackMock}
          onSave={onSaveMock}
        />
      );

      // Change to full access
      const fullRadio = screen.getByLabelText('Full access');
      await user.click(fullRadio);

      // Click save
      const saveButton = screen.getByRole('button', {
        name: /Save access settings/i,
      });
      await user.click(saveButton);

      expect(onSaveMock).toHaveBeenCalledWith({
        organizationId: 1,
        detailLevel: 'full',
      } as NetworkPermissions);
    });

    it('should save with default overview level if not changed', async () => {
      const user = userEvent.setup();

      render(
        <NetworkPermissionsView
          organization={mockOrganization}
          onBack={onBackMock}
          onSave={onSaveMock}
        />
      );

      const saveButton = screen.getByRole('button', {
        name: /Save access settings/i,
      });
      await user.click(saveButton);

      expect(onSaveMock).toHaveBeenCalledWith({
        organizationId: 1,
        detailLevel: 'overview',
      } as NetworkPermissions);
    });

    it('should disable save button when saving', () => {
      render(
        <NetworkPermissionsView
          organization={mockOrganization}
          onBack={onBackMock}
          onSave={onSaveMock}
          isSaving={true}
        />
      );

      const saveButton = screen.getByRole('button', { name: /Saving/i });
      expect(saveButton).toBeDisabled();
    });

    it('should display loading state when saving', () => {
      render(
        <NetworkPermissionsView
          organization={mockOrganization}
          onBack={onBackMock}
          onSave={onSaveMock}
          isSaving={true}
        />
      );

      expect(screen.getByText('Saving...')).toBeInTheDocument();
    });
  });
});

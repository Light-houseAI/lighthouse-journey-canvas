/**
 * @vitest-environment jsdom
 * BulkPersonPermissionsView Tests
 * Testing the permissions assignment flow for single and multiple people
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  BulkPersonPermissionsView,
  BulkPersonPermissions,
} from './BulkPersonPermissionsView';
import { UserSearchResult } from '../../services/user-api';

const mockPerson: UserSearchResult = {
  id: 1,
  userName: 'john.doe',
  firstName: 'John',
  lastName: 'Doe',
  title: 'Software Engineer',
  company: 'Syracuse University',
  avatarUrl: 'https://example.com/avatar.jpg',
};

const mockPersonWithoutDetails: UserSearchResult = {
  id: 2,
  userName: 'jane.smith',
  firstName: '',
  lastName: '',
  title: '',
  company: '',
  avatarUrl: '',
};

describe('BulkPersonPermissionsView', () => {
  let onBackMock: ReturnType<typeof vi.fn>;
  let onSaveMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onBackMock = vi.fn();
    onSaveMock = vi.fn();
  });

  describe('Component Rendering - Single Person', () => {
    it('should display person information with full details', () => {
      render(
        <BulkPersonPermissionsView
          people={[mockPerson]}
          onBack={onBackMock}
          onSave={onSaveMock}
        />
      );

      // Check person name is displayed
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(
        screen.getByText('Software Engineer at Syracuse University')
      ).toBeInTheDocument();
    });

    it('should display username when name is not available', () => {
      render(
        <BulkPersonPermissionsView
          people={[mockPersonWithoutDetails]}
          onBack={onBackMock}
          onSave={onSaveMock}
        />
      );

      // Should fall back to username
      expect(screen.getByText('jane.smith')).toBeInTheDocument();
    });

    it('should display avatar when available', () => {
      render(
        <BulkPersonPermissionsView
          people={[mockPerson]}
          onBack={onBackMock}
          onSave={onSaveMock}
        />
      );

      const avatar = screen.getByAltText('John Doe');
      expect(avatar).toBeInTheDocument();
      expect(avatar).toHaveAttribute('src', 'https://example.com/avatar.jpg');
    });

    it('should display default icon when avatar is not available', () => {
      render(
        <BulkPersonPermissionsView
          people={[mockPersonWithoutDetails]}
          onBack={onBackMock}
          onSave={onSaveMock}
        />
      );

      // Should have Users icon as fallback
      // The username text is rendered
      expect(screen.getByText('jane.smith')).toBeInTheDocument();
      // The component renders with icon container
      const container = screen.getByText('jane.smith').closest('div')?.parentElement;
      expect(container).toBeInTheDocument();
      // Icon container with blue background should exist
      const iconElements = document.querySelectorAll('.bg-blue-100');
      expect(iconElements.length).toBeGreaterThan(0);
    });
  });

  describe('Component Rendering - Multiple People', () => {
    it('should display count of people selected', () => {
      render(
        <BulkPersonPermissionsView
          people={[mockPerson, mockPersonWithoutDetails]}
          onBack={onBackMock}
          onSave={onSaveMock}
        />
      );

      expect(screen.getByText('2 people selected')).toBeInTheDocument();
    });

    it('should show avatar preview for multiple people', () => {
      const multiplePeople = [
        mockPerson,
        mockPersonWithoutDetails,
        { ...mockPerson, id: 3, userName: 'user3' },
        { ...mockPerson, id: 4, userName: 'user4' },
      ];

      render(
        <BulkPersonPermissionsView
          people={multiplePeople}
          onBack={onBackMock}
          onSave={onSaveMock}
        />
      );

      expect(screen.getByText('4 people selected')).toBeInTheDocument();
      // Should show +1 indicator for the 4th person
      expect(screen.getByText('+1')).toBeInTheDocument();
    });
  });

  describe('Access Level Selection', () => {
    it('should have "Limited access" selected by default', () => {
      render(
        <BulkPersonPermissionsView
          people={[mockPerson]}
          onBack={onBackMock}
          onSave={onSaveMock}
        />
      );

      const limitedRadio = screen.getByRole('radio', {
        name: /Limited access/i,
      });
      expect(limitedRadio).toBeChecked();

      const fullRadio = screen.getByRole('radio', { name: /Full access/i });
      expect(fullRadio).not.toBeChecked();
    });

    it('should allow changing access level', async () => {
      const user = userEvent.setup();

      render(
        <BulkPersonPermissionsView
          people={[mockPerson]}
          onBack={onBackMock}
          onSave={onSaveMock}
        />
      );

      const fullRadio = screen.getByRole('radio', { name: /Full access/i });
      await user.click(fullRadio);
      expect(fullRadio).toBeChecked();

      const limitedRadio = screen.getByRole('radio', {
        name: /Limited access/i,
      });
      expect(limitedRadio).not.toBeChecked();
    });

    it('should use currentAccessLevel prop when provided', () => {
      render(
        <BulkPersonPermissionsView
          people={[mockPerson]}
          currentAccessLevel="full"
          onBack={onBackMock}
          onSave={onSaveMock}
        />
      );

      const fullRadio = screen.getByRole('radio', { name: /Full access/i });
      expect(fullRadio).toBeChecked();

      const limitedRadio = screen.getByRole('radio', {
        name: /Limited access/i,
      });
      expect(limitedRadio).not.toBeChecked();
    });

    it('should display helpful descriptions', () => {
      render(
        <BulkPersonPermissionsView
          people={[mockPerson]}
          onBack={onBackMock}
          onSave={onSaveMock}
        />
      );

      expect(
        screen.getByText('Can view basic information and milestones')
      ).toBeInTheDocument();
    });
  });

  describe('Actions', () => {
    it('should call onBack when Back button is clicked', async () => {
      const user = userEvent.setup();

      render(
        <BulkPersonPermissionsView
          people={[mockPerson]}
          onBack={onBackMock}
          onSave={onSaveMock}
        />
      );

      const backButton = screen.getByRole('button', { name: /Back/i });
      await user.click(backButton);

      expect(onBackMock).toHaveBeenCalledOnce();
    });

    it('should call onSave with correct data for single person', async () => {
      const user = userEvent.setup();

      render(
        <BulkPersonPermissionsView
          people={[mockPerson]}
          onBack={onBackMock}
          onSave={onSaveMock}
        />
      );

      const fullRadio = screen.getByRole('radio', { name: /Full access/i });
      await user.click(fullRadio);

      // Click save
      const saveButton = screen.getByRole('button', {
        name: /Save access settings/i,
      });
      await user.click(saveButton);

      // Should be called with the expected permissions object
      expect(onSaveMock).toHaveBeenCalledWith({
        userIds: [1],
        detailLevel: 'full',
      } as BulkPersonPermissions);
    });

    it('should call onSave with correct data for multiple people', async () => {
      const user = userEvent.setup();

      render(
        <BulkPersonPermissionsView
          people={[mockPerson, mockPersonWithoutDetails]}
          onBack={onBackMock}
          onSave={onSaveMock}
        />
      );

      const fullRadio = screen.getByRole('radio', { name: /Full access/i });
      await user.click(fullRadio);

      // Click save
      const saveButton = screen.getByRole('button', {
        name: /Save access for 2 people/i,
      });
      await user.click(saveButton);

      // Should be called with the expected permissions object
      expect(onSaveMock).toHaveBeenCalledWith({
        userIds: [1, 2],
        detailLevel: 'full',
      } as BulkPersonPermissions);
    });

    it('should save with default values if not changed', async () => {
      const user = userEvent.setup();

      render(
        <BulkPersonPermissionsView
          people={[mockPerson]}
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
        userIds: [1],
        detailLevel: 'overview',
      } as BulkPersonPermissions);
    });
  });

  describe('Visual Elements', () => {
    it('should display "Person" label for single person', () => {
      render(
        <BulkPersonPermissionsView
          people={[mockPerson]}
          onBack={onBackMock}
          onSave={onSaveMock}
        />
      );

      expect(screen.getByText('Person')).toBeInTheDocument();
    });

    it('should display "People" label for multiple people', () => {
      render(
        <BulkPersonPermissionsView
          people={[mockPerson, mockPersonWithoutDetails]}
          onBack={onBackMock}
          onSave={onSaveMock}
        />
      );

      expect(screen.getByText('People')).toBeInTheDocument();
    });

    it('should display section separators', () => {
      const { container } = render(
        <BulkPersonPermissionsView
          people={[mockPerson]}
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

    it('should display "Access level" label', () => {
      render(
        <BulkPersonPermissionsView
          people={[mockPerson]}
          onBack={onBackMock}
          onSave={onSaveMock}
        />
      );

      expect(screen.getByText('Access level')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle person with minimal data', () => {
      const minimalPerson: UserSearchResult = {
        id: 3,
        userName: 'user123',
        firstName: 'User',
        lastName: '',
        title: '',
        company: '',
        avatarUrl: '',
      };

      render(
        <BulkPersonPermissionsView
          people={[minimalPerson]}
          onBack={onBackMock}
          onSave={onSaveMock}
        />
      );

      // Should display whatever is available
      expect(screen.getByText('user123')).toBeInTheDocument();
    });

    it('should handle person with only lastName', () => {
      const lastNameOnlyPerson: UserSearchResult = {
        id: 4,
        userName: 'smith',
        firstName: '',
        lastName: 'Smith',
        title: '',
        company: '',
        avatarUrl: '',
      };

      render(
        <BulkPersonPermissionsView
          people={[lastNameOnlyPerson]}
          onBack={onBackMock}
          onSave={onSaveMock}
        />
      );

      // Should fall back to username when only lastName exists
      expect(screen.getByText('smith')).toBeInTheDocument();
    });

    it('should handle empty people array gracefully', () => {
      render(
        <BulkPersonPermissionsView
          people={[]}
          onBack={onBackMock}
          onSave={onSaveMock}
        />
      );

      // Should still render without errors
      expect(screen.getByRole('button', { name: /Back/i })).toBeInTheDocument();
    });
  });
});

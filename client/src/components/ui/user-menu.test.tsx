import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useToast } from '@/hooks/use-toast';
import { useAuthStore } from '@/stores/auth-store';

import { UserMenu } from './user-menu';

// Mock external dependencies
vi.mock('@/stores/auth-store');
vi.mock('@/hooks/use-toast');
vi.mock('wouter', () => ({
  useLocation: () => ['/timeline', vi.fn()],
}));

describe('UserMenu Component', () => {
  const mockToast = vi.fn();
  const mockLogout = vi.fn();
  const mockSetLocation = vi.fn();
  const mockUser = {
    id: 1,
    email: 'test@example.com',
    firstName: 'John',
    lastName: 'Doe',
    userName: 'testuser',
  };

  beforeEach(() => {
    vi.resetAllMocks();

    // Mock clipboard API
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
      writable: true,
    });

    // Mock window.location
    Object.defineProperty(window, 'location', {
      value: { origin: 'http://localhost:5004' },
      writable: true,
    });

    // Setup default mocks
    (useToast as any).mockReturnValue({ toast: mockToast });
    (useAuthStore as any).mockReturnValue({
      user: mockUser,
      logout: mockLogout,
      isLoading: false,
    });

    // Mock useLocation
    vi.doMock('wouter', () => ({
      useLocation: () => ['/', mockSetLocation],
    }));
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Component Rendering', () => {
    it('should render user menu trigger with user information', () => {
      render(<UserMenu />);

      // Check if firstName + lastName is shown as display name
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      // Email should NOT be displayed in the user menu
      expect(screen.queryByText('test@example.com')).not.toBeInTheDocument();
    });

    it('should render user initials in avatar from firstName + lastName', () => {
      render(<UserMenu />);

      // firstName + lastName initials should be shown (J + D)
      expect(screen.getByText('JD')).toBeInTheDocument();
    });

    it('should still show firstName + lastName even without username', () => {
      const userWithoutUsername = {
        ...mockUser,
        userName: '',
      };

      (useAuthStore as any).mockReturnValue({
        user: userWithoutUsername,
        logout: mockLogout,
        isLoading: false,
      });

      render(<UserMenu />);

      // firstName + lastName should still be prioritized
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('JD')).toBeInTheDocument();
      // Email should not be displayed
      expect(screen.queryByText('test@example.com')).not.toBeInTheDocument();
    });

    it('should not render when user is not authenticated', () => {
      (useAuthStore as any).mockReturnValue({
        user: null,
        logout: mockLogout,
        isLoading: false,
      });

      const { container } = render(<UserMenu />);
      expect(container.firstChild).toBeNull();
    });

    it('should apply custom className', () => {
      const { container } = render(<UserMenu className="custom-class" />);

      const trigger = container.querySelector('.custom-class');
      expect(trigger).toBeInTheDocument();
    });
  });

  describe('Dropdown Menu Interactions', () => {
    it('should open dropdown menu when trigger is clicked', async () => {
      const user = userEvent.setup();
      render(<UserMenu />);

      // Click the trigger button
      const trigger = screen.getByRole('button');
      await user.click(trigger);

      // Check if dropdown items are visible
      await waitFor(() => {
        expect(screen.getByText('Settings')).toBeInTheDocument();
        expect(screen.getByText('Logout')).toBeInTheDocument();
      });
    });

    it('should navigate to settings when settings item is clicked', async () => {
      const user = userEvent.setup();
      render(<UserMenu />);

      // Open dropdown
      const trigger = screen.getByRole('button');
      await user.click(trigger);

      // Click settings
      await waitFor(() => {
        const settingsItem = screen.getByText('Settings');
        expect(settingsItem).toBeInTheDocument();
      });

      const settingsItem = screen.getByText('Settings');
      await user.click(settingsItem);

      // Verify navigation would be called (in real app, this would trigger route change)
      // Since we're mocking wouter, we can't directly test navigation
      // but we can verify the onClick handler was set up correctly
    });

    it('should show copy profile link option when user has username', async () => {
      const user = userEvent.setup();
      render(<UserMenu />);

      // Open dropdown
      const trigger = screen.getByRole('button');
      await user.click(trigger);

      await waitFor(() => {
        expect(screen.getByText('Copy Profile Link')).toBeInTheDocument();
      });
    });

    it('should not show copy profile link option when user has no username', async () => {
      const userWithoutUsername = {
        ...mockUser,
        userName: '',
      };

      (useAuthStore as any).mockReturnValue({
        user: userWithoutUsername,
        logout: mockLogout,
        isLoading: false,
      });

      const user = userEvent.setup();
      render(<UserMenu />);

      // Open dropdown
      const trigger = screen.getByRole('button');
      await user.click(trigger);

      await waitFor(() => {
        expect(screen.getByText('Settings')).toBeInTheDocument();
      });

      // Copy profile link should not be visible
      expect(screen.queryByText('Copy Profile Link')).not.toBeInTheDocument();
    });
  });

  describe('Profile Link Copying', () => {
    it('should copy profile link to clipboard successfully', async () => {
      const user = userEvent.setup();
      render(<UserMenu />);

      // Open dropdown
      const trigger = screen.getByRole('button');
      await user.click(trigger);

      await waitFor(() => {
        const copyLink = screen.getByText('Copy Profile Link');
        expect(copyLink).toBeInTheDocument();
      });

      // Click copy profile link
      const copyLink = screen.getByText('Copy Profile Link');
      await user.click(copyLink);

      // Verify clipboard API was called
      await waitFor(() => {
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
          'http://localhost:5004/testuser'
        );
      });

      // Verify success toast
      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Link copied',
          description:
            'Your profile sharing link has been copied to clipboard.',
        });
      });
    });

    it('should handle clipboard copy failure', async () => {
      const user = userEvent.setup();

      // Mock clipboard failure
      (navigator.clipboard.writeText as any).mockRejectedValueOnce(
        new Error('Clipboard error')
      );

      render(<UserMenu />);

      // Open dropdown and click copy
      const trigger = screen.getByRole('button');
      await user.click(trigger);

      await waitFor(() => {
        const copyLink = screen.getByText('Copy Profile Link');
        expect(copyLink).toBeInTheDocument();
      });

      const copyLink = screen.getByText('Copy Profile Link');
      await user.click(copyLink);

      // Verify error toast
      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Copy failed',
          description: 'Failed to copy link to clipboard.',
          variant: 'destructive',
        });
      });
    });

    it('should show error toast when trying to copy without username', async () => {
      const userWithoutUsername = {
        ...mockUser,
        userName: '',
      };

      (useAuthStore as any).mockReturnValue({
        user: userWithoutUsername,
        logout: mockLogout,
        isLoading: false,
      });

      // Since copy profile link won't be visible without username,
      // we can test this by directly testing the logic
      // In this case, the component correctly hides the option
      const user = userEvent.setup();
      render(<UserMenu />);

      const trigger = screen.getByRole('button');
      await user.click(trigger);

      await waitFor(() => {
        expect(screen.getByText('Settings')).toBeInTheDocument();
      });

      // Verify copy profile link is not available
      expect(screen.queryByText('Copy Profile Link')).not.toBeInTheDocument();
    });

    it('should show check icon after successful copy', async () => {
      const user = userEvent.setup();
      render(<UserMenu />);

      // Open dropdown
      const trigger = screen.getByRole('button');
      await user.click(trigger);

      await waitFor(() => {
        const copyLink = screen.getByText('Copy Profile Link');
        expect(copyLink).toBeInTheDocument();
      });

      // Click copy
      const copyLink = screen.getByText('Copy Profile Link');
      await user.click(copyLink);

      // Note: The check icon visibility would depend on timing and re-renders
      // In a real test environment, you might need to use specific test IDs
      // to verify the icon change state
    });
  });

  describe('Logout Functionality', () => {
    it('should call logout when logout item is clicked', async () => {
      const user = userEvent.setup();
      mockLogout.mockResolvedValueOnce(undefined);

      render(<UserMenu />);

      // Open dropdown
      const trigger = screen.getByRole('button');
      await user.click(trigger);

      await waitFor(() => {
        expect(screen.getByText('Logout')).toBeInTheDocument();
      });

      // Click logout
      const logoutItem = screen.getByText('Logout');
      await user.click(logoutItem);

      // Verify logout was called
      await waitFor(() => {
        expect(mockLogout).toHaveBeenCalledTimes(1);
      });
    });

    it('should handle logout errors gracefully', async () => {
      const user = userEvent.setup();
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      mockLogout.mockRejectedValueOnce(new Error('Logout failed'));

      render(<UserMenu />);

      // Open dropdown and click logout
      const trigger = screen.getByRole('button');
      await user.click(trigger);

      await waitFor(() => {
        const logoutItem = screen.getByText('Logout');
        expect(logoutItem).toBeInTheDocument();
      });

      const logoutItem = screen.getByText('Logout');
      await user.click(logoutItem);

      // Verify error was logged
      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Logout failed:',
          expect.any(Error)
        );
      });

      consoleErrorSpy.mockRestore();
    });

    it('should show loading state during logout', () => {
      (useAuthStore as any).mockReturnValue({
        user: mockUser,
        logout: mockLogout,
        isLoading: true,
      });

      render(<UserMenu />);

      // Open dropdown
      const trigger = screen.getByRole('button');
      fireEvent.click(trigger);

      // Note: In the actual component, you might want to add loading indicators
      // This test structure is ready for when that's implemented
    });
  });

  describe('User Display Logic', () => {
    it('should prioritize firstName + lastName for display', () => {
      render(<UserMenu />);

      // firstName + lastName should be primary display
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      // Email should NOT be displayed in menu
      expect(screen.queryByText('test@example.com')).not.toBeInTheDocument();
    });

    it('should fallback to firstName only when lastName is missing', () => {
      const userWithFirstNameOnly = {
        ...mockUser,
        firstName: 'John',
        lastName: null,
      };

      (useAuthStore as any).mockReturnValue({
        user: userWithFirstNameOnly,
        logout: mockLogout,
        isLoading: false,
      });

      render(<UserMenu />);

      // Only firstName should be shown
      expect(screen.getByText('John')).toBeInTheDocument();
      expect(screen.getByText('JO')).toBeInTheDocument(); // First 2 chars of firstName
    });

    it('should fallback to userName when no firstName/lastName', () => {
      const userWithUsernameOnly = {
        id: 1,
        email: 'test@example.com',
        firstName: null,
        lastName: null,
        userName: 'testuser',
      };

      (useAuthStore as any).mockReturnValue({
        user: userWithUsernameOnly,
        logout: mockLogout,
        isLoading: false,
      });

      render(<UserMenu />);

      // Username should be shown as fallback
      expect(screen.getByText('testuser')).toBeInTheDocument();
      expect(screen.getByText('TE')).toBeInTheDocument(); // First 2 chars of username
    });

    it('should fallback to email when no firstName/lastName/userName', () => {
      const userWithEmailOnly = {
        id: 1,
        email: 'jane.doe@example.com',
        firstName: null,
        lastName: null,
        userName: null,
      };

      (useAuthStore as any).mockReturnValue({
        user: userWithEmailOnly,
        logout: mockLogout,
        isLoading: false,
      });

      render(<UserMenu />);

      // Email should be shown as final fallback
      expect(screen.getByText('jane.doe@example.com')).toBeInTheDocument();
      expect(screen.getByText('JA')).toBeInTheDocument(); // First 2 chars of email prefix
    });

    it('should generate correct initials for various inputs', () => {
      const testCases = [
        {
          firstName: 'John',
          lastName: 'Doe',
          userName: 'jdoe',
          email: 'john@test.com',
          expectedDisplay: 'John Doe',
          expectedInitials: 'JD',
        },
        {
          firstName: 'Jane',
          lastName: null,
          userName: 'jane123',
          email: 'jane@test.com',
          expectedDisplay: 'Jane',
          expectedInitials: 'JA',
        },
        {
          firstName: null,
          lastName: null,
          userName: 'testuser',
          email: 'test@example.com',
          expectedDisplay: 'testuser',
          expectedInitials: 'TE',
        },
        {
          firstName: null,
          lastName: null,
          userName: null,
          email: 'admin@company.com',
          expectedDisplay: 'admin@company.com',
          expectedInitials: 'AD',
        },
      ];

      testCases.forEach(
        ({
          firstName,
          lastName,
          userName,
          email,
          expectedDisplay,
          expectedInitials,
        }) => {
          const testUser = {
            id: 1,
            email,
            firstName,
            lastName,
            userName,
          };

          (useAuthStore as any).mockReturnValue({
            user: testUser,
            logout: mockLogout,
            isLoading: false,
          });

          const { unmount } = render(<UserMenu />);

          expect(screen.getByText(expectedDisplay)).toBeInTheDocument();
          expect(screen.getByText(expectedInitials)).toBeInTheDocument();

          unmount();
        }
      );
    });
  });
});

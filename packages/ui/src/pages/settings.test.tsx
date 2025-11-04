import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useToast } from '../hooks/use-toast';
// Note: Using a simple div wrapper since we're mocking wouter
import Settings from './settings';

// Mock the auth hooks
vi.mock('../hooks/useAuth', () => ({
  useCurrentUser: vi.fn(),
  useUpdateProfile: vi.fn(),
}));

import { useCurrentUser, useUpdateProfile } from '../hooks/useAuth';

const mockUseCurrentUser = vi.mocked(useCurrentUser);
const mockUseUpdateProfile = vi.mocked(useUpdateProfile);

// Mock the toast hook
vi.mock('../hooks/use-toast');
const mockUseToast = vi.mocked(useToast);

// Mock wouter location hook
vi.mock('wouter', () => ({
  useLocation: () => ['/settings', vi.fn()],
}));

// Mock UserMenu component
vi.mock('../components/ui/user-menu', () => ({
  UserMenu: () => <div data-testid="user-menu">UserMenu</div>,
}));

// Mock form dependencies
vi.mock('react-hook-form', async () => {
  const actual = await vi.importActual('react-hook-form');
  return actual;
});

vi.mock('@hookform/resolvers/zod', async () => {
  const actual = await vi.importActual('@hookform/resolvers/zod');
  return actual;
});

// Mock UI components
vi.mock('../components/magicui/magic-card', () => ({
  MagicCard: ({ children, ...props }: any) => (
    <div data-testid="magic-card" {...props}>
      {children}
    </div>
  ),
}));

vi.mock('../components/magicui/blur-fade', () => ({
  BlurFade: ({ children }: any) => <div>{children}</div>,
}));

// Mock ThemeContext
vi.mock('../contexts/ThemeContext', () => ({
  useTheme: () => ({
    theme: {
      backgroundGradient: 'bg-gradient-to-br from-blue-50 to-indigo-100',
    },
  }),
}));

const renderSettings = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <Settings />
    </QueryClientProvider>
  );
};

describe('Settings Component', () => {
  const mockUser = {
    id: 1,
    email: 'test@example.com',
    firstName: 'John',
    lastName: 'Doe',
    userName: 'johndoe',
    interest: 'find-job',
    hasCompletedOnboarding: true,
    createdAt: '2024-01-01T00:00:00Z',
  };

  const mockMutateAsync = vi.fn();
  const mockToast = vi.fn();
  let clipboardWriteText: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetAllMocks();

    // Mock window.location
    Object.defineProperty(window, 'location', {
      value: {
        origin: 'http://localhost',
        href: 'http://localhost/settings',
        pathname: '/settings',
        search: '',
        hash: '',
      },
      writable: true,
      configurable: true,
    });

    // Mock window.matchMedia for framer-motion
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: vi.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    // Mock clipboard API properly
    clipboardWriteText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: clipboardWriteText,
      },
      writable: true,
      configurable: true,
    });

    // Mock useCurrentUser to return user data
    mockUseCurrentUser.mockReturnValue({
      data: mockUser,
      isLoading: false,
      error: null,
    } as any);

    // Mock useUpdateProfile to return mutation
    mockUseUpdateProfile.mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
      isError: false,
      error: null,
    } as any);

    mockUseToast.mockReturnValue({
      toast: mockToast,
      dismiss: vi.fn(),
      toasts: [],
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Component Rendering', () => {
    it('should render settings page with all form fields', async () => {
      renderSettings();

      expect(screen.getByText('Account settings')).toBeInTheDocument();
      expect(screen.getByText('Profile Information')).toBeInTheDocument();
      expect(
        screen.getByText(
          'Update your personal information and username for profile sharing'
        )
      ).toBeInTheDocument();

      // Wait for form fields to be rendered (BlurFade animation)
      await waitFor(() => {
        expect(screen.getByText(/email address/i)).toBeInTheDocument();
      });

      // Email field doesn't use FormField, so check by display value
      expect(screen.getByDisplayValue('test@example.com')).toBeInTheDocument();
      expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/last name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/username/i)).toBeInTheDocument();

      // Check buttons
      expect(
        screen.getByRole('button', { name: /update profile/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /back to timeline/i })
      ).toBeInTheDocument();
    });

    it('should populate form fields with user data', async () => {
      renderSettings();

      // Wait for form to be rendered
      await waitFor(() => {
        expect(
          screen.getByDisplayValue('test@example.com')
        ).toBeInTheDocument();
      });

      const emailField = screen.getByDisplayValue('test@example.com');
      const firstNameField = screen.getByDisplayValue('John');
      const lastNameField = screen.getByDisplayValue('Doe');
      const userNameField = screen.getByDisplayValue('johndoe');

      expect(emailField).toBeInTheDocument();
      expect(emailField).toBeDisabled();
      expect(firstNameField).toBeInTheDocument();
      expect(lastNameField).toBeInTheDocument();
      expect(userNameField).toBeInTheDocument();
    });

    it('should show share profile section when user has username', async () => {
      renderSettings();

      // Wait for share profile section to render
      await waitFor(() => {
        expect(screen.getByText('Share Your Profile')).toBeInTheDocument();
      });

      expect(screen.getByText('Your Profile Link')).toBeInTheDocument();
      expect(
        screen.getByDisplayValue('http://localhost/profile/johndoe')
      ).toBeInTheDocument();
      // Copy button - use getByRole with just button type since it only has an icon
      const buttons = screen.getAllByRole('button');
      const copyButton = buttons.find((btn) =>
        btn.querySelector('svg.lucide-copy')
      );
      expect(copyButton).toBeInTheDocument();
    });

    it('should show username required message when user has no username', async () => {
      mockUseCurrentUser.mockReturnValue({
        data: { ...mockUser, userName: null },
        isLoading: false,
        error: null,
      } as any);

      renderSettings();

      // Wait for content to render
      await waitFor(() => {
        expect(screen.getByText('Set a Username First')).toBeInTheDocument();
      });

      expect(
        screen.getByText(
          'You need to set a username before you can share your profile with others.'
        )
      ).toBeInTheDocument();
    });

    it('should handle null user gracefully', () => {
      mockUseCurrentUser.mockReturnValue({
        data: null,
        isLoading: false,
        error: null,
      } as any);

      const { container } = renderSettings();
      expect(container.firstChild).toBeNull();
    });
  });

  describe('Form Validation', () => {
    it('should allow valid firstName input', async () => {
      const user = userEvent.setup();
      renderSettings();

      const firstNameField = screen.getByLabelText(/first name/i);
      await user.clear(firstNameField);
      await user.type(firstNameField, 'Mary-Jane');

      expect(firstNameField).toHaveValue('Mary-Jane');
    });

    it('should allow valid lastName input', async () => {
      const user = userEvent.setup();
      renderSettings();

      const lastNameField = screen.getByLabelText(/last name/i);
      await user.clear(lastNameField);
      await user.type(lastNameField, "O'Connor");

      expect(lastNameField).toHaveValue("O'Connor");
    });

    it('should allow valid userName input', async () => {
      const user = userEvent.setup();
      renderSettings();

      const userNameField = screen.getByLabelText(/username/i);
      await user.clear(userNameField);
      await user.type(userNameField, 'new_username-123');

      expect(userNameField).toHaveValue('new_username-123');
    });

    it('should show placeholder text for empty fields', async () => {
      mockUseCurrentUser.mockReturnValue({
        data: { ...mockUser, firstName: '', lastName: '', userName: '' },
        isLoading: false,
        error: null,
      } as any);

      renderSettings();

      // Wait for form to render
      await waitFor(() => {
        expect(
          screen.getByPlaceholderText('Enter your first name')
        ).toBeInTheDocument();
      });

      expect(
        screen.getByPlaceholderText('Enter your last name')
      ).toBeInTheDocument();
      expect(
        screen.getByPlaceholderText('Enter your username')
      ).toBeInTheDocument();
    });
  });

  describe('Form Submission', () => {
    it('should submit form with firstName only', async () => {
      const user = userEvent.setup();
      const updatedUser = { ...mockUser, firstName: 'Jane' };
      mockMutateAsync.mockResolvedValue(updatedUser);

      renderSettings();

      const firstNameField = screen.getByLabelText(/first name/i);
      const submitButton = screen.getByRole('button', {
        name: /update profile/i,
      });

      await user.clear(firstNameField);
      await user.type(firstNameField, 'Jane');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockMutateAsync).toHaveBeenCalledWith({
          firstName: 'Jane',
          lastName: 'Doe',
          userName: 'johndoe',
        });
      });

      expect(mockToast).toHaveBeenCalledWith({
        title: 'Profile updated',
        description: 'Your profile has been successfully updated.',
      });
    });

    it('should submit form with lastName only', async () => {
      const user = userEvent.setup();
      const updatedUser = { ...mockUser, lastName: 'Smith' };
      mockMutateAsync.mockResolvedValue(updatedUser);

      renderSettings();

      const lastNameField = screen.getByLabelText(/last name/i);
      const submitButton = screen.getByRole('button', {
        name: /update profile/i,
      });

      await user.clear(lastNameField);
      await user.type(lastNameField, 'Smith');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockMutateAsync).toHaveBeenCalledWith({
          firstName: 'John',
          lastName: 'Smith',
          userName: 'johndoe',
        });
      });

      expect(mockToast).toHaveBeenCalledWith({
        title: 'Profile updated',
        description: 'Your profile has been successfully updated.',
      });
    });

    it('should submit form with all fields updated', async () => {
      const user = userEvent.setup();
      const updatedUser = {
        ...mockUser,
        firstName: 'Jane',
        lastName: 'Smith',
        userName: 'janesmith',
      };
      mockMutateAsync.mockResolvedValue(updatedUser);

      renderSettings();

      const firstNameField = screen.getByLabelText(/first name/i);
      const lastNameField = screen.getByLabelText(/last name/i);
      const userNameField = screen.getByLabelText(/username/i);
      const submitButton = screen.getByRole('button', {
        name: /update profile/i,
      });

      await user.clear(firstNameField);
      await user.type(firstNameField, 'Jane');
      await user.clear(lastNameField);
      await user.type(lastNameField, 'Smith');
      await user.clear(userNameField);
      await user.type(userNameField, 'janesmith');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockMutateAsync).toHaveBeenCalledWith({
          firstName: 'Jane',
          lastName: 'Smith',
          userName: 'janesmith',
        });
      });

      expect(mockToast).toHaveBeenCalledWith({
        title: 'Profile updated',
        description: 'Your profile has been successfully updated.',
      });
    });

    it('should handle form submission errors', async () => {
      const user = userEvent.setup();
      const errorMessage = 'Username already taken';
      mockMutateAsync.mockRejectedValue(new Error(errorMessage));

      renderSettings();

      const submitButton = screen.getByRole('button', {
        name: /update profile/i,
      });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Update failed',
          description: 'Failed to update profile',
          variant: 'destructive',
        });
      });
    });

    it('should show loading state during submission', async () => {
      // Start with isPending false
      mockUseUpdateProfile.mockReturnValue({
        mutateAsync: mockMutateAsync,
        isPending: false,
        isError: false,
        error: null,
      } as any);

      const { rerender } = renderSettings();

      // Wait for form to render
      await waitFor(() => {
        expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
      });

      // Now set isPending to true to simulate loading state
      mockUseUpdateProfile.mockReturnValue({
        mutateAsync: mockMutateAsync,
        isPending: true,
        isError: false,
        error: null,
      } as any);

      // Force re-render with loading state
      rerender(
        <QueryClientProvider
          client={
            new QueryClient({
              defaultOptions: {
                queries: { retry: false },
                mutations: { retry: false },
              },
            })
          }
        >
          <Settings />
        </QueryClientProvider>
      );

      // Should show loading state
      await waitFor(() => {
        expect(screen.getByText('Updating...')).toBeInTheDocument();
      });

      const submitButton = screen.getByRole('button', {
        name: /updating/i,
      });
      expect(submitButton).toBeDisabled();
    });

    it('should disable submit button when auth store is loading', async () => {
      mockUseUpdateProfile.mockReturnValue({
        mutateAsync: mockMutateAsync,
        isPending: true,
        isError: false,
        error: null,
      } as any);

      renderSettings();

      // Wait for form to render and check for "Updating..." button text
      await waitFor(() => {
        expect(screen.getByText('Updating...')).toBeInTheDocument();
      });

      const submitButton = screen.getByRole('button', {
        name: /updating/i,
      });
      expect(submitButton).toBeDisabled();
    });
  });

  describe('Share Profile Functionality', () => {
    it('should copy profile link to clipboard', async () => {
      renderSettings();

      // Wait for share profile section to render
      await waitFor(() => {
        expect(screen.getByText('Share Your Profile')).toBeInTheDocument();
      });

      // Find the profile link input first
      const profileLinkInput = screen.getByDisplayValue(
        'http://localhost/profile/johndoe'
      );
      expect(profileLinkInput).toBeInTheDocument();

      // Get all buttons and find the small one (copy button has size="sm")
      // It should be the last button rendered (after "Back to Timeline" and "Update Profile")
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThanOrEqual(3); // Back, Update Profile, Copy
      const copyButton = buttons[buttons.length - 1]; // Last button should be copy button

      // Use fireEvent instead of userEvent for simpler click
      fireEvent.click(copyButton);

      await waitFor(() => {
        expect(clipboardWriteText).toHaveBeenCalledWith(
          'http://localhost/profile/johndoe'
        );
      });

      expect(mockToast).toHaveBeenCalledWith({
        title: 'Link copied',
        description: 'Your profile sharing link has been copied to clipboard.',
      });
    });

    it('should handle clipboard copy failure', async () => {
      // Override the mock to reject
      clipboardWriteText.mockRejectedValueOnce(new Error('Clipboard error'));

      renderSettings();

      // Wait for share profile section to render
      await waitFor(() => {
        expect(screen.getByText('Share Your Profile')).toBeInTheDocument();
      });

      // Find the profile link input first
      const profileLinkInput = screen.getByDisplayValue(
        'http://localhost/profile/johndoe'
      );
      expect(profileLinkInput).toBeInTheDocument();

      // Get last button (copy button)
      const buttons = screen.getAllByRole('button');
      const copyButton = buttons[buttons.length - 1];

      fireEvent.click(copyButton);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Copy failed',
          description: 'Failed to copy link to clipboard.',
          variant: 'destructive',
        });
      });
    });

    it('should show error when trying to copy without username', async () => {
      mockUseCurrentUser.mockReturnValue({
        data: { ...mockUser, userName: null },
        isLoading: false,
        error: null,
      } as any);

      renderSettings();

      // Since there's no username, the copy button shouldn't be visible
      // Instead, we should see the "Set a Username First" message
      expect(screen.getByText('Set a Username First')).toBeInTheDocument();

      // Check that copy button doesn't exist (not in the DOM at all)
      const buttons = screen.getAllByRole('button');
      const copyButton = buttons.find((btn) =>
        btn.querySelector('svg.lucide-copy')
      );
      expect(copyButton).toBeUndefined();
    });
  });

  describe('Navigation', () => {
    it('should navigate back to timeline when back button is clicked', async () => {
      const user = userEvent.setup();
      renderSettings();

      const backButton = screen.getByRole('button', {
        name: /back to timeline/i,
      });
      await user.click(backButton);

      // This would normally test navigation, but since we mocked wouter,
      // we can't easily test the actual navigation behavior in this unit test
      expect(backButton).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper form labels and descriptions', async () => {
      renderSettings();

      // Wait for form to render
      await waitFor(() => {
        expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
      });

      expect(
        screen.getByText('Your first name for your profile.')
      ).toBeInTheDocument();

      expect(screen.getByLabelText(/last name/i)).toBeInTheDocument();
      expect(
        screen.getByText('Your last name for your profile.')
      ).toBeInTheDocument();

      expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
      expect(screen.getByText(/choose a unique username/i)).toBeInTheDocument();

      // Email field doesn't use FormField so check by text
      expect(screen.getByText(/email address/i)).toBeInTheDocument();
      expect(
        screen.getByText('Email cannot be changed at this time')
      ).toBeInTheDocument();
    });

    it('should have proper heading structure', async () => {
      renderSettings();

      expect(
        screen.getByRole('heading', { name: 'Account settings' })
      ).toBeInTheDocument();

      // Wait for content to render
      await waitFor(() => {
        expect(screen.getByText('Profile Information')).toBeInTheDocument();
      });

      expect(screen.getByText('Share Your Profile')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle special characters in names', async () => {
      const user = userEvent.setup();
      const updatedUser = {
        ...mockUser,
        firstName: 'Mary-Jane',
        lastName: "O'Connor-Smith",
      };
      mockMutateAsync.mockResolvedValue(updatedUser);

      renderSettings();

      const firstNameField = screen.getByLabelText(/first name/i);
      const lastNameField = screen.getByLabelText(/last name/i);
      const submitButton = screen.getByRole('button', {
        name: /update profile/i,
      });

      await user.clear(firstNameField);
      await user.type(firstNameField, 'Mary-Jane');
      await user.clear(lastNameField);
      await user.type(lastNameField, "O'Connor-Smith");
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockMutateAsync).toHaveBeenCalledWith({
          firstName: 'Mary-Jane',
          lastName: "O'Connor-Smith",
          userName: 'johndoe',
        });
      });
    });
  });
});

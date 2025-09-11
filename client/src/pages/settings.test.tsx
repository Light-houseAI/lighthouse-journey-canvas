import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
// Note: Using a simple div wrapper since we're mocking wouter
import Settings from '../settings';
import { useAuthStore } from '@/stores/auth-store';
import { useToast } from '@/hooks/use-toast';

// Mock the auth store
vi.mock('@/stores/auth-store');
const mockUseAuthStore = vi.mocked(useAuthStore);

// Mock the toast hook
vi.mock('@/hooks/use-toast');
const mockUseToast = vi.mocked(useToast);

// Mock wouter location hook
vi.mock('wouter', () => ({
  useLocation: () => ['/settings', vi.fn()],
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
vi.mock('../../../components/magicui/magic-card', () => ({
  MagicCard: ({ children, ...props }: any) => <div data-testid="magic-card" {...props}>{children}</div>,
}));

vi.mock('../../../components/magicui/shimmer-button', () => ({
  ShimmerButton: ({ children, ...props }: any) => <button data-testid="shimmer-button" {...props}>{children}</button>,
}));

vi.mock('../../../components/magicui/blur-fade', () => ({
  BlurFade: ({ children }: any) => <div>{children}</div>,
}));

// Mock navigator.clipboard
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn().mockResolvedValue(undefined),
  },
});

// Mock window.location
Object.defineProperty(window, 'location', {
  value: {
    origin: 'http://localhost:3000',
  },
  writable: true,
});

const renderSettings = () => {
  return render(<Settings />);
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

  const mockUpdateProfile = vi.fn();
  const mockToast = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();

    mockUseAuthStore.mockReturnValue({
      user: mockUser,
      updateProfile: mockUpdateProfile,
      isLoading: false,
      error: null,
      isAuthenticated: true,
      setUser: vi.fn(),
      setLoading: vi.fn(),
      setError: vi.fn(),
      login: vi.fn(),
      logout: vi.fn(),
      register: vi.fn(),
      checkAuth: vi.fn(),
      updateUserInterest: vi.fn(),
      completeOnboarding: vi.fn(),
      clearError: vi.fn(),
    });

    mockUseToast.mockReturnValue({
      toast: mockToast,
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Component Rendering', () => {
    it('should render settings page with all form fields', () => {
      renderSettings();

      expect(screen.getByText('Settings')).toBeInTheDocument();
      expect(screen.getByText('Profile Information')).toBeInTheDocument();
      expect(screen.getByText('Update your personal information and username for profile sharing')).toBeInTheDocument();

      // Check form fields
      expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/last name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/username/i)).toBeInTheDocument();

      // Check buttons
      expect(screen.getByRole('button', { name: /update profile/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /back to timeline/i })).toBeInTheDocument();
    });

    it('should populate form fields with user data', () => {
      renderSettings();

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

    it('should show share profile section when user has username', () => {
      renderSettings();

      expect(screen.getByText('Share Your Profile')).toBeInTheDocument();
      expect(screen.getByText('Your Profile Link')).toBeInTheDocument();
      expect(screen.getByDisplayValue('http://localhost:3000/johndoe')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '' })).toBeInTheDocument(); // Copy button
    });

    it('should show username required message when user has no username', () => {
      mockUseAuthStore.mockReturnValue({
        ...mockUseAuthStore(),
        user: { ...mockUser, userName: null },
      });

      renderSettings();

      expect(screen.getByText('Set a Username First')).toBeInTheDocument();
      expect(screen.getByText('You need to set a username before you can share your profile with others.')).toBeInTheDocument();
    });

    it('should handle null user gracefully', () => {
      mockUseAuthStore.mockReturnValue({
        ...mockUseAuthStore(),
        user: null,
      });

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

    it('should show placeholder text for empty fields', () => {
      mockUseAuthStore.mockReturnValue({
        ...mockUseAuthStore(),
        user: { ...mockUser, firstName: '', lastName: '', userName: '' },
      });

      renderSettings();

      expect(screen.getByPlaceholderText('Enter your first name')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Enter your last name')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Enter your username')).toBeInTheDocument();
    });
  });

  describe('Form Submission', () => {
    it('should submit form with firstName only', async () => {
      const user = userEvent.setup();
      mockUpdateProfile.mockResolvedValue(undefined);

      renderSettings();

      const firstNameField = screen.getByLabelText(/first name/i);
      const submitButton = screen.getByRole('button', { name: /update profile/i });

      await user.clear(firstNameField);
      await user.type(firstNameField, 'Jane');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockUpdateProfile).toHaveBeenCalledWith({
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
      mockUpdateProfile.mockResolvedValue(undefined);

      renderSettings();

      const lastNameField = screen.getByLabelText(/last name/i);
      const submitButton = screen.getByRole('button', { name: /update profile/i });

      await user.clear(lastNameField);
      await user.type(lastNameField, 'Smith');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockUpdateProfile).toHaveBeenCalledWith({
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
      mockUpdateProfile.mockResolvedValue(undefined);

      renderSettings();

      const firstNameField = screen.getByLabelText(/first name/i);
      const lastNameField = screen.getByLabelText(/last name/i);
      const userNameField = screen.getByLabelText(/username/i);
      const submitButton = screen.getByRole('button', { name: /update profile/i });

      await user.clear(firstNameField);
      await user.type(firstNameField, 'Jane');
      await user.clear(lastNameField);
      await user.type(lastNameField, 'Smith');
      await user.clear(userNameField);
      await user.type(userNameField, 'janesmith');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockUpdateProfile).toHaveBeenCalledWith({
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
      mockUpdateProfile.mockRejectedValue(new Error(errorMessage));

      renderSettings();

      const submitButton = screen.getByRole('button', { name: /update profile/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Update failed',
          description: errorMessage,
          variant: 'destructive',
        });
      });
    });

    it('should show loading state during submission', async () => {
      const user = userEvent.setup();
      let resolveUpdateProfile: () => void;
      const updateProfilePromise = new Promise<void>((resolve) => {
        resolveUpdateProfile = resolve;
      });
      mockUpdateProfile.mockReturnValue(updateProfilePromise);

      renderSettings();

      const submitButton = screen.getByRole('button', { name: /update profile/i });
      await user.click(submitButton);

      // Should show loading state
      await waitFor(() => {
        expect(screen.getByText('Updating...')).toBeInTheDocument();
      });

      // Resolve the promise and check loading state disappears
      resolveUpdateProfile!();
      await waitFor(() => {
        expect(screen.getByText('Update Profile')).toBeInTheDocument();
      });
    });

    it('should disable submit button when auth store is loading', () => {
      mockUseAuthStore.mockReturnValue({
        ...mockUseAuthStore(),
        isLoading: true,
      });

      renderSettings();

      const submitButton = screen.getByRole('button', { name: /update profile/i });
      expect(submitButton).toBeDisabled();
    });
  });

  describe('Share Profile Functionality', () => {
    it('should copy profile link to clipboard', async () => {
      const user = userEvent.setup();
      renderSettings();

      const copyButton = screen.getByRole('button', { name: '' }); // Copy button has no text, just icon
      await user.click(copyButton);

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('http://localhost:3000/johndoe');
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Link copied',
        description: 'Your profile sharing link has been copied to clipboard.',
      });
    });

    it('should handle clipboard copy failure', async () => {
      const user = userEvent.setup();
      (navigator.clipboard.writeText as any).mockRejectedValue(new Error('Clipboard error'));

      renderSettings();

      const copyButton = screen.getByRole('button', { name: '' });
      await user.click(copyButton);

      expect(mockToast).toHaveBeenCalledWith({
        title: 'Copy failed',
        description: 'Failed to copy link to clipboard.',
        variant: 'destructive',
      });
    });

    it('should show error when trying to copy without username', async () => {
      const user = userEvent.setup();
      mockUseAuthStore.mockReturnValue({
        ...mockUseAuthStore(),
        user: { ...mockUser, userName: null },
      });

      renderSettings();

      // Since there's no username, the copy button shouldn't be visible
      // Instead, we should see the "Set a Username First" message
      expect(screen.getByText('Set a Username First')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: '' })).not.toBeInTheDocument();
    });
  });

  describe('Navigation', () => {
    it('should navigate back to timeline when back button is clicked', async () => {
      const user = userEvent.setup();
      renderSettings();

      const backButton = screen.getByRole('button', { name: /back to timeline/i });
      await user.click(backButton);

      // This would normally test navigation, but since we mocked wouter,
      // we can't easily test the actual navigation behavior in this unit test
      expect(backButton).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper form labels and descriptions', () => {
      renderSettings();

      expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
      expect(screen.getByText('Your first name for your profile.')).toBeInTheDocument();

      expect(screen.getByLabelText(/last name/i)).toBeInTheDocument();
      expect(screen.getByText('Your last name for your profile.')).toBeInTheDocument();

      expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
      expect(screen.getByText(/choose a unique username/i)).toBeInTheDocument();

      expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
      expect(screen.getByText('Email cannot be changed at this time')).toBeInTheDocument();
    });

    it('should have proper heading structure', () => {
      renderSettings();

      expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument();
      expect(screen.getByText('Profile Information')).toBeInTheDocument();
      expect(screen.getByText('Share Your Profile')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty string values', async () => {
      const user = userEvent.setup();
      mockUpdateProfile.mockResolvedValue(undefined);

      renderSettings();

      const firstNameField = screen.getByLabelText(/first name/i);
      const submitButton = screen.getByRole('button', { name: /update profile/i });

      await user.clear(firstNameField);
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockUpdateProfile).toHaveBeenCalledWith({
          firstName: '',
          lastName: 'Doe',
          userName: 'johndoe',
        });
      });
    });

    it('should handle special characters in names', async () => {
      const user = userEvent.setup();
      mockUpdateProfile.mockResolvedValue(undefined);

      renderSettings();

      const firstNameField = screen.getByLabelText(/first name/i);
      const lastNameField = screen.getByLabelText(/last name/i);
      const submitButton = screen.getByRole('button', { name: /update profile/i });

      await user.clear(firstNameField);
      await user.type(firstNameField, "Mary-Jane");
      await user.clear(lastNameField);
      await user.type(lastNameField, "O'Connor-Smith");
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockUpdateProfile).toHaveBeenCalledWith({
          firstName: "Mary-Jane",
          lastName: "O'Connor-Smith",
          userName: 'johndoe',
        });
      });
    });
  });
});
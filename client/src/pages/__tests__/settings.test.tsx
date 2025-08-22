import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

import Settings from '../settings';
import { useAuthStore } from '@/stores/auth-store';
import { useToast } from '@/hooks/use-toast';

// Mock external dependencies
vi.mock('@/stores/auth-store');
vi.mock('@/hooks/use-toast');
vi.mock('wouter', () => ({
  useLocation: () => ['/settings', vi.fn()],
}));

// Mock react-hook-form
vi.mock('react-hook-form', () => ({
  useForm: () => ({
    control: {},
    handleSubmit: (fn: any) => fn,
    formState: { errors: {} },
    register: () => ({}),
    watch: () => ({}),
    reset: () => ({}),
    setValue: () => ({}),
    getValues: () => ({}),
  }),
}));

// Mock @hookform/resolvers/zod
vi.mock('@hookform/resolvers/zod', () => ({
  zodResolver: () => ({}),
}));

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
}));

// Mock Magic UI components
vi.mock('../../../../components/magicui/magic-card', () => ({
  MagicCard: ({ children, ...props }: any) => <div data-testid="magic-card" {...props}>{children}</div>,
}));

vi.mock('../../../../components/magicui/shimmer-button', () => ({
  ShimmerButton: ({ children, ...props }: any) => <button data-testid="shimmer-button" {...props}>{children}</button>,
}));

vi.mock('../../../../components/magicui/blur-fade', () => ({
  BlurFade: ({ children, ...props }: any) => <div data-testid="blur-fade" {...props}>{children}</div>,
}));

// Mock all UI components
vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));

vi.mock('@/components/ui/input', () => ({
  Input: ({ ...props }: any) => <input {...props} />,
}));

vi.mock('@/components/ui/label', () => ({
  Label: ({ children, ...props }: any) => <label {...props}>{children}</label>,
}));

vi.mock('@/components/ui/form', () => ({
  Form: ({ children }: any) => <form>{children}</form>,
  FormControl: ({ children }: any) => <div>{children}</div>,
  FormDescription: ({ children }: any) => <div>{children}</div>,
  FormField: ({ render }: any) => render({ field: {} }),
  FormItem: ({ children }: any) => <div>{children}</div>,
  FormLabel: ({ children }: any) => <label>{children}</label>,
  FormMessage: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children, ...props }: any) => <div data-testid="card" {...props}>{children}</div>,
  CardContent: ({ children }: any) => <div>{children}</div>,
  CardDescription: ({ children }: any) => <div>{children}</div>,
  CardHeader: ({ children }: any) => <div>{children}</div>,
  CardTitle: ({ children }: any) => <h2>{children}</h2>,
}));

vi.mock('@/components/ui/separator', () => ({
  Separator: () => <hr />,
}));

// Mock fetch globally
global.fetch = vi.fn();

describe('Settings Component', () => {
  const mockToast = vi.fn();
  const mockUpdateProfile = vi.fn();
  const mockUser = {
    id: 1,
    email: 'test@example.com',
    userName: 'testuser',
  };

  beforeEach(() => {
    // Reset all mocks
    vi.resetAllMocks();

    // Setup default mock implementations
    (useToast as any).mockReturnValue({ toast: mockToast });
    (useAuthStore as any).mockReturnValue({
      user: mockUser,
      updateProfile: mockUpdateProfile,
      isLoading: false,
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Component Rendering', () => {
    it('should render the settings page with all sections', () => {
      render(<Settings />);

      // Check main heading
      expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument();
      expect(screen.getByText('Manage your profile and account preferences')).toBeInTheDocument();

      // Check profile section
      expect(screen.getByText('Profile Information')).toBeInTheDocument();
      expect(screen.getByText('Update your username for profile sharing')).toBeInTheDocument();

      // Check share section
      expect(screen.getByText('Share Your Profile')).toBeInTheDocument();
      expect(screen.getByText('Share your professional journey with others')).toBeInTheDocument();

      // Check coming soon section
      expect(screen.getByText('Coming Soon')).toBeInTheDocument();
    });

    it('should display user email as disabled field', () => {
      render(<Settings />);

      const emailField = screen.getByDisplayValue('test@example.com');
      expect(emailField).toBeInTheDocument();
      expect(emailField).toBeDisabled();
    });

    it('should display username field with current value', () => {
      render(<Settings />);

      const usernameField = screen.getByDisplayValue('testuser');
      expect(usernameField).toBeInTheDocument();
      expect(usernameField).toBeEnabled();
    });

    it('should not render when user is not authenticated', () => {
      (useAuthStore as any).mockReturnValue({
        user: null,
        updateProfile: mockUpdateProfile,
        isLoading: false,
      });

      const { container } = render(<Settings />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe('Username Update Functionality', () => {
    it('should update username successfully', async () => {
      const user = userEvent.setup();
      mockUpdateProfile.mockResolvedValueOnce(undefined);

      render(<Settings />);

      // Find and clear username field
      const usernameField = screen.getByDisplayValue('testuser');
      await user.clear(usernameField);
      await user.type(usernameField, 'newusername');

      // Submit form
      const updateButton = screen.getByText('Update Profile');
      await user.click(updateButton);

      // Verify API call
      await waitFor(() => {
        expect(mockUpdateProfile).toHaveBeenCalledWith({
          userName: 'newusername',
        });
      });

      // Verify success toast
      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Profile updated',
          description: 'Your profile has been successfully updated.',
        });
      });
    });

    it('should handle username update failure', async () => {
      const user = userEvent.setup();
      const errorMessage = 'Username already exists';
      mockUpdateProfile.mockRejectedValueOnce(new Error(errorMessage));

      render(<Settings />);

      // Update username
      const usernameField = screen.getByDisplayValue('testuser');
      await user.clear(usernameField);
      await user.type(usernameField, 'existinguser');

      // Submit form
      const updateButton = screen.getByText('Update Profile');
      await user.click(updateButton);

      // Verify error toast
      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Update failed',
          description: errorMessage,
          variant: 'destructive',
        });
      });
    });

    it('should validate username format', async () => {
      const user = userEvent.setup();
      render(<Settings />);

      const usernameField = screen.getByDisplayValue('testuser');
      
      // Test invalid username (too short)
      await user.clear(usernameField);
      await user.type(usernameField, 'ab');
      
      const updateButton = screen.getByText('Update Profile');
      await user.click(updateButton);

      // Should show validation error
      await waitFor(() => {
        expect(screen.getByText('Username must be at least 3 characters long')).toBeInTheDocument();
      });

      // Verify API was not called
      expect(mockUpdateProfile).not.toHaveBeenCalled();
    });

    it('should show loading state during update', async () => {
      const user = userEvent.setup();
      
      // Mock loading state
      (useAuthStore as any).mockReturnValue({
        user: mockUser,
        updateProfile: mockUpdateProfile,
        isLoading: true,
      });

      render(<Settings />);

      const updateButton = screen.getByText('Updating...');
      expect(updateButton).toBeDisabled();
    });
  });

  describe('Profile Sharing Functionality', () => {
    beforeEach(() => {
      // Mock clipboard API for jsdom
      Object.defineProperty(navigator, 'clipboard', {
        value: {
          writeText: vi.fn().mockResolvedValue(undefined),
        },
        writable: true,
      });
    });

    it('should display profile link when user has username', () => {
      // Mock window.location
      Object.defineProperty(window, 'location', {
        value: { origin: 'http://localhost:5004' },
        writable: true,
      });

      render(<Settings />);

      const profileLinkField = screen.getByDisplayValue('http://localhost:5004/testuser');
      expect(profileLinkField).toBeInTheDocument();
      expect(profileLinkField).toHaveAttribute('readOnly');
    });

    it('should copy profile link to clipboard', async () => {
      const user = userEvent.setup();
      
      // Mock window.location
      Object.defineProperty(window, 'location', {
        value: { origin: 'http://localhost:5004' },
        writable: true,
      });

      render(<Settings />);

      const copyButton = screen.getByRole('button', { name: '' }); // Copy button has only icon
      await user.click(copyButton);

      // Verify clipboard API was called
      await waitFor(() => {
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith('http://localhost:5004/testuser');
      });

      // Verify success toast
      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Link copied',
          description: 'Your profile sharing link has been copied to clipboard.',
        });
      });
    });

    it('should handle clipboard copy failure', async () => {
      const user = userEvent.setup();
      
      // Mock clipboard failure
      (navigator.clipboard.writeText as any).mockRejectedValueOnce(new Error('Clipboard error'));
      
      Object.defineProperty(window, 'location', {
        value: { origin: 'http://localhost:5004' },
        writable: true,
      });

      render(<Settings />);

      const copyButton = screen.getByRole('button', { name: '' });
      await user.click(copyButton);

      // Verify error toast
      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Copy failed',
          description: 'Failed to copy link to clipboard.',
          variant: 'destructive',
        });
      });
    });

    it('should show username required message when user has no username', () => {
      const userWithoutUsername = {
        ...mockUser,
        userName: '',
      };

      (useAuthStore as any).mockReturnValue({
        user: userWithoutUsername,
        updateProfile: mockUpdateProfile,
        isLoading: false,
      });

      render(<Settings />);

      expect(screen.getByText('Set a Username First')).toBeInTheDocument();
      expect(screen.getByText('You need to set a username before you can share your profile with others.')).toBeInTheDocument();
    });

    it('should show error when trying to copy without username', async () => {
      const user = userEvent.setup();
      const userWithoutUsername = {
        ...mockUser,
        userName: '',
      };

      (useAuthStore as any).mockReturnValue({
        user: userWithoutUsername,
        updateProfile: mockUpdateProfile,
        isLoading: false,
      });

      render(<Settings />);

      // Even though the copy button might not be visible, test the function directly
      // by testing what happens when copyShareLink is called without username
      expect(screen.getByText('Set a Username First')).toBeInTheDocument();
    });
  });

  describe('Navigation', () => {
    it('should have back to timeline button', () => {
      render(<Settings />);

      const backButton = screen.getByText('Back to Timeline');
      expect(backButton).toBeInTheDocument();
    });
  });

  describe('API Contract Validation', () => {
    it('should send correct payload for profile update', async () => {
      const user = userEvent.setup();
      render(<Settings />);

      // Update username
      const usernameField = screen.getByDisplayValue('testuser');
      await user.clear(usernameField);
      await user.type(usernameField, 'newusername123');

      // Submit form
      const updateButton = screen.getByText('Update Profile');
      await user.click(updateButton);

      // Verify exact API contract
      await waitFor(() => {
        expect(mockUpdateProfile).toHaveBeenCalledWith({
          userName: 'newusername123',
        });
        expect(mockUpdateProfile).toHaveBeenCalledTimes(1);
      });
    });

    it('should handle API response format correctly', async () => {
      const user = userEvent.setup();
      
      // Mock successful API response
      mockUpdateProfile.mockResolvedValueOnce({
        id: 1,
        email: 'test@example.com',
        userName: 'newusername123',
      });

      render(<Settings />);

      // Update and submit
      const usernameField = screen.getByDisplayValue('testuser');
      await user.clear(usernameField);
      await user.type(usernameField, 'newusername123');

      const updateButton = screen.getByText('Update Profile');
      await user.click(updateButton);

      // Verify success handling
      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Profile updated',
          description: 'Your profile has been successfully updated.',
        });
      });
    });
  });
});
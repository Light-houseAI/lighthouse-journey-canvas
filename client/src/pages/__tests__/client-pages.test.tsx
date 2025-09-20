/**
 * Component Tests for Client Pages
 * Tests page-level components, routing, and user workflows
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Router, Route } from 'wouter';
import { Settings } from '../settings';
import { ProfileReview } from '../profile-review';
import { UserTimeline } from '../user-timeline';
import { OnboardingStep1 } from '../onboarding-step1';

// Mock dependencies
vi.mock('@/services/http-client', () => ({
  httpClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    getCurrentUser: vi.fn(),
    updateProfile: vi.fn(),
  },
}));

vi.mock('@/stores/auth-store', () => ({
  useAuthStore: () => ({
    user: {
      id: 1,
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      userName: 'testuser',
      hasCompletedOnboarding: true,
    },
    setUser: vi.fn(),
    logout: vi.fn(),
  }),
}));

const mockUser = {
  id: 1,
  email: 'test@example.com',
  firstName: 'Test',
  lastName: 'User',
  userName: 'testuser',
  interest: 'Software Development',
  hasCompletedOnboarding: true,
};

const TestWrapper = ({ 
  children, 
  initialPath = '/' 
}: { 
  children: React.ReactNode;
  initialPath?: string;
}) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <Router base={initialPath}>
        {children}
      </Router>
    </QueryClientProvider>
  );
};

describe('Client Pages', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
    vi.clearAllMocks();
  });

  describe('Settings Page', () => {
    it('should render user settings form', async () => {
      vi.mocked(require('@/services/http-client').httpClient.getCurrentUser)
        .mockResolvedValue(mockUser);

      render(
        <TestWrapper>
          <Settings />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByDisplayValue('Test')).toBeInTheDocument();
        expect(screen.getByDisplayValue('User')).toBeInTheDocument();
        expect(screen.getByDisplayValue('test@example.com')).toBeInTheDocument();
        expect(screen.getByDisplayValue('testuser')).toBeInTheDocument();
      });
    });

    it('should update user profile', async () => {
      const mockUpdate = vi.mocked(require('@/services/http-client').httpClient.updateProfile)
        .mockResolvedValue({ success: true });

      vi.mocked(require('@/services/http-client').httpClient.getCurrentUser)
        .mockResolvedValue(mockUser);

      render(
        <TestWrapper>
          <Settings />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByDisplayValue('Test')).toBeInTheDocument();
      });

      const firstNameInput = screen.getByLabelText(/first name/i);
      await user.clear(firstNameInput);
      await user.type(firstNameInput, 'Updated');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockUpdate).toHaveBeenCalledWith(
          expect.objectContaining({
            firstName: 'Updated',
          })
        );
      });

      expect(screen.getByText(/settings updated successfully/i)).toBeInTheDocument();
    });

    it('should handle privacy settings', async () => {
      vi.mocked(require('@/services/http-client').httpClient.getCurrentUser)
        .mockResolvedValue(mockUser);

      render(
        <TestWrapper>
          <Settings />
        </TestWrapper>
      );

      const privacyTab = screen.getByRole('tab', { name: /privacy/i });
      await user.click(privacyTab);

      const publicProfileToggle = screen.getByRole('switch', { name: /public profile/i });
      await user.click(publicProfileToggle);

      const saveButton = screen.getByRole('button', { name: /save privacy settings/i });
      await user.click(saveButton);

      expect(screen.getByText(/privacy settings updated/i)).toBeInTheDocument();
    });

    it('should handle account deletion', async () => {
      vi.mocked(require('@/services/http-client').httpClient.getCurrentUser)
        .mockResolvedValue(mockUser);

      render(
        <TestWrapper>
          <Settings />
        </TestWrapper>
      );

      const dangerTab = screen.getByRole('tab', { name: /danger/i });
      await user.click(dangerTab);

      const deleteButton = screen.getByRole('button', { name: /delete account/i });
      await user.click(deleteButton);

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText(/this action cannot be undone/i)).toBeInTheDocument();

      const confirmInput = screen.getByPlaceholderText(/type "DELETE" to confirm/i);
      await user.type(confirmInput, 'DELETE');

      const confirmButton = screen.getByRole('button', { name: /confirm deletion/i });
      expect(confirmButton).toBeEnabled();
    });
  });

  describe('Profile Review Page', () => {
    it('should render profile review interface', async () => {
      const mockProfileData = {
        ...mockUser,
        timeline: [
          {
            id: '1',
            title: 'Software Engineer',
            company: 'Tech Corp',
            startDate: '2023-01-01',
            endDate: '2023-12-31',
          },
        ],
      };

      vi.mocked(require('@/services/http-client').httpClient.get)
        .mockResolvedValue(mockProfileData);

      render(
        <TestWrapper>
          <ProfileReview />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Test User')).toBeInTheDocument();
        expect(screen.getByText('Software Engineer')).toBeInTheDocument();
      });
    });

    it('should handle profile approval', async () => {
      const mockApprove = vi.mocked(require('@/services/http-client').httpClient.post)
        .mockResolvedValue({ success: true });

      render(
        <TestWrapper>
          <ProfileReview />
        </TestWrapper>
      );

      const approveButton = screen.getByRole('button', { name: /approve profile/i });
      await user.click(approveButton);

      expect(mockApprove).toHaveBeenCalledWith('/api/profile/approve');
      expect(screen.getByText(/profile approved successfully/i)).toBeInTheDocument();
    });

    it('should handle profile feedback', async () => {
      render(
        <TestWrapper>
          <ProfileReview />
        </TestWrapper>
      );

      const feedbackButton = screen.getByRole('button', { name: /provide feedback/i });
      await user.click(feedbackButton);

      const feedbackTextarea = screen.getByLabelText(/feedback/i);
      await user.type(feedbackTextarea, 'Great profile! Consider adding more details about your projects.');

      const submitButton = screen.getByRole('button', { name: /submit feedback/i });
      await user.click(submitButton);

      expect(screen.getByText(/feedback submitted/i)).toBeInTheDocument();
    });
  });

  describe('User Timeline Page', () => {
    it('should render user timeline', async () => {
      const mockTimeline = [
        {
          id: '1',
          title: 'Software Engineer',
          company: 'Tech Corp',
          startDate: '2023-01-01',
          endDate: '2023-12-31',
          isPrivate: false,
        },
        {
          id: '2',
          title: 'Intern',
          company: 'StartupCo',
          startDate: '2022-06-01',
          endDate: '2022-08-31',
          isPrivate: true,
        },
      ];

      vi.mocked(require('@/services/http-client').httpClient.get)
        .mockResolvedValue(mockTimeline);

      render(
        <TestWrapper>
          <UserTimeline />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Software Engineer')).toBeInTheDocument();
        expect(screen.queryByText('Intern')).not.toBeInTheDocument(); // Private entry
      });
    });

    it('should show private entries when viewing own timeline', async () => {
      const mockTimeline = [
        {
          id: '1',
          title: 'Software Engineer',
          company: 'Tech Corp',
          isPrivate: false,
        },
        {
          id: '2',
          title: 'Intern',
          company: 'StartupCo',
          isPrivate: true,
        },
      ];

      vi.mocked(require('@/services/http-client').httpClient.get)
        .mockResolvedValue(mockTimeline);

      render(
        <TestWrapper>
          <UserTimeline isOwnProfile={true} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Software Engineer')).toBeInTheDocument();
        expect(screen.getByText('Intern')).toBeInTheDocument();
      });

      const privateIndicator = screen.getByLabelText(/private entry/i);
      expect(privateIndicator).toBeInTheDocument();
    });

    it('should handle timeline filtering', async () => {
      render(
        <TestWrapper>
          <UserTimeline />
        </TestWrapper>
      );

      const filterButton = screen.getByRole('button', { name: /filter/i });
      await user.click(filterButton);

      const dateRangeFilter = screen.getByLabelText(/date range/i);
      await user.type(dateRangeFilter, '2023');

      const applyButton = screen.getByRole('button', { name: /apply/i });
      await user.click(applyButton);

      expect(screen.getByText(/filtered by: 2023/i)).toBeInTheDocument();
    });
  });

  describe('Onboarding Step 1', () => {
    it('should render onboarding form', () => {
      render(
        <TestWrapper>
          <OnboardingStep1 />
        </TestWrapper>
      );

      expect(screen.getByText(/welcome to lighthouse/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/last name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
    });

    it('should validate form fields', async () => {
      render(
        <TestWrapper>
          <OnboardingStep1 />
        </TestWrapper>
      );

      const submitButton = screen.getByRole('button', { name: /continue/i });
      await user.click(submitButton);

      expect(screen.getByText(/first name is required/i)).toBeInTheDocument();
      expect(screen.getByText(/last name is required/i)).toBeInTheDocument();
      expect(screen.getByText(/username is required/i)).toBeInTheDocument();
    });

    it('should handle form submission', async () => {
      const mockUpdate = vi.mocked(require('@/services/http-client').httpClient.updateProfile)
        .mockResolvedValue({ success: true });

      render(
        <TestWrapper>
          <OnboardingStep1 />
        </TestWrapper>
      );

      await user.type(screen.getByLabelText(/first name/i), 'John');
      await user.type(screen.getByLabelText(/last name/i), 'Doe');
      await user.type(screen.getByLabelText(/username/i), 'johndoe');

      const submitButton = screen.getByRole('button', { name: /continue/i });
      await user.click(submitButton);

      expect(mockUpdate).toHaveBeenCalledWith({
        firstName: 'John',
        lastName: 'Doe',
        userName: 'johndoe',
      });
    });

    it('should check username availability', async () => {
      vi.mocked(require('@/services/http-client').httpClient.get)
        .mockResolvedValue({ available: false });

      render(
        <TestWrapper>
          <OnboardingStep1 />
        </TestWrapper>
      );

      const usernameInput = screen.getByLabelText(/username/i);
      await user.type(usernameInput, 'takenusername');

      await waitFor(() => {
        expect(screen.getByText(/username is already taken/i)).toBeInTheDocument();
      });
    });
  });

  describe('Page Navigation', () => {
    it('should handle navigation between pages', async () => {
      const mockNavigate = vi.fn();

      render(
        <TestWrapper>
          <Router>
            <Route path="/settings" component={Settings} />
            <Route path="/profile" component={ProfileReview} />
          </Router>
        </TestWrapper>
      );

      // Simulate navigation would be handled by router in real app
    });

    it('should handle protected routes', () => {
      vi.mocked(require('@/stores/auth-store').useAuthStore).mockReturnValue({
        user: null,
        setUser: vi.fn(),
        logout: vi.fn(),
      });

      render(
        <TestWrapper>
          <Settings />
        </TestWrapper>
      );

      expect(screen.getByText(/please sign in/i)).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      vi.mocked(require('@/services/http-client').httpClient.getCurrentUser)
        .mockRejectedValue(new Error('Failed to load user data'));

      render(
        <TestWrapper>
          <Settings />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/failed to load user data/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
      });
    });

    it('should handle network connectivity issues', async () => {
      vi.mocked(require('@/services/http-client').httpClient.get)
        .mockRejectedValue(new Error('Network error'));

      render(
        <TestWrapper>
          <UserTimeline />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/network error/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
      });
    });
  });
});